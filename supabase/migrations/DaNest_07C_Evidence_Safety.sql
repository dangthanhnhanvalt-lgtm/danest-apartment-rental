-- 07C: evidence access delivery confirmation and stale review protection.
-- Run after 06B and 07B. No existing accounts, listings or documents deleted.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_authorize_evidence_access(uuid,uuid)') IS NULL OR to_regprocedure('public.danest_save_listing(uuid,jsonb)') IS NULL THEN RAISE EXCEPTION 'Install 06B and 07B first'; END IF;
END $$;
ALTER TABLE public.evidence_access_log ADD COLUMN IF NOT EXISTS delivery_confirmed boolean NOT NULL DEFAULT false;
-- Existing 06B function writes an authorized access attempt with delivery_confirmed=false.
-- Only the trusted server can append a successful retrieval event.
CREATE OR REPLACE FUNCTION public.danest_record_evidence_delivery(p_actor_id uuid,p_evidence_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor_id AND role='admin' AND account_status='active') THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.evidence_access_log WHERE evidence_id=p_evidence_id AND actor_id=p_actor_id AND NOT delivery_confirmed) THEN RAISE EXCEPTION 'Authorization request missing'; END IF;
 INSERT INTO public.evidence_access_log(evidence_id,actor_id,delivery_confirmed) VALUES(p_evidence_id,p_actor_id,true);
END $$;
REVOKE ALL ON FUNCTION public.danest_record_evidence_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_record_evidence_delivery(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.danest_review_evidence(p_listing_id uuid,p_decision text,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_p public.properties%ROWTYPE; v_review uuid; v_actor uuid:=auth.uid(); v_check_status text;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected','corrections-requested') THEN RAISE EXCEPTION 'Invalid evidence decision'; END IF;
 IF p_reason IS NULL OR btrim(p_reason)='' OR length(p_reason)>1000 THEN RAISE EXCEPTION 'Reason required (1-1000 characters)'; END IF;
 SELECT * INTO v_p FROM public.properties WHERE id=p_listing_id FOR UPDATE;
 IF NOT FOUND OR v_p.is_demo IS DISTINCT FROM false OR v_p.owner_id IS NULL OR v_p.verification_level IS DISTINCT FROM 'unverified' THEN RAISE EXCEPTION 'Listing not eligible for evidence review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.evidence_document WHERE listing_id=p_listing_id AND evidence_review_id IS NULL) THEN RAISE EXCEPTION 'No pending evidence'; END IF;
 IF p_decision='approved' THEN
  IF NOT EXISTS(SELECT 1 FROM public.evidence_document WHERE listing_id=p_listing_id AND evidence_review_id IS NULL AND kind='identity') OR
     NOT EXISTS(SELECT 1 FROM public.evidence_document WHERE listing_id=p_listing_id AND evidence_review_id IS NULL AND kind='rental-authorization') THEN RAISE EXCEPTION 'Identity and rental-right evidence required in the same batch'; END IF;
  IF EXISTS(SELECT 1 FROM public.evidence_document d WHERE d.listing_id=p_listing_id AND d.evidence_review_id IS NULL AND
    (NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='verification-evidence' AND o.name=d.storage_ref) OR
     NOT EXISTS(SELECT 1 FROM public.evidence_access_log a WHERE a.evidence_id=d.id AND a.actor_id=v_actor AND a.delivery_confirmed))) THEN RAISE EXCEPTION 'Admin must successfully retrieve every pending document first'; END IF;
 END IF;
 INSERT INTO public.evidence_review(listing_id,reviewer_id,decision,reason) VALUES(p_listing_id,v_actor,p_decision,btrim(p_reason)) RETURNING id INTO v_review;
 UPDATE public.evidence_document SET evidence_review_id=v_review WHERE listing_id=p_listing_id AND evidence_review_id IS NULL;
 v_check_status:=CASE WHEN p_decision='approved' THEN 'verified' ELSE 'not-started' END;
 INSERT INTO public.verification_check(listing_id,kind,status,last_updated)
 SELECT p_listing_id,k,v_check_status,now() FROM unnest(ARRAY['listing-info','landlord-identity','rental-authorization']) u(k) WHERE true
 ON CONFLICT(listing_id,kind) DO UPDATE SET status=excluded.status,last_updated=excluded.last_updated;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,reason,new_values)
 VALUES('admin',v_actor,'evidence-reviewed','listing',p_listing_id::text,btrim(p_reason),jsonb_build_object('review_id',v_review,'decision',p_decision));
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_p.owner_id) THEN
  INSERT INTO public.notifications(recipient_id,type,payload) VALUES(v_p.owner_id,'verification-changed',jsonb_build_object('listing_id',p_listing_id,'evidence_decision',p_decision));
 END IF;
 RETURN v_review;
END $$;

REVOKE ALL ON FUNCTION public.danest_review_evidence(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_review_evidence(uuid,text,text) TO authenticated;

-- A material edit after evidence approval requires a new review. Verified listings
-- cannot be materially edited (including registered images) until verification is revoked.
CREATE OR REPLACE FUNCTION public.danest_guard_evidence_material_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.title,NEW.description,NEW.address,NEW.neighborhood_id,NEW.price,NEW.area,NEW.bedrooms,NEW.bathrooms,NEW.furnishing,NEW.images,NEW.amenities,NEW.costs,NEW.available_from,NEW.minimum_months,NEW.maximum_months,NEW.deposit_months,NEW.owner_id,NEW.property_type)
 IS DISTINCT FROM (OLD.title,OLD.description,OLD.address,OLD.neighborhood_id,OLD.price,OLD.area,OLD.bedrooms,OLD.bathrooms,OLD.furnishing,OLD.images,OLD.amenities,OLD.costs,OLD.available_from,OLD.minimum_months,OLD.maximum_months,OLD.deposit_months,OLD.owner_id,OLD.property_type) THEN
   IF OLD.verification_level='basic_verified' THEN RAISE EXCEPTION 'Revoke verification before materially editing a verified listing'; END IF;
   IF EXISTS(SELECT 1 FROM public.verification_check WHERE listing_id=NEW.id AND status='verified') THEN
     UPDATE public.verification_check SET status='not-started',last_updated=now() WHERE listing_id=NEW.id;
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.danest_guard_evidence_material_edit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS dn07c_evidence_material_edit ON public.properties;
CREATE TRIGGER dn07c_evidence_material_edit AFTER UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.danest_guard_evidence_material_edit();
COMMIT;
SELECT (SELECT count(*) FROM public.properties) AS properties,
 (SELECT count(*) FROM public.profiles) AS profiles,
 (SELECT count(*) FROM public.evidence_document) AS evidence_documents,
 (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.properties'::regclass AND tgname='dn07c_evidence_material_edit') AS material_edit_guard,
 has_function_privilege('authenticated','public.danest_record_evidence_delivery(uuid,uuid)','EXECUTE') AS client_can_log_delivery,
 has_function_privilege('service_role','public.danest_record_evidence_delivery(uuid,uuid)','EXECUTE') AS server_can_log_delivery;
