-- Hardening for staff roles, from the code review.
--
--  1. Ops and Finance need a second-factor session (aal2) for the database to honour them. Before,
--     only the browser asked for it. Owner is exempt (the admin claim or an owner row), so no
--     owner can be locked out. A team member who hasn't set up two-factor sign-in still sees the
--     setup prompt (my_roles still reports their role) but gets no data until they do.
--     The edge functions read my_effective_roles(), which applies the same rule.
--  2. The last owner can't be removed, and an owner who is one through the sign-in claim can't be
--     "removed" from the Team page (the claim would keep them an owner, so the page would lie).
--  3. admin_list_staff says which owners are owners by claim, so the page can show that.
--  4. Finance doesn't need clients' onboarding answers: the workspaces policies go back to Ops and
--     Owner, and Finance gets only project names through workspace_names().
--
-- Apply as supabase_admin; safe to run twice.

-- ---------------------------------------------------------------------------------------------
-- 1. Second factor for Ops and Finance.

create or replace function console.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from console.staff_roles r where r.user_id = auth.uid() and r.role = p_role
  ) and (p_role = 'owner' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2');
$$;

-- What the caller may actually use right now: owner always, ops and finance only at aal2.
create or replace function console.my_effective_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r), '{}')
  from (
    select role as r from console.staff_roles
     where user_id = auth.uid() and (role = 'owner' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
    union
    select 'owner' where coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  ) x;
$$;

revoke all on function console.my_effective_roles() from public, anon;
grant execute on function console.my_effective_roles() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. The Team list says who is an owner by claim.

drop function if exists console.admin_list_staff();
create function console.admin_list_staff()
returns table (user_id uuid, email text, roles text[], last_sign_in_at timestamptz, confirmed boolean, owner_by_claim boolean)
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
         u.email_confirmed_at is not null,
         coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
  from auth.users u
  where exists (select 1 from console.staff_roles r where r.user_id = u.id)
     or coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
  order by u.email;
end;
$$;

revoke all on function console.admin_list_staff() from public, anon;
grant execute on function console.admin_list_staff() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Guards on changing roles.

create or replace function console.admin_set_staff_roles(p_user_id uuid, p_roles text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_roles text[] := coalesce(p_roles, '{}');
  v_role text;
  v_claim boolean;
  v_other_owners integer;
begin
  if not console.is_admin() then
    raise exception 'Owners only' using errcode = '42501';
  end if;

  select coalesce((raw_app_meta_data ->> 'is_admin')::boolean, false) into v_claim from auth.users where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  foreach v_role in array v_roles loop
    if v_role not in ('owner', 'ops', 'finance') then
      raise exception 'Unknown role: %', v_role using errcode = '22023';
    end if;
  end loop;

  if not ('owner' = any (v_roles)) then
    -- An owner by sign-in claim stays an owner whatever is saved here, so refuse rather than pretend.
    if v_claim then
      raise exception 'This person is an owner through their account settings, so Owner cannot be removed here' using errcode = '22023';
    end if;
    -- Someone has to be left in charge.
    if exists (select 1 from console.staff_roles where user_id = p_user_id and role = 'owner') then
      select count(*) into v_other_owners
      from auth.users u
      where u.id <> p_user_id
        and (coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
             or exists (select 1 from console.staff_roles r where r.user_id = u.id and r.role = 'owner'));
      if v_other_owners = 0 then
        raise exception 'There must be at least one owner' using errcode = '22023';
      end if;
    end if;
  end if;

  delete from console.staff_roles where user_id = p_user_id;
  insert into console.staff_roles (user_id, role, granted_by)
  select p_user_id, r, auth.uid() from unnest(v_roles) as r
  on conflict do nothing;
end;
$$;

revoke all on function console.admin_set_staff_roles(uuid, text[]) from public, anon;
grant execute on function console.admin_set_staff_roles(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Finance reads project names, not client answers.

create or replace function console.workspace_names()
returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not console.has_staff_access() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return query select w.id, w.name from console.workspaces w order by w.name;
end;
$$;

revoke all on function console.workspace_names() from public, anon;
grant execute on function console.workspace_names() to authenticated;

do $$
declare
  p record;
begin
  for p in
    select policyname, qual, with_check
    from pg_policies
    where schemaname = 'console' and tablename = 'workspaces'
      and (coalesce(qual, '') like '%has_staff_access()%' or coalesce(with_check, '') like '%has_staff_access()%')
  loop
    execute format(
      'alter policy %I on console.workspaces %s %s',
      p.policyname,
      case when p.qual is not null then format('using (%s)', regexp_replace(p.qual, '(console\.)?has_staff_access\(\)', 'console.has_ops_access()', 'g')) else '' end,
      case when p.with_check is not null then format('with check (%s)', regexp_replace(p.with_check, '(console\.)?has_staff_access\(\)', 'console.has_ops_access()', 'g')) else '' end
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
