-- The follow-up agent's trust ledger for support conversations -- lighter
-- than inquiry_activities/deliverable_activities because Chatwoot already
-- stores everything once a message is actually sent. This table only ever
-- holds what's still pending: a drafted reply an admin hasn't decided on
-- yet. Internal actions (private notes) skip this table entirely and post
-- straight to Chatwoot as private:true, since a private note is already
-- staff-only by construction there -- there's nothing to gate.
--
-- Staff-only, same reasoning as deliverable_activities: a pending draft is
-- never client-visible until an admin approves it via console-support-send
-- and it's actually posted to Chatwoot as a real outgoing message.

create table console.support_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references console.support_conversations (id) on delete cascade,
  created_at timestamptz not null default now(),
  body text not null,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  decided_by uuid references auth.users (id),
  decided_at timestamptz
);

create index support_proposals_conversation_id_idx on console.support_proposals (conversation_id);

alter table console.support_proposals enable row level security;

create policy "admins can read support proposals"
  on console.support_proposals for select
  to authenticated
  using (console.is_admin());

create policy "admins can update support proposals"
  on console.support_proposals for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, update on console.support_proposals to authenticated;
grant select, insert, update, delete on console.support_proposals to service_role;
