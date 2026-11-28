-- E2 additive hardening: run as project DB owner after E1. No data deletion.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Only revoke direct execution on confirmed trigger/event-trigger functions.
-- PostgreSQL triggers retain their existing execution mechanism. Do not drop them.
DO $$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('handle_new_user','rls_auto_enable')
 AND p.prorettype IN ('pg_catalog.trigger'::regtype,'pg_catalog.event_trigger'::regtype)
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.sig);
 END LOOP;
END $$;
-- Support existing sorted queries; no changes to RLS or RPC semantics.
CREATE INDEX IF NOT EXISTS dn09e2_audit_recent ON public.audit_log(created_at DESC,id);
CREATE INDEX IF NOT EXISTS dn09e2_owner_listing ON public.properties(owner_id,created_at DESC NULLS LAST,id);
CREATE INDEX IF NOT EXISTS dn09e2_notice_recent ON public.notifications(recipient_id,created_at DESC,id);
COMMIT;
SELECT 'trigger_direct_execute_denied' AS check_name,
 NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('handle_new_user','rls_auto_enable') AND p.prorettype IN ('pg_catalog.trigger'::regtype,'pg_catalog.event_trigger'::regtype) AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) AS actual,true AS expected
UNION ALL SELECT 'indexes_present',count(*)=3,true FROM pg_indexes WHERE schemaname='public' AND indexname IN ('dn09e2_audit_recent','dn09e2_owner_listing','dn09e2_notice_recent')
UNION ALL SELECT 'all_public_tables_rls',NOT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity),true;
