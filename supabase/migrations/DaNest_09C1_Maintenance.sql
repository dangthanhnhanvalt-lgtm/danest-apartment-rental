-- C1 migration. Run as SQL Editor owner. Does NOT run maintenance in write mode or enable Cron.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_run_maintenance(boolean)') IS NULL OR to_regprocedure('public.danest_owner_listing_action(uuid,text,text)') IS NULL THEN RAISE EXCEPTION 'Complete 06E and B2 first'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.danest_maintenance_core_09c1(p_preview boolean,p_scoped boolean,p_listing_id uuid,p_inquiry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.admin_settings%ROWTYPE; v_p public.properties%ROWTYPE; v_i record;
 v_now timestamptz:=now(); v_remind integer:=0; v_hide integer:=0; v_inquiry integer:=0; v_unknown bigint;
BEGIN
 IF p_preview IS NULL OR p_scoped IS NULL THEN RAISE EXCEPTION 'Preview flag is required'; END IF;
 SELECT * INTO STRICT s FROM public.admin_settings WHERE singleton;
 SELECT count(*) INTO v_unknown FROM public.properties WHERE NOT is_demo AND status='published' AND last_availability_confirmed_at IS NULL AND (NOT p_scoped OR id=p_listing_id);
 -- serialize sweeps (including previews); no duplicate reminders from concurrent jobs.
 PERFORM pg_advisory_xact_lock(6040605);
 FOR v_p IN SELECT p.* FROM public.properties p JOIN public.profiles u ON u.id=p.owner_id
   WHERE NOT p.is_demo AND p.status='published' AND p.availability='available' AND u.role='landlord' AND u.account_status='active'
   AND (NOT p_scoped OR p.id=p_listing_id)
   AND p.last_availability_confirmed_at<v_now-make_interval(days=>s.availability_reminder_days)
   ORDER BY p.id FOR UPDATE OF p
 LOOP
   IF v_p.availability_reminder_sent_at IS NULL OR v_p.availability_reminder_sent_at<v_p.last_availability_confirmed_at THEN
     v_remind:=v_remind+1;
     IF NOT p_preview THEN
       UPDATE public.properties SET availability_reminder_sent_at=v_now,updated_at=v_now WHERE id=v_p.id;
       INSERT INTO public.notifications(recipient_id,type,payload) VALUES(v_p.owner_id,'availability-reminder',jsonb_build_object('listing_id',v_p.id,'event','reconfirm','grace_days',s.availability_grace_days,'reminded_at',v_now,'listing_title',v_p.title));
       INSERT INTO public.audit_log(actor_type,action,target_type,target_id,old_values,new_values) VALUES('system','availability-reminder-sent','listing',v_p.id::text,jsonb_build_object('reminder_sent_at',v_p.availability_reminder_sent_at),jsonb_build_object('reminder_sent_at',v_now));
     END IF;
   ELSIF v_p.availability_reminder_sent_at<=v_now-make_interval(days=>s.availability_grace_days) THEN
     v_hide:=v_hide+1;
     IF NOT p_preview THEN
       UPDATE public.properties SET status='hidden',availability_hidden_at=v_now,updated_at=v_now,listing_data=coalesce(listing_data,'{}'::jsonb)||jsonb_build_object('status','hidden') WHERE id=v_p.id;
       INSERT INTO public.audit_log(actor_type,action,target_type,target_id,reason,old_values,new_values) VALUES('system','availability-auto-hidden','listing',v_p.id::text,'Confirmation grace period elapsed',jsonb_build_object('status',v_p.status,'auto_hidden_at',v_p.availability_hidden_at),jsonb_build_object('status','hidden','auto_hidden_at',v_now));
       INSERT INTO public.notifications(recipient_id,type,payload) VALUES(v_p.owner_id,'availability-reminder',jsonb_build_object('listing_id',v_p.id,'event','auto-hidden','listing_title',v_p.title));
     END IF;
   END IF;
 END LOOP;
 FOR v_i IN SELECT i.id,p.owner_id FROM public.inquiries i JOIN public.properties p ON p.id=i.listing_id JOIN public.profiles u ON u.id=p.owner_id
   WHERE i.status='new' AND (NOT p_scoped OR i.id=p_inquiry_id) AND NOT i.is_sample AND NOT p.is_demo AND i.first_responded_at IS NULL AND i.response_reminder_sent_at IS NULL
   AND i.first_requested_at<=v_now-interval '24 hours' AND u.role='landlord' AND u.account_status='active' ORDER BY i.id FOR UPDATE OF i SKIP LOCKED
 LOOP
   v_inquiry:=v_inquiry+1;
   IF NOT p_preview THEN
     UPDATE public.inquiries SET response_reminder_sent_at=v_now WHERE id=v_i.id;
     INSERT INTO public.notifications(recipient_id,inquiry_id,type,payload) VALUES(v_i.owner_id,v_i.id,'inquiry-response-reminder',jsonb_build_object('event','unanswered-24h'));
     INSERT INTO public.audit_log(actor_type,action,target_type,target_id,old_values,new_values) VALUES('system','inquiry-response-reminder-sent','inquiry',v_i.id::text,jsonb_build_object('response_reminder_sent_at',NULL),jsonb_build_object('response_reminder_sent_at',v_now));
   END IF;
 END LOOP;
 RETURN jsonb_build_object('preview',p_preview,'listing_reminders',v_remind,'listings_to_hide',v_hide,'inquiry_reminders',v_inquiry,'published_missing_confirmation',v_unknown);
END $$;

CREATE OR REPLACE FUNCTION public.danest_reconfirm_availability(p_listing_id uuid,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_p public.properties%ROWTYPE; v_role text:=public.danest_active_role(); v_status text; v_now timestamptz:=now();
BEGIN
 IF v_role IS NULL OR v_role NOT IN ('admin','landlord') THEN RAISE EXCEPTION 'Active admin or landlord required' USING ERRCODE='42501'; END IF;
 IF (v_role='admin' AND coalesce(length(btrim(p_reason)),0)=0) OR length(coalesce(p_reason,''))>1000 THEN RAISE EXCEPTION 'Admin must record a reason (1–1000 characters)'; END IF;
 SELECT * INTO v_p FROM public.properties WHERE id=p_listing_id FOR UPDATE;
 IF NOT FOUND OR v_p.is_demo OR (v_role='landlord' AND v_p.owner_id IS DISTINCT FROM auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_p.owner_id AND role='landlord' AND account_status='active') THEN RAISE EXCEPTION 'Listing must have an active authorized owner' USING ERRCODE='42501'; END IF;
 IF v_p.status IS NULL OR v_p.status NOT IN ('draft','pending','needs-attention','published','paused','hidden') THEN RAISE EXCEPTION 'Listing cannot be reconfirmed in current status'; END IF;
 IF v_p.availability IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'Only available listings may be reconfirmed as available'; END IF;
 v_status:=v_p.status;
 IF v_p.status='hidden' AND v_p.availability_hidden_at IS NOT NULL THEN
   -- Do not bypass moderation for legacy or unapproved records.
   IF EXISTS(SELECT 1 FROM public.moderation_auto WHERE listing_id=p_listing_id AND result IN ('passed','needs-attention'))
      AND EXISTS(SELECT 1 FROM public.moderation_review m JOIN public.moderation_auto a ON a.listing_id=m.listing_id WHERE m.listing_id=p_listing_id AND m.decision='approved' AND m.reviewed_at>=a.auto_reviewed_at)
      AND (SELECT decision FROM public.moderation_review WHERE listing_id=p_listing_id ORDER BY reviewed_at DESC,id DESC LIMIT 1) IN ('approved','restored') THEN v_status:='published';
   ELSE RAISE EXCEPTION 'Automatic restoration requires current moderation approval; contact Admin';
   END IF;
 END IF;
 UPDATE public.properties SET last_availability_confirmed_at=v_now,availability_reminder_sent_at=NULL,
   availability_hidden_at=NULL,status=v_status,updated_at=v_now,
   listing_data=coalesce(listing_data,'{}'::jsonb)||jsonb_build_object('status',v_status,'lastAvailabilityConfirmedAt',v_now,'availabilityReminderSentAt',NULL)
 WHERE id=p_listing_id;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,reason,old_values,new_values)
 VALUES(v_role,auth.uid(),CASE WHEN v_role='admin' THEN 'availability-admin-reconfirmed' ELSE 'availability-reconfirmed' END,'listing',p_listing_id::text,nullif(btrim(p_reason),''),
 jsonb_build_object('status',v_p.status,'last_confirmed_at',v_p.last_availability_confirmed_at,'reminder_sent_at',v_p.availability_reminder_sent_at,'auto_hidden_at',v_p.availability_hidden_at),
 jsonb_build_object('status',v_status,'last_confirmed_at',v_now,'reminder_sent_at',NULL,'auto_hidden_at',NULL));
 RETURN jsonb_build_object('listing_id',p_listing_id,'status',v_status,'last_availability_confirmed_at',v_now);
END $$;
CREATE OR REPLACE FUNCTION public.danest_run_maintenance(p_preview boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN public.danest_maintenance_core_09c1(p_preview,false,NULL,NULL); END $$;
CREATE OR REPLACE FUNCTION public.danest_maintenance_preview_09c1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 RETURN public.danest_run_maintenance(true);
END $$;
REVOKE ALL ON FUNCTION public.danest_maintenance_core_09c1(boolean,boolean,uuid,uuid), public.danest_run_maintenance(boolean), public.danest_maintenance_preview_09c1(), public.danest_reconfirm_availability(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_run_maintenance(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.danest_maintenance_preview_09c1(), public.danest_reconfirm_availability(uuid,text) TO authenticated;
DO $$ BEGIN
 IF has_function_privilege('anon','public.danest_run_maintenance(boolean)','EXECUTE') OR has_function_privilege('authenticated','public.danest_run_maintenance(boolean)','EXECUTE') OR has_function_privilege('authenticated','public.danest_maintenance_core_09c1(boolean,boolean,uuid,uuid)','EXECUTE') OR has_column_privilege('authenticated','public.properties','listing_data','SELECT') THEN RAISE EXCEPTION 'Unexpected client privilege'; END IF;
END $$;
COMMIT;
SELECT public.danest_run_maintenance(true) AS maintenance_preview;
