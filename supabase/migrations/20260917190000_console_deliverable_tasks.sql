-- Checklist items under a deliverable -- real project-management detail
-- instead of just a status pill. Same visibility boundary as
-- console.deliverables itself: this is still Restart's own curated
-- breakdown of the work, not something a client edits, so members get
-- read-only access scoped to their workspace (via a join through
-- deliverables, since this table has no workspace_id of its own) and only
-- admins can write.

create table console.deliverable_tasks (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references console.deliverables (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index deliverable_tasks_deliverable_id_idx on console.deliverable_tasks (deliverable_id);

alter table console.deliverable_tasks enable row level security;

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

create policy "admins can manage deliverable tasks"
  on console.deliverable_tasks for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select on console.deliverable_tasks to authenticated;
grant insert, update, delete on console.deliverable_tasks to authenticated;
grant select, insert, update, delete on console.deliverable_tasks to service_role;
