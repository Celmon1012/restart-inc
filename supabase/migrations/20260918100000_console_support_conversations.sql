-- Maps a Chatwoot conversation to the workspace it belongs to. Chatwoot
-- (support.restart.ng, already running) is the system of record for the
-- conversation and every message in it -- this table exists only so
-- console can answer "which conversations belong to this workspace"
-- without mirroring any message content, same "proxy live, don't
-- duplicate" philosophy as console-data does for Coolify.

create table console.support_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references console.workspaces (id) on delete cascade,
  chatwoot_conversation_id integer not null unique,
  chatwoot_contact_id integer not null,
  created_at timestamptz not null default now()
);

create index support_conversations_workspace_id_idx on console.support_conversations (workspace_id);

alter table console.support_conversations enable row level security;

create policy "members and admins can read support conversations"
  on console.support_conversations for select
  to authenticated
  using (
    console.is_admin()
    or exists (
      select 1 from console.workspace_members m
      where m.workspace_id = support_conversations.workspace_id
        and m.user_id = auth.uid()
    )
  );

-- Insert only ever happens from console-support-create, after a real
-- Chatwoot conversation already exists -- but it runs as the caller's own
-- JWT (like every other function here), so this policy is what actually
-- lets that succeed: admins, or a member creating a row for their own
-- workspace.
create policy "members and admins can record support conversations"
  on console.support_conversations for insert
  to authenticated
  with check (
    console.is_admin()
    or exists (
      select 1 from console.workspace_members m
      where m.workspace_id = support_conversations.workspace_id
        and m.user_id = auth.uid()
    )
  );

grant select, insert on console.support_conversations to authenticated;
grant select, insert, update, delete on console.support_conversations to service_role;
