-- C2: additive, no Cron configuration changes; execute as SQL Editor owner.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_maintenance_core_09c1(boolean,boolean,uuid,uuid)') IS NULL OR to_regprocedure('public.danest_inquiry_party(uuid)') IS NULL THEN RAISE EXCEPTION 'Install 06C and C1 first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_publication WHERE pubname='supabase_realtime') THEN RAISE EXCEPTION 'Supabase Realtime publication missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename='notifications' AND rowsecurity) OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='dn04_notifications_read') THEN RAISE EXCEPTION 'Notification RLS required'; END IF;
END $$;
-- Separate message-read state from general notification-read state; no additional table.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message_read_at timestamptz;
-- Existing message notices initially remain unread until explicitly marked in the conversation.
CREATE INDEX IF NOT EXISTS idx_dn09c2_unread_message ON public.notifications(recipient_id,inquiry_id) WHERE message_read_at IS NULL;
CREATE OR REPLACE FUNCTION public.danest_mark_messages_read_09c2(p_inquiry_id uuid,p_notice_ids uuid[])
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(6040605);
 PERFORM public.danest_inquiry_party(p_inquiry_id);
 IF p_notice_ids IS NULL OR cardinality(p_notice_ids)>100 THEN RAISE EXCEPTION 'At most 100 notification IDs'; END IF;
 UPDATE public.notifications SET message_read_at=now(),read_at=coalesce(read_at,now())
 WHERE recipient_id=auth.uid() AND inquiry_id=p_inquiry_id AND id=ANY(p_notice_ids) AND message_read_at IS NULL
 AND (type='inquiry-created' OR (type='inquiry-replied' AND payload->>'event'='message'));
 GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $$;
-- No appointment duration in current schema: one-hour minimum separation for both parties.
-- No private appointment details are returned, only a conflict error.
CREATE OR REPLACE FUNCTION public.danest_check_viewing_conflict_09c2(p_inquiry_id uuid,p_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.inquiries i JOIN public.properties p ON p.id=i.listing_id
 JOIN public.inquiries x ON x.id=p_inquiry_id JOIN public.properties xp ON xp.id=x.listing_id
 WHERE i.id<>x.id AND i.status='viewing_scheduled' AND i.scheduled_at IS NOT NULL
 AND (i.tenant_id=x.tenant_id OR p.owner_id=xp.owner_id)
 AND i.scheduled_at>p_at-interval '1 hour' AND i.scheduled_at<p_at+interval '1 hour') THEN
 RAISE EXCEPTION 'Viewing conflicts with another confirmed appointment (60 minutes)'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.danest_propose_viewing(p_inquiry_id uuid,p_proposed_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_party text; v_i public.inquiries%ROWTYPE; v_recipient uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(6040605); -- serialize with C1 maintenance and other viewing writes
 v_party:=public.danest_inquiry_party(p_inquiry_id);
 SELECT * INTO v_i FROM public.inquiries WHERE id=p_inquiry_id;
 IF v_i.status NOT IN ('replied','viewing_scheduled') THEN RAISE EXCEPTION 'Viewing requires replied or viewing_scheduled status'; END IF;
 IF p_proposed_at IS NULL OR p_proposed_at<=now() THEN RAISE EXCEPTION 'Viewing must be in the future'; END IF;
 SELECT CASE WHEN v_party='landlord' THEN v_i.tenant_id ELSE owner_id END INTO v_recipient FROM public.properties WHERE id=v_i.listing_id;
 IF v_recipient IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_recipient AND account_status='active') THEN RAISE EXCEPTION 'Other participant unavailable'; END IF;
 PERFORM public.danest_check_viewing_conflict_09c2(p_inquiry_id,p_proposed_at);
 UPDATE public.inquiries SET proposed_at=p_proposed_at, proposed_by=auth.uid(), updated_at=now() WHERE id=p_inquiry_id;
 INSERT INTO public.notifications(recipient_id,inquiry_id,type,payload) VALUES(v_recipient,p_inquiry_id,'inquiry-viewing-scheduled',jsonb_build_object('event','proposal','proposed_at',p_proposed_at));
 RETURN p_proposed_at;
END $$;

CREATE OR REPLACE FUNCTION public.danest_confirm_viewing(p_inquiry_id uuid,p_expected_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_party text; v_i public.inquiries%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(6040605); -- serialize with C1 maintenance and other viewing writes
 v_party:=public.danest_inquiry_party(p_inquiry_id);
 SELECT * INTO v_i FROM public.inquiries WHERE id=p_inquiry_id;
 IF v_i.status NOT IN ('replied','viewing_scheduled') OR v_i.proposed_at IS NULL OR v_i.proposed_at<=now() OR v_i.proposed_at IS DISTINCT FROM p_expected_at OR v_i.proposed_by=auth.uid() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_i.proposed_by AND account_status='active') OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=v_i.listing_id AND v_i.proposed_by IN (p.owner_id,v_i.tenant_id)) THEN RAISE EXCEPTION 'No current proposal from the other participant'; END IF;
 PERFORM public.danest_check_viewing_conflict_09c2(p_inquiry_id,v_i.proposed_at);
 UPDATE public.inquiries SET status='viewing_scheduled',scheduled_at=v_i.proposed_at,proposed_at=NULL,proposed_by=NULL,updated_at=now() WHERE id=p_inquiry_id;
 IF v_i.status<>'viewing_scheduled' THEN INSERT INTO public.inquiry_status_history(inquiry_id,from_status,to_status,actor_id) VALUES(p_inquiry_id,v_i.status,'viewing_scheduled',auth.uid()); END IF;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values) VALUES(v_party,auth.uid(),'viewing-confirmed','inquiry',p_inquiry_id::text,jsonb_build_object('scheduled_at',v_i.scheduled_at),jsonb_build_object('scheduled_at',v_i.proposed_at));
 INSERT INTO public.notifications(recipient_id,inquiry_id,type,payload) VALUES(v_i.proposed_by,p_inquiry_id,'inquiry-viewing-scheduled',jsonb_build_object('event','confirmed','scheduled_at',v_i.proposed_at));
 RETURN v_i.proposed_at;
END $$;


-- Decline or withdraw the current proposal. Existing confirmed appointment remains unchanged.
CREATE OR REPLACE FUNCTION public.danest_cancel_proposal_09c2(p_inquiry_id uuid,p_expected_at timestamptz,p_expected_by uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_i public.inquiries%ROWTYPE; v_party text; v_other uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(6040605);
 v_party:=public.danest_inquiry_party(p_inquiry_id);
 SELECT * INTO STRICT v_i FROM public.inquiries WHERE id=p_inquiry_id;
 IF v_i.status NOT IN ('replied','viewing_scheduled') OR v_i.proposed_at IS NULL OR v_i.proposed_at IS DISTINCT FROM p_expected_at OR v_i.proposed_by IS DISTINCT FROM p_expected_by THEN RAISE EXCEPTION 'Proposal changed; refresh'; END IF;
 SELECT CASE WHEN v_party='landlord' THEN v_i.tenant_id ELSE owner_id END INTO v_other FROM public.properties WHERE id=v_i.listing_id;
 UPDATE public.inquiries SET proposed_at=NULL,proposed_by=NULL,updated_at=now() WHERE id=p_inquiry_id;
 IF v_other IS NOT NULL THEN INSERT INTO public.notifications(recipient_id,inquiry_id,type,payload) VALUES(v_other,p_inquiry_id,'inquiry-viewing-scheduled',jsonb_build_object('event','proposal-cancelled','proposed_at',v_i.proposed_at)); END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.danest_check_viewing_conflict_09c2(uuid,timestamptz),public.danest_mark_messages_read_09c2(uuid,uuid[]),public.danest_cancel_proposal_09c2(uuid,timestamptz,uuid),public.danest_propose_viewing(uuid,timestamptz),public.danest_confirm_viewing(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_mark_messages_read_09c2(uuid,uuid[]),public.danest_cancel_proposal_09c2(uuid,timestamptz,uuid),public.danest_propose_viewing(uuid,timestamptz),public.danest_confirm_viewing(uuid,timestamptz) TO authenticated;
-- Use the existing hourly job: remind each active participant once per confirmed time.
-- Preview does not write. Serialize with C1 and viewing confirmation using the same lock.
CREATE OR REPLACE FUNCTION public.danest_viewing_reminders_09c2(p_preview boolean)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count bigint;
BEGIN
 IF p_preview IS NULL THEN RAISE EXCEPTION 'Preview flag required'; END IF;
 PERFORM pg_advisory_xact_lock(6040605);
 IF p_preview THEN
   SELECT count(*) INTO v_count FROM public.inquiries i JOIN public.properties p ON p.id=i.listing_id
   JOIN public.profiles t ON t.id=i.tenant_id AND t.account_status='active' AND t.role='tenant'
   JOIN public.profiles l ON l.id=p.owner_id AND l.account_status='active' AND l.role='landlord'
   CROSS JOIN LATERAL (VALUES(i.tenant_id),(p.owner_id)) r(recipient_id)
   WHERE NOT i.is_sample AND i.status='viewing_scheduled' AND i.scheduled_at>now() AND i.scheduled_at<=now()+interval '24 hours'
   AND NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.recipient_id=r.recipient_id AND n.inquiry_id=i.id AND n.type='inquiry-viewing-scheduled' AND n.payload->>'event'='viewing-reminder' AND n.payload->'scheduled_epoch'=to_jsonb(extract(epoch FROM i.scheduled_at)));
 ELSE
   INSERT INTO public.notifications(recipient_id,inquiry_id,type,payload)
   SELECT r.recipient_id,i.id,'inquiry-viewing-scheduled',jsonb_build_object('event','viewing-reminder','scheduled_at',i.scheduled_at,'scheduled_epoch',extract(epoch FROM i.scheduled_at))
   FROM public.inquiries i JOIN public.properties p ON p.id=i.listing_id
   JOIN public.profiles t ON t.id=i.tenant_id AND t.account_status='active' AND t.role='tenant'
   JOIN public.profiles l ON l.id=p.owner_id AND l.account_status='active' AND l.role='landlord'
   CROSS JOIN LATERAL (VALUES(i.tenant_id),(p.owner_id)) r(recipient_id)
   WHERE NOT i.is_sample AND i.status='viewing_scheduled' AND i.scheduled_at>now() AND i.scheduled_at<=now()+interval '24 hours'
   AND NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.recipient_id=r.recipient_id AND n.inquiry_id=i.id AND n.type='inquiry-viewing-scheduled' AND n.payload->>'event'='viewing-reminder' AND n.payload->'scheduled_epoch'=to_jsonb(extract(epoch FROM i.scheduled_at)));
   GET DIAGNOSTICS v_count=ROW_COUNT;
 END IF;
 RETURN v_count;
END $$;
CREATE OR REPLACE FUNCTION public.danest_run_maintenance(p_preview boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb; v_viewings bigint;
BEGIN
 v_result:=public.danest_maintenance_core_09c1(p_preview,false,NULL,NULL);
 v_viewings:=public.danest_viewing_reminders_09c2(p_preview);
 RETURN v_result || jsonb_build_object('viewing_reminders',v_viewings);
END $$;
REVOKE ALL ON FUNCTION public.danest_viewing_reminders_09c2(boolean),public.danest_run_maintenance(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_run_maintenance(boolean) TO service_role;
-- Realtime payload is recipient-scoped via existing RLS; only notifications are added.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;
END $$;
COMMIT;
SELECT 'notification_realtime' AS check_name,EXISTS(SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') AS actual,true AS expected
UNION ALL SELECT 'message_read_column',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='message_read_at'),true
UNION ALL SELECT 'anon_mark_messages',has_function_privilege('anon','public.danest_mark_messages_read_09c2(uuid,uuid[])','EXECUTE'),false
UNION ALL SELECT 'authenticated_mark_messages',has_function_privilege('authenticated','public.danest_mark_messages_read_09c2(uuid,uuid[])','EXECUTE'),true
UNION ALL SELECT 'client_conflict_helper',has_function_privilege('authenticated','public.danest_check_viewing_conflict_09c2(uuid,timestamptz)','EXECUTE'),false
UNION ALL SELECT 'client_reminder_helper',has_function_privilege('authenticated','public.danest_viewing_reminders_09c2(boolean)','EXECUTE'),false;
