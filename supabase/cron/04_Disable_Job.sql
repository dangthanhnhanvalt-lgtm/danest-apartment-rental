SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname='danest-maintenance-09c1' AND username=current_user),active := false);
SELECT jobname,active FROM cron.job WHERE jobname='danest-maintenance-09c1';
