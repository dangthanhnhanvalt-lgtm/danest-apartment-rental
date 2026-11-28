-- DEVELOPMENT ONLY. Run the ENTIRE file in one SQL Editor query as postgres.
-- Synthetic role claims + SET LOCAL ROLE exercise PostgreSQL privileges/RLS;
-- not a real JWT, HTTP, Storage download, or Edge Function test.
-- Temporary witness rows on a TEST listing and all mutations are rolled back.
-- Never run on a live production project; ensure no external DB webhooks on these tables.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
CREATE TEMP TABLE dn_e2_results(check_name text, result text, detail text) ON COMMIT DROP;
CREATE TEMP TABLE dn_e2_cases(label text, actor uuid, db_role text, suspend_actor boolean, mode text, statement text, missing text) ON COMMIT DROP;
INSERT INTO dn_e2_results
SELECT 'RLS on all public tables',CASE WHEN NOT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) THEN 'PASS' ELSE 'FAIL' END,'Catalog only'
UNION ALL SELECT 'two private buckets',CASE WHEN count(*)=2 AND bool_and(NOT public) THEN 'PASS' ELSE 'FAIL' END,'Bucket metadata only' FROM storage.buckets WHERE id IN ('listing-images','verification-evidence')
UNION ALL SELECT 'raw listing and direct audit writes denied',CASE WHEN NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated']) r WHERE has_column_privilege(r,'public.properties','listing_data','SELECT') OR has_any_column_privilege(r,'public.audit_log','UPDATE') OR has_table_privilege(r,'public.audit_log','DELETE') OR has_any_column_privilege(r,'public.audit_log','INSERT')) THEN 'PASS' ELSE 'FAIL' END,'Catalog'
UNION ALL SELECT 'maintenance and evidence delivery server only',CASE WHEN NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated']) r WHERE has_function_privilege(r,'public.danest_run_maintenance(boolean)','EXECUTE') OR has_function_privilege(r,'public.danest_authorize_evidence_access(uuid,uuid)','EXECUTE') OR has_function_privilege(r,'public.danest_record_evidence_delivery(uuid,uuid)','EXECUTE')) THEN 'PASS' ELSE 'FAIL' END,'Catalog'
UNION ALL SELECT 'analytics direct access denied',CASE WHEN NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated']) r WHERE has_any_column_privilege(r,'public.listing_analytics_09d1','SELECT') OR has_any_column_privilege(r,'public.listing_analytics_09d1','INSERT') OR has_any_column_privilege(r,'public.listing_analytics_09d1','UPDATE') OR has_table_privilege(r,'public.listing_analytics_09d1','DELETE')) THEN 'PASS' ELSE 'FAIL' END,'Catalog';
DO $$
DECLARE
 p uuid; own uuid; tenant_a uuid; tenant_b uuid; landlord_b uuid; admin_a uuid;
 iq uuid; msg uuid; nt uuid; ev uuid; log_id uuid; other_private uuid;
BEGIN
 SELECT l.id,l.owner_id INTO p,own FROM public.properties l JOIN public.profiles u ON u.id=l.owner_id
 WHERE l.title LIKE 'TEST %' AND NOT l.is_demo AND l.status='published' AND l.availability='available' AND u.role='landlord' AND u.account_status='active' ORDER BY l.id LIMIT 1;
 SELECT id INTO tenant_a FROM public.profiles WHERE role='tenant' AND account_status='active' ORDER BY id LIMIT 1;
 SELECT id INTO tenant_b FROM public.profiles WHERE role='tenant' AND account_status='active' AND id IS DISTINCT FROM tenant_a ORDER BY id LIMIT 1;
 SELECT id INTO landlord_b FROM public.profiles WHERE role='landlord' AND account_status='active' AND id IS DISTINCT FROM own ORDER BY id LIMIT 1;
 SELECT id INTO admin_a FROM public.profiles WHERE role='admin' AND account_status='active' ORDER BY id LIMIT 1;
 SELECT id INTO ev FROM storage.objects WHERE bucket_id='verification-evidence' ORDER BY id LIMIT 1;
 SELECT id INTO log_id FROM public.audit_log ORDER BY id LIMIT 1;
 SELECT id INTO other_private FROM public.properties WHERE status<>'published' AND owner_id IS DISTINCT FROM landlord_b ORDER BY id LIMIT 1;
 IF p IS NOT NULL AND tenant_a IS NOT NULL THEN
  BEGIN
   INSERT INTO public.inquiries(listing_id,tenant_id,type,message,is_sample) VALUES(p,tenant_a,'question','E2 rollback fixture',true) RETURNING id INTO iq;
   INSERT INTO public.inquiry_messages(inquiry_id,sender_id,body) VALUES(iq,tenant_a,'E2 rollback fixture') RETURNING id INTO msg;
   INSERT INTO public.notifications(recipient_id,inquiry_id,type,payload) VALUES(tenant_a,iq,'inquiry-replied','{"event":"message"}'::jsonb) RETURNING id INTO nt;
   INSERT INTO public.saved_apartments(user_id,listing_id) VALUES(tenant_a,p) ON CONFLICT DO NOTHING;
   INSERT INTO dn_e2_results VALUES('test witness preparation','PASS','Temporary inquiry/message/notice/saved; transaction rollback');
  EXCEPTION WHEN OTHERS THEN
   iq:=NULL;msg:=NULL;nt:=NULL;
   INSERT INTO dn_e2_results VALUES('test witness preparation','FAIL','Fixture SQLSTATE '||SQLSTATE);
  END;
 ELSE INSERT INTO dn_e2_results VALUES('test witness preparation','SKIP','Need published available TEST listing with active owner and active renter'); END IF;
 -- mode denied: exactly SQLSTATE 42501; hidden: true or privilege denial; true: true only.
 INSERT INTO dn_e2_cases VALUES
 ('guest admin listing RPC',NULL,'anon',false,'denied','SELECT public.danest_read_listings_08a(''admin'',0,1) IS NOT NULL',NULL),
 ('guest owner listing RPC',NULL,'anon',false,'denied','SELECT public.danest_read_listings_08a(''owner'',0,1) IS NOT NULL',NULL),
 ('guest published only',NULL,'anon',false,'true','SELECT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.danest_read_listings_08a(''public'',0,100)) r WHERE r->>''status'' IS DISTINCT FROM ''published'') AND jsonb_array_length(public.danest_read_listings_08a(''public'',0,100))>0',NULL),
 ('guest raw JSON',NULL,'anon',false,'denied','SELECT listing_data IS NOT NULL FROM public.properties LIMIT 1',NULL),
 ('renter own inquiry',tenant_a,'authenticated',false,'true',format('SELECT EXISTS(SELECT 1 FROM public.inquiries WHERE id=%L::uuid)',iq),CASE WHEN tenant_a IS NULL OR iq IS NULL THEN 'Need test inquiry' END),
 ('renter other inquiry',tenant_b,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.inquiries WHERE id=%L::uuid)',iq),CASE WHEN tenant_b IS NULL OR iq IS NULL THEN 'Need second active renter and test inquiry' END),
 ('renter other message',tenant_b,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.inquiry_messages WHERE id=%L::uuid)',msg),CASE WHEN tenant_b IS NULL OR msg IS NULL THEN 'Need second renter and message' END),
 ('renter other notification',tenant_b,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.notifications WHERE id=%L::uuid)',nt),CASE WHEN tenant_b IS NULL OR nt IS NULL THEN 'Need second renter and notice' END),
 ('renter other saved',tenant_b,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.saved_apartments WHERE user_id=%L::uuid AND listing_id=%L::uuid)',tenant_a,p),CASE WHEN tenant_b IS NULL OR iq IS NULL THEN 'Need second renter and saved witness' END),
 ('renter other message RPC',tenant_b,'authenticated',false,'denied',format('SELECT public.danest_send_inquiry_message(%L::uuid,''E2 denied'') IS NOT NULL',iq),CASE WHEN tenant_b IS NULL OR iq IS NULL THEN 'Need second renter and test inquiry' END),
 ('renter other contact RPC',tenant_b,'authenticated',false,'denied',format('SELECT public.danest_get_inquiry_contact(%L::uuid) IS NOT NULL',iq),CASE WHEN tenant_b IS NULL OR iq IS NULL THEN 'Need second renter and test inquiry' END),
 ('renter other notice write RPC',tenant_b,'authenticated',false,'true',format('SELECT public.danest_mark_notification_read(%L::uuid)=false',nt),CASE WHEN tenant_b IS NULL OR nt IS NULL THEN 'Need second renter and notice' END),
 ('renter foreign saved insert',tenant_b,'authenticated',false,'denied',format('INSERT INTO public.saved_apartments(user_id,listing_id) VALUES(%L::uuid,%L::uuid) ON CONFLICT DO NOTHING RETURNING true',tenant_a,p),CASE WHEN tenant_b IS NULL OR iq IS NULL THEN 'Need second renter and saved witness' END),
 ('renter admin email RPC',tenant_a,'authenticated',false,'denied',format('SELECT EXISTS(SELECT 1 FROM public.danest_admin_account_emails_09e1(ARRAY[%L::uuid]))',tenant_a),CASE WHEN tenant_a IS NULL THEN 'Need active renter' END),
 ('renter admin moderation RPC',tenant_a,'authenticated',false,'denied',format('SELECT public.danest_moderate_listing(%L::uuid,''hidden'',''E2 denied'') IS NOT NULL',p),CASE WHEN tenant_a IS NULL OR p IS NULL THEN 'Need renter and TEST listing' END),
 ('landlord own inquiry',own,'authenticated',false,'true',format('SELECT EXISTS(SELECT 1 FROM public.inquiries WHERE id=%L::uuid)',iq),CASE WHEN iq IS NULL THEN 'Need test inquiry' END),
 ('landlord other private listing',landlord_b,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.properties WHERE id=%L::uuid)',other_private),CASE WHEN landlord_b IS NULL OR other_private IS NULL THEN 'Need second landlord and nonpublic listing' END),
 ('landlord other inquiry',landlord_b,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.inquiries WHERE id=%L::uuid)',iq),CASE WHEN landlord_b IS NULL OR iq IS NULL THEN 'Need second landlord and test inquiry' END),
 ('landlord other saved',own,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.saved_apartments WHERE user_id=%L::uuid AND listing_id=%L::uuid)',tenant_a,p),CASE WHEN iq IS NULL THEN 'Need saved witness' END),
 ('landlord other notice',own,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.notifications WHERE id=%L::uuid)',nt),CASE WHEN nt IS NULL THEN 'Need notice witness' END),
 ('landlord other listing write RPC',landlord_b,'authenticated',false,'denied',format('SELECT public.danest_owner_listing_action(%L::uuid,''availability'',''unavailable'') IS NOT NULL',p),CASE WHEN landlord_b IS NULL OR p IS NULL THEN 'Need second active landlord and TEST listing' END),
 ('landlord other evidence metadata RPC',landlord_b,'authenticated',false,'denied',format('SELECT public.danest_list_evidence(%L::uuid) IS NOT NULL',p),CASE WHEN landlord_b IS NULL OR p IS NULL THEN 'Need second active landlord and TEST listing' END),
 ('admin inquiry read',admin_a,'authenticated',false,'true',format('SELECT EXISTS(SELECT 1 FROM public.inquiries WHERE id=%L::uuid)',iq),CASE WHEN admin_a IS NULL OR iq IS NULL THEN 'Need admin and inquiry' END),
 ('admin other saved',admin_a,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.saved_apartments WHERE user_id=%L::uuid AND listing_id=%L::uuid)',tenant_a,p),CASE WHEN admin_a IS NULL OR iq IS NULL THEN 'Need admin and saved witness' END),
 ('admin other notice',admin_a,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.notifications WHERE id=%L::uuid)',nt),CASE WHEN admin_a IS NULL OR nt IS NULL THEN 'Need admin and notice witness' END),
 ('admin cannot impersonate inquiry participant',admin_a,'authenticated',false,'denied',format('SELECT public.danest_send_inquiry_message(%L::uuid,''E2 denied'') IS NOT NULL',iq),CASE WHEN admin_a IS NULL OR iq IS NULL THEN 'Need admin and inquiry' END),
 ('admin cannot mutate audit',admin_a,'authenticated',false,'denied',format('UPDATE public.audit_log SET reason=reason WHERE id=%L::uuid RETURNING true',log_id),CASE WHEN admin_a IS NULL OR log_id IS NULL THEN 'Need admin and audit witness' END),
 ('suspended owner active role',own,'authenticated',true,'true','SELECT public.danest_active_role() IS NULL',CASE WHEN own IS NULL THEN 'Need TEST listing owner' END),
 ('suspended owner listing write',own,'authenticated',true,'denied',format('SELECT public.danest_owner_listing_action(%L::uuid,''availability'',''unavailable'') IS NOT NULL',p),CASE WHEN own IS NULL THEN 'Need TEST listing owner' END),
 ('suspended owner inbox',own,'authenticated',true,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM public.inquiries WHERE id=%L::uuid)',iq),CASE WHEN iq IS NULL THEN 'Need TEST inquiry' END),
 ('suspended renter profile write',tenant_a,'authenticated',true,'denied',format('SELECT public.danest_save_renter_profile_09e1(%L::uuid,''E2 denied'','''') IS NOT NULL',tenant_a),CASE WHEN tenant_a IS NULL THEN 'Need active renter' END),
 ('guest evidence object metadata',NULL,'anon',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM storage.objects WHERE id=%L::uuid)',ev),CASE WHEN ev IS NULL THEN 'Need uploaded evidence object' END),
 ('renter evidence object metadata',tenant_a,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM storage.objects WHERE id=%L::uuid)',ev),CASE WHEN tenant_a IS NULL OR ev IS NULL THEN 'Need renter and evidence object' END),
 ('landlord direct evidence object metadata',own,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM storage.objects WHERE id=%L::uuid)',ev),CASE WHEN own IS NULL OR ev IS NULL THEN 'Need TEST owner and evidence object' END),
 ('admin direct evidence object metadata',admin_a,'authenticated',false,'hidden',format('SELECT NOT EXISTS(SELECT 1 FROM storage.objects WHERE id=%L::uuid)',ev),CASE WHEN admin_a IS NULL OR ev IS NULL THEN 'Need admin and evidence object' END);
END $$;
DO $$
DECLARE c record; got boolean; outcome text; why text; st text;
BEGIN
 FOR c IN SELECT * FROM dn_e2_cases LOOP
  IF c.missing IS NOT NULL THEN INSERT INTO dn_e2_results VALUES(c.label,'SKIP',c.missing); CONTINUE; END IF;
  outcome:='FAIL';why:='Unexpected result';got:=NULL;
  BEGIN
   -- Suspend only the chosen test actor, in this subtransaction; restore on all paths.
   IF c.suspend_actor THEN UPDATE public.profiles SET account_status='suspended' WHERE id=c.actor; END IF;
   PERFORM set_config('request.jwt.claim.sub',coalesce(c.actor::text,''),true);
   PERFORM set_config('request.jwt.claims',CASE WHEN c.actor IS NULL THEN '{"role":"anon"}' ELSE jsonb_build_object('sub',c.actor,'role','authenticated')::text END,true);
   EXECUTE format('SET LOCAL ROLE %I',c.db_role);
   BEGIN
    EXECUTE c.statement INTO got;
    IF c.mode IN ('true','hidden') AND got IS TRUE THEN outcome:='PASS';why:='Expected result under actual DB role';
    ELSE outcome:='FAIL';why:='Unexpected success or result under actual DB role'; END IF;
   EXCEPTION WHEN insufficient_privilege THEN
    IF c.mode IN ('denied','hidden') THEN outcome:='PASS';why:='SQLSTATE 42501 as expected';
    ELSE outcome:='FAIL';why:='Unexpected SQLSTATE 42501'; END IF;
   WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE; outcome:='FAIL';why:='Unexpected SQLSTATE '||st;
   END;
   -- Always rollback the subtransaction, including unauthorized writes if any.
   RAISE EXCEPTION USING ERRCODE='P09E2',MESSAGE='test rollback';
  EXCEPTION WHEN SQLSTATE 'P09E2' THEN NULL;
   WHEN OTHERS THEN GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE;outcome:='FAIL';why:='Harness SQLSTATE '||st;
  END;
  INSERT INTO dn_e2_results VALUES(c.label,outcome,why);
 END LOOP;
END $$;
SELECT check_name,result,detail FROM dn_e2_results;
ROLLBACK;
