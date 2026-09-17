-- Hourly trigger for the follow-up agent (supabase/functions/console-agent-run).
-- pg_cron fires the schedule; pg_net makes the actual HTTP call from inside
-- Postgres, since a cron job can't invoke an edge function directly.
--
-- The URL and shared secret are deliberately NOT set here -- this migration
-- only wires the schedule, it never carries real secret values into git.
-- Run once, by hand, against this project (Supabase SQL editor or `psql`),
-- before this cron job can succeed:
--
--   alter database postgres set app.settings.console_agent_url =
--     'https://<project-ref>.supabase.co/functions/v1/console-agent-run';
--   alter database postgres set app.settings.console_cron_secret =
--     '<same value as the CRON_SECRET edge function secret>';
--
-- (and separately, `supabase secrets set CRON_SECRET=... ANTHROPIC_API_KEY=...
-- SUPABASE_SERVICE_ROLE_KEY=...` for the function itself). Until both of
-- those are set, this job will run every hour and fail quietly (net.http_post
-- errors are swallowed by pg_cron, visible only in cron.job_run_details) --
-- check console.agent_runs for whether it's actually completing.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'console-agent-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.console_agent_url', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', current_setting('app.settings.console_cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);
