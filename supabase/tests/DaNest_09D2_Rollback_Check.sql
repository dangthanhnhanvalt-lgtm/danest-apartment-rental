-- Development database only. Config/audit changes are rolled back in a subtransaction.
BEGIN;
DROP TABLE IF EXISTS pg_temp.dn_d2_results;
CREATE TEMP TABLE dn_d2_results(check_name text,result text,detail text) ON COMMIT PRESERVE ROWS;
INSERT INTO dn_d2_results SELECT 'catalog grants',CASE WHEN NOT has_function_privilege('anon','public.danest_admin_period_report_09d2(integer)','EXECUTE') AND NOT has_function_privilege('anon','public.danest_save_pilot_config_09d2(integer,integer,integer,text)','EXECUTE') AND NOT has_table_privilege('authenticated','public.admin_settings','UPDATE') THEN 'PASS' ELSE 'FAIL' END,'No public report/config write or direct settings update';
DO $$
DECLARE a uuid; u uuid; r jsonb; c jsonb; reason_text text:='D2 rollback '||gen_random_uuid()::text; msg text; ro text; bad boolean;
BEGIN
 SELECT id INTO a FROM public.profiles WHERE role='admin' AND account_status='active' LIMIT 1;
 IF a IS NULL THEN INSERT INTO dn_d2_results VALUES('admin report and settings','SKIP','No active admin'); ELSE
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',a::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  r:=public.danest_admin_period_report_09d2(7);
  IF jsonb_array_length(r->'days') IS DISTINCT FROM 7 OR (r->>'through')::date-(r->>'from')::date<>6 THEN RAISE EXCEPTION 'Incorrect 7 day range'; END IF;
  IF jsonb_array_length(public.danest_admin_period_report_09d2(30)->'days') IS DISTINCT FROM 30 OR jsonb_array_length(public.danest_admin_period_report_09d2(90)->'days') IS DISTINCT FROM 90 THEN RAISE EXCEPTION 'Incorrect 30/90 day range'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'days') x WHERE (x->>'day')::date < ((r->>'trackingStartedAt')::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (x->>'ordinaryViews' IS NOT NULL OR x->>'sponsoredViews' IS NOT NULL)) THEN RAISE EXCEPTION 'Pre-tracking values must be null'; END IF;
  bad:=false; BEGIN PERFORM public.danest_admin_period_report_09d2(100); EXCEPTION WHEN OTHERS THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Invalid period accepted'; END IF;
  c:=public.danest_pilot_config_09d2();
  PERFORM public.danest_save_pilot_config_09d2(610000,210,3100,reason_text);
  c:=public.danest_pilot_config_09d2();
  IF (c->>'monthlyFeeVnd')::integer IS DISTINCT FROM 610000 OR (c->>'priceMinUsd')::integer IS DISTINCT FROM 210 OR (c->>'priceMaxUsd')::integer IS DISTINCT FROM 3100 THEN RAISE EXCEPTION 'Config mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_log WHERE action='pilot-config-updated' AND actor_id=a AND reason=reason_text AND old_values IS NOT NULL AND new_values IS NOT NULL) THEN RAISE EXCEPTION 'Missing audit'; END IF;
  bad:=false; BEGIN PERFORM public.danest_save_pilot_config_09d2(610000,3100,210,reason_text); EXCEPTION WHEN OTHERS THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Invalid range accepted'; END IF;
  RAISE EXCEPTION USING ERRCODE='P0902',MESSAGE='rollback successful tests';
 EXCEPTION WHEN SQLSTATE 'P0902' THEN INSERT INTO dn_d2_results VALUES('admin report and settings','PASS','7/30/90 days, pre-tracking null, validation, saved settings and audit; rolled back'); WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; INSERT INTO dn_d2_results VALUES('admin report and settings','FAIL',msg); END;
 END IF;
 FOREACH ro IN ARRAY ARRAY['tenant','landlord'] LOOP
  SELECT id INTO u FROM public.profiles WHERE role=ro AND account_status='active' LIMIT 1;
  IF u IS NULL THEN INSERT INTO dn_d2_results VALUES(ro||' report/config denial','SKIP','No active account'); CONTINUE; END IF;
  BEGIN
   PERFORM set_config('request.jwt.claim.sub',u::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
   bad:=false; BEGIN PERFORM public.danest_admin_period_report_09d2(7); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Non-admin report allowed'; END IF;
   bad:=false; BEGIN PERFORM public.danest_save_pilot_config_09d2(610000,NULL,NULL,reason_text); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Non-admin config write allowed'; END IF;
   IF ro='landlord' THEN c:=public.danest_pilot_config_09d2(); IF c->>'priceMinUsd' IS NOT NULL OR c->>'priceMaxUsd' IS NOT NULL OR c->>'monthlyFeeVnd' IS NULL THEN RAISE EXCEPTION 'Unexpected landlord config'; END IF;
   ELSE bad:=false; BEGIN PERFORM public.danest_pilot_config_09d2(); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Renter config access allowed'; END IF; END IF;
   RAISE EXCEPTION USING ERRCODE='P0902',MESSAGE='rollback';
  EXCEPTION WHEN SQLSTATE 'P0902' THEN INSERT INTO dn_d2_results VALUES(ro||' report/config denial','PASS','Role guards enforced'); WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; INSERT INTO dn_d2_results VALUES(ro||' report/config denial','FAIL',msg); END;
 END LOOP;
END $$;
COMMIT;
SELECT * FROM dn_d2_results;
