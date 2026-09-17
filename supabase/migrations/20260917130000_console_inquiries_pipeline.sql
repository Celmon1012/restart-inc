-- Turns console.inquiries from a one-way lead drop box into a working
-- pipeline: adds the terminal stages a real sales process needs (won/lost,
-- not just archived), the scheduling fields the follow-up agent needs to
-- decide what's overdue, and the admin update policy the original
-- inquiries migration deliberately left out ("triage happens ... which
-- only service_role ... can do for now" -- this is that future admin tool).

alter table console.inquiries
  drop constraint inquiries_status_check,
  add constraint inquiries_status_check
    check (status in ('new', 'contacted', 'qualified', 'won', 'lost', 'archived'));

alter table console.inquiries
  add column assigned_to uuid references auth.users (id),
  add column next_follow_up_at timestamptz,
  add column last_contacted_at timestamptz;

create policy "admins can update inquiries"
  on console.inquiries for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant update on console.inquiries to authenticated;
