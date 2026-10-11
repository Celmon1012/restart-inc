-- Admin: who has console access to a project.
--
-- workspace_members is the real access list, but the login emails live in
-- auth.users, which the browser can't read. This returns them for one
-- project so Ops can show them next to the project's contact email.
--
-- SECURITY DEFINER; console.is_admin() is the whole boundary, checked first.

create or replace function console.admin_workspace_members(p_workspace_id uuid)
returns table (user_id uuid, email text, joined_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not console.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
  select m.user_id, u.email::text, m.created_at
  from console.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace_id
  order by m.created_at;
end;
$$;

revoke all on function console.admin_workspace_members(uuid) from public, anon;
grant execute on function console.admin_workspace_members(uuid) to authenticated;

notify pgrst, 'reload schema';
