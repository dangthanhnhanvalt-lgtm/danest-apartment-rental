-- 10A.1.3: read-only reporting RPCs, existing D1/D2 definitions unchanged.
BEGIN;
CREATE INDEX IF NOT EXISTS dn10a13_listing_event_time ON public.listing_analytics_09d1(listing_id,occurred_at);
CREATE OR REPLACE FUNCTION public.danest_report_listings_10a13() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=public.danest_active_role(); v_rows jsonb;
BEGIN
 IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active admin or landlord required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'status',p.status) ORDER BY p.title,p.id),'[]'::jsonb) INTO v_rows
 FROM public.properties p WHERE NOT p.is_demo AND (v_role='admin' OR p.owner_id=auth.uid());
 RETURN v_rows;
END $$;
CREATE OR REPLACE FUNCTION public.danest_listing_report_10a13(p_listing_id uuid,p_days integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=public.danest_active_role(); v_today date:=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date; v_first date; v_from timestamptz; v_until timestamptz:=now(); v_tracking timestamptz; v_rows jsonb; v_campaigns jsonb; v_title text;
BEGIN
 IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active admin or landlord required' USING ERRCODE='42501'; END IF;
 SELECT p.title INTO v_title FROM public.properties p WHERE p.id=p_listing_id AND NOT p.is_demo AND (v_role='admin' OR p.owner_id=auth.uid());
 IF NOT FOUND THEN RAISE EXCEPTION 'Listing not accessible' USING ERRCODE='42501'; END IF;
 IF p_days IS NULL OR p_days NOT IN (7,30,90) THEN RAISE EXCEPTION 'Choose 7, 30 or 90 days' USING ERRCODE='22023'; END IF;
 v_first:=v_today-(p_days-1); v_from:=v_first::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
 SELECT started_at INTO STRICT v_tracking FROM public.analytics_start_09d1 WHERE singleton;
 WITH days AS (SELECT v_first+n AS report_date FROM generate_series(0,p_days-1) AS g(n)),
 req AS (SELECT i.id,i.first_requested_at FROM public.inquiries i WHERE i.listing_id=p_listing_id AND NOT i.is_sample),
 newreq AS (SELECT (first_requested_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS report_date,count(*) AS n FROM req WHERE first_requested_at>=v_from AND first_requested_at<=v_until GROUP BY 1),
 firstview AS (SELECT h.inquiry_id,min(h.changed_at) AS at_time FROM public.inquiry_status_history h JOIN req r ON r.id=h.inquiry_id WHERE h.to_status='viewing_scheduled' GROUP BY h.inquiry_id),
 viewings AS (SELECT (at_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS report_date,count(*) AS n FROM firstview WHERE at_time>=v_from AND at_time<=v_until GROUP BY 1),
 events AS (SELECT (e.occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS report_date,
 count(*) FILTER(WHERE e.kind='view' AND e.campaign_id IS NULL) AS ordinary_views,
 count(*) FILTER(WHERE e.kind='view' AND e.campaign_id IS NOT NULL) AS sponsored_views,
 count(*) FILTER(WHERE e.kind='inquiry' AND e.campaign_id IS NULL) AS ordinary_inquiries,
 count(*) FILTER(WHERE e.kind='inquiry' AND e.campaign_id IS NOT NULL) AS sponsored_inquiries
 FROM public.listing_analytics_09d1 e WHERE e.listing_id=p_listing_id AND e.occurred_at>=greatest(v_tracking,v_from) AND e.occurred_at<=v_until GROUP BY 1)
 SELECT jsonb_agg(jsonb_build_object('day',d.report_date,'inquiries',coalesce(r.n,0),'firstViewings',coalesce(v.n,0),
 'ordinaryViews',CASE WHEN d.report_date >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.ordinary_views,0) END,
 'sponsoredViews',CASE WHEN d.report_date >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.sponsored_views,0) END,
 'ordinaryInquiries',CASE WHEN d.report_date >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.ordinary_inquiries,0) END,
 'sponsoredInquiries',CASE WHEN d.report_date >= (v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN coalesce(e.sponsored_inquiries,0) END) ORDER BY d.report_date) INTO v_rows
 FROM days d LEFT JOIN newreq r USING(report_date) LEFT JOIN viewings v USING(report_date) LEFT JOIN events e USING(report_date);
 -- Include campaigns intersecting selected calendar period OR with tracked events in it. No attribution by current status.
 WITH measured AS (SELECT e.campaign_id,count(*) FILTER(WHERE e.kind='view') AS views,count(*) FILTER(WHERE e.kind='inquiry') AS inquiries
 FROM public.listing_analytics_09d1 e WHERE e.listing_id=p_listing_id AND e.campaign_id IS NOT NULL AND e.occurred_at>=greatest(v_tracking,v_from) AND e.occurred_at<=v_until GROUP BY e.campaign_id)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'startDate',c.start_date,'endDate',c.end_date,'endedAt',c.ended_at,
 'views',coalesce(m.views,0),'inquiries',coalesce(m.inquiries,0)) ORDER BY c.start_date,c.id),'[]'::jsonb) INTO v_campaigns
 FROM public.listing_promotion c LEFT JOIN measured m ON m.campaign_id=c.id
 WHERE c.listing_id=p_listing_id AND (m.campaign_id IS NOT NULL OR (c.activated_by IS NOT NULL AND c.start_date<=v_today AND c.end_date>=greatest(v_first,(v_tracking AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AND (c.ended_at IS NULL OR c.ended_at>=greatest(v_from,v_tracking))));
 RETURN jsonb_build_object('listingId',p_listing_id,'title',v_title,'from',v_first,'through',v_today,'asOf',v_until,'trackingStartedAt',v_tracking,'days',v_rows,'campaigns',v_campaigns);
END $$;
REVOKE ALL ON FUNCTION public.danest_report_listings_10a13(),public.danest_listing_report_10a13(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_report_listings_10a13(),public.danest_listing_report_10a13(uuid,integer) TO authenticated;
COMMIT;
SELECT 'anon_listing_report' AS check_name,has_function_privilege('anon','public.danest_listing_report_10a13(uuid,integer)','EXECUTE') AS actual,false AS expected
UNION ALL SELECT 'authenticated_listing_report',has_function_privilege('authenticated','public.danest_listing_report_10a13(uuid,integer)','EXECUTE'),true
UNION ALL SELECT 'anon_listing_options',has_function_privilege('anon','public.danest_report_listings_10a13()','EXECUTE'),false
UNION ALL SELECT 'authenticated_listing_options',has_function_privilege('authenticated','public.danest_report_listings_10a13()','EXECUTE'),true
UNION ALL SELECT 'events_direct_read',has_table_privilege('authenticated','public.listing_analytics_09d1','SELECT'),false
UNION ALL SELECT 'listing_time_index',to_regclass('public.dn10a13_listing_event_time') IS NOT NULL,true;
