-- Repair: production was missing the "admins can read deliverable
-- activities" policy from 20260917200000 (found by supabase/check-migrations.sql),
-- so milestone activity threads read back empty for admins even though
-- inserts succeeded. Re-asserts all three policies; idempotent.

alter table console.deliverable_activities enable row level security;

drop policy if exists "admins can read deliverable activities" on console.deliverable_activities;
create policy "admins can read deliverable activities"
  on console.deliverable_activities for select
  to authenticated
  using (console.is_admin());

drop policy if exists "admins can insert deliverable activities" on console.deliverable_activities;
create policy "admins can insert deliverable activities"
  on console.deliverable_activities for insert
  to authenticated
  with check (console.is_admin());

drop policy if exists "admins can update deliverable activities" on console.deliverable_activities;
create policy "admins can update deliverable activities"
  on console.deliverable_activities for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update on console.deliverable_activities to authenticated;
