-- DEV ONLY. No external webhooks. Run before enabling the mail worker; pause it if enabled.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE dn14_results(check_name text,result text,detail text) ON COMMIT DROP;
INSERT INTO dn14_results SELECT 'catalog grants',CASE WHEN NOT has_table_privilege('authenticated','public.email_outbox_10a14','SELECT,INSERT,UPDATE,DELETE') AND NOT has_function_privilege('anon','public.danest_email_preference_10a14(uuid,boolean)','EXECUTE') AND NOT has_function_privilege('authenticated','public.danest_claim_email_10a14()','EXECUTE') AND NOT has_function_privilege('authenticated','public.danest_finish_email_10a14(uuid,uuid,text,text)','EXECUTE') AND has_function_privilege('service_role','public.danest_claim_email_10a14()','EXECUTE') AND has_function_privilege('service_role','public.danest_finish_email_10a14(uuid,uuid,text,text)','EXECUTE') THEN 'PASS' ELSE 'FAIL' END,'No direct client table access or worker RPCs';
DO $$
DECLARE a uuid; ad uuid; n1 uuid; n2 uuid; n3 uuid; v_lease uuid:=gen_random_uuid(); r jsonb; denied boolean;
BEGIN
 SELECT p.id INTO a FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.role IN ('tenant','landlord') AND p.account_status='active' AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL AND u.email<>'' AND (SELECT count(*) FROM public.email_outbox_10a14 q WHERE q.recipient_id=p.id AND q.created_at>now()-interval '1 hour')<18 LIMIT 1;
 SELECT id INTO ad FROM public.profiles WHERE role='admin' AND account_status='active' LIMIT 1;
 IF a IS NULL THEN
  INSERT INTO dn14_results VALUES('self preference and cross-account denial','SKIP','Need eligible confirmed account below mail cap'),('queue opt-in and no backfill','SKIP','Need eligible confirmed account'),('worker lease and retry','SKIP','Need test queue item'),('opt-out skips pending','SKIP','Need test queue item');
 ELSE
  BEGIN
   UPDATE public.profiles SET email_notices_10a14=false WHERE id=a;
   INSERT INTO public.notifications(recipient_id,type,payload) VALUES(a,'availability-reminder','{"test":"rollback only"}') RETURNING id INTO n1;
   IF EXISTS(SELECT 1 FROM public.email_outbox_10a14 WHERE notification_id=n1) THEN RAISE EXCEPTION 'Opt-out queued email'; END IF;
   PERFORM set_config('request.jwt.claim.sub',a::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
   r:=public.danest_email_preference_10a14(a,true);
   IF NOT coalesce((r->>'enabled')::boolean,false) THEN RAISE EXCEPTION 'Preference not enabled'; END IF;
   denied:=false;BEGIN PERFORM public.danest_email_preference_10a14(gen_random_uuid(),true);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;IF NOT denied THEN RAISE EXCEPTION 'Cross-account preference allowed';END IF;
   denied:=false;BEGIN PERFORM public.danest_email_status_10a14();EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;IF NOT denied THEN RAISE EXCEPTION 'Non-admin status allowed';END IF;
   EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
   INSERT INTO dn14_results VALUES('self preference and cross-account denial','PASS','Self opt-in, other account denied, non-admin status denied');
   INSERT INTO public.notifications(recipient_id,type,payload) VALUES(a,'availability-reminder','{"test":"rollback only"}') RETURNING id INTO n2;
   INSERT INTO public.notifications(recipient_id,type,payload) VALUES(a,'report-resolved','{"test":"rollback only"}') RETURNING id INTO n3;
   IF NOT EXISTS(SELECT 1 FROM public.email_outbox_10a14 WHERE notification_id=n2 AND status='pending') OR EXISTS(SELECT 1 FROM public.email_outbox_10a14 WHERE notification_id IN(n1,n3)) THEN RAISE EXCEPTION 'Queue eligibility mismatch'; END IF;
   INSERT INTO dn14_results VALUES('queue opt-in and no backfill','PASS','New allowed event only; old and unsupported event not queued');
   -- Exercise finish on this fixture only. No actual claim of preexisting work or HTTP calls.
   UPDATE public.email_outbox_10a14 SET status='sending',attempts=1,lease_id=v_lease,lease_until=now()+interval '3 minutes' WHERE notification_id=n2;
   IF public.danest_finish_email_10a14(n2,gen_random_uuid(),'retry',NULL) THEN RAISE EXCEPTION 'Wrong lease accepted'; END IF;
   IF NOT public.danest_finish_email_10a14(n2,v_lease,'retry',NULL) THEN RAISE EXCEPTION 'Valid lease rejected'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.email_outbox_10a14 WHERE notification_id=n2 AND status='pending' AND next_attempt_at>now() AND lease_id IS NULL) THEN RAISE EXCEPTION 'Retry state invalid';END IF;
   INSERT INTO dn14_results VALUES('worker lease and retry','PASS','Wrong lease rejected; valid lease schedules retry (fixture only)');
   PERFORM set_config('request.jwt.claim.sub',a::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
   r:=public.danest_email_preference_10a14(a,false);EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
   IF NOT EXISTS(SELECT 1 FROM public.email_outbox_10a14 WHERE notification_id=n2 AND status='skipped' AND result_code='opt_out') THEN RAISE EXCEPTION 'Opt-out did not skip pending item'; END IF;
   INSERT INTO dn14_results VALUES('opt-out skips pending','PASS','Queued fixture cancelled');
  EXCEPTION WHEN OTHERS THEN EXECUTE 'RESET ROLE'; INSERT INTO dn14_results VALUES('queue and preference workflow','FAIL',SQLSTATE||': '||SQLERRM); END;
 END IF;
 IF ad IS NULL THEN INSERT INTO dn14_results VALUES('admin aggregate status','SKIP','Need active admin'); ELSE
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',ad::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ad,'role','authenticated')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
  r:=public.danest_email_status_10a14();EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
  IF NOT (r ?& ARRAY['pending','sending','accepted','failed','skipped']) THEN RAISE EXCEPTION 'Missing aggregate'; END IF;
  INSERT INTO dn14_results VALUES('admin aggregate status','PASS','Counts only; no email addresses');
 EXCEPTION WHEN OTHERS THEN EXECUTE 'RESET ROLE';INSERT INTO dn14_results VALUES('admin aggregate status','FAIL',SQLSTATE||': '||SQLERRM);END;END IF;
END $$;
SELECT * FROM dn14_results ORDER BY check_name;
ROLLBACK;
