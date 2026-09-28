-- Admin: link console projects to Coolify projects, and import Coolify
-- projects that have no console project yet.
--
-- Until now a workspace's coolify_project_uuid was set by hand in SQL, so
-- console projects and Coolify projects drifted apart (Coolify projects with
-- no console project; console projects stuck in "provisioning"). These two
-- functions back the admin "Infrastructure" controls. They're called by the
-- console-admin-infra edge function as the admin's own JWT, after it has
-- checked the Coolify project exists -- the database can't see Coolify.
--
-- SECURITY DEFINER because authenticated has select-only on
-- console.workspaces. console.is_admin() is the whole boundary, checked first.
--
-- Policy these support: one console project = one Coolify project = its own
-- dedicated server. The unique constraint on coolify_project_uuid already
-- stops two workspaces sharing a Coolify project.

-- Link (or, with NULL, unlink) a workspace's Coolify project.
create or replace function console.admin_set_workspace_infra(
  p_workspace_id uuid,
  p_coolify_project_uuid text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uuid text := nullif(btrim(coalesce(p_coolify_project_uuid, '')), '');
begin
  if not console.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if v_uuid is not null and exists (
    select 1 from console.workspaces w
    where w.coolify_project_uuid = v_uuid and w.id <> p_workspace_id
  ) then
    raise exception 'That Coolify project is already linked to another console project' using errcode = '23505';
  end if;

  update console.workspaces
  set coolify_project_uuid = v_uuid
  where id = p_workspace_id;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function console.admin_set_workspace_infra(uuid, text) from public, anon;
grant execute on function console.admin_set_workspace_infra(uuid, text) to authenticated;

-- Create a console project for an existing Coolify project. If an account
-- with the contact email already exists it becomes the project's member
-- straight away; otherwise the project waits, grouped under that email in
-- the admin area, until access is granted.
create or replace function console.admin_import_workspace(
  p_name text,
  p_contact_email text,
  p_coolify_project_uuid text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_uuid text := nullif(btrim(coalesce(p_coolify_project_uuid, '')), '');
  v_workspace uuid;
  v_member uuid;
begin
  if not console.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Project name must be 2-80 characters' using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter the client''s email address' using errcode = '22023';
  end if;
  if v_uuid is null then
    raise exception 'Missing Coolify project' using errcode = '22023';
  end if;
  if exists (select 1 from console.workspaces w where w.coolify_project_uuid = v_uuid) then
    raise exception 'That Coolify project is already linked to a console project' using errcode = '23505';
  end if;

  insert into console.workspaces (name, contact_email, coolify_project_uuid, onboarding)
  values (
    v_name,
    v_email,
    v_uuid,
    jsonb_build_object('source', 'admin_import', 'completed_at', now())
  )
  returning id into v_workspace;

  select u.id into v_member
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_member is not null then
    insert into console.workspace_members (workspace_id, user_id)
    values (v_workspace, v_member)
    on conflict do nothing;
  end if;

  return v_workspace;
end;
$$;

revoke all on function console.admin_import_workspace(text, text, text) from public, anon;
grant execute on function console.admin_import_workspace(text, text, text) to authenticated;
