-- Attach a client's login to their project(s) automatically, on verified email only.
--
-- A project created by an admin (Ops -> Add client, or an imported Coolify project)
-- carries the client's contact_email but no member, so the client's first sign-in
-- (e.g. Google) looked like a stranger with no project and was sent through
-- onboarding, creating a second, empty project.
--
-- Two paths, both matching contact_email to the login's email case-insensitively:
--   1. A trigger on auth.users: when a row is inserted or its email is confirmed
--      (email_confirmed_at set), link the matching projects. Covers a fresh Google
--      sign-in (confirmed at insert) and an email/password signup once confirmed.
--   2. console.claim_my_workspaces(): the console calls it when a signed-in,
--      non-admin account has no project, which covers logins that already existed
--      before this migration. It acts only on the caller's own account.
--
-- Verified emails only: nothing is linked while auth.users.email_confirmed_at is
-- null, so signing up with someone else's address does not grant their project.
-- Archived projects are skipped.
--
-- The trigger swallows its own errors (with a warning) so that a problem here can
-- never block a signup.

create or replace function console.link_workspaces_for_user(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linked integer;
begin
  with u as (
    select id, lower(email) as email
    from auth.users
    where id = p_user_id and email_confirmed_at is not null and email is not null
  ), ins as (
    insert into console.workspace_members (workspace_id, user_id)
    select w.id, u.id
    from console.workspaces w
    join u on lower(w.contact_email) = u.email
    where w.archived_at is null
    on conflict do nothing
    returning 1
  )
  select count(*) into v_linked from ins;
  return v_linked;
end;
$$;

-- Internal: only the trigger and claim_my_workspaces() call it.
revoke all on function console.link_workspaces_for_user(uuid) from public, anon, authenticated;

create or replace function console.claim_my_workspaces()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return 0;
  end if;
  return console.link_workspaces_for_user(auth.uid());
end;
$$;

revoke all on function console.claim_my_workspaces() from public, anon;
grant execute on function console.claim_my_workspaces() to authenticated;

create or replace function console.on_auth_user_link_workspaces()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null then
    perform console.link_workspaces_for_user(new.id);
  end if;
  return new;
exception when others then
  raise warning 'console.on_auth_user_link_workspaces failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function console.on_auth_user_link_workspaces() from public, anon, authenticated;

drop trigger if exists link_workspaces_on_auth_user on auth.users;
create trigger link_workspaces_on_auth_user
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function console.on_auth_user_link_workspaces();

notify pgrst, 'reload schema';
