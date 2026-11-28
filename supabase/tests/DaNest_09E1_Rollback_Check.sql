-- Development DB only: role checks with synthetic JWT claims; no permanent test edits.
BEGIN;
DROP TABLE IF EXISTS pg_temp.dn_e1_results;
CREATE TEMP TABLE dn_e1_results(check_name text,result text,detail text) ON COMMIT PRESERVE ROWS;
INSERT INTO dn_e1_results SELECT 'catalog grants',CASE WHEN NOT has_function_privilege('anon','public.danest_my_renter_profile_09e1(uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.danest_save_renter_profile_09e1(uuid,text,text)','EXECUTE') AND NOT has_function_privilege('anon','public.danest_admin_account_emails_09e1(uuid[])','EXECUTE') AND NOT has_table_privilege('authenticated','public.profiles','UPDATE') THEN 'PASS' ELSE 'FAIL' END,'Anonymous denied; no direct profile write';
DO $$
DECLARE renter_id uuid; other_id uuid; admin_id uuid; rr jsonb; denied boolean; err text; u uuid;
BEGIN
 SELECT id INTO renter_id FROM public.profiles WHERE role='tenant' AND account_status='active' LIMIT 1;
 SELECT id INTO other_id FROM public.profiles WHERE id IS DISTINCT FROM renter_id LIMIT 1;
 SELECT id INTO admin_id FROM public.profiles WHERE role='admin' AND account_status='active' LIMIT 1;
 IF renter_id IS NULL THEN INSERT INTO dn_e1_results VALUES('renter profile','SKIP','No active renter'); ELSE
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',renter_id::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',renter_id,'role','authenticated')::text,true);
  rr:=public.danest_save_renter_profile_09e1(renter_id,'E1 rollback test','0900000000');
  IF rr->>'name' IS DISTINCT FROM 'E1 rollback test' OR rr->>'phone' IS DISTINCT FROM '0900000000' THEN RAISE EXCEPTION 'Profile response mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_log WHERE actor_id=renter_id AND action='renter-profile-updated') THEN RAISE EXCEPTION 'Missing audit'; END IF;
  denied:=false; BEGIN PERFORM public.danest_admin_account_emails_09e1(ARRAY[renter_id]); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END; IF NOT denied THEN RAISE EXCEPTION 'Renter can read admin emails'; END IF;
  denied:=false; BEGIN PERFORM public.danest_save_renter_profile_09e1(renter_id,'x',''); EXCEPTION WHEN OTHERS THEN denied:=true; END; IF NOT denied THEN RAISE EXCEPTION 'Invalid name accepted'; END IF;
  RAISE EXCEPTION USING ERRCODE='P09E1',MESSAGE='rollback';
 EXCEPTION WHEN SQLSTATE 'P09E1' THEN INSERT INTO dn_e1_results VALUES('renter profile','PASS','Own save/read, invalid name, audit, admin email denial; rolled back'); WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT; INSERT INTO dn_e1_results VALUES('renter profile','FAIL',err); END;
 END IF;
 IF renter_id IS NULL OR other_id IS NULL THEN INSERT INTO dn_e1_results VALUES('cross-account profile','SKIP','Need two accounts'); ELSE
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',renter_id::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',renter_id,'role','authenticated')::text,true);
  denied:=false; BEGIN PERFORM public.danest_my_renter_profile_09e1(other_id); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END; IF NOT denied THEN RAISE EXCEPTION 'Cross-account read allowed'; END IF;
  denied:=false; BEGIN PERFORM public.danest_save_renter_profile_09e1(other_id,'E1 test',''); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END; IF NOT denied THEN RAISE EXCEPTION 'Cross-account write allowed'; END IF;
  RAISE EXCEPTION USING ERRCODE='P09E1',MESSAGE='rollback';
 EXCEPTION WHEN SQLSTATE 'P09E1' THEN INSERT INTO dn_e1_results VALUES('cross-account profile','PASS','Other account denied'); WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT; INSERT INTO dn_e1_results VALUES('cross-account profile','FAIL',err); END;
 END IF;
 IF admin_id IS NULL THEN INSERT INTO dn_e1_results VALUES('admin emails','SKIP','No active admin'); ELSE
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  SELECT user_id INTO u FROM public.danest_admin_account_emails_09e1(ARRAY[admin_id]); IF u IS DISTINCT FROM admin_id THEN RAISE EXCEPTION 'Admin lookup missing'; END IF;
  denied:=false; BEGIN PERFORM public.danest_save_renter_profile_09e1(admin_id,'E1 test',''); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END; IF NOT denied THEN RAISE EXCEPTION 'Admin can use renter save'; END IF;
  RAISE EXCEPTION USING ERRCODE='P09E1',MESSAGE='rollback';
 EXCEPTION WHEN SQLSTATE 'P09E1' THEN INSERT INTO dn_e1_results VALUES('admin emails','PASS','Admin lookup works; renter save denied'); WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT; INSERT INTO dn_e1_results VALUES('admin emails','FAIL',err); END;
 END IF;
END $$;
COMMIT;
SELECT * FROM dn_e1_results;
