-- DaNest 09E1: private renter profile and bounded admin email lookup. No data rewrite.
BEGIN;
CREATE OR REPLACE FUNCTION public.danest_my_renter_profile_09e1(p_expected_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 IF p_expected_user IS NULL OR auth.uid() IS DISTINCT FROM p_expected_user OR public.danest_active_role() IS DISTINCT FROM 'tenant' THEN
  RAISE EXCEPTION 'Active renter required' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object('name',coalesce(p.full_name,''),'phone',coalesce(p.phone,''),'loginEmail',coalesce(u.email,'')) INTO r
 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_expected_user;
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.danest_save_renter_profile_09e1(p_expected_user uuid,p_name text,p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); n text:=btrim(p_name); ph text:=btrim(coalesce(p_phone,'')); before_name text; before_phone text;
BEGIN
 IF p_expected_user IS NULL OR a IS DISTINCT FROM p_expected_user THEN RAISE EXCEPTION 'Account changed' USING ERRCODE='42501'; END IF;
 SELECT full_name,phone INTO before_name,before_phone FROM public.profiles WHERE id=a AND role='tenant' AND account_status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active renter required' USING ERRCODE='42501'; END IF;
 IF n IS NULL OR length(n) NOT BETWEEN 2 AND 100 OR length(ph)>40 OR (ph<>'' AND ph !~ '^[+0-9(). -]{3,40}$') THEN RAISE EXCEPTION 'Invalid profile fields'; END IF;
 UPDATE public.profiles SET full_name=n,phone=nullif(ph,''),updated_at=now() WHERE id=a;
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,new_values)
 VALUES('renter',a,'renter-profile-updated','profile',a::text,jsonb_build_object('name_changed',before_name IS DISTINCT FROM n,'phone_changed',before_phone IS DISTINCT FROM nullif(ph,'')));
 RETURN public.danest_my_renter_profile_09e1(a);
END $$;
CREATE OR REPLACE FUNCTION public.danest_admin_account_emails_09e1(p_ids uuid[])
RETURNS TABLE(user_id uuid,login_email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.danest_active_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_ids IS NULL OR cardinality(p_ids)>100 THEN RAISE EXCEPTION 'Maximum 100 account IDs'; END IF;
 RETURN QUERY SELECT p.id,u.email::text FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=ANY(p_ids);
END $$;
REVOKE ALL ON FUNCTION public.danest_my_renter_profile_09e1(uuid),public.danest_save_renter_profile_09e1(uuid,text,text),public.danest_admin_account_emails_09e1(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_my_renter_profile_09e1(uuid),public.danest_save_renter_profile_09e1(uuid,text,text),public.danest_admin_account_emails_09e1(uuid[]) TO authenticated;
COMMIT;
SELECT 'anon_profile' check_name,has_function_privilege('anon','public.danest_my_renter_profile_09e1(uuid)','EXECUTE') actual,false expected
UNION ALL SELECT 'anon_profile_save',has_function_privilege('anon','public.danest_save_renter_profile_09e1(uuid,text,text)','EXECUTE'),false
UNION ALL SELECT 'authenticated_profile_save',has_function_privilege('authenticated','public.danest_save_renter_profile_09e1(uuid,text,text)','EXECUTE'),true
UNION ALL SELECT 'anon_admin_emails',has_function_privilege('anon','public.danest_admin_account_emails_09e1(uuid[])','EXECUTE'),false
UNION ALL SELECT 'direct_profile_update',has_table_privilege('authenticated','public.profiles','UPDATE'),false;
