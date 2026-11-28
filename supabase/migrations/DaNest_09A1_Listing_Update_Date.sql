-- A1: only add the non-sensitive updated_at field to the existing scoped RPC.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_read_listings_08a(text,integer,integer)') IS NULL THEN RAISE EXCEPTION 'Install 08A first'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.danest_read_listings_08a(p_scope text DEFAULT 'public',p_offset integer DEFAULT 0,p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=public.danest_active_role(); a uuid:=auth.uid(); result jsonb;
BEGIN
 IF p_scope IS NULL OR p_scope NOT IN ('public','owner','admin') OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid listing read request'; END IF;
 IF (p_scope='owner' AND (r IS DISTINCT FROM 'landlord' OR a IS NULL)) OR (p_scope='admin' AND r IS DISTINCT FROM 'admin') THEN RAISE EXCEPTION 'Listing scope not permitted' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(x.row_json ORDER BY x.created_at DESC NULLS LAST,x.id),'[]'::jsonb) INTO result FROM (
 SELECT p.id,p.created_at,jsonb_build_object('id',p.id,'source_id',p.source_id,'owner_id',p.owner_id,'status',p.status,'availability',p.availability,'is_demo',p.is_demo,'updated_at',p.updated_at,'listing_data',CASE WHEN p_scope='public' THEN public.danest_public_listing_json_08a(p.listing_data) ELSE p.listing_data END,'verification_level',p.verification_level,'verified_at',p.verified_at,'verified_scope',p.verified_scope,'last_availability_confirmed_at',p.last_availability_confirmed_at,'availability_reminder_sent_at',CASE WHEN p_scope='public' THEN NULL ELSE p.availability_reminder_sent_at END,'availability_hidden_at',CASE WHEN p_scope='public' THEN NULL ELSE p.availability_hidden_at END) AS row_json
 FROM public.properties p WHERE (p_scope='public' AND p.status='published') OR (p_scope='owner' AND p.owner_id=a) OR p_scope='admin'
 ORDER BY p.created_at DESC NULLS LAST,p.id OFFSET p_offset LIMIT p_limit
 ) x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.danest_read_listings_08a(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_read_listings_08a(text,integer,integer) TO anon,authenticated;
DO $$ BEGIN
 IF has_column_privilege('anon','public.properties','listing_data','SELECT') OR has_column_privilege('authenticated','public.properties','listing_data','SELECT') THEN RAISE EXCEPTION 'Raw JSON privilege remains'; END IF;
END $$;
COMMIT;
SELECT 'updated_at_present' AS check_name, coalesce((public.danest_read_listings_08a('public',0,1)->0) ? 'updated_at',false) AS actual;
