-- SQL Editor only, development/test DB. Uses a TEST-prefixed listing if available;
-- no permanent updates, no actual email. The inner subtransaction is deliberately rolled back.
BEGIN;
DROP TABLE IF EXISTS pg_temp.dn_c1_results;
CREATE TEMP TABLE dn_c1_results (check_name text, result text, detail text) ON COMMIT PRESERVE ROWS;
DO $$
DECLARE l uuid; i uuid; s public.admin_settings%ROWTYPE; x jsonb; r text; a integer; b integer; owner uuid; can_restore boolean:=false;
BEGIN
 SELECT * INTO STRICT s FROM public.admin_settings WHERE singleton;
 SELECT p.id,p.owner_id INTO l,owner FROM public.properties p JOIN public.profiles u ON u.id=p.owner_id
 WHERE p.title ILIKE 'TEST %' AND NOT p.is_demo AND p.status='published' AND p.availability='available' AND u.role='landlord' AND u.account_status='active' ORDER BY p.id LIMIT 1;
 IF l IS NULL THEN INSERT INTO dn_c1_results VALUES('listing reminder/hide','SKIP','No published available TEST listing with active owner'),('manual hidden/paused protection','SKIP','No eligible TEST listing'),('eligible auto restore','SKIP','No eligible TEST listing'); ELSE
 BEGIN
   PERFORM pg_advisory_xact_lock(6040605);
   UPDATE public.properties SET last_availability_confirmed_at=now()-make_interval(days=>s.availability_reminder_days+1),availability_reminder_sent_at=NULL WHERE id=l;
   SELECT count(*) INTO a FROM public.notifications WHERE type='availability-reminder' AND payload->>'listing_id'=l::text;
   x:=public.danest_maintenance_core_09c1(true,true,l,NULL);
   IF (x->>'listing_reminders')::int<>1 OR (SELECT availability_reminder_sent_at IS NOT NULL FROM public.properties WHERE id=l) THEN RAISE EXCEPTION 'Preview did not remain read-only'; END IF;
   x:=public.danest_maintenance_core_09c1(false,true,l,NULL);
   IF (x->>'listing_reminders')::int<>1 OR (SELECT availability_reminder_sent_at IS NULL FROM public.properties WHERE id=l) THEN RAISE EXCEPTION 'Reminder failed'; END IF;
   -- For grace=0 a subsequent sweep can hide immediately; otherwise no duplicate reminder.
   x:=public.danest_maintenance_core_09c1(true,true,l,NULL);
   IF (x->>'listing_reminders')::int<>0 THEN RAISE EXCEPTION 'Duplicate reminder candidate'; END IF;
   SELECT count(*) INTO b FROM public.notifications WHERE type='availability-reminder' AND payload->>'listing_id'=l::text;
   IF b<>a+1 THEN RAISE EXCEPTION 'Expected exactly one reminder notification'; END IF;
   UPDATE public.properties SET availability_reminder_sent_at=now()-make_interval(days=>s.availability_grace_days+1),last_availability_confirmed_at=now()-make_interval(days=>s.availability_reminder_days+s.availability_grace_days+3) WHERE id=l;
   x:=public.danest_maintenance_core_09c1(false,true,l,NULL);
   IF (x->>'listings_to_hide')::int<>1 OR NOT EXISTS(SELECT 1 FROM public.properties WHERE id=l AND status='hidden' AND availability_hidden_at IS NOT NULL) THEN RAISE EXCEPTION 'Auto-hide failed'; END IF;
   x:=public.danest_maintenance_core_09c1(false,true,l,NULL);
   IF (x->>'listings_to_hide')::int<>0 THEN RAISE EXCEPTION 'Repeated hide'; END IF;
   -- Exercise the owner RPC using temporary JWT claims inside this rollback-only test.
   PERFORM set_config('request.jwt.claim.sub',owner::text,true);
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
   IF auth.uid() IS DISTINCT FROM owner OR public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Cannot emulate authorized owner'; END IF;
   can_restore:=EXISTS(SELECT 1 FROM public.moderation_auto WHERE listing_id=l AND result IN ('passed','needs-attention'))
      AND EXISTS(SELECT 1 FROM public.moderation_review m JOIN public.moderation_auto a ON a.listing_id=m.listing_id WHERE m.listing_id=l AND m.decision='approved' AND m.reviewed_at>=a.auto_reviewed_at)
      AND coalesce((SELECT decision FROM public.moderation_review WHERE listing_id=l ORDER BY reviewed_at DESC,id DESC LIMIT 1) IN ('approved','restored'),false);
   IF can_restore THEN
     x:=public.danest_reconfirm_availability(l,NULL);
     IF x->>'status'<>'published' OR NOT EXISTS(SELECT 1 FROM public.properties WHERE id=l AND status='published' AND availability_hidden_at IS NULL AND availability_reminder_sent_at IS NULL) THEN RAISE EXCEPTION 'Eligible automatic restore failed'; END IF;
   ELSE
     BEGIN
       PERFORM public.danest_reconfirm_availability(l,NULL);
       RAISE EXCEPTION USING ERRCODE='P0902',MESSAGE='Restore without current approval was allowed';
     EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
   END IF;
   UPDATE public.properties SET status='hidden',availability_hidden_at=NULL WHERE id=l;
   x:=public.danest_reconfirm_availability(l,NULL);
   IF x->>'status'<>'hidden' THEN RAISE EXCEPTION 'Manually hidden listing restored'; END IF;
   UPDATE public.properties SET status='paused' WHERE id=l;
   x:=public.danest_reconfirm_availability(l,NULL);
   IF x->>'status'<>'paused' THEN RAISE EXCEPTION 'Paused listing restored'; END IF;
   -- Deliberate subtransaction rollback, including audit and notifications.
   RAISE EXCEPTION USING ERRCODE='P0901',MESSAGE='rollback successful test';
 EXCEPTION WHEN SQLSTATE 'P0901' THEN INSERT INTO dn_c1_results VALUES('listing reminder/hide','PASS','Preview, reminder, no duplicate, grace elapsed, auto-hide, repeat; rolled back'),('manual hidden/paused protection','PASS','Reconfirmation did not restore manually hidden or paused listing'),('eligible auto restore',CASE WHEN can_restore THEN 'PASS' ELSE 'SKIP' END,CASE WHEN can_restore THEN 'Current approval restored correctly' ELSE 'No current approval; blocked restore checked' END);
 WHEN OTHERS THEN GET STACKED DIAGNOSTICS r=MESSAGE_TEXT; INSERT INTO dn_c1_results VALUES('listing reminder/hide','FAIL',r);
 END; END IF;
 SELECT q.id INTO i FROM public.inquiries q JOIN public.properties p ON p.id=q.listing_id JOIN public.profiles u ON u.id=p.owner_id
 WHERE p.title ILIKE 'TEST %' AND NOT p.is_demo AND NOT q.is_sample AND q.status='new' AND q.first_responded_at IS NULL AND u.role='landlord' AND u.account_status='active' ORDER BY q.id LIMIT 1;
 IF i IS NULL THEN INSERT INTO dn_c1_results VALUES('inquiry 24h','SKIP','No unanswered new inquiry on TEST listing'); ELSE
 BEGIN
   PERFORM pg_advisory_xact_lock(6040605);
   UPDATE public.inquiries SET first_requested_at=now()-interval '25 hours',response_reminder_sent_at=NULL WHERE id=i;
   x:=public.danest_maintenance_core_09c1(true,true,NULL,i);
   IF (x->>'inquiry_reminders')::int<>1 OR (SELECT response_reminder_sent_at IS NOT NULL FROM public.inquiries WHERE id=i) THEN RAISE EXCEPTION 'Inquiry preview failed'; END IF;
   x:=public.danest_maintenance_core_09c1(false,true,NULL,i);
   IF (x->>'inquiry_reminders')::int<>1 OR (SELECT response_reminder_sent_at IS NULL FROM public.inquiries WHERE id=i) THEN RAISE EXCEPTION 'Inquiry reminder failed'; END IF;
   x:=public.danest_maintenance_core_09c1(false,true,NULL,i);
   IF (x->>'inquiry_reminders')::int<>0 THEN RAISE EXCEPTION 'Repeated inquiry reminder'; END IF;
   RAISE EXCEPTION USING ERRCODE='P0901',MESSAGE='rollback successful test';
 EXCEPTION WHEN SQLSTATE 'P0901' THEN INSERT INTO dn_c1_results VALUES('inquiry 24h','PASS','Preview, reminder and repeat; rolled back');
 WHEN OTHERS THEN GET STACKED DIAGNOSTICS r=MESSAGE_TEXT; INSERT INTO dn_c1_results VALUES('inquiry 24h','FAIL',r);
 END; END IF;
END $$;
COMMIT;
SELECT * FROM dn_c1_results;
