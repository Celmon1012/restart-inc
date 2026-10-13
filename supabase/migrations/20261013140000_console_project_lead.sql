-- A named lead for each project: the one person on the team who owns it.
--
-- workspaces is select-only for authenticated users (writes go through security-definer
-- functions, like admin_rename_workspace), so the lead is set the same way. The lead has to be
-- someone on the team (an owner or Ops person), checked in Postgres. Clearing it is allowed.
--
-- Apply as supabase_admin (workspaces is owned by it); safe to run twice.

alter table console.workspaces
  add column if not exists lead_id uuid references auth.users (id) on delete set null;

create or replace function console.admin_set_workspace_lead(p_workspace_id uuid, p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not console.has_ops_access() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  if p_lead_id is not null
     and not exists (select 1 from console.admin_team_members() m where m.user_id = p_lead_id) then
    raise exception 'The lead must be someone on the team' using errcode = '22023';
  end if;

  update console.workspaces set lead_id = p_lead_id where id = p_workspace_id;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function console.admin_set_workspace_lead(uuid, uuid) from public, anon;
grant execute on function console.admin_set_workspace_lead(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
