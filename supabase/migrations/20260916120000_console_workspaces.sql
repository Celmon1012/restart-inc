-- Console operator workspaces.
--
-- Maps a Supabase Auth user to the Coolify project(s) they're allowed to
-- view in the console. One workspace = one client project = one dedicated
-- Coolify server; the server and its resources (apps/databases/services)
-- are resolved live from the Coolify API using coolify_project_uuid, not
-- mirrored into Postgres, so this table is purely an authorization map.
--
-- Lives in the "console" schema because this Supabase project is shared
-- with restart-inc's other apps (e.g. breadmakersystems) on the "public"
-- schema.
--
-- IMPORTANT: never set `db: { schema: "console" }` globally on a Supabase
-- client that also handles auth (supabase.auth.*) — a prior attempt at
-- this (see git history on the old client-console app) did that and broke
-- admin login. Scope the schema per query instead, e.g.
-- `supabase.schema("console").from("workspaces")`, leaving the client's
-- default schema untouched for auth calls.

create table console.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier_label text,
  coolify_project_uuid text not null unique,
  created_at timestamptz not null default now()
);

create table console.workspace_members (
  workspace_id uuid not null references console.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on console.workspace_members (user_id);

alter table console.workspaces enable row level security;
alter table console.workspace_members enable row level security;

-- Read-only for operators: workspace assignment is managed by restart-inc
-- via service_role (onboarding script / Studio), not self-service.
create policy "members can read their workspaces"
  on console.workspaces for select
  using (
    exists (
      select 1 from console.workspace_members m
      where m.workspace_id = workspaces.id
        and m.user_id = auth.uid()
    )
  );

create policy "members can read their own membership rows"
  on console.workspace_members for select
  using (user_id = auth.uid());

grant usage on schema console to authenticated, service_role;
grant select on console.workspaces to authenticated;
grant select on console.workspace_members to authenticated;
grant select, insert, update, delete on console.workspaces to service_role;
grant select, insert, update, delete on console.workspace_members to service_role;
