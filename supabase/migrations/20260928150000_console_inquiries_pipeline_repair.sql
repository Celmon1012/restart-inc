-- Repair: production had the admin update policy from
-- 20260917130000_console_inquiries_pipeline.sql but not its columns
-- (assigned_to, next_follow_up_at, last_contacted_at), so re-running that
-- migration failed on the existing policy and rolled back. Same changes,
-- idempotent.

alter table console.inquiries
  drop constraint if exists inquiries_status_check,
  add constraint inquiries_status_check
    check (status in ('new', 'contacted', 'qualified', 'won', 'lost', 'archived'));

alter table console.inquiries
  add column if not exists assigned_to uuid references auth.users (id),
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_contacted_at timestamptz;

drop policy if exists "admins can update inquiries" on console.inquiries;
create policy "admins can update inquiries"
  on console.inquiries for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant update on console.inquiries to authenticated;

notify pgrst, 'reload schema';
