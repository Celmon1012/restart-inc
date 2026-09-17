-- One row per invocation of the console-agent-run edge function (see
-- supabase/functions/console-agent-run). This is the actual "earn trust"
-- surface for the follow-up agent: an admin can see exactly when it ran,
-- what model answered, how much it looked at, and how many actions it
-- created -- without digging through inquiry_activities row by row.

create table console.agent_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model text,
  inquiries_scanned integer not null default 0,
  deliverables_scanned integer not null default 0,
  actions_created integer not null default 0,
  error text
);

alter table console.agent_runs enable row level security;

create policy "admins can read agent runs"
  on console.agent_runs for select
  to authenticated
  using (console.is_admin());

grant select on console.agent_runs to authenticated;
grant select, insert, update on console.agent_runs to service_role;
