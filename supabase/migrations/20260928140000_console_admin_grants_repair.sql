-- Repair: production was missing table grants on console.deliverable_tasks
-- ("permission denied for table deliverable_tasks" in the admin Tasks page),
-- so the policies from 20260917190000 were never reachable. Re-asserts the
-- grants, RLS, and policies for every console table the admin area reads or
-- writes. Idempotent: safe to run on a database that already has all of it.

-- deliverable_tasks (20260917190000)
alter table console.deliverable_tasks enable row level security;

drop policy if exists "members and admins can read deliverable tasks" on console.deliverable_tasks;
create policy "members and admins can read deliverable tasks"
  on console.deliverable_tasks for select
  to authenticated
  using (
    console.is_admin()
    or exists (
      select 1 from console.deliverables d
      join console.workspace_members m on m.workspace_id = d.workspace_id
      where d.id = deliverable_tasks.deliverable_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "admins can manage deliverable tasks" on console.deliverable_tasks;
create policy "admins can manage deliverable tasks"
  on console.deliverable_tasks for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update, delete on console.deliverable_tasks to authenticated;
grant select, insert, update, delete on console.deliverable_tasks to service_role;

-- The rest of the admin area's tables: grants only, matching what their own
-- migrations already grant (RLS policies there stay the boundary). Re-granting
-- an existing privilege is a no-op.
grant select on console.workspaces to authenticated;
grant select, insert, update, delete on console.deliverables to authenticated;
grant select, insert, update on console.deliverable_activities to authenticated;
grant select, update on console.inquiries to authenticated;
grant select, insert, update on console.inquiry_activities to authenticated;
grant select, insert on console.support_conversations to authenticated;
grant select, update on console.support_proposals to authenticated;
