-- 09B1: Run after 09A1 and 07C. No existing listing edits at install time.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_save_listing(uuid,jsonb)') IS NULL OR to_regprocedure('public.danest_guard_evidence_material_edit()') IS NULL OR to_regprocedure('public.danest_public_listing_json_08a(jsonb)') IS NULL THEN RAISE EXCEPTION 'Install 07B, 07C, 08A and 09A1 first'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.danest_save_listing(p_listing_id uuid,p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); p public.properties%ROWTYPE; n public.neighborhoods%ROWTYPE; v_id uuid; v_source text; v_title text:=btrim(p_data->>'title'); v_summary text:=btrim(p_data->>'summary'); v_desc text:=btrim(p_data->>'description'); v_address text:=btrim(p_data->>'address'); v_rent numeric:= (p_data->>'monthlyRent')::numeric; v_area numeric:=(p_data->>'floorArea')::numeric; v_beds integer:=(p_data->>'bedrooms')::integer; v_baths integer:=(p_data->>'bathrooms')::integer; v_min integer:=(p_data->'rentalDurationMonths'->>0)::integer; v_max integer:=(p_data->'rentalDurationMonths'->>1)::integer; v_deposit integer:=(p_data->'costs'->>'depositMonths')::integer; v_available date:=nullif(p_data->>'availableFrom','')::date; v_furn text:=p_data->>'furnishing'; v_amen jsonb:=coalesce(p_data->'amenities','[]'); v_cost jsonb:=coalesce(p_data->'costs'->'items','[]'); v_avail text; v_clean_cost jsonb; v_json jsonb; v_terms jsonb; v_landlord jsonb; v_images jsonb; v_type text; v_lat double precision; v_lng double precision; v_precision text; v_floor text; v_payment integer; v_notes text[]; v_draft boolean:=coalesce(p_data->>'draftOnly','false')='true'; v_require_pin boolean; v_snapshot uuid[]; v_order uuid[]; v_actual uuid[]; v_shift integer; v_old_count integer;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active landlord required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR coalesce(length(v_title),0) NOT BETWEEN (CASE WHEN v_draft THEN 1 ELSE 8 END) AND 255 OR coalesce(length(v_summary),0) NOT BETWEEN (CASE WHEN v_draft THEN 0 ELSE 1 END) AND 120 OR coalesce(length(v_desc),0) NOT BETWEEN (CASE WHEN v_draft THEN 0 ELSE 40 END) AND 15000 OR coalesce(length(v_address),0) NOT BETWEEN (CASE WHEN v_draft THEN 0 ELSE 1 END) AND 500 OR v_rent IS NULL OR v_rent NOT BETWEEN 0.01 AND 99999999 OR v_area IS NULL OR v_area NOT BETWEEN 10.01 AND 100000 OR v_beds IS NULL OR v_beds NOT BETWEEN 0 AND 6 OR v_baths IS NULL OR v_baths NOT BETWEEN 1 AND 4 OR v_min IS NULL OR v_max IS NULL OR v_min NOT BETWEEN 1 AND 12 OR v_max NOT BETWEEN v_min AND 12 OR v_deposit IS NULL OR v_deposit NOT BETWEEN 1 AND 3 OR (NOT v_draft AND v_available IS NULL) OR v_furn IS NULL OR v_furn NOT IN ('furnished','semi-furnished','unfurnished') THEN RAISE EXCEPTION 'Invalid or incomplete listing fields'; END IF;
 SELECT * INTO n FROM public.neighborhoods WHERE id=p_data->>'neighborhood'; IF NOT FOUND THEN RAISE EXCEPTION 'Invalid neighborhood'; END IF;
 IF jsonb_typeof(v_amen) IS DISTINCT FROM 'array' OR jsonb_typeof(v_cost) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid amenities or costs'; END IF;
 IF jsonb_array_length(v_amen)>12 OR jsonb_array_length(v_cost)>30 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_amen) x WHERE NOT EXISTS(SELECT 1 FROM public.amenities am WHERE am.id=x.value)) THEN RAISE EXCEPTION 'Invalid amenities or too many costs'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_cost) x WHERE coalesce(length(btrim(x.value->>'label')),0) NOT BETWEEN 1 AND 150 OR coalesce(x.value->>'state','') NOT IN ('fixed','variable','reported','unknown') OR ((x.value->>'amount') IS NULL AND x.value->>'state'<>'unknown') OR ((x.value->>'amount') IS NOT NULL AND ((x.value->>'amount')::numeric NOT BETWEEN 0 AND 99999999))) THEN RAISE EXCEPTION 'Invalid cost'; END IF;
 IF p_listing_id IS NOT NULL THEN
  SELECT * INTO p FROM public.properties WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND OR p.owner_id IS DISTINCT FROM a OR p.is_demo IS DISTINCT FROM false THEN RAISE EXCEPTION 'Listing not owned by caller' USING ERRCODE='42501'; END IF;
  IF p.status IS NULL OR p.status NOT IN ('draft','pending','needs-attention','rejected','paused','published') OR p.verification_level IS DISTINCT FROM 'unverified' THEN RAISE EXCEPTION 'Listing locked; contact admin before editing verified or hidden listings'; END IF;
  v_id:=p.id; v_source:=coalesce(p.source_id,p.id::text); v_avail:=coalesce(p.availability,'available'); v_type:=coalesce(p_data->>'type',p.property_type,'apartment');
 ELSE v_id:=gen_random_uuid(); v_source:=v_id::text; v_avail:='available'; v_type:=coalesce(p_data->>'type',CASE WHEN v_beds=0 THEN 'studio' ELSE 'apartment' END); END IF;
 v_avail:=coalesce(p_data->>'availability',v_avail);
 IF v_avail NOT IN ('available','reserved','unavailable') THEN RAISE EXCEPTION 'Invalid availability'; END IF;
 IF v_type NOT IN ('apartment','studio','serviced-apartment','penthouse') THEN RAISE EXCEPTION 'Invalid apartment type'; END IF;
 v_floor:=CASE WHEN p_data ? 'floorLevel' THEN coalesce(nullif(btrim(p_data->>'floorLevel'),''),'—') ELSE coalesce(p.floor_level,'—') END;
 IF length(v_floor)>80 THEN RAISE EXCEPTION 'Floor label too long'; END IF;
 v_require_pin:=p_listing_id IS NULL OR coalesce(p.listing_data->>'locationRequired','false')='true';
 v_precision:=coalesce(p_data->'location'->>'precision','approximate');
 IF v_precision NOT IN ('owner-selected','approximate') THEN RAISE EXCEPTION 'Invalid location precision'; END IF;
 IF v_precision='owner-selected' THEN
   v_lat:=(p_data->'location'->>'lat')::double precision; v_lng:=(p_data->'location'->>'lng')::double precision;
   IF v_lat IS NULL OR v_lng IS NULL OR v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
 ELSE
   IF p_listing_id IS NOT NULL AND p.neighborhood_id=n.id AND p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180 THEN v_lat:=p.latitude;v_lng:=p.longitude; ELSE v_lat:=n.lat;v_lng:=n.lng; END IF;
 END IF;
 IF v_require_pin AND NOT v_draft AND v_precision<>'owner-selected' THEN RAISE EXCEPTION 'Choose an apartment location on the map'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_cost) x WHERE coalesce(x.value->>'cadence','monthly') NOT IN ('monthly','one-time') OR coalesce(x.value->>'unit','per month') NOT IN ('per month','per month, estimated','per stay','per kWh','per m³','per person/month','per m²/month') OR (coalesce(x.value->>'cadence','monthly')='one-time' AND coalesce(x.value->>'unit','per month') NOT IN ('per stay','per month','per month, estimated')) OR (coalesce(x.value->>'cadence','monthly')='monthly' AND x.value->>'unit'='per stay')) THEN RAISE EXCEPTION 'Invalid cost unit or cadence'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id','fee-'||i,'label',btrim(x->>'label'),'amount',CASE WHEN x->>'state'='unknown' THEN NULL ELSE round((x->>'amount')::numeric,2) END,'unit',CASE WHEN x->>'cadence'='one-time' THEN 'per stay' WHEN x->>'unit'='per month, estimated' THEN 'per month' ELSE coalesce(x->>'unit','per month') END,'state',x->>'state','cadence',coalesce(x->>'cadence','monthly')) ORDER BY i),'[]') INTO v_clean_cost FROM jsonb_array_elements(v_cost) WITH ORDINALITY AS z(x,i);
 v_payment:=coalesce((p_data->'rentalTerms'->>'paymentDayOfMonth')::integer,1);
 IF v_payment NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'Invalid payment day'; END IF;
 IF jsonb_typeof(coalesce(p_data->'rentalTerms'->'notes','[]'::jsonb)) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid rental notes'; END IF;
 SELECT coalesce(array_agg(btrim(value)),'{}') INTO v_notes FROM jsonb_array_elements_text(coalesce(p_data->'rentalTerms'->'notes','[]'::jsonb)) WHERE btrim(value)<>'';
 IF cardinality(v_notes)>50 OR length(array_to_string(v_notes,' '))>2000 THEN RAISE EXCEPTION 'Rental notes too long'; END IF;
 SELECT jsonb_build_object('minMonths',v_min,'maxMonths',v_max,'paymentDayOfMonth',v_payment,'utilitiesIncluded',utilities_included,'notes',v_notes) INTO v_terms FROM public.rental_terms WHERE listing_id=v_id;
 v_terms:=coalesce(v_terms,jsonb_build_object('minMonths',v_min,'maxMonths',v_max,'paymentDayOfMonth',v_payment,'utilitiesIncluded','[]'::jsonb,'notes',v_notes));
 -- Photo changes are atomic with saving the listing. Full snapshot guards concurrent edits.
 IF p_data ? 'photoOrder' OR p_data ? 'photoSnapshot' THEN
   IF p_listing_id IS NULL OR jsonb_typeof(p_data->'photoOrder') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'photoSnapshot') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid photo plan'; END IF;
   SELECT coalesce(array_agg(value::uuid ORDER BY ord),'{}') INTO v_snapshot FROM jsonb_array_elements_text(p_data->'photoSnapshot') WITH ORDINALITY AS q(value,ord);
   SELECT coalesce(array_agg(value::uuid ORDER BY ord),'{}') INTO v_order FROM jsonb_array_elements_text(p_data->'photoOrder') WITH ORDINALITY AS q(value,ord);
   SELECT coalesce(array_agg(id ORDER BY position),'{}'),coalesce(max(position),0)+1,count(*) INTO v_actual,v_shift,v_old_count FROM public.listing_image WHERE listing_id=v_id;
   IF v_snapshot IS DISTINCT FROM v_actual OR cardinality(v_order)>30 OR array_position(v_order,NULL) IS NOT NULL OR cardinality(v_order)<>(SELECT count(DISTINCT x) FROM unnest(v_order) AS u(x)) OR NOT v_order <@ v_actual THEN RAISE EXCEPTION 'Photos changed or invalid photo IDs; reopen the listing'; END IF;
   DELETE FROM public.listing_image WHERE listing_id=v_id AND NOT(id=ANY(v_order));
   UPDATE public.listing_image SET position=position+v_shift WHERE listing_id=v_id;
   UPDATE public.listing_image AS li SET position=(q.ord-1)::integer FROM unnest(v_order) WITH ORDINALITY AS q(id,ord) WHERE li.listing_id=v_id AND li.id=q.id;
   INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values) VALUES('landlord',a,'listing-photos-updated','listing',v_id::text,jsonb_build_object('count',v_old_count,'order',v_actual),jsonb_build_object('count',cardinality(v_order),'order',v_order));
 END IF;
 SELECT jsonb_build_object('id',a,'displayName',coalesce(nullif(full_name,''),'DaNest landlord'),'role','Private landlord','languages','[]'::jsonb,'responseTime','Not yet measured','memberSince',created_at::date) INTO v_landlord FROM public.profiles WHERE id=a;
 SELECT coalesce(jsonb_agg(url ORDER BY position),'[]') INTO v_images FROM public.listing_image WHERE listing_id=v_id;
 v_json:=jsonb_build_object('id',v_source,'slug',v_source,'title',v_title,'summary',v_summary,'description',v_desc,'neighborhood',n.id,'address',v_address,'location',jsonb_build_object('lat',v_lat,'lng',v_lng,'precision',v_precision),'locationRequired',v_require_pin,'schemaVersion','09B1','type',v_type,'monthlyRent',v_rent,'bedrooms',v_beds,'bathrooms',v_baths,'floorArea',v_area,'floorLevel',v_floor,'furnishing',v_furn,'amenities',v_amen,'availability',v_avail,'availableFrom',coalesce(v_available::text,''),'rentalDurationMonths',jsonb_build_array(v_min,v_max),'images',v_images,'verification',jsonb_build_object('checks','[]'::jsonb,'lastAvailabilityConfirmed',NULL),'verificationBadge',false,'costs',jsonb_build_object('monthlyRent',v_rent,'depositMonths',v_deposit,'depositAmount',v_rent*v_deposit,'items',v_clean_cost),'rentalTerms',v_terms,'neighborhoodNotes','[]'::jsonb,'distanceToBeach','To be confirmed','landlordId',a,'landlord',v_landlord,'status','draft','moderation',jsonb_build_object('result','incomplete','checks','[]'::jsonb,'reasons','[]'::jsonb,'duplicateRisk',false,'autoReviewedAt',NULL,'manualReview',NULL),'lastAvailabilityConfirmedAt',coalesce(p.last_availability_confirmed_at,now()),'availabilityReminderSentAt',p.availability_reminder_sent_at,'featured',false,'sponsored',false,'listedAt',coalesce(p.listed_at,now()),'views',0,'inquiries',0,'isSample',false);
 IF p_listing_id IS NULL THEN
 INSERT INTO public.properties(id,source_id,slug,owner_id,title,summary,description,price,area,neighborhood,neighborhood_id,address,latitude,longitude,property_type,floor_level,bedrooms,bathrooms,furnishing,images,amenities,availability,available_from,minimum_months,maximum_months,deposit_months,costs,landlord_info,verification,listing_data,status,is_demo,last_availability_confirmed_at)
 VALUES(v_id,v_source,v_source,a,v_title,v_summary,v_desc,v_rent,v_area,n.id,n.id,v_address,v_lat,v_lng,v_type,v_floor,v_beds,v_baths,v_furn,v_images,v_amen,v_avail,v_available,v_min,v_max,v_deposit,v_json->'costs',v_landlord,v_json->'verification',v_json,'draft',false,now());
 ELSE
 UPDATE public.properties SET source_id=v_source,title=v_title,summary=v_summary,description=v_desc,price=v_rent,area=v_area,neighborhood=n.id,neighborhood_id=n.id,address=v_address,latitude=v_lat,longitude=v_lng,property_type=v_type,floor_level=v_floor,bedrooms=v_beds,bathrooms=v_baths,furnishing=v_furn,images=v_images,amenities=v_amen,availability=v_avail,available_from=v_available,minimum_months=v_min,maximum_months=v_max,deposit_months=v_deposit,costs=v_json->'costs',landlord_info=v_landlord,verification=v_json->'verification',listing_data=v_json,status='draft',updated_at=now() WHERE id=v_id;
 END IF;
 DELETE FROM public.listing_amenity WHERE listing_id=v_id;
 INSERT INTO public.listing_amenity(listing_id,amenity_id) SELECT DISTINCT v_id,x.value FROM jsonb_array_elements_text(v_amen) x;
 DELETE FROM public.listing_cost WHERE listing_id=v_id;
 INSERT INTO public.listing_cost(listing_id,code,label,amount,unit,state,cadence,position) SELECT v_id,x->>'id',x->>'label',(x->>'amount')::numeric,x->>'unit',x->>'state',x->>'cadence',i-1 FROM jsonb_array_elements(v_clean_cost) WITH ORDINALITY z(x,i);
 INSERT INTO public.rental_terms(listing_id,payment_day_of_month,notes) VALUES(v_id,v_payment,v_notes) ON CONFLICT(listing_id) DO UPDATE SET payment_day_of_month=excluded.payment_day_of_month,notes=excluded.notes;
 INSERT INTO public.moderation_auto(listing_id,result,checks,reasons,duplicate_risk,auto_reviewed_at) VALUES(v_id,'incomplete','[]'::jsonb,'{}',false,NULL) ON CONFLICT(listing_id) DO UPDATE SET result=excluded.result,checks=excluded.checks,reasons=excluded.reasons,duplicate_risk=false,auto_reviewed_at=NULL;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values) VALUES('landlord',a,'listing-draft-saved','listing',v_id::text,CASE WHEN p_listing_id IS NULL THEN NULL ELSE jsonb_build_object('status',p.status,'price',p.price,'title',p.title) END,jsonb_build_object('status','draft','price',v_rent,'title',v_title));
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.danest_register_listing_image(p_listing_id uuid,p_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_p public.properties%ROWTYPE; v_id uuid; v_position integer;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active landlord required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_p FROM public.properties WHERE id=p_listing_id FOR UPDATE;
 IF NOT FOUND OR v_p.owner_id IS DISTINCT FROM auth.uid() OR v_p.is_demo THEN RAISE EXCEPTION 'Listing not owned by caller' USING ERRCODE='42501'; END IF;
 IF v_p.verification_level IS DISTINCT FROM 'unverified' OR v_p.status IS NULL OR v_p.status NOT IN ('draft','pending','needs-attention','rejected','paused') THEN RAISE EXCEPTION 'Listing is not editable'; END IF;
 IF p_path IS NULL OR p_path !~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
 OR split_part(p_path,'/',1)<>auth.uid()::text OR split_part(p_path,'/',2)<>p_listing_id::text
 OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='listing-images' AND name=p_path) THEN RAISE EXCEPTION 'Invalid or missing uploaded image'; END IF;
 SELECT id INTO v_id FROM public.listing_image WHERE listing_id=p_listing_id AND storage_path=p_path;
 IF FOUND THEN RETURN v_id; END IF;
 SELECT coalesce(max(position),-1)+1 INTO v_position FROM public.listing_image WHERE listing_id=p_listing_id;
 IF (SELECT count(*) FROM public.listing_image WHERE listing_id=p_listing_id)>=30 THEN RAISE EXCEPTION 'Maximum 30 registered images per listing'; END IF;
 INSERT INTO public.listing_image(listing_id,url,storage_path,position) VALUES(p_listing_id,p_path,p_path,v_position) RETURNING id INTO v_id;
 -- A changed listing returns to draft; submission must run the checks again.
 UPDATE public.properties SET status='draft', updated_at=now(), images=(SELECT coalesce(jsonb_agg(url ORDER BY position),'[]'::jsonb) FROM public.listing_image WHERE listing_id=p_listing_id), listing_data=coalesce(listing_data,'{}'::jsonb)||jsonb_build_object('status','draft','images',(SELECT coalesce(jsonb_agg(url ORDER BY position),'[]'::jsonb) FROM public.listing_image WHERE listing_id=p_listing_id)) WHERE id=p_listing_id;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values)
 VALUES('landlord',auth.uid(),'listing-image-registered','listing',p_listing_id::text,jsonb_build_object('status',v_p.status),jsonb_build_object('status','draft','image_id',v_id));
 RETURN v_id;
END $$;


CREATE OR REPLACE FUNCTION public.danest_submit_listing(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_p public.properties%ROWTYPE; v_actor uuid:=auth.uid(); v_missing text[]:='{}';
 v_reasons text[]:='{}'; v_checks jsonb:='[]'; v_content text; v_area_key text;
 v_min numeric; v_max numeric; v_deposit text; v_image_count integer;
 v_required text; v_content_result text:='passed'; v_price_result text:='passed'; v_image_result text:='passed';
 v_duplicate boolean:=false; v_result text; v_status text; v_payload jsonb; v_detail text; v_hit text;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active landlord required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_p FROM public.properties WHERE id=p_listing_id FOR UPDATE;
 IF NOT FOUND OR v_p.owner_id IS DISTINCT FROM v_actor OR v_p.is_demo THEN RAISE EXCEPTION 'Listing not owned by caller' USING ERRCODE='42501'; END IF;
 IF v_p.status IS NULL OR v_p.status NOT IN ('draft','pending','needs-attention','rejected','paused') THEN RAISE EXCEPTION 'Listing cannot be submitted in current status'; END IF;
 v_area_key:=coalesce(v_p.neighborhood_id,nullif(v_p.neighborhood,''));
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
   ELSE v_detail:='No configured prohibited or misleading phrase found.'; END IF;
 END IF;
 IF v_content_result<>'passed' THEN v_reasons:=array_append(v_reasons,v_detail); END IF;
 v_checks:=v_checks||jsonb_build_array(jsonb_build_object('id','content','label','Content screening','result',v_content_result,'detail',v_detail));
 v_min:=CASE v_area_key WHEN 'an-thuong' THEN 250 WHEN 'my-an' THEN 220 ELSE 200 END;
 v_max:=CASE v_area_key WHEN 'my-an' THEN 2600 WHEN 'han-river' THEN 3500 ELSE 3000 END;
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
 -- Conservative duplicate heuristic: normalized exact address, or exact title and shared cover.
 -- No disclosure of other owners' unpublished details in the result.
 SELECT EXISTS(SELECT 1 FROM public.properties p WHERE p.id<>p_listing_id AND p.status IS DISTINCT FROM 'archived' AND (
   (length(btrim(coalesce(v_p.address,'')))>8 AND regexp_replace(lower(btrim(p.address)),'[^[:alnum:]]+',' ','g')=regexp_replace(lower(btrim(v_p.address)),'[^[:alnum:]]+',' ','g'))
   OR (lower(btrim(p.title))=lower(btrim(v_p.title)) AND EXISTS(SELECT 1 FROM public.listing_image a JOIN public.listing_image b ON a.url=b.url WHERE a.listing_id=p_listing_id AND b.listing_id=p.id AND a.position=0 AND b.position=0))
 )) INTO v_duplicate;
 v_detail:=CASE WHEN v_duplicate THEN 'Potential duplicate; manual review required.' ELSE 'No duplicate found by configured heuristic.' END;
 IF v_duplicate THEN v_reasons:=array_append(v_reasons,v_detail); END IF;
 v_checks:=v_checks||jsonb_build_array(jsonb_build_object('id','duplicates','label','Duplicate detection','result',CASE WHEN v_duplicate THEN 'needs-attention' ELSE 'passed' END,'detail',v_detail));
 v_result:=CASE WHEN v_required='incomplete' OR v_price_result='incomplete' OR v_image_result='incomplete' THEN 'incomplete' WHEN v_content_result='rejected' THEN 'rejected' WHEN v_duplicate OR 'needs-attention' IN (v_content_result,v_price_result,v_image_result) THEN 'needs-attention' ELSE 'passed' END;
 v_status:=CASE v_result WHEN 'incomplete' THEN 'draft' WHEN 'rejected' THEN 'rejected' WHEN 'needs-attention' THEN 'needs-attention' ELSE 'pending' END;
 v_payload:=jsonb_build_object('result',v_result,'checks',v_checks,'reasons',to_jsonb(v_reasons),'duplicateRisk',v_duplicate,'autoReviewedAt',now(),'manualReview',NULL);
 INSERT INTO public.moderation_auto(listing_id,result,checks,reasons,duplicate_risk,auto_reviewed_at) VALUES(p_listing_id,v_result,v_checks,v_reasons,v_duplicate,now()) ON CONFLICT(listing_id) DO UPDATE SET result=excluded.result,checks=excluded.checks,reasons=excluded.reasons,duplicate_risk=excluded.duplicate_risk,auto_reviewed_at=excluded.auto_reviewed_at;
 UPDATE public.properties SET status=v_status,updated_at=now(),listing_data=coalesce(listing_data,'{}'::jsonb)||jsonb_build_object('status',v_status,'moderation',v_payload) WHERE id=p_listing_id;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values) VALUES('system',NULL,'listing-auto-moderated','listing',p_listing_id::text,jsonb_build_object('status',v_p.status),jsonb_build_object('status',v_status,'result',v_result));
 RETURN jsonb_build_object('listing_id',p_listing_id,'status',v_status,'moderation',v_payload);
END $$;


CREATE OR REPLACE FUNCTION public.danest_guard_evidence_material_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.title,NEW.description,NEW.address,NEW.neighborhood_id,NEW.price,NEW.area,NEW.bedrooms,NEW.bathrooms,NEW.furnishing,NEW.images,NEW.amenities,NEW.costs,NEW.available_from,NEW.minimum_months,NEW.maximum_months,NEW.deposit_months,NEW.owner_id,NEW.property_type,NEW.latitude,NEW.longitude,NEW.floor_level,NEW.listing_data->'rentalTerms')
 IS DISTINCT FROM (OLD.title,OLD.description,OLD.address,OLD.neighborhood_id,OLD.price,OLD.area,OLD.bedrooms,OLD.bathrooms,OLD.furnishing,OLD.images,OLD.amenities,OLD.costs,OLD.available_from,OLD.minimum_months,OLD.maximum_months,OLD.deposit_months,OLD.owner_id,OLD.property_type,OLD.latitude,OLD.longitude,OLD.floor_level,OLD.listing_data->'rentalTerms') THEN
   IF OLD.verification_level='basic_verified' THEN RAISE EXCEPTION 'Revoke verification before materially editing a verified listing'; END IF;
   IF EXISTS(SELECT 1 FROM public.verification_check WHERE listing_id=NEW.id AND status='verified') THEN
     UPDATE public.verification_check SET status='not-started',last_updated=now() WHERE listing_id=NEW.id;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.danest_public_listing_json_08a(j jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT public.danest_json_pick_08a(j,ARRAY['id','slug','title','summary','description','neighborhood','address','type','monthlyRent','bedrooms','bathrooms','floorArea','floorLevel','furnishing','amenities','availability','availableFrom','rentalDurationMonths','images','neighborhoodNotes','distanceToBeach','landlordId','status','listedAt','views','inquiries','isSample'])
 || jsonb_build_object(
 'location',public.danest_json_pick_08a(j->'location',ARRAY['lat','lng','precision']),
 'landlord',public.danest_json_pick_08a(j->'landlord',ARRAY['id','displayName','role','languages','responseTime','memberSince']),
 'costs',public.danest_json_pick_08a(j->'costs',ARRAY['monthlyRent','depositMonths','depositAmount']) || jsonb_build_object('items', (SELECT coalesce(jsonb_agg(public.danest_json_pick_08a(v,ARRAY['id','label','amount','unit','state','cadence','note']) ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(j->'costs'->'items')='array' THEN j->'costs'->'items' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(v,ord))),
 'rentalTerms',public.danest_json_pick_08a(j->'rentalTerms',ARRAY['minMonths','maxMonths','paymentDayOfMonth','utilitiesIncluded','notes']),
 'moderation',jsonb_build_object('result',CASE WHEN j->'moderation'->>'result' IN ('passed','incomplete','needs-attention','rejected') THEN j->'moderation'->>'result' ELSE 'incomplete' END,'checks','[]'::jsonb,'reasons','[]'::jsonb,'duplicateRisk',false,'autoReviewedAt',NULL,'manualReview',NULL)
 )
$$;
REVOKE ALL ON FUNCTION public.danest_public_listing_json_08a(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.danest_save_listing(uuid,jsonb),public.danest_register_listing_image(uuid,text),public.danest_submit_listing(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_save_listing(uuid,jsonb),public.danest_register_listing_image(uuid,text),public.danest_submit_listing(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.danest_guard_evidence_material_edit() FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF has_column_privilege('anon','public.properties','listing_data','SELECT') OR has_column_privilege('authenticated','public.properties','listing_data','SELECT') THEN RAISE EXCEPTION 'Raw JSON privilege remains'; END IF;
END $$;
COMMIT;
SELECT 'save_anon' AS check_name,has_function_privilege('anon','public.danest_save_listing(uuid,jsonb)','EXECUTE') AS actual,false AS expected UNION ALL SELECT 'save_authenticated',has_function_privilege('authenticated','public.danest_save_listing(uuid,jsonb)','EXECUTE'),true UNION ALL SELECT 'raw_json_authenticated',has_column_privilege('authenticated','public.properties','listing_data','SELECT'),false UNION ALL SELECT 'public_location_precision',public.danest_public_listing_json_08a('{"location":{"lat":16.05,"lng":108.24,"precision":"owner-selected","private":"x"}}'::jsonb)->'location' = '{"lat":16.05,"lng":108.24,"precision":"owner-selected"}'::jsonb,true;
