-- Run ONLY after the worker is deployed, secrets are configured in Vault and Edge Secrets, and a verified sender is ready.
-- Enable pg_net via Dashboard first. Existing maintenance Cron is not changed.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN RAISE EXCEPTION 'Enable pg_net first'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN RAISE EXCEPTION 'Enable pg_cron first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='danest_mail_project_url' AND decrypted_secret ~ '^https://[a-z0-9]+\.supabase\.co/?$') OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='danest_mail_worker_secret' AND length(decrypted_secret)>=32) THEN RAISE EXCEPTION 'Vault URL and worker secret required'; END IF;
END $$;
SELECT cron.schedule('danest-mail-10a14','*/5 * * * *',$job$
 SELECT net.http_post(url:=rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='danest_mail_project_url'),'/')||'/functions/v1/danest-mail-worker',headers:=jsonb_build_object('Content-Type','application/json','x-danest-worker-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='danest_mail_worker_secret')),body:='{}'::jsonb,timeout_milliseconds:=55000);
$job$);
