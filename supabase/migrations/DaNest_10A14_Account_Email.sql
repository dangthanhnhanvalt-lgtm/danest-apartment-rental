-- New transactional emails only. No backfill, no HTTP calls, no scheduler activation.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notices_10a14 boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.email_outbox_10a14 (
 notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 event_type text NOT NULL,
 recipient_fingerprint text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT now(),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid, lease_until timestamptz,
 provider_id text, result_code text, finished_at timestamptz
);
ALTER TABLE public.email_outbox_10a14 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox_10a14 FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_email_outbox_10a14_pending ON public.email_outbox_10a14(status,next_attempt_at,created_at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_10a14_recipient ON public.email_outbox_10a14(recipient_id,created_at);
CREATE OR REPLACE FUNCTION public.danest_email_preference_10a14(p_user uuid,p_enabled boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_old boolean; v_email text; v_confirmed boolean;
BEGIN
 IF p_user IS NULL OR auth.uid() IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'Account changed' USING ERRCODE='42501'; END IF;
 SELECT role,email_notices_10a14 INTO v_role,v_old FROM public.profiles WHERE id=p_user AND account_status='active' AND role IN ('tenant','landlord') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active renter or landlord required' USING ERRCODE='42501'; END IF;
 SELECT email,email_confirmed_at IS NOT NULL INTO v_email,v_confirmed FROM auth.users WHERE id=p_user;
 IF p_enabled IS NOT NULL AND p_enabled IS DISTINCT FROM v_old THEN
  IF p_enabled AND (NOT coalesce(v_confirmed,false) OR coalesce(v_email,'')='') THEN RAISE EXCEPTION 'Confirmed email required'; END IF;
  UPDATE public.profiles SET email_notices_10a14=p_enabled,updated_at=now() WHERE id=p_user;
  IF NOT p_enabled THEN UPDATE public.email_outbox_10a14 SET status='skipped',result_code='opt_out',finished_at=now(),lease_id=NULL,lease_until=NULL WHERE recipient_id=p_user AND status='pending'; END IF;
  INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values)
  VALUES(CASE WHEN v_role='tenant' THEN 'renter' ELSE 'landlord' END,p_user,'email-notices-preference','profile',p_user::text,jsonb_build_object('enabled',v_old),jsonb_build_object('enabled',p_enabled));
  v_old:=p_enabled;
 END IF;
 RETURN jsonb_build_object('enabled',v_old,'email',coalesce(v_email,''),'confirmed',coalesce(v_confirmed,false));
END $$;
CREATE OR REPLACE FUNCTION public.danest_enqueue_email_10a14()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
 IF NEW.type NOT IN ('inquiry-created','inquiry-replied','inquiry-viewing-scheduled','inquiry-response-reminder','availability-reminder','listing-moderated','verification-changed') THEN RETURN NEW; END IF;
 IF NEW.inquiry_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.inquiries i JOIN public.properties p ON p.id=i.listing_id WHERE i.id=NEW.inquiry_id AND (i.is_sample OR p.is_demo)) THEN RETURN NEW; END IF;
 IF NEW.payload ? 'listing_id' AND EXISTS(SELECT 1 FROM public.properties p WHERE p.id::text=NEW.payload->>'listing_id' AND p.is_demo) THEN RETURN NEW; END IF;
 -- Best-effort recipient cap (concurrent inserts may exceed it). Internal notices remain intact.
 IF (SELECT count(*) FROM public.email_outbox_10a14 WHERE recipient_id=NEW.recipient_id AND created_at>now()-interval '1 hour')>=20 THEN RETURN NEW; END IF;
 SELECT u.email INTO v_email FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=NEW.recipient_id AND p.account_status='active' AND p.role IN ('tenant','landlord') AND p.email_notices_10a14 AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL AND u.email<>'';
 IF FOUND THEN INSERT INTO public.email_outbox_10a14(notification_id,recipient_id,event_type,recipient_fingerprint) VALUES(NEW.id,NEW.recipient_id,NEW.type,md5(lower(v_email))) ON CONFLICT(notification_id) DO NOTHING; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS danest_enqueue_email_10a14 ON public.notifications;
CREATE TRIGGER danest_enqueue_email_10a14 AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.danest_enqueue_email_10a14();
-- Service worker claims ONE item with row locking; short lease allows recovery after worker crash.
CREATE OR REPLACE FUNCTION public.danest_claim_email_10a14()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.email_outbox_10a14%ROWTYPE; v_email text; v_lease uuid:=gen_random_uuid();
BEGIN
 UPDATE public.email_outbox_10a14 SET status='failed',result_code='expired_or_attempt_limit',finished_at=now(),lease_id=NULL,lease_until=NULL
 WHERE (status='pending' OR (status='sending' AND lease_until<=now())) AND (created_at<=now()-interval '12 hours' OR attempts>=5);
 SELECT * INTO q FROM public.email_outbox_10a14 WHERE (status='pending' AND next_attempt_at<=now() OR status='sending' AND lease_until<=now()) AND attempts<5 AND created_at>now()-interval '12 hours' ORDER BY created_at,notification_id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT u.email INTO v_email FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=q.recipient_id AND p.account_status='active' AND p.role IN ('tenant','landlord') AND p.email_notices_10a14 AND u.email_confirmed_at IS NOT NULL AND md5(lower(u.email))=q.recipient_fingerprint;
 IF NOT FOUND THEN UPDATE public.email_outbox_10a14 SET status='skipped',result_code='recipient_ineligible',finished_at=now(),lease_id=NULL,lease_until=NULL WHERE notification_id=q.notification_id; RETURN jsonb_build_object('skipped',true); END IF;
 UPDATE public.email_outbox_10a14 SET status='sending',attempts=attempts+1,lease_id=v_lease,lease_until=now()+interval '3 minutes' WHERE notification_id=q.notification_id;
 RETURN jsonb_build_object('id',q.notification_id,'lease',v_lease,'email',v_email,'type',q.event_type);
END $$;
CREATE OR REPLACE FUNCTION public.danest_finish_email_10a14(p_id uuid,p_lease uuid,p_result text,p_provider_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_result IS NULL OR p_result NOT IN ('accepted','retry','permanent_failure') OR (p_result='accepted' AND (p_provider_id IS NULL OR length(p_provider_id) NOT BETWEEN 1 AND 150)) THEN RAISE EXCEPTION 'Invalid result'; END IF;
 UPDATE public.email_outbox_10a14 SET status=CASE WHEN p_result='accepted' THEN 'accepted' WHEN p_result='retry' AND attempts<5 AND created_at>now()-interval '12 hours' THEN 'pending' ELSE 'failed' END,
 provider_id=CASE WHEN p_result='accepted' THEN p_provider_id ELSE NULL END,result_code=p_result,
 next_attempt_at=now()+make_interval(mins=>5*attempts),
 finished_at=CASE WHEN p_result='retry' AND attempts<5 AND created_at>now()-interval '12 hours' THEN NULL ELSE now() END,lease_id=NULL,lease_until=NULL
 WHERE notification_id=p_id AND lease_id=p_lease AND status='sending';
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.danest_email_status_10a14()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('pending',(SELECT count(*) FROM public.email_outbox_10a14 WHERE status='pending'),'sending',(SELECT count(*) FROM public.email_outbox_10a14 WHERE status='sending'),'accepted',(SELECT count(*) FROM public.email_outbox_10a14 WHERE status='accepted'),'failed',(SELECT count(*) FROM public.email_outbox_10a14 WHERE status='failed'),'skipped',(SELECT count(*) FROM public.email_outbox_10a14 WHERE status='skipped'),'lastAccepted',(SELECT max(finished_at) FROM public.email_outbox_10a14 WHERE status='accepted'));
END $$;
REVOKE ALL ON FUNCTION public.danest_email_preference_10a14(uuid,boolean),public.danest_email_status_10a14(),public.danest_enqueue_email_10a14(),public.danest_claim_email_10a14(),public.danest_finish_email_10a14(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_email_preference_10a14(uuid,boolean),public.danest_email_status_10a14() TO authenticated;
GRANT EXECUTE ON FUNCTION public.danest_claim_email_10a14(),public.danest_finish_email_10a14(uuid,uuid,text,text) TO service_role;
COMMIT;
SELECT 'outbox_rls' AS check_name, (SELECT relrowsecurity FROM pg_class WHERE oid='public.email_outbox_10a14'::regclass) AS actual,true AS expected
UNION ALL SELECT 'client_outbox_read',has_table_privilege('authenticated','public.email_outbox_10a14','SELECT'),false
UNION ALL SELECT 'client_worker_claim',has_function_privilege('authenticated','public.danest_claim_email_10a14()','EXECUTE'),false
UNION ALL SELECT 'service_worker_claim',has_function_privilege('service_role','public.danest_claim_email_10a14()','EXECUTE'),true
UNION ALL SELECT 'anon_preference',has_function_privilege('anon','public.danest_email_preference_10a14(uuid,boolean)','EXECUTE'),false
UNION ALL SELECT 'enqueue_trigger',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.notifications'::regclass AND tgname='danest_enqueue_email_10a14' AND tgenabled='O'),true;
