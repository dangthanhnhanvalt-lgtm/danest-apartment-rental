-- D1: forward-only measurement. No public event reads, no raw visitor identity.
BEGIN;
CREATE TABLE IF NOT EXISTS public.listing_analytics_09d1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 listing_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
 campaign_id uuid REFERENCES public.listing_promotion(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('view','inquiry')),
 dedup_key text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(listing_id,kind,dedup_key)
);
CREATE INDEX IF NOT EXISTS dn09d1_analytics_time ON public.listing_analytics_09d1(occurred_at,listing_id);
CREATE INDEX IF NOT EXISTS dn09d1_analytics_campaign ON public.listing_analytics_09d1(campaign_id);
ALTER TABLE public.listing_analytics_09d1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.listing_analytics_09d1 FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.analytics_start_09d1 (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.analytics_start_09d1(singleton) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE public.analytics_start_09d1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.analytics_start_09d1 FROM PUBLIC,anon,authenticated;
-- Keep eligibility identical to public sponsored badge, then resolve actual campaign.
CREATE OR REPLACE FUNCTION public.danest_eligible_campaign_09d1(p_listing_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT pr.id FROM public.listing_promotion pr
 JOIN public.danest_public_promotions() eligible ON eligible.listing_id=pr.listing_id
 JOIN public.properties p ON p.id=pr.listing_id
 WHERE pr.listing_id=p_listing_id AND pr.active AND pr.ended_at IS NULL
 AND pr.requested_by=p.owner_id AND pr.activated_by IS NOT NULL
 AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN pr.start_date AND pr.end_date
 ORDER BY pr.created_at DESC,pr.id LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.danest_record_view_09d1(p_source_id text,p_visitor_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_bucket bigint:=floor(extract(epoch FROM now())/1800)::bigint; v_count integer;
BEGIN
 IF p_visitor_token IS NULL OR p_source_id IS NULL OR length(p_source_id)>256 THEN RETURN false; END IF;
 IF auth.uid() IS NOT NULL AND public.danest_active_role() IS DISTINCT FROM 'tenant' THEN RETURN false; END IF;
 SELECT p.id INTO v_id FROM public.properties p JOIN public.profiles u ON u.id=p.owner_id
 WHERE p.source_id=p_source_id AND p.status='published' AND NOT p.is_demo AND u.role='landlord' AND u.account_status='active';
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.listing_analytics_09d1(listing_id,campaign_id,kind,dedup_key)
 VALUES(v_id,public.danest_eligible_campaign_09d1(v_id),'view',md5(v_id::text||':'||v_bucket::text||':'||p_visitor_token::text))
 ON CONFLICT(listing_id,kind,dedup_key) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count=1;
END $$;
-- Snapshot campaign eligibility at time of inquiry, not retrospectively inferred.
CREATE OR REPLACE FUNCTION public.danest_track_inquiry_09d1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT NEW.is_sample AND EXISTS(SELECT 1 FROM public.properties p WHERE p.id=NEW.listing_id AND NOT p.is_demo) THEN
  INSERT INTO public.listing_analytics_09d1(listing_id,campaign_id,kind,dedup_key)
  VALUES(NEW.listing_id,public.danest_eligible_campaign_09d1(NEW.listing_id),'inquiry',md5(NEW.id::text))
  ON CONFLICT(listing_id,kind,dedup_key) DO NOTHING;
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 -- Analytics must not block the actual inquiry. SQL logs signal measurement failure.
 RAISE WARNING 'DaNest D1 inquiry measurement failed: %',SQLSTATE;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dn09d1_inquiry_analytics ON public.inquiries;
CREATE TRIGGER dn09d1_inquiry_analytics AFTER INSERT ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.danest_track_inquiry_09d1();
CREATE OR REPLACE FUNCTION public.danest_promotion_metrics_09d1() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=public.danest_active_role(); v_start timestamptz; v_result jsonb;
BEGIN
 IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active admin or landlord required' USING ERRCODE='42501'; END IF;
 SELECT started_at INTO v_start FROM public.analytics_start_09d1 WHERE singleton;
 WITH scope AS (SELECT p.id FROM public.properties p WHERE NOT p.is_demo AND (v_role='admin' OR p.owner_id=auth.uid())),
 events AS (SELECT e.* FROM public.listing_analytics_09d1 e JOIN scope s ON s.id=e.listing_id),
 period AS (SELECT * FROM events WHERE occurred_at>=greatest(v_start,now()-interval '30 days')),
 campaign AS (SELECT pr.id, EXISTS(SELECT 1 FROM public.danest_public_promotions() pp WHERE pp.listing_id=pr.listing_id) AND pr.id=public.danest_eligible_campaign_09d1(pr.listing_id) AS eligible FROM public.listing_promotion pr JOIN scope s ON s.id=pr.listing_id),
 totals AS (SELECT count(*) FILTER(WHERE kind='view' AND campaign_id IS NOT NULL) AS sponsored_views,count(*) FILTER(WHERE kind='view' AND campaign_id IS NULL) AS ordinary_views,count(*) FILTER(WHERE kind='inquiry' AND campaign_id IS NOT NULL) AS sponsored_inquiries,count(*) FILTER(WHERE kind='inquiry' AND campaign_id IS NULL) AS ordinary_inquiries FROM period)
 SELECT jsonb_build_object('startedAt',v_start,'periodStart',greatest(v_start,now()-interval '30 days'),'asOf',now(),'sponsoredViews',t.sponsored_views,'ordinaryViews',t.ordinary_views,'sponsoredInquiries',t.sponsored_inquiries,'ordinaryInquiries',t.ordinary_inquiries,'campaigns',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'eligible',coalesce(c.eligible,false),'views',(SELECT count(*) FROM events e WHERE e.campaign_id=c.id AND e.kind='view'),'inquiries',(SELECT count(*) FROM events e WHERE e.campaign_id=c.id AND e.kind='inquiry'))) FROM campaign c),'[]'::jsonb)) INTO v_result FROM totals t;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.danest_eligible_campaign_09d1(uuid),public.danest_track_inquiry_09d1(),public.danest_record_view_09d1(text,uuid),public.danest_promotion_metrics_09d1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_record_view_09d1(text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_promotion_metrics_09d1() TO authenticated;
CREATE OR REPLACE FUNCTION public.danest_landlord_kpis()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active landlord required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('listing_id',p.id,'title',p.title,'status',p.status,
   'inquiries',(SELECT count(*) FROM public.inquiries i WHERE i.listing_id=p.id AND NOT i.is_sample),
   'confirmedViewings',(SELECT count(*) FROM public.inquiries i WHERE i.listing_id=p.id AND NOT i.is_sample AND EXISTS(SELECT 1 FROM public.inquiry_status_history h WHERE h.inquiry_id=i.id AND h.to_status='viewing_scheduled')),
   'rented',(SELECT count(*) FROM public.inquiries i WHERE i.listing_id=p.id AND NOT i.is_sample AND i.status='rented'),
   'views',(SELECT count(*) FROM public.listing_analytics_09d1 e WHERE e.listing_id=p.id AND e.kind='view')) ORDER BY p.id),'[]'::jsonb) INTO v_result
 FROM public.properties p WHERE p.owner_id=auth.uid() AND NOT p.is_demo;
 RETURN jsonb_build_object('listings',v_result,'viewsTracked',true,'asOf',now());
END $$;


REVOKE ALL ON FUNCTION public.danest_landlord_kpis() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_landlord_kpis() TO authenticated;
COMMIT;
SELECT 'events_rls' AS check_name, relrowsecurity AS actual,true AS expected FROM pg_class WHERE oid='public.listing_analytics_09d1'::regclass
UNION ALL SELECT 'anon_events_read',has_table_privilege('anon','public.listing_analytics_09d1','SELECT'),false
UNION ALL SELECT 'authenticated_events_write',has_table_privilege('authenticated','public.listing_analytics_09d1','INSERT'),false
UNION ALL SELECT 'anon_view_rpc',has_function_privilege('anon','public.danest_record_view_09d1(text,uuid)','EXECUTE'),true
UNION ALL SELECT 'anon_metrics_rpc',has_function_privilege('anon','public.danest_promotion_metrics_09d1()','EXECUTE'),false
UNION ALL SELECT 'authenticated_metrics_rpc',has_function_privilege('authenticated','public.danest_promotion_metrics_09d1()','EXECUTE'),true;
