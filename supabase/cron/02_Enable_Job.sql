-- ONLY after preview, rollback test and confirmation of settings and real listing eligibility.
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname='danest-maintenance-09c1' AND username=current_user),active := true);
SELECT jobid,jobname,schedule,active FROM cron.job WHERE jobname='danest-maintenance-09c1';
