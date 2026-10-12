-- Staff roles: Owner, Ops, Finance.
--
-- Until now one flag (the JWT's app_metadata.is_admin) meant "sees and can change everything".
-- That is still what Owner is. This adds two narrower staff roles so a teammate or an accountant
-- can be given only the area they need:
--
--   owner   everything: Ops, Finance, Sales (leads, outreach), infrastructure controls, the Team page
--   ops     Ops: clients, projects, milestones and tasks, support, server requests. No finance.
--   finance Finance: costs, payments, accounts, VAT, invoices. No client work, support or leads.
--
-- Roles live in console.staff_roles and are checked by the database, so changing one takes effect
-- at once (no waiting for a new sign-in). The existing is_admin claim still counts as Owner, so
-- nobody currently an admin loses anything.
--
-- Every change here WIDENS an access rule (owner OR the new role); none narrows one. Sales tables
-- (inquiries, prospects, agent runs) and the infrastructure functions stay Owner-only, as is_admin
-- already was. Writes to staff_roles go only through the owner-only function below.

create table if not exists console.staff_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'ops', 'finance')),
  created_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

alter table console.staff_roles enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Role checks. SECURITY DEFINER so a policy can ask without the caller being able to read the table.

create or replace function console.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from console.staff_roles r where r.user_id = auth.uid() and r.role = p_role
  );
$$;

-- Owner: the existing admin claim, or an 'owner' row. This keeps every current admin an owner.
create or replace function console.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
      or console.has_role('owner');
$$;

create or replace function console.has_ops_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select console.is_admin() or console.has_role('ops');
$$;

create or replace function console.has_finance_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select console.is_admin() or console.has_role('finance');
$$;

-- Anyone on the team (any role): enough to see project names and contacts.
create or replace function console.has_staff_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select console.is_admin() or console.has_role('ops') or console.has_role('finance');
$$;

-- The caller's own roles, for the console and the edge functions.
create or replace function console.my_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r), '{}')
  from (
    select role as r from console.staff_roles where user_id = auth.uid()
    union
    select 'owner' where coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  ) x;
$$;

revoke all on function console.has_role(text) from public, anon;
revoke all on function console.is_admin() from public, anon;
revoke all on function console.has_ops_access() from public, anon;
revoke all on function console.has_finance_access() from public, anon;
revoke all on function console.has_staff_access() from public, anon;
revoke all on function console.my_roles() from public, anon;
grant execute on function console.has_role(text) to authenticated;
grant execute on function console.is_admin() to authenticated;
grant execute on function console.has_ops_access() to authenticated;
grant execute on function console.has_finance_access() to authenticated;
grant execute on function console.has_staff_access() to authenticated;
grant execute on function console.my_roles() to authenticated;

-- A person reads their own roles; an owner reads all. No direct writes: see admin_set_staff_roles.
drop policy if exists "read own staff roles" on console.staff_roles;
create policy "read own staff roles"
  on console.staff_roles for select
  to authenticated
  using (user_id = auth.uid() or console.is_admin());

grant select on console.staff_roles to authenticated;
grant select, insert, update, delete on console.staff_roles to service_role;

-- ---------------------------------------------------------------------------------------------
-- Team management (owner only).

create or replace function console.admin_list_staff()
returns table (user_id uuid, email text, roles text[], last_sign_in_at timestamptz, confirmed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not console.is_admin() then
    raise exception 'Owners only' using errcode = '42501';
  end if;

  return query
  select u.id,
         u.email::text,
         coalesce((select array_agg(distinct r.role order by r.role) from console.staff_roles r where r.user_id = u.id), '{}'::text[])
           || case when coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
                    and not exists (select 1 from console.staff_roles r where r.user_id = u.id and r.role = 'owner')
                   then array['owner']::text[] else '{}'::text[] end,
         u.last_sign_in_at,
         u.email_confirmed_at is not null
  from auth.users u
  where exists (select 1 from console.staff_roles r where r.user_id = u.id)
     or coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
  order by u.email;
end;
$$;

-- Replace a person's roles. An empty list removes their staff access (their account remains).
create or replace function console.admin_set_staff_roles(p_user_id uuid, p_roles text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_roles text[] := coalesce(p_roles, '{}');
  v_role text;
begin
  if not console.is_admin() then
    raise exception 'Owners only' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  foreach v_role in array v_roles loop
    if v_role not in ('owner', 'ops', 'finance') then
      raise exception 'Unknown role: %', v_role using errcode = '22023';
    end if;
  end loop;

  delete from console.staff_roles where user_id = p_user_id;
  insert into console.staff_roles (user_id, role, granted_by)
  select p_user_id, r, auth.uid() from unnest(v_roles) as r
  on conflict do nothing;
end;
$$;

revoke all on function console.admin_list_staff() from public, anon;
revoke all on function console.admin_set_staff_roles(uuid, text[]) from public, anon;
grant execute on function console.admin_list_staff() to authenticated;
grant execute on function console.admin_set_staff_roles(uuid, text[]) to authenticated;

-- The team members a task can be assigned to: owners and Ops.
create or replace function console.admin_team_members()
returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not console.has_ops_access() then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text
  from auth.users u
  where coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
     or exists (select 1 from console.staff_roles r where r.user_id = u.id and r.role in ('owner', 'ops'))
  order by u.email;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Widen the policies. Each takes its existing check and swaps "owner" for "owner or <role>", by
-- table. Tables not listed (sales and outreach, agent runs, staff_roles) stay Owner-only.

do $$
declare
  p record;
  fn text;
  newq text;
  neww text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'console'
      and (coalesce(qual, '') ~ 'is_admin\(\)' or coalesce(with_check, '') ~ 'is_admin\(\)')
  loop
    fn := case
      when p.tablename in ('deliverables', 'deliverable_tasks', 'deliverable_activities',
                           'support_conversations', 'support_proposals', 'server_requests')
        then 'console.has_ops_access()'
      when p.tablename in ('expenses', 'finance_settings', 'finance_accounts', 'expense_payments',
                           'vat_remittances', 'services')
        then 'console.has_finance_access()'
      when p.tablename = 'workspaces'
        then 'console.has_staff_access()'
      else null
    end;
    continue when fn is null;

    newq := regexp_replace(p.qual, '(console\.)?is_admin\(\)', fn, 'g');
    neww := regexp_replace(p.with_check, '(console\.)?is_admin\(\)', fn, 'g');

    execute format(
      'alter policy %I on %I.%I %s %s',
      p.policyname, p.schemaname, p.tablename,
      case when newq is not null then format('using (%s)', newq) else '' end,
      case when neww is not null then format('with check (%s)', neww) else '' end
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Widen the admin_* functions the same way, by what each one does. admin_set_workspace_infra and
-- admin_import_workspace (they link or create Coolify projects) stay Owner-only.

do $$
declare
  f record;
  def text;
  fn text;
begin
  for f in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'console'
      and p.proname in ('admin_rename_workspace', 'admin_set_workspace_archived',
                        'admin_create_client_project', 'admin_workspace_members',
                        'admin_set_workspace_billing')
  loop
    fn := case when f.proname = 'admin_set_workspace_billing' then 'console.has_finance_access()' else 'console.has_ops_access()' end;
    def := pg_get_functiondef(f.oid);
    if def ~ 'is_admin\(\)' then
      execute regexp_replace(def, '(console\.)?is_admin\(\)', fn, 'g');
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
