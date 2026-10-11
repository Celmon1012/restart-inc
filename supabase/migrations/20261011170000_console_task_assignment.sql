-- Who a checklist item is for.
--
-- owner 'team'   : Restart does it. assignee_id optionally names which team member
--                  (a console admin); null means unassigned.
-- owner 'client' : the client has to do it (send content, approve something, pay,
--                  grant access). It shows on the client's Delivery view as
--                  waiting on them. Clients can't tick items off themselves (they
--                  have read-only access), so staff marks it done when they have.
--
-- console.admin_team_members() lists the console admins (id + email) for the
-- assignee picker; auth.users isn't readable from the browser.
-- SECURITY DEFINER, console.is_admin() checked first.

alter table console.deliverable_tasks
  add column if not exists owner text not null default 'team' check (owner in ('team', 'client')),
  add column if not exists assignee_id uuid references auth.users (id) on delete set null;

-- A client-owned item has no team assignee.
alter table console.deliverable_tasks drop constraint if exists deliverable_tasks_assignee_team_only;
alter table console.deliverable_tasks
  add constraint deliverable_tasks_assignee_team_only check (owner = 'team' or assignee_id is null);

create index if not exists deliverable_tasks_assignee_idx on console.deliverable_tasks (assignee_id) where assignee_id is not null;

create or replace function console.admin_team_members()
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not console.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text
  from auth.users u
  where coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
  order by u.email;
end;
$$;

revoke all on function console.admin_team_members() from public, anon;
grant execute on function console.admin_team_members() to authenticated;

notify pgrst, 'reload schema';
