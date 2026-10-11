-- Admin: create a client project directly from Ops.
--
-- For clients who never go through onboarding and have no Coolify project,
-- e.g. a WordPress maintenance client billed through Lago. Until now the only
-- ways to get a workspace were self-onboarding, "Start a project" (which makes
-- the admin the creator) and admin_import_workspace (which needs a Coolify
-- project).
--
-- Clients are grouped by contact email, so reusing an existing client's email
-- adds this as another project of that client. If a console account already
-- exists for the email it is added as a member, same as admin_import_workspace;
-- otherwise the client gets access only when they sign up with that email.
--
-- SECURITY DEFINER because authenticated has select-only on console.workspaces.
-- console.is_admin() is the whole boundary, checked first.

create or replace function console.admin_create_client_project(
  p_name text,
  p_contact_email text,
  p_engagement_type text,
  p_service text,
  p_client_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_service text := nullif(btrim(coalesce(p_service, '')), '');
  v_client_type text := nullif(btrim(coalesce(p_client_type, '')), '');
  v_workspace uuid;
  v_member uuid;
begin
  if not console.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Name must be 2-80 characters' using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter the client''s email address' using errcode = '22023';
  end if;
  if p_engagement_type not in ('build', 'scale', 'operate', 'ai', 'advisory', 'exploring') then
    raise exception 'Unknown engagement type' using errcode = '22023';
  end if;
  if v_client_type is not null and v_client_type not in ('startup', 'sme', 'enterprise', 'agency', 'individual') then
    raise exception 'Unknown client type' using errcode = '22023';
  end if;
  if v_service is not null and char_length(v_service) > 80 then
    raise exception 'Keep the service under 80 characters' using errcode = '22023';
  end if;

  insert into console.workspaces (name, contact_email, engagement_type, tier_label, client_type, onboarding)
  values (
    v_name,
    v_email,
    p_engagement_type,
    v_service,
    v_client_type,
    jsonb_build_object('source', 'admin_create', 'completed_at', now())
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

revoke all on function console.admin_create_client_project(text, text, text, text, text) from public, anon;
grant execute on function console.admin_create_client_project(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
