-- Shared servers. A server can run more than one project (a dedicated server is only for a client
-- who asks for one), so a server's cost sits on one project (its service row) and
-- console.service_projects lists the other projects it also hosts. A server also gets an IP address,
-- kept on its expense next to its cost, which is what the Hosting page shows under the server name.
-- Apply as supabase_admin; safe to run twice.

alter table console.expenses
  add column if not exists ip_address text check (char_length(ip_address) <= 100);

create table if not exists console.service_projects (
  service_id uuid not null references console.services (id) on delete cascade,
  workspace_id uuid not null references console.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_id, workspace_id)
);

create index if not exists service_projects_workspace_idx on console.service_projects (workspace_id);

alter table console.service_projects enable row level security;

drop policy if exists "finance manages shared servers" on console.service_projects;
create policy "finance manages shared servers"
  on console.service_projects for all
  to authenticated
  using (console.has_finance_access())
  with check (console.has_finance_access());

grant select, insert, update, delete on console.service_projects to authenticated;
grant select, insert, update, delete on console.service_projects to service_role;

notify pgrst, 'reload schema';
