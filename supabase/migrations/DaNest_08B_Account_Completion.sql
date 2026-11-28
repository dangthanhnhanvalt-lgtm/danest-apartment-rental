-- DaNest 08B: consent at signup, own-landlord profile. No existing records rewritten.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_read_listings_08a(text,integer,integer)') IS NULL THEN RAISE EXCEPTION 'Run 08A first'; END IF;
END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_version text;
-- The signup payload is an explicit assertion of consent, not a source of roles or timestamps.
-- Applies to new auth users only, including admin-created Auth users. Internal provisioning must handle consent explicitly.
CREATE OR REPLACE FUNCTION public.danest_handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE chosen_role text; chosen_name text;
BEGIN
 IF (NEW.raw_user_meta_data->'terms_accepted') IS DISTINCT FROM 'true'::jsonb OR (NEW.raw_user_meta_data->>'terms_version') IS DISTINCT FROM 'danest-pilot-2026-11' THEN
   RAISE EXCEPTION 'Current terms and privacy consent required';
 END IF;
 chosen_role:=CASE WHEN NEW.raw_user_meta_data->>'role'='landlord' THEN 'landlord' ELSE 'tenant' END;
 chosen_name:=left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'full_name'),''),'User'),100);
 INSERT INTO public.profiles(id,full_name,role,account_status,terms_accepted_at,terms_version)
 VALUES(NEW.id,chosen_name,chosen_role,CASE WHEN chosen_role='landlord' THEN 'pending' ELSE 'active' END,now(),'danest-pilot-2026-11');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.danest_handle_new_user() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.danest_my_landlord_profile_08b(p_expected_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 IF p_expected_user IS NULL OR auth.uid() IS DISTINCT FROM p_expected_user OR public.danest_active_role() IS DISTINCT FROM 'landlord' THEN RAISE EXCEPTION 'Active landlord required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('displayName',coalesce(nullif(lp.display_name,''),p.full_name,''),'loginEmail',u.email,'email',coalesce(lp.contact_email,u.email,''),'phone',coalesce(lp.contact_phone,p.phone,''),'languages',coalesce(lp.languages,'{}'::text[]),'memberSince',u.created_at::date,'approvedAt',p.approved_at)
 INTO r FROM public.profiles p JOIN auth.users u ON u.id=p.id LEFT JOIN public.landlord_profiles lp ON lp.user_id=p.id WHERE p.id=auth.uid();
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.danest_save_landlord_profile_08b(p_expected_user uuid,p_name text,p_email text,p_phone text,p_languages text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); old_profile jsonb; new_profile jsonb; n text:=btrim(p_name); e text:=btrim(p_email); ph text:=btrim(coalesce(p_phone,'')); langs text[]:=coalesce(p_languages,'{}'::text[]);
BEGIN
 IF p_expected_user IS NULL OR a IS DISTINCT FROM p_expected_user THEN RAISE EXCEPTION 'Account changed' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=a AND role='landlord' AND account_status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active landlord required' USING ERRCODE='42501'; END IF;
 IF n IS NULL OR length(n) NOT BETWEEN 2 AND 100 OR e IS NULL OR length(e)>254 OR e !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR length(ph)>40 OR (ph<>'' AND ph !~ '^[+0-9(). -]{3,40}$') OR cardinality(langs)>10 OR EXISTS(SELECT 1 FROM unnest(langs) x WHERE x IS NULL OR length(btrim(x)) NOT BETWEEN 1 AND 40) THEN RAISE EXCEPTION 'Invalid profile fields'; END IF;
 SELECT public.danest_my_landlord_profile_08b(a) INTO old_profile;
 INSERT INTO public.landlord_profiles(user_id,display_name,contact_email,contact_phone,languages,member_since)
 SELECT a,n,e,nullif(ph,''),langs,u.created_at::date FROM auth.users u WHERE u.id=a
 ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,languages=excluded.languages;
 UPDATE public.profiles SET full_name=n,phone=nullif(ph,''),updated_at=now() WHERE id=a;
 SELECT public.danest_my_landlord_profile_08b(a) INTO new_profile;
 -- Record the fact of the edit without duplicating private contact values in immutable audit.
 INSERT INTO public.audit_log(actor_type,actor_id,action,target_type,target_id,new_values) VALUES('landlord',a,'landlord-profile-updated','profile',a::text,jsonb_build_object('name_changed',old_profile->'displayName' IS DISTINCT FROM new_profile->'displayName','email_changed',old_profile->'email' IS DISTINCT FROM new_profile->'email','phone_changed',old_profile->'phone' IS DISTINCT FROM new_profile->'phone','languages_changed',old_profile->'languages' IS DISTINCT FROM new_profile->'languages'));
 RETURN new_profile;
END $$;
REVOKE ALL ON FUNCTION public.danest_my_landlord_profile_08b(uuid),public.danest_save_landlord_profile_08b(uuid,text,text,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.danest_my_landlord_profile_08b(uuid),public.danest_save_landlord_profile_08b(uuid,text,text,text,text[]) TO authenticated;
COMMIT;
SELECT 'profile_anon' check_name,has_function_privilege('anon','public.danest_my_landlord_profile_08b(uuid)','EXECUTE') actual,false expected
UNION ALL SELECT 'save_anon',has_function_privilege('anon','public.danest_save_landlord_profile_08b(uuid,text,text,text,text[])','EXECUTE'),false
UNION ALL SELECT 'save_authenticated',has_function_privilege('authenticated','public.danest_save_landlord_profile_08b(uuid,text,text,text,text[])','EXECUTE'),true;
