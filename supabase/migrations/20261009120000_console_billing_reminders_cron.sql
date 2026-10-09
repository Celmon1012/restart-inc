-- Daily trigger for console-billing-reminders (weekly overdue-invoice reminders).
-- Same pg_cron + pg_net wiring and shared secret as console-inquiry-notify
-- (20260929120000_console_inquiry_followup.sql). Idempotent: re-running replaces
-- the schedule. Set the URL once, by hand, before the job can succeed:
--
--   alter database postgres set app.settings.console_billing_reminders_url =
--     'https://<supabase-host>/functions/v1/console-billing-reminders';
--
-- The function needs CRON_SECRET, LAGO_API_KEY, RESEND_API_KEY on the edge runtime
-- (all already set for other functions) and optionally BILLING_FROM,
-- BILLING_NOTIFY_EMAIL, REMINDER_INTERVAL_DAYS (default 7), REMINDER_MAX (default 4).
--
-- 07:00 UTC is 08:00 in Lagos.

create extension if not exists pg_cron;

select cron.unschedule('console-billing-reminders')
where exists (select 1 from cron.job where jobname = 'console-billing-reminders');

select cron.schedule(
  'console-billing-reminders',
  '0 7 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.console_billing_reminders_url', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', current_setting('app.settings.console_cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);
