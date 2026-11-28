-- D2: current KPIs unchanged; daily activity reports and audited pilot configuration.
BEGIN;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS moderation_price_min_usd integer;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS moderation_price_max_usd integer;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.admin_settings'::regclass AND conname='dn09d2_price_range') THEN
 ALTER TABLE public.admin_settings ADD CONSTRAINT dn09d2_price_range CHECK ((moderation_price_min_usd IS NULL AND moderation_price_max_usd IS NULL) OR (moderation_price_min_usd IS NOT NULL AND moderation_price_max_usd IS NOT NULL AND moderation_price_min_usd BETWEEN 1 AND 100000 AND moderation_price_max_usd BETWEEN moderation_price_min_usd AND 100000));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.danest_admin_period_report_09d2(p_days integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_today date:=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date; v_first date; v_from timestamptz; v_until timestamptz:=now(); v_tracking timestamptz; v_rows jsonb;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_days IS NULL OR p_days NOT IN (7,30,90) THEN RAISE EXCEPTION 'Choose 7, 30 or 90 days'; END IF;
 v_first:=v_today-(p_days-1); v_from:=v_first::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
 SELECT started_at INTO STRICT v_tracking FROM public.analytics_start_09d1 WHERE singleton;
 WITH days AS (SELECT v_first+n AS day FROM generate_series(0,p_days-1) AS g(n)),
 req AS (SELECT i.id,i.first_requested_at FROM public.inquiries i JOIN public.properties p ON p.id=i.listing_id WHERE NOT i.is_sample AND NOT p.is_demo),
 newreq AS (SELECT (first_requested_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date day,count(*) n FROM req WHERE first_requested_at>=v_from AND first_requested_at<=v_until GROUP BY 1),
 firstview AS (SELECT h.inquiry_id,min(h.changed_at) at_time FROM public.inquiry_status_history h JOIN req r ON r.id=h.inquiry_id WHERE h.to_status='viewing_scheduled' GROUP BY h.inquiry_id),
 viewings AS (SELECT (at_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date day,count(*) n FROM firstview WHERE at_time>=v_from AND at_time<=v_until GROUP BY 1),
 events AS (SELECT (e.occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date day,
 count(*) FILTER(WHERE e.kind='view' AND e.campaign_id IS NULL) ordinary_views,
 count(*) FILTER(WHERE e.kind='view' AND e.campaign_id IS NOT NULL) sponsored_views,
 count(*) FILTER(WHERE e.kind='inquiry' AND e.campaign_id IS NULL) ordinary_inquiries,
 count(*) FILTER(WHERE e.kind='inquiry' AND e.campaign_id IS NOT NULL) sponsored_inquiries
 FROM public.listing_analytics_09d1 e JOIN public.properties p ON p.id=e.listing_id WHERE NOT p.is_demo AND e.occurred_at>=greatest(v_tracking,v_from) AND e.occurred_at<=v_until GROUP BY 1)
 SELECT jsonb_agg(jsonb_build_object('day',d.day,'inquiries',coalesce(r.n,0),'firstViewings',coalesce(v.n,0),
 'ordinaryViews',CASE WHEN d.day >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.ordinary_views,0) END,
 'sponsoredViews',CASE WHEN d.day >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.sponsored_views,0) END,
 'ordinaryInquiries',CASE WHEN d.day >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.ordinary_inquiries,0) END,
 'sponsoredInquiries',CASE WHEN d.day >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.sponsored_inquiries,0) END) ORDER BY d.day) INTO v_rows
 FROM days d LEFT JOIN newreq r ON r.day=d.day LEFT JOIN viewings v ON v.day=d.day LEFT JOIN events e ON e.day=d.day;
 RETURN jsonb_build_object('from',v_first,'through',v_today,'asOf',v_until,'trackingStartedAt',v_tracking,'days',v_rows);
END $$;
CREATE OR REPLACE FUNCTION public.danest_pilot_config_09d2() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.admin_settings%ROWTYPE;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' AND public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active admin or landlord required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT s FROM public.admin_settings WHERE singleton;
 RETURN jsonb_build_object('monthlyFeeVnd',CASE WHEN jsonb_typeof(s.featured_fee_config->'monthly_vnd')='number' THEN (s.featured_fee_config->>'monthly_vnd')::numeric ELSE 600000 END,
 'priceMinUsd',CASE WHEN public.danest_active_role()='admin' THEN s.moderation_price_min_usd END,'priceMaxUsd',CASE WHEN public.danest_active_role()='admin' THEN s.moderation_price_max_usd END);
END $$;
CREATE OR REPLACE FUNCTION public.danest_save_pilot_config_09d2(p_fee integer,p_min integer,p_max integer,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.admin_settings%ROWTYPE; n public.admin_settings%ROWTYPE;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_fee IS NULL OR p_fee NOT BETWEEN 0 AND 100000000 OR (p_min IS NULL)<>(p_max IS NULL) OR (p_min IS NOT NULL AND (p_min NOT BETWEEN 1 AND 100000 OR p_max NOT BETWEEN p_min AND 100000)) OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid configuration or reason'; END IF;
 SELECT * INTO STRICT s FROM public.admin_settings WHERE singleton FOR UPDATE;
 UPDATE public.admin_settings SET featured_fee_config=CASE WHEN jsonb_typeof(featured_fee_config)='object' THEN featured_fee_config ELSE '{}'::jsonb END ||jsonb_build_object('monthly_vnd',p_fee),moderation_price_min_usd=p_min,moderation_price_max_usd=p_max,updated_at=now() WHERE singleton RETURNING * INTO n;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_label,reason,old_values,new_values) VALUES('admin',auth.uid(),'pilot-config-updated','settings','Pilot fee and price screening',btrim(p_reason),jsonb_build_object('featured_fee_config',s.featured_fee_config,'price_min_usd',s.moderation_price_min_usd,'price_max_usd',s.moderation_price_max_usd),jsonb_build_object('featured_fee_config',n.featured_fee_config,'price_min_usd',n.moderation_price_min_usd,'price_max_usd',n.moderation_price_max_usd));
 RETURN public.danest_pilot_config_09d2();
END $$;
REVOKE ALL ON FUNCTION public.danest_admin_period_report_09d2(integer),public.danest_pilot_config_09d2(),public.danest_save_pilot_config_09d2(integer,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_admin_period_report_09d2(integer),public.danest_pilot_config_09d2(),public.danest_save_pilot_config_09d2(integer,integer,integer,text) TO authenticated;

-- B2 submit, preserve all checks and add optional admin override.
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
 UPDATE public.properties SET status=v_status,updated_at=now(),last_availability_confirmed_at=CASE WHEN v_result IN ('passed','needs-attention') AND v_p.availability='available' THEN now() ELSE last_availability_confirmed_at END,availability_reminder_sent_at=CASE WHEN v_result IN ('passed','needs-attention') AND v_p.availability='available' THEN NULL ELSE availability_reminder_sent_at END,listing_data=coalesce(listing_data,'{}'::jsonb)||jsonb_build_object('status',v_status,'moderation',v_payload) WHERE id=p_listing_id;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,old_values,new_values) VALUES('system',NULL,'listing-auto-moderated','listing',p_listing_id::text,jsonb_build_object('status',v_p.status),jsonb_build_object('status',v_status,'result',v_result));
 RETURN jsonb_build_object('listing_id',p_listing_id,'status',v_status,'moderation',v_payload);
END $$;


REVOKE ALL ON FUNCTION public.danest_submit_listing(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_submit_listing(uuid) TO authenticated;
COMMIT;
SELECT 'anon_period_report' AS check_name,has_function_privilege('anon','public.danest_admin_period_report_09d2(integer)','EXECUTE') AS actual,false AS expected
UNION ALL SELECT 'authenticated_period_report',has_function_privilege('authenticated','public.danest_admin_period_report_09d2(integer)','EXECUTE'),true
UNION ALL SELECT 'anon_config_save',has_function_privilege('anon','public.danest_save_pilot_config_09d2(integer,integer,integer,text)','EXECUTE'),false
UNION ALL SELECT 'direct_settings_write',has_table_privilege('authenticated','public.admin_settings','UPDATE'),false
UNION ALL SELECT 'price_override_columns',(SELECT count(*)=2 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_settings' AND column_name IN ('moderation_price_min_usd','moderation_price_max_usd')),true;
