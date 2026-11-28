-- DEVELOPMENT ONLY. Run all at once; changes rolled back. No external webhook side effects allowed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
CREATE TEMP TABLE dn_g1_results(check_name text,result text,detail text) ON COMMIT DROP;
INSERT INTO dn_g1_results
SELECT 'catalog privileges',CASE WHEN NOT has_table_privilege('authenticated','public.neighborhoods','INSERT,UPDATE,DELETE') AND NOT has_table_privilege('authenticated','public.amenities','INSERT,UPDATE,DELETE') AND NOT has_function_privilege('anon','public.danest_save_required_10a11(text[],text)','EXECUTE') THEN 'PASS' ELSE 'FAIL' END,'catalog only'
UNION ALL SELECT 'duplicate privileges',CASE WHEN NOT has_function_privilege('anon','public.danest_admin_duplicates_10a11(uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.danest_duplicate_candidates_internal_10a11(uuid)','EXECUTE') AND NOT has_column_privilege('authenticated','public.listing_image','content_hash_10a11','SELECT') THEN 'PASS' ELSE 'FAIL' END,'catalog only';
DO $$
DECLARE ad uuid; own uuid; rent uuid; l uuid; l2 uuid; before_at timestamptz; after_at timestamptz; old_av text; s text; res jsonb; f text[]; cid text:='test-g1-'||replace(gen_random_uuid()::text,'-','');
BEGIN
 SELECT id INTO ad FROM public.profiles WHERE role='admin' AND account_status='active' LIMIT 1;
 SELECT id INTO rent FROM public.profiles WHERE role='tenant' AND account_status='active' LIMIT 1;
 SELECT p.id,p.owner_id,p.availability INTO l,own,old_av FROM public.properties p JOIN public.profiles u ON u.id=p.owner_id WHERE p.title LIKE 'TEST %' AND NOT p.is_demo AND p.status IN ('draft','pending','needs-attention','rejected','paused','published') AND p.verification_level='unverified' AND u.role='landlord' AND u.account_status='active' LIMIT 1;
 SELECT id INTO l2 FROM public.properties WHERE id<>l AND title LIKE 'TEST %' AND NOT is_demo AND verification_level='unverified' AND status IN ('draft','pending','needs-attention','rejected','paused','published') LIMIT 1;
 IF ad IS NULL THEN INSERT INTO dn_g1_results VALUES('admin catalog and required fields','SKIP','Need active admin'); ELSE
  BEGIN
   PERFORM set_config('request.jwt.claim.sub',ad::text,true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ad,'role','authenticated')::text,true);
   EXECUTE 'SET LOCAL ROLE authenticated';
   PERFORM public.danest_save_catalog_10a11('amenity',cid,'Test amenity','Tiện ích thử',true,NULL,NULL,'Rollback test');
   PERFORM public.danest_save_catalog_10a11('amenity',cid,'Test renamed','Tiện ích đã đổi',false,NULL,NULL,'Rollback test');
   PERFORM public.danest_save_required_10a11(ARRAY['floorLevel'],'Rollback test');
   f:=public.danest_extra_required_10a11();
   EXECUTE 'RESET ROLE'; PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
   IF f=ARRAY['floorLevel'] AND EXISTS(SELECT 1 FROM public.amenities WHERE id=cid AND label='Test renamed' AND NOT active) AND (SELECT count(*) FROM public.audit_log WHERE actor_id=ad AND target_id=cid AND action='catalog-updated')=2 THEN INSERT INTO dn_g1_results VALUES('admin catalog and required fields','PASS','Create, rename, deactivate, configuration and audit'); ELSE INSERT INTO dn_g1_results VALUES('admin catalog and required fields','FAIL','Unexpected saved values'); END IF;
  EXCEPTION WHEN OTHERS THEN EXECUTE 'RESET ROLE'; INSERT INTO dn_g1_results VALUES('admin catalog and required fields','FAIL',SQLSTATE||': '||SQLERRM); END;
 END IF;
 IF rent IS NULL THEN INSERT INTO dn_g1_results VALUES('renter config and duplicates denied','SKIP','Need active renter'); ELSE
  BEGIN
   PERFORM set_config('request.jwt.claim.sub',rent::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',rent,'role','authenticated')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
   BEGIN PERFORM public.danest_save_required_10a11(ARRAY[]::text[],'Forbidden');s:='FAIL'; EXCEPTION WHEN insufficient_privilege THEN s:='PASS'; END;
   BEGIN PERFORM public.danest_admin_duplicates_10a11(coalesce(l,gen_random_uuid()));s:='FAIL'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
   INSERT INTO dn_g1_results VALUES('renter config and duplicates denied',s,'RPC role checks');
  EXCEPTION WHEN OTHERS THEN EXECUTE 'RESET ROLE';INSERT INTO dn_g1_results VALUES('renter config and duplicates denied','FAIL',SQLSTATE||': '||SQLERRM); END;
 END IF;
 IF l IS NULL THEN INSERT INTO dn_g1_results VALUES('owner confirmation timestamp','SKIP','Need editable unverified TEST listing with active landlord'); ELSE
  BEGIN
   UPDATE public.properties SET last_availability_confirmed_at=now()-interval '20 days',availability_reminder_sent_at=now()-interval '2 days' WHERE id=l RETURNING last_availability_confirmed_at INTO before_at;
   PERFORM set_config('request.jwt.claim.sub',own::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
   PERFORM public.danest_owner_listing_action(l,'availability',CASE WHEN old_av='available' THEN 'reserved' ELSE 'available' END);
   EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
   SELECT last_availability_confirmed_at INTO after_at FROM public.properties WHERE id=l;
   IF after_at>before_at AND EXISTS(SELECT 1 FROM public.properties WHERE id=l AND availability_reminder_sent_at IS NULL) AND EXISTS(SELECT 1 FROM public.audit_log WHERE actor_id=own AND target_id=l::text AND action='availability-confirmed-by-edit' AND created_at=now()) THEN INSERT INTO dn_g1_results VALUES('owner confirmation timestamp','PASS','Availability edit, reset reminder, audit'); ELSE INSERT INTO dn_g1_results VALUES('owner confirmation timestamp','FAIL','Expected updated date and audit'); END IF;
  EXCEPTION WHEN OTHERS THEN EXECUTE 'RESET ROLE'; INSERT INTO dn_g1_results VALUES('owner confirmation timestamp','FAIL',SQLSTATE||': '||SQLERRM); END;
 END IF;
 IF l IS NULL OR ad IS NULL OR NOT ('floorLevel'=ANY(public.danest_extra_required_10a11())) THEN INSERT INTO dn_g1_results VALUES('required field enforced on submit','SKIP','Need test listing and enabled floor requirement'); ELSE
  BEGIN
   UPDATE public.properties SET floor_level='—',status='draft' WHERE id=l;
   PERFORM set_config('request.jwt.claim.sub',own::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
   res:=public.danest_submit_listing(l);
   EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
   INSERT INTO dn_g1_results VALUES('required field enforced on submit',CASE WHEN res->>'status'='draft' AND strpos(res::text,'floor level')>0 THEN 'PASS' ELSE 'FAIL' END,'Server-side requirement on submission');
  EXCEPTION WHEN OTHERS THEN EXECUTE 'RESET ROLE';INSERT INTO dn_g1_results VALUES('required field enforced on submit','FAIL',SQLSTATE||': '||SQLERRM); END;
 END IF;
 IF l IS NULL OR l2 IS NULL OR ad IS NULL THEN INSERT INTO dn_g1_results VALUES('duplicate candidate and admin link','SKIP','Need two editable unverified TEST listings and active admin'); ELSE
  BEGIN
   UPDATE public.properties SET address='TEST G1 duplicate address 1234567' WHERE id IN (l,l2);
   PERFORM set_config('request.jwt.claim.sub',ad::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ad,'role','authenticated')::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
   res:=public.danest_admin_duplicates_10a11(l);
   EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
   INSERT INTO dn_g1_results VALUES('duplicate candidate and admin link',CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(res) c WHERE c->>'candidate_id'=l2::text AND (c->>'address_match')::boolean AND c->>'source_id' IS NOT NULL) THEN 'PASS' ELSE 'FAIL' END,'Shared detector returns candidate ID and reason');
  EXCEPTION WHEN OTHERS THEN EXECUTE 'RESET ROLE';INSERT INTO dn_g1_results VALUES('duplicate candidate and admin link','FAIL',SQLSTATE||': '||SQLERRM); END;
 END IF;
END $$;
SELECT * FROM dn_g1_results ORDER BY check_name;
ROLLBACK;
