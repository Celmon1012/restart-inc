-- The deliverables-side twin of console.inquiry_activities: the follow-up
-- agent's audit trail and trust ledger, applied to deliverables instead of
-- leads. Same shape, same reasoning -- see 20260917140000_console_inquiry_
-- activities.sql for the full rationale on requires_approval/status.
--
-- Staff-only, unlike deliverables itself: a drafted client update or an
-- internal "this is overdue" flag is never client-visible here -- the
-- client only ever sees the result once an admin approves it and
-- console-deliverable-send actually emails them. This table is the
-- internal record of that whole process, not a client-facing feed.
--
-- The agent never changes a deliverable's status directly (see the plan
-- this shipped under) -- status is Restart's own curated call, so the
-- activity_type vocabulary here has no stage_change equivalent.

create table console.deliverable_activities (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references console.deliverables (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor text not null check (actor in ('admin', 'agent')),
  actor_user_id uuid references auth.users (id),
  activity_type text not null check (activity_type in ('note', 'agent_auto_action', 'agent_proposal', 'email_sent')),
  body text,
  payload jsonb,
  requires_approval boolean not null default false,
  status text not null default 'complete' check (status in ('proposed', 'approved', 'rejected', 'complete')),
  decided_by uuid references auth.users (id),
  decided_at timestamptz
);

create index deliverable_activities_deliverable_id_idx on console.deliverable_activities (deliverable_id);

alter table console.deliverable_activities enable row level security;

create policy "admins can read deliverable activities"
  on console.deliverable_activities for select
  to authenticated
  using (console.is_admin());

create policy "admins can insert deliverable activities"
  on console.deliverable_activities for insert
  to authenticated
  with check (console.is_admin());

create policy "admins can update deliverable activities"
  on console.deliverable_activities for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update on console.deliverable_activities to authenticated;
grant select, insert, update, delete on console.deliverable_activities to service_role;
