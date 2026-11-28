-- Development DB: read business rows only, temporary fixtures/results; no persisted changes.
BEGIN;
DROP TABLE IF EXISTS pg_temp.dn13_results,pg_temp.dn13_fixture,pg_temp.dn13_scope,pg_temp.dn13_expected;
CREATE TEMP TABLE dn13_results(check_name text,result text,detail text) ON COMMIT PRESERVE ROWS;
CREATE TEMP TABLE dn13_fixture AS
SELECT (SELECT id FROM public.profiles WHERE role='admin' AND account_status='active' ORDER BY id LIMIT 1) AS admin_id,
 (SELECT id FROM public.profiles WHERE role='tenant' AND account_status='active' ORDER BY id LIMIT 1) AS renter_id,
 (SELECT u.id FROM public.profiles u WHERE u.role='landlord' AND u.account_status='active' ORDER BY EXISTS(SELECT 1 FROM public.properties p WHERE p.owner_id=u.id AND NOT p.is_demo) DESC,u.id LIMIT 1) AS landlord_id,
 (SELECT p.id FROM public.properties p WHERE NOT p.is_demo ORDER BY EXISTS(SELECT 1 FROM public.listing_analytics_09d1 e WHERE e.listing_id=p.id) DESC,p.id LIMIT 1) AS sample_listing,
 (SELECT started_at FROM public.analytics_start_09d1 WHERE singleton) AS tracking;
CREATE TEMP TABLE dn13_scope AS SELECT id,owner_id,is_demo FROM public.properties;
CREATE TEMP TABLE dn13_expected AS
SELECT p.id,
 (SELECT count(*) FROM public.inquiries i WHERE i.listing_id=p.id AND NOT i.is_sample AND i.first_requested_at>=(((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-6)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND i.first_requested_at<=now()) AS inquiries,
 (SELECT count(*) FROM public.listing_analytics_09d1 e WHERE e.listing_id=p.id AND e.kind='view' AND e.campaign_id IS NULL AND e.occurred_at>=greatest(f.tracking,(((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-6)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) AND e.occurred_at<=now()) AS ordinary_views,
 (SELECT count(*) FROM public.listing_analytics_09d1 e WHERE e.listing_id=p.id AND e.kind='view' AND e.campaign_id IS NOT NULL AND e.occurred_at>=greatest(f.tracking,(((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-6)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) AND e.occurred_at<=now()) AS sponsored_views,
 (SELECT count(*) FROM public.listing_analytics_09d1 e WHERE e.listing_id=p.id AND e.kind='inquiry' AND e.campaign_id IS NOT NULL AND e.occurred_at>=greatest(f.tracking,(((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-6)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) AND e.occurred_at<=now()) AS sponsored_inquiries
FROM public.properties p CROSS JOIN dn13_fixture f WHERE NOT p.is_demo;
INSERT INTO dn13_results VALUES('catalog grants',CASE WHEN NOT has_function_privilege('anon','public.danest_listing_report_10a13(uuid,integer)','EXECUTE') AND NOT has_function_privilege('anon','public.danest_report_listings_10a13()','EXECUTE') AND has_function_privilege('authenticated','public.danest_listing_report_10a13(uuid,integer)','EXECUTE') AND has_function_privilege('authenticated','public.danest_report_listings_10a13()','EXECUTE') AND NOT has_table_privilege('authenticated','public.listing_analytics_09d1','SELECT') THEN 'PASS' ELSE 'FAIL' END,'RPC grants and no direct event reads');
GRANT SELECT ON dn13_fixture,dn13_scope,dn13_expected TO authenticated;
GRANT INSERT ON dn13_results TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f record; r jsonb; opts jsonb; expected record; owned uuid; other uuid; bad boolean; msg text; s bigint; d2 jsonb;
BEGIN
 SELECT * INTO f FROM dn13_fixture;
 IF f.admin_id IS NULL OR f.sample_listing IS NULL THEN INSERT INTO dn13_results VALUES('admin daily report and source totals','SKIP','Need active admin and a non-demo listing'); ELSE
 BEGIN
 PERFORM set_config('request.jwt.claim.sub',f.admin_id::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f.admin_id,'role','authenticated')::text,true);
 opts:=public.danest_report_listings_10a13();
 IF jsonb_array_length(opts)<>(SELECT count(*) FROM dn13_scope WHERE NOT is_demo) OR EXISTS(SELECT 1 FROM jsonb_array_elements(opts) x WHERE NOT EXISTS(SELECT 1 FROM dn13_scope p WHERE p.id=(x->>'id')::uuid AND NOT p.is_demo)) THEN RAISE EXCEPTION 'Invalid admin scope'; END IF;
 r:=public.danest_listing_report_10a13(f.sample_listing,7);
 SELECT * INTO expected FROM dn13_expected WHERE id=f.sample_listing;
 IF jsonb_array_length(r->'days')<>7 OR (r->>'through')::date-(r->>'from')::date<>6 OR (r->>'listingId')::uuid<>f.sample_listing THEN RAISE EXCEPTION 'Incorrect range or listing'; END IF;
 IF (SELECT coalesce(sum((x->>'inquiries')::bigint),0) FROM jsonb_array_elements(r->'days') x)<>expected.inquiries OR (SELECT coalesce(sum((x->>'ordinaryViews')::bigint),0) FROM jsonb_array_elements(r->'days') x)<>expected.ordinary_views OR (SELECT coalesce(sum((x->>'sponsoredViews')::bigint),0) FROM jsonb_array_elements(r->'days') x)<>expected.sponsored_views OR (SELECT coalesce(sum((x->>'sponsoredInquiries')::bigint),0) FROM jsonb_array_elements(r->'days') x)<>expected.sponsored_inquiries THEN RAISE EXCEPTION 'Daily sums disagree with source'; END IF;
 IF (SELECT coalesce(sum((x->>'views')::bigint),0) FROM jsonb_array_elements(r->'campaigns') x)<>expected.sponsored_views OR (SELECT coalesce(sum((x->>'inquiries')::bigint),0) FROM jsonb_array_elements(r->'campaigns') x)<>expected.sponsored_inquiries THEN RAISE EXCEPTION 'Campaign sums disagree with source'; END IF;
 r:=public.danest_listing_report_10a13(f.sample_listing,90);
 IF jsonb_array_length(r->'days')<>90 OR jsonb_array_length(public.danest_listing_report_10a13(f.sample_listing,30)->'days')<>30 THEN RAISE EXCEPTION 'Incorrect 30/90-day range'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'days') x WHERE (x->>'day')::date < (f.tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (x->>'ordinaryViews' IS NOT NULL OR x->>'sponsoredViews' IS NOT NULL OR x->>'ordinaryInquiries' IS NOT NULL OR x->>'sponsoredInquiries' IS NOT NULL)) THEN RAISE EXCEPTION 'Pre-tracking counts must be null'; END IF;
 bad:=false; BEGIN PERFORM public.danest_listing_report_10a13(f.sample_listing,31); EXCEPTION WHEN invalid_parameter_value THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Invalid period accepted'; END IF;
 -- D2 aggregate and the sum over source rows must agree (same transaction time).
 d2:=public.danest_admin_period_report_09d2(7);
 SELECT coalesce(sum((x->>'ordinaryViews')::bigint),0) INTO s FROM jsonb_array_elements(d2->'days') x;
 IF s<>(SELECT coalesce(sum(ordinary_views),0) FROM dn13_expected) THEN RAISE EXCEPTION 'D2 aggregate differs from source'; END IF;
 INSERT INTO dn13_results VALUES('admin daily report and source totals','PASS','7/30/90 days, source and campaign totals, pre-tracking null, D2 ordinary-view total');
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; INSERT INTO dn13_results VALUES('admin daily report and source totals','FAIL',msg); END; END IF;
 IF f.landlord_id IS NULL THEN INSERT INTO dn13_results VALUES('landlord option isolation','SKIP','No active landlord'); INSERT INTO dn13_results VALUES('landlord cross-listing denial','SKIP','No active landlord'); ELSE
 BEGIN
 PERFORM set_config('request.jwt.claim.sub',f.landlord_id::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f.landlord_id,'role','authenticated')::text,true);
 opts:=public.danest_report_listings_10a13();
 IF jsonb_array_length(opts)<>(SELECT count(*) FROM dn13_scope WHERE NOT is_demo AND owner_id=f.landlord_id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(opts) x WHERE NOT EXISTS(SELECT 1 FROM dn13_scope p WHERE p.id=(x->>'id')::uuid AND NOT p.is_demo AND p.owner_id=f.landlord_id)) THEN RAISE EXCEPTION 'Landlord option leak'; END IF;
 SELECT id INTO owned FROM dn13_scope WHERE NOT is_demo AND owner_id=f.landlord_id LIMIT 1;
 IF owned IS NOT NULL THEN r:=public.danest_listing_report_10a13(owned,7); IF (r->>'listingId')::uuid IS DISTINCT FROM owned THEN RAISE EXCEPTION 'Own listing report mismatch'; END IF; END IF;
 INSERT INTO dn13_results VALUES('landlord option isolation',CASE WHEN owned IS NULL THEN 'SKIP' ELSE 'PASS' END,CASE WHEN owned IS NULL THEN 'Empty ownership scope checked; own report not exercised' ELSE 'Own report and scoped options' END);
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; INSERT INTO dn13_results VALUES('landlord option isolation','FAIL',msg); END;
 BEGIN
 SELECT id INTO other FROM dn13_scope WHERE NOT is_demo AND owner_id IS DISTINCT FROM f.landlord_id LIMIT 1;
 IF other IS NULL THEN INSERT INTO dn13_results VALUES('landlord cross-listing denial','SKIP','No non-owned real listing'); ELSE
 bad:=false; BEGIN PERFORM public.danest_listing_report_10a13(other,7); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Cross-listing report allowed'; END IF;
 INSERT INTO dn13_results VALUES('landlord cross-listing denial','PASS','Non-owned report denied'); END IF;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; INSERT INTO dn13_results VALUES('landlord cross-listing denial','FAIL',msg); END; END IF;
 IF f.renter_id IS NULL THEN INSERT INTO dn13_results VALUES('renter report denial','SKIP','No active renter'); ELSE BEGIN
 PERFORM set_config('request.jwt.claim.sub',f.renter_id::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f.renter_id,'role','authenticated')::text,true);
 bad:=false; BEGIN PERFORM public.danest_report_listings_10a13(); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Renter options allowed'; END IF;
 bad:=false; BEGIN PERFORM public.danest_listing_report_10a13(f.sample_listing,7); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Renter report allowed'; END IF;
 INSERT INTO dn13_results VALUES('renter report denial','PASS','Both RPC role checks');
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; INSERT INTO dn13_results VALUES('renter report denial','FAIL',msg); END; END IF;
END $$;
RESET ROLE;
COMMIT;
SELECT * FROM dn13_results ORDER BY check_name;
