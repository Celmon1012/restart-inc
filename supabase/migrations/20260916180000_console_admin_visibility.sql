-- Admin visibility: let an account flagged as an admin see every workspace,
-- not just ones it has a console.workspace_members row for.
--
-- Uses auth.jwt() -> app_metadata, not user_metadata: app_metadata can only
-- be written via the service-role Admin API, never via the user's own
-- auth.updateUser() call (which is exactly what Profile & Security uses for
-- everything else) -- so a client account can never grant itself admin
-- access by editing its own profile.

create or replace function console.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

drop policy if exists "members can read their workspaces" on console.workspaces;
create policy "members and admins can read workspaces"
  on console.workspaces for select
  using (
    console.is_admin()
    or exists (
      select 1 from console.workspace_members m
      where m.workspace_id = workspaces.id
        and m.user_id = auth.uid()
    )
  );
