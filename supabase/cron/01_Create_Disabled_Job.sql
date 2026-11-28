-- Enable pg_cron via Integrations > Cron before running. Does not run maintenance.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.danest_maintenance_core_09c1(boolean,boolean,uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'Install C1 migration first'; END IF;
 IF to_regclass('cron.job') IS NULL THEN RAISE EXCEPTION 'Enable Supabase Cron first'; END IF;
END $$;
SELECT cron.schedule('danest-maintenance-09c1','0 * * * *','SELECT public.danest_run_maintenance(false);');
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname='danest-maintenance-09c1' AND username=current_user),active := false);
COMMIT;
SELECT jobid,jobname,schedule,active FROM cron.job WHERE jobname='danest-maintenance-09c1';
