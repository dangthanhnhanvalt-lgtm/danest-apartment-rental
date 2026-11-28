-- DaNest 10A.1.1: install after F1 and fixed D2/E2 migrations.
-- Adds columns and internal functions; no listing status changes or data deletion on installation.
BEGIN;
ALTER TABLE public.neighborhoods ADD COLUMN IF NOT EXISTS name_vi text, ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.amenities ADD COLUMN IF NOT EXISTS label_vi text, ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS extra_required_fields_10a11 text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.listing_image ADD COLUMN IF NOT EXISTS content_hash_10a11 text;
-- Preserve previously public image columns, keep digest internal.
REVOKE SELECT ON public.listing_image FROM PUBLIC,anon,authenticated;
REVOKE SELECT (content_hash_10a11) ON public.listing_image FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,listing_id,url,storage_path,position,created_at) ON public.listing_image TO anon,authenticated;
CREATE INDEX IF NOT EXISTS danest_image_hash_10a11 ON public.listing_image(content_hash_10a11) WHERE content_hash_10a11 IS NOT NULL;
UPDATE public.neighborhoods SET name_vi=CASE id WHEN 'an-thuong' THEN 'An Thượng' WHEN 'my-an' THEN 'Mỹ An' WHEN 'son-tra' THEN 'Sơn Trà' WHEN 'han-river' THEN 'Sông Hàn' ELSE name END WHERE name_vi IS NULL;
UPDATE public.amenities SET label_vi=CASE id WHEN 'wifi' THEN 'Wi-Fi tốc độ cao' WHEN 'air-conditioning' THEN 'Điều hòa' WHEN 'washing-machine' THEN 'Máy giặt' WHEN 'kitchen' THEN 'Bếp đầy đủ' WHEN 'pool' THEN 'Hồ bơi' WHEN 'gym' THEN 'Phòng gym' WHEN 'balcony' THEN 'Ban công' WHEN 'parking' THEN 'Chỗ để xe máy' WHEN 'elevator' THEN 'Thang máy' WHEN 'workspace' THEN 'Góc làm việc riêng' WHEN 'pet-friendly' THEN 'Cho phép thú nuôi' WHEN 'sea-view' THEN 'Hướng biển' ELSE label END WHERE label_vi IS NULL;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.neighborhoods,public.amenities FROM PUBLIC,anon,authenticated;
-- No public exposure of other admin settings.
CREATE OR REPLACE FUNCTION public.danest_extra_required_10a11() RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT extra_required_fields_10a11 FROM public.admin_settings WHERE singleton;
$$;
CREATE OR REPLACE FUNCTION public.danest_save_required_10a11(p_fields text[],p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old text[]; v_new text[];
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_fields IS NULL OR array_position(p_fields,NULL) IS NOT NULL OR NOT p_fields <@ ARRAY['floorLevel','amenities','rentalNotes']::text[] OR cardinality(p_fields)>3 OR coalesce(length(btrim(p_reason)),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid fields or reason'; END IF;
 PERFORM pg_advisory_xact_lock(10111,1);
 IF 'amenities'=ANY(p_fields) AND NOT EXISTS(SELECT 1 FROM public.amenities WHERE active) THEN RAISE EXCEPTION 'At least one active amenity is required'; END IF;
 SELECT extra_required_fields_10a11 INTO STRICT v_old FROM public.admin_settings WHERE singleton FOR UPDATE;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO v_new FROM unnest(p_fields) AS u(x);
 UPDATE public.admin_settings SET extra_required_fields_10a11=v_new,updated_at=now() WHERE singleton;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,reason,old_values,new_values) VALUES('admin',auth.uid(),'required-fields-updated','settings','listing-fields',btrim(p_reason),jsonb_build_object('fields',v_old),jsonb_build_object('fields',v_new));
END $$;
CREATE OR REPLACE FUNCTION public.danest_save_catalog_10a11(p_kind text,p_id text,p_en text,p_vi text,p_active boolean,p_lat double precision,p_lng double precision,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old jsonb; v_new jsonb;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('neighborhood','amenity') OR p_id IS NULL OR p_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_id)>64 OR p_id='any' OR coalesce(length(btrim(p_en)),0) NOT BETWEEN 1 AND 100 OR coalesce(length(btrim(p_vi)),0) NOT BETWEEN 1 AND 100 OR p_active IS NULL OR coalesce(length(btrim(p_reason)),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid catalog values or reason'; END IF;
 -- Serialize catalog edits to enforce the last-active guard and record reliable before/after.
 PERFORM pg_advisory_xact_lock(10111,1);
 IF p_kind='neighborhood' THEN
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Valid neighborhood coordinates required'; END IF;
  SELECT to_jsonb(n) INTO v_old FROM public.neighborhoods n WHERE id=p_id;
  IF v_old IS NULL AND (SELECT count(*) FROM public.neighborhoods)>=200 THEN RAISE EXCEPTION 'Maximum 200 neighborhoods'; END IF;
  IF NOT p_active AND NOT EXISTS(SELECT 1 FROM public.neighborhoods WHERE active AND id<>p_id) THEN RAISE EXCEPTION 'At least one active neighborhood is required'; END IF;
  INSERT INTO public.neighborhoods(id,name,name_vi,lat,lng,active) VALUES(p_id,btrim(p_en),btrim(p_vi),p_lat,p_lng,p_active) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_vi=excluded.name_vi,lat=excluded.lat,lng=excluded.lng,active=excluded.active;
  SELECT to_jsonb(n) INTO v_new FROM public.neighborhoods n WHERE id=p_id;
 ELSE
  SELECT to_jsonb(a) INTO v_old FROM public.amenities a WHERE id=p_id;
  IF v_old IS NULL AND (SELECT count(*) FROM public.amenities)>=200 THEN RAISE EXCEPTION 'Maximum 200 amenities'; END IF;
  IF NOT p_active AND EXISTS(SELECT 1 FROM public.admin_settings WHERE singleton AND 'amenities'=ANY(extra_required_fields_10a11)) AND NOT EXISTS(SELECT 1 FROM public.amenities WHERE active AND id<>p_id) THEN RAISE EXCEPTION 'At least one active amenity is required'; END IF;
  INSERT INTO public.amenities(id,label,label_vi,active) VALUES(p_id,btrim(p_en),btrim(p_vi),p_active) ON CONFLICT(id) DO UPDATE SET label=excluded.label,label_vi=excluded.label_vi,active=excluded.active;
  SELECT to_jsonb(a) INTO v_new FROM public.amenities a WHERE id=p_id;
 END IF;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,reason,old_values,new_values) VALUES('admin',auth.uid(),'catalog-updated',p_kind,p_id,btrim(p_reason),v_old,v_new);
END $$;
-- Existing inactive values may be retained/removed; new assignments must be active.
CREATE OR REPLACE FUNCTION public.danest_catalog_guard_10a11() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old_amen jsonb:='[]'; v_old_area text;
BEGIN
 IF auth.uid() IS NULL OR public.danest_active_role() IS DISTINCT FROM 'landlord' OR NEW.owner_id IS DISTINCT FROM auth.uid() OR NEW.is_demo THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN v_old_amen:=coalesce(OLD.amenities,'[]'); v_old_area:=OLD.neighborhood_id; END IF;
 IF NEW.neighborhood_id IS DISTINCT FROM v_old_area AND NOT EXISTS(SELECT 1 FROM public.neighborhoods WHERE id=NEW.neighborhood_id AND active) THEN RAISE EXCEPTION 'Choose an active neighborhood'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(NEW.amenities,'[]')) u(id) WHERE NOT (v_old_amen ? u.id) AND NOT EXISTS(SELECT 1 FROM public.amenities a WHERE a.id=u.id AND a.active)) THEN RAISE EXCEPTION 'Choose active amenities only'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS danest_catalog_guard_10a11 ON public.properties;
CREATE TRIGGER danest_catalog_guard_10a11 BEFORE INSERT OR UPDATE OF neighborhood_id,amenities ON public.properties FOR EACH ROW EXECUTE FUNCTION public.danest_catalog_guard_10a11();
-- FR-07: owner changes, not admin moderation or Cron. No status changes, no verification grants.
CREATE OR REPLACE FUNCTION public.danest_confirm_material_edit_10a11() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND OLD.owner_id=auth.uid() AND NEW.owner_id=OLD.owner_id AND NOT OLD.is_demo AND public.danest_active_role()='landlord' AND OLD.status NOT IN ('hidden','archived') AND (NEW.price IS DISTINCT FROM OLD.price OR NEW.images IS DISTINCT FROM OLD.images OR NEW.availability IS DISTINCT FROM OLD.availability OR NEW.available_from IS DISTINCT FROM OLD.available_from) THEN
  NEW.last_availability_confirmed_at:=now(); NEW.availability_reminder_sent_at:=NULL;
  NEW.listing_data:=coalesce(NEW.listing_data,'{}')||jsonb_build_object('lastAvailabilityConfirmedAt',NEW.last_availability_confirmed_at,'availabilityReminderSentAt',NULL);
  INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values) VALUES('landlord',auth.uid(),'availability-confirmed-by-edit','listing',NEW.id::text,jsonb_build_object('confirmed_at',OLD.last_availability_confirmed_at,'availability',OLD.availability),jsonb_build_object('confirmed_at',NEW.last_availability_confirmed_at,'availability',NEW.availability,'price_changed',NEW.price IS DISTINCT FROM OLD.price,'images_changed',NEW.images IS DISTINCT FROM OLD.images,'available_from_changed',NEW.available_from IS DISTINCT FROM OLD.available_from));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS danest_confirm_material_edit_10a11 ON public.properties;
CREATE TRIGGER danest_confirm_material_edit_10a11 BEFORE UPDATE OF price,images,availability,available_from ON public.properties FOR EACH ROW EXECUTE FUNCTION public.danest_confirm_material_edit_10a11();
-- Image digest is an untrusted owner-supplied hint (not proof of authenticity), exact bytes only.
CREATE OR REPLACE FUNCTION public.danest_register_image_hash_10a11(p_listing_id uuid,p_path text,p_sha256 text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid image digest'; END IF;
 v_id:=public.danest_register_listing_image(p_listing_id,p_path);
 UPDATE public.listing_image SET content_hash_10a11=p_sha256 WHERE id=v_id AND listing_id=p_listing_id AND content_hash_10a11 IS NULL;
 RETURN v_id;
END $$;
-- Shared detector: submission and admin comparison use the same current candidate rules.
CREATE OR REPLACE FUNCTION public.danest_duplicate_candidates_internal_10a11(p_listing_id uuid) RETURNS TABLE(candidate_id uuid,source_id text,address_match boolean,image_match boolean,near_title_match boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH candidates AS (
 SELECT p.id AS candidate_id,p.source_id::text AS source_id,
  (length(btrim(coalesce(b.address,'')))>8 AND btrim(regexp_replace(lower(btrim(coalesce(p.address,''))),'[^[:alnum:]]+',' ','g'))=btrim(regexp_replace(lower(btrim(b.address)),'[^[:alnum:]]+',' ','g'))) AS address_match,
  EXISTS(SELECT 1 FROM public.listing_image x JOIN public.listing_image y ON (x.url=y.url OR (x.content_hash_10a11 IS NOT NULL AND x.content_hash_10a11=y.content_hash_10a11)) WHERE x.listing_id=b.id AND y.listing_id=p.id AND btrim(x.url)<>'') AS image_match,
  coalesce(b.latitude BETWEEN -90 AND 90 AND p.latitude BETWEEN -90 AND 90 AND b.longitude BETWEEN -180 AND 180 AND p.longitude BETWEEN -180 AND 180 AND b.listing_data->'location'->>'precision'='owner-selected' AND p.listing_data->'location'->>'precision'='owner-selected' AND abs(b.latitude-p.latitude)<=0.0005 AND abs(b.longitude-p.longitude)<=0.0005 AND lower(btrim(b.title))=lower(btrim(p.title)),false) AS near_title_match
 FROM public.properties b JOIN public.properties p ON p.id<>b.id AND p.status IS DISTINCT FROM 'archived' WHERE b.id=p_listing_id AND NOT p.is_demo
 ) SELECT c.* FROM candidates c WHERE c.address_match OR c.image_match OR c.near_title_match ORDER BY (c.address_match AND c.image_match) DESC,c.image_match DESC,c.address_match DESC,c.candidate_id LIMIT 50;
$$;
CREATE OR REPLACE FUNCTION public.danest_admin_duplicates_10a11(p_listing_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM public.danest_duplicate_candidates_internal_10a11(p_listing_id) c);
END $$;

CREATE OR REPLACE FUNCTION public.danest_submit_listing(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_p public.properties%ROWTYPE; v_actor uuid:=auth.uid(); v_missing text[]:='{}';
 v_reasons text[]:='{}'; v_checks jsonb:='[]'; v_content text; v_area_key text;
 v_min numeric; v_max numeric; v_deposit text; v_image_count integer;
 v_required text; v_content_result text:='passed'; v_price_result text:='passed'; v_image_result text:='passed';
 v_duplicate boolean:=false; v_result text; v_status text; v_payload jsonb; v_detail text; v_hit text; v_extra_required text[];
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active landlord required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_p FROM public.properties WHERE id=p_listing_id FOR UPDATE;
 IF NOT FOUND OR v_p.owner_id IS DISTINCT FROM v_actor OR v_p.is_demo THEN RAISE EXCEPTION 'Listing not owned by caller' USING ERRCODE='42501'; END IF;
 IF v_p.status IS NULL OR v_p.status NOT IN ('draft','pending','needs-attention','rejected','paused') THEN RAISE EXCEPTION 'Listing cannot be submitted in current status'; END IF;
 SELECT extra_required_fields_10a11 INTO STRICT v_extra_required FROM public.admin_settings WHERE singleton;
 v_area_key:=coalesce(v_p.neighborhood_id,nullif(v_p.neighborhood,''));
 IF v_p.availability='unavailable' THEN v_missing:=array_append(v_missing,'availability (mark available or reserved before submission)'); END IF;
 IF length(btrim(coalesce(v_p.title,'')))<8 THEN v_missing:=array_append(v_missing,'title (8 characters)'); END IF;
 IF v_p.listing_data->>'schemaVersion'='09B1' THEN
  IF btrim(coalesce(v_p.summary,''))='' THEN v_missing:=array_append(v_missing,'summary'); END IF;
  IF coalesce(v_p.listing_data->>'locationRequired','false')='true' AND v_p.listing_data->'location'->>'precision' IS DISTINCT FROM 'owner-selected' THEN v_missing:=array_append(v_missing,'selected map location'); END IF;
 END IF;
 IF length(btrim(coalesce(v_p.description,'')))<40 THEN v_missing:=array_append(v_missing,'description (40 characters)'); END IF;
 IF coalesce(v_p.price,0)<=0 OR v_p.price::text IN ('NaN','Infinity','-Infinity') THEN v_missing:=array_append(v_missing,'monthly rent'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.neighborhoods WHERE id=v_area_key) THEN v_missing:=array_append(v_missing,'neighborhood'); END IF;
 IF btrim(coalesce(v_p.address,''))='' THEN v_missing:=array_append(v_missing,'address'); END IF;
 IF v_p.bedrooms IS NULL OR v_p.bedrooms<0 THEN v_missing:=array_append(v_missing,'bedrooms'); END IF;
 IF coalesce(v_p.bathrooms,0)<1 THEN v_missing:=array_append(v_missing,'bathrooms'); END IF;
 IF coalesce(v_p.area,0)<=0 OR v_p.area::text IN ('NaN','Infinity','-Infinity') THEN v_missing:=array_append(v_missing,'floor area'); END IF;
 -- Legacy data may contain static photos. Only registered images count here.
 SELECT count(*) INTO v_image_count FROM public.listing_image WHERE listing_id=p_listing_id AND btrim(url)<>'';
 IF v_image_count=0 THEN v_missing:=array_append(v_missing,'registered image'); END IF;
 IF v_p.available_from IS NULL THEN v_missing:=array_append(v_missing,'available-from date'); END IF;
 v_deposit:=coalesce(v_p.deposit_months::text,v_p.costs->>'depositMonths',v_p.listing_data->'costs'->>'depositMonths');
 IF v_deposit IS NULL OR v_deposit !~ '^[0-9]+(\.[0-9]+)?$' THEN v_missing:=array_append(v_missing,'deposit months'); END IF;
 IF EXISTS(SELECT 1 FROM public.listing_cost WHERE listing_id=p_listing_id AND amount IS NULL AND state<>'unknown') THEN v_missing:=array_append(v_missing,'additional fees'); END IF;
 IF 'floorLevel'=ANY(v_extra_required) AND coalesce(btrim(v_p.floor_level),'') IN ('','—') THEN v_missing:=array_append(v_missing,'floor level'); END IF;
 IF 'amenities'=ANY(v_extra_required) AND NOT EXISTS(SELECT 1 FROM public.listing_amenity WHERE listing_id=p_listing_id) THEN v_missing:=array_append(v_missing,'at least one amenity'); END IF;
 IF 'rentalNotes'=ANY(v_extra_required) AND NOT EXISTS(SELECT 1 FROM public.rental_terms rt CROSS JOIN LATERAL unnest(rt.notes) AS n(note) WHERE rt.listing_id=p_listing_id AND btrim(n.note)<>'') THEN v_missing:=array_append(v_missing,'rental conditions'); END IF;
 v_required:=CASE WHEN cardinality(v_missing)>0 THEN 'incomplete' ELSE 'passed' END;
 v_detail:=CASE WHEN v_required='passed' THEN 'Required fields are complete.' ELSE 'Missing: '||array_to_string(v_missing,', ') END;
 IF v_required='incomplete' THEN v_reasons:=array_append(v_reasons,v_detail); END IF;
 v_checks:=v_checks||jsonb_build_array(jsonb_build_object('id','required-info','label','Required information','result',v_required,'detail',v_detail));
 v_content:=lower(concat_ws(' ',v_p.title,coalesce(v_p.summary,v_p.listing_data->>'summary'),v_p.description));
 SELECT w INTO v_hit FROM unnest(ARRAY['guaranteed approval','no documents','cash only, no contract','cash only no contract','100% verified','official owner','under the table']) AS u(w) WHERE strpos(v_content,w)>0 LIMIT 1;
 IF FOUND THEN v_content_result:='rejected'; v_detail:='Prohibited wording: '||v_hit;
 ELSE
   SELECT w INTO v_hit FROM unnest(ARRAY['luxury for cheap','views maybe','best price guaranteed','definitely quiet']) AS u(w) WHERE strpos(v_content,w)>0 LIMIT 1;
   IF FOUND THEN v_content_result:='needs-attention'; v_detail:='Potentially misleading wording: '||v_hit;
   ELSIF (v_p.title=upper(v_p.title) AND v_p.title<>lower(v_p.title)) OR length(v_p.title)-length(replace(v_p.title,'!',''))>=2 THEN v_content_result:='needs-attention'; v_detail:='Title contains all capitals or repeated exclamation marks.';
   ELSIF v_content ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}' OR v_content ~ '(^|[^0-9])([+]?[0-9][ .()-]*){9,15}([^0-9]|$)' THEN v_content_result:='needs-attention'; v_detail:='Possible contact information in public content; manual review required.';
   ELSE v_detail:='No configured prohibited or misleading phrase found.'; END IF;
 END IF;
 IF v_content_result<>'passed' THEN v_reasons:=array_append(v_reasons,v_detail); END IF;
 v_checks:=v_checks||jsonb_build_array(jsonb_build_object('id','content','label','Content screening','result',v_content_result,'detail',v_detail));
 v_min:=CASE v_area_key WHEN 'an-thuong' THEN 250 WHEN 'my-an' THEN 220 ELSE 200 END;
 v_max:=CASE v_area_key WHEN 'my-an' THEN 2600 WHEN 'han-river' THEN 3500 ELSE 3000 END;
 SELECT coalesce(moderation_price_min_usd,v_min),coalesce(moderation_price_max_usd,v_max) INTO STRICT v_min,v_max FROM public.admin_settings WHERE singleton;
 IF coalesce(v_p.price,0)<=0 OR v_p.price::text IN ('NaN','Infinity','-Infinity') THEN v_price_result:='incomplete'; v_detail:='No valid rent.';
 ELSIF v_p.price<v_min OR v_p.price>v_max THEN v_price_result:='needs-attention'; v_detail:='Rent outside configured demo range (USD '||v_min||'–'||v_max||').';
 ELSE v_detail:='Rent inside configured demo range.'; END IF;
 IF v_price_result<>'passed' THEN v_reasons:=array_append(v_reasons,v_detail); END IF;
 v_checks:=v_checks||jsonb_build_array(jsonb_build_object('id','pricing','label','Pricing sanity','result',v_price_result,'detail',v_detail));
 IF v_image_count=0 THEN v_image_result:='incomplete'; v_detail:='No registered image.';
 ELSIF EXISTS (SELECT 1 FROM public.listing_image WHERE listing_id=p_listing_id AND url ~* '(placeholder|lorem|via\.placeholder|dummyimage|example\.com)') OR (v_p.area<25 AND v_p.bedrooms>=3) THEN v_image_result:='needs-attention'; v_detail:='Potential placeholder or inconsistent layout.';
 ELSE v_detail:='No configured image heuristic triggered; image authenticity not verified.'; END IF;
 IF v_image_result<>'passed' THEN v_reasons:=array_append(v_reasons,v_detail); END IF;
 v_checks:=v_checks||jsonb_build_array(jsonb_build_object('id','images','label','Image relevance','result',v_image_result,'detail',v_detail));
 SELECT EXISTS(SELECT 1 FROM public.danest_duplicate_candidates_internal_10a11(p_listing_id)) INTO v_duplicate;
 v_detail:=CASE WHEN v_duplicate THEN 'Potential duplicate; manual review required.' ELSE 'No duplicate found by configured heuristic.' END;
 IF v_duplicate THEN v_reasons:=array_append(v_reasons,v_detail); END IF;
 v_checks:=v_checks||jsonb_build_array(jsonb_build_object('id','duplicates','label','Duplicate detection','result',CASE WHEN v_duplicate THEN 'needs-attention' ELSE 'passed' END,'detail',v_detail));
 v_result:=CASE WHEN v_required='incomplete' OR v_price_result='incomplete' OR v_image_result='incomplete' THEN 'incomplete' WHEN v_content_result='rejected' THEN 'rejected' WHEN v_duplicate OR 'needs-attention' IN (v_content_result,v_price_result,v_image_result) THEN 'needs-attention' ELSE 'passed' END;
 v_status:=CASE v_result WHEN 'incomplete' THEN 'draft' WHEN 'rejected' THEN 'rejected' WHEN 'needs-attention' THEN 'needs-attention' ELSE 'pending' END;
 v_payload:=jsonb_build_object('result',v_result,'checks',v_checks,'reasons',to_jsonb(v_reasons),'duplicateRisk',v_duplicate,'autoReviewedAt',now(),'manualReview',NULL);
 INSERT INTO public.moderation_auto(listing_id,result,checks,reasons,duplicate_risk,auto_reviewed_at) VALUES(p_listing_id,v_result,v_checks,v_reasons,v_duplicate,now()) ON CONFLICT(listing_id) DO UPDATE SET result=excluded.result,checks=excluded.checks,reasons=excluded.reasons,duplicate_risk=excluded.duplicate_risk,auto_reviewed_at=excluded.auto_reviewed_at;
 UPDATE public.properties SET status=v_status,updated_at=now(),last_availability_confirmed_at=CASE WHEN v_result IN ('passed','needs-attention') AND v_p.availability='available' THEN now() ELSE last_availability_confirmed_at END,availability_reminder_sent_at=CASE WHEN v_result IN ('passed','needs-attention') AND v_p.availability='available' THEN NULL ELSE availability_reminder_sent_at END,listing_data=coalesce(listing_data,'{}'::jsonb)||jsonb_build_object('status',v_status,'moderation',v_payload) WHERE id=p_listing_id;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values) VALUES('system',NULL,'listing-auto-moderated','listing',p_listing_id::text,jsonb_build_object('status',v_p.status),jsonb_build_object('status',v_status,'result',v_result));
 RETURN jsonb_build_object('listing_id',p_listing_id,'status',v_status,'moderation',v_payload);
END $$;

REVOKE ALL ON FUNCTION public.danest_extra_required_10a11(),public.danest_save_required_10a11(text[],text),public.danest_save_catalog_10a11(text,text,text,text,boolean,double precision,double precision,text),public.danest_catalog_guard_10a11(),public.danest_confirm_material_edit_10a11(),public.danest_register_image_hash_10a11(uuid,text,text),public.danest_duplicate_candidates_internal_10a11(uuid),public.danest_admin_duplicates_10a11(uuid),public.danest_submit_listing(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_extra_required_10a11() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_save_required_10a11(text[],text),public.danest_save_catalog_10a11(text,text,text,text,boolean,double precision,double precision,text),public.danest_register_image_hash_10a11(uuid,text,text),public.danest_admin_duplicates_10a11(uuid),public.danest_submit_listing(uuid) TO authenticated;
COMMIT;
SELECT 'anon_catalog_write' AS check_name,has_function_privilege('anon','public.danest_save_catalog_10a11(text,text,text,text,boolean,double precision,double precision,text)','EXECUTE') AS actual,false AS expected
UNION ALL SELECT 'direct_catalog_write',has_table_privilege('authenticated','public.neighborhoods','INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated','public.amenities','INSERT,UPDATE,DELETE'),false
UNION ALL SELECT 'anon_duplicates',has_function_privilege('anon','public.danest_admin_duplicates_10a11(uuid)','EXECUTE'),false
UNION ALL SELECT 'internal_detector',has_function_privilege('authenticated','public.danest_duplicate_candidates_internal_10a11(uuid)','EXECUTE'),false
UNION ALL SELECT 'digest_private',has_column_privilege('anon','public.listing_image','content_hash_10a11','SELECT') OR has_column_privilege('authenticated','public.listing_image','content_hash_10a11','SELECT'),false
UNION ALL SELECT 'public_required_fields',has_function_privilege('anon','public.danest_extra_required_10a11()','EXECUTE'),true
UNION ALL SELECT 'confirmation_trigger',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.properties'::regclass AND tgname='danest_confirm_material_edit_10a11' AND tgenabled<>'D'),true;
