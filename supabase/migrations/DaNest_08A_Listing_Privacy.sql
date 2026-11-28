-- 08A: restrict legacy JSON and use a scoped read API. No data deletion or ownership changes.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_active_role()') IS NULL OR to_regprocedure('public.danest_save_listing(uuid,jsonb)') IS NULL OR to_regprocedure('public.danest_landlord_kpis()') IS NULL THEN RAISE EXCEPTION 'Complete 01–07F first'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='properties' AND c.relrowsecurity) THEN RAISE EXCEPTION 'properties RLS must be enabled'; END IF;
END $$;
-- Preserve raw JSON for authorized staff/owners, not for anonymous or unrelated callers.
REVOKE SELECT ON TABLE public.properties FROM PUBLIC, anon, authenticated;
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute WHERE attrelid='public.properties'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE format('REVOKE SELECT (%s) ON public.properties FROM PUBLIC, anon, authenticated',cols);
END $$;
-- Minimal columns required for existing relation joins, RLS and listing lookup.
GRANT SELECT (id,source_id,owner_id,status,is_demo,title,price,area,created_at) ON public.properties TO anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.properties FROM PUBLIC,anon,authenticated;
-- Select explicit keys only. Never expose extra keys added to legacy JSON later.
CREATE OR REPLACE FUNCTION public.danest_json_pick_08a(p jsonb, keys text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(k,v),'{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(p)='object' THEN p ELSE '{}'::jsonb END) AS x(k,v) WHERE k=ANY(keys)
$$;
REVOKE ALL ON FUNCTION public.danest_json_pick_08a(jsonb,text[]) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.danest_public_listing_json_08a(j jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT public.danest_json_pick_08a(j,ARRAY['id','slug','title','summary','description','neighborhood','address','type','monthlyRent','bedrooms','bathrooms','floorArea','floorLevel','furnishing','amenities','availability','availableFrom','rentalDurationMonths','images','neighborhoodNotes','distanceToBeach','landlordId','status','listedAt','views','inquiries','isSample'])
 || jsonb_build_object(
 'location',public.danest_json_pick_08a(j->'location',ARRAY['lat','lng']),
 'landlord',public.danest_json_pick_08a(j->'landlord',ARRAY['id','displayName','role','languages','responseTime','memberSince']),
 'costs',public.danest_json_pick_08a(j->'costs',ARRAY['monthlyRent','depositMonths','depositAmount']) || jsonb_build_object('items', (SELECT coalesce(jsonb_agg(public.danest_json_pick_08a(v,ARRAY['id','label','amount','unit','state','cadence','note']) ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(j->'costs'->'items')='array' THEN j->'costs'->'items' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(v,ord))),
 'rentalTerms',public.danest_json_pick_08a(j->'rentalTerms',ARRAY['minMonths','maxMonths','paymentDayOfMonth','utilitiesIncluded','notes']),
 'moderation',jsonb_build_object('result',CASE WHEN j->'moderation'->>'result' IN ('passed','incomplete','needs-attention','rejected') THEN j->'moderation'->>'result' ELSE 'incomplete' END,'checks','[]'::jsonb,'reasons','[]'::jsonb,'duplicateRisk',false,'autoReviewedAt',NULL,'manualReview',NULL)
 )
$$;
REVOKE ALL ON FUNCTION public.danest_public_listing_json_08a(jsonb) FROM PUBLIC,anon,authenticated;
-- Scope is explicitly checked, not inferred from a caller-supplied owner ID.
CREATE OR REPLACE FUNCTION public.danest_read_listings_08a(p_scope text DEFAULT 'public',p_offset integer DEFAULT 0,p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=public.danest_active_role(); a uuid:=auth.uid(); result jsonb;
BEGIN
 IF p_scope IS NULL OR p_scope NOT IN ('public','owner','admin') OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid listing read request'; END IF;
 IF (p_scope='owner' AND (r IS DISTINCT FROM 'landlord' OR a IS NULL)) OR (p_scope='admin' AND r IS DISTINCT FROM 'admin') THEN RAISE EXCEPTION 'Listing scope not permitted' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(x.row_json ORDER BY x.created_at DESC NULLS LAST,x.id),'[]'::jsonb) INTO result FROM (
 SELECT p.id,p.created_at,jsonb_build_object('id',p.id,'source_id',p.source_id,'owner_id',p.owner_id,'status',p.status,'availability',p.availability,'is_demo',p.is_demo,'listing_data',CASE WHEN p_scope='public' THEN public.danest_public_listing_json_08a(p.listing_data) ELSE p.listing_data END,'verification_level',p.verification_level,'verified_at',p.verified_at,'verified_scope',p.verified_scope,'last_availability_confirmed_at',p.last_availability_confirmed_at,'availability_reminder_sent_at',CASE WHEN p_scope='public' THEN NULL ELSE p.availability_reminder_sent_at END,'availability_hidden_at',CASE WHEN p_scope='public' THEN NULL ELSE p.availability_hidden_at END) AS row_json
 FROM public.properties p WHERE (p_scope='public' AND p.status='published') OR (p_scope='owner' AND p.owner_id=a) OR p_scope='admin'
 ORDER BY p.created_at DESC NULLS LAST,p.id OFFSET p_offset LIMIT p_limit
 ) x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.danest_read_listings_08a(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_read_listings_08a(text,integer,integer) TO anon,authenticated;
-- Fail closed if raw column access still exists (e.g. inherited table privileges).
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated']) AS r(role_name) CROSS JOIN unnest(ARRAY['listing_data','landlord_info','verification','costs','images']) AS c(col_name) WHERE has_column_privilege(r.role_name,'public.properties',c.col_name,'SELECT')) THEN RAISE EXCEPTION 'Raw column privilege remains; migration rolled back'; END IF;
END $$;
COMMIT;
SELECT 'raw_json_anon' AS check_name,has_column_privilege('anon','public.properties','listing_data','SELECT') AS actual,false AS expected
UNION ALL SELECT 'raw_json_authenticated',has_column_privilege('authenticated','public.properties','listing_data','SELECT'),false
UNION ALL SELECT 'public_rpc_anon',has_function_privilege('anon','public.danest_read_listings_08a(text,integer,integer)','EXECUTE'),true
UNION ALL SELECT 'maintenance_anon',has_function_privilege('anon','public.danest_run_maintenance(boolean)','EXECUTE'),false
UNION ALL SELECT 'maintenance_authenticated',has_function_privilege('authenticated','public.danest_run_maintenance(boolean)','EXECUTE'),false;
