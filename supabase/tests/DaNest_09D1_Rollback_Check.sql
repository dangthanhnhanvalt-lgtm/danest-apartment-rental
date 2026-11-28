-- Run in development SQL Editor as postgres, not in a browser. All test events roll back.
BEGIN;
DROP TABLE IF EXISTS pg_temp.dn_d1_results;
CREATE TEMP TABLE dn_d1_results(check_name text,result text,detail text) ON COMMIT PRESERVE ROWS;
INSERT INTO dn_d1_results SELECT 'private event storage',CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid='public.listing_analytics_09d1'::regclass) AND NOT has_table_privilege('anon','public.listing_analytics_09d1','SELECT') AND NOT has_table_privilege('authenticated','public.listing_analytics_09d1','SELECT,INSERT,UPDATE,DELETE') THEN 'PASS' ELSE 'FAIL' END,'RLS and no client direct table access';
INSERT INTO dn_d1_results SELECT 'RPC grants',CASE WHEN has_function_privilege('anon','public.danest_record_view_09d1(text,uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.danest_promotion_metrics_09d1()','EXECUTE') AND NOT has_function_privilege('authenticated','public.danest_eligible_campaign_09d1(uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.danest_track_inquiry_09d1()','EXECUTE') THEN 'PASS' ELSE 'FAIL' END,'Only view submission exposed to guests';
DO $$
DECLARE l uuid; s text; own uuid; other_owner uuid; tok uuid:=gen_random_uuid(); n bigint; m jsonb; err text;
BEGIN
 SELECT p.id,p.source_id,p.owner_id INTO l,s,own FROM public.properties p JOIN public.profiles u ON u.id=p.owner_id WHERE p.title ILIKE 'TEST %' AND p.status='published' AND NOT p.is_demo AND u.role='landlord' AND u.account_status='active' AND p.source_id IS NOT NULL ORDER BY p.id LIMIT 1;
 IF l IS NULL THEN INSERT INTO dn_d1_results VALUES('view dedup / owner metrics','SKIP','No published non-demo TEST listing with active owner'); RETURN; END IF;
 BEGIN
  PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','{}',true);
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Cannot emulate guest'; END IF;
  IF NOT public.danest_record_view_09d1(s,tok) THEN RAISE EXCEPTION 'First view not counted'; END IF;
  IF public.danest_record_view_09d1(s,tok) THEN RAISE EXCEPTION 'Deduplication failed'; END IF;
  IF public.danest_record_view_09d1('d1-nonexistent-'||tok::text,tok) THEN RAISE EXCEPTION 'Unknown listing was counted'; END IF;
  SELECT count(*) INTO n FROM public.listing_analytics_09d1 WHERE listing_id=l AND kind='view';
  PERFORM set_config('request.jwt.claim.sub',own::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
  IF public.danest_record_view_09d1(s,gen_random_uuid()) THEN RAISE EXCEPTION 'Landlord view counted'; END IF;
  m:=public.danest_landlord_kpis();
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'listings') x WHERE x->>'listing_id'=l::text AND (x->>'views')::bigint=n) THEN RAISE EXCEPTION 'Owner aggregate mismatch'; END IF;
  SELECT id INTO other_owner FROM public.profiles WHERE role='landlord' AND account_status='active' AND id<>own LIMIT 1;
  IF other_owner IS NOT NULL THEN
   PERFORM set_config('request.jwt.claim.sub',other_owner::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_owner,'role','authenticated')::text,true);
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.danest_landlord_kpis()->'listings') x WHERE x->>'listing_id'=l::text) THEN RAISE EXCEPTION 'Cross-owner aggregate exposure'; END IF;
  END IF;
  RAISE EXCEPTION USING ERRCODE='P0901',MESSAGE='rollback successful test';
 EXCEPTION WHEN SQLSTATE 'P0901' THEN INSERT INTO dn_d1_results VALUES('view dedup / owner metrics','PASS','Guest counted once; invalid listing and landlord excluded; owner KPI matches'),('cross-owner KPI',CASE WHEN other_owner IS NULL THEN 'SKIP' ELSE 'PASS' END,CASE WHEN other_owner IS NULL THEN 'No second active landlord' ELSE 'Other owner cannot see TEST listing KPI' END);
 WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT; INSERT INTO dn_d1_results VALUES('view dedup / owner metrics','FAIL',err);
 END;
END $$;
COMMIT;
SELECT * FROM dn_d1_results;
