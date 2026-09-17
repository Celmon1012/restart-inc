-- The timeline for a single inquiry: manual staff notes, stage changes, and
-- everything the follow-up agent does or proposes. One table serves both
-- purposes on purpose -- an admin scrolling a lead's history should see
-- human and agent activity interleaved in one place, not two separate logs.
--
-- Trust boundary lives in `requires_approval`/`status`: internal actions the
-- agent is allowed to take on its own (stage suggestions, reminders, notes)
-- are inserted as activity_type in ('note','stage_change','agent_auto_action')
-- with status defaulting to 'complete' -- they already happened. Anything
-- client-facing (a drafted email) is activity_type = 'agent_proposal' with
-- requires_approval = true and status = 'proposed' -- it is a suggestion
-- sitting in a review queue, not an action, until an admin approves and
-- sends it (or rejects it). The agent itself never flips a proposal's
-- status; only an admin (via the console UI) or the send edge function
-- (after a successful send) does.

create table console.inquiry_activities (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references console.inquiries (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor text not null check (actor in ('admin', 'agent')),
  actor_user_id uuid references auth.users (id),
  activity_type text not null check (activity_type in ('note', 'stage_change', 'agent_auto_action', 'agent_proposal', 'email_sent')),
  body text,
  payload jsonb,
  requires_approval boolean not null default false,
  status text not null default 'complete' check (status in ('proposed', 'approved', 'rejected', 'complete')),
  decided_by uuid references auth.users (id),
  decided_at timestamptz
);

create index inquiry_activities_inquiry_id_idx on console.inquiry_activities (inquiry_id);

alter table console.inquiry_activities enable row level security;

-- Same visibility boundary as console.inquiries itself: staff-only, no
-- client-facing read path (this is internal CRM data, not a deliverable).
create policy "admins can read inquiry activities"
  on console.inquiry_activities for select
  to authenticated
  using (console.is_admin());

create policy "admins can insert inquiry activities"
  on console.inquiry_activities for insert
  to authenticated
  with check (console.is_admin());

-- Update is how an admin approves/rejects a proposal (or edits one before
-- sending) -- there's no delete policy, the timeline is append/amend-only.
create policy "admins can update inquiry activities"
  on console.inquiry_activities for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update on console.inquiry_activities to authenticated;
grant select, insert, update, delete on console.inquiry_activities to service_role;
