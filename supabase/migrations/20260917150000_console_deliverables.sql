-- Replaces the hand-authored, non-DB milestone list in
-- console/src/lib/delivery.ts with real per-workspace rows. Unlike
-- inquiries/inquiry_activities (internal CRM data, staff-only), deliverables
-- are what the Delivery tab in console shows the *client* -- so, like
-- workspaces itself, workspace members can read their own workspace's rows,
-- not just admins. Only admins can write: delivery status is Restart's own
-- curated update to the client, not something the client edits.

create table console.deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references console.workspaces (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not-started' check (status in ('not-started', 'in-progress', 'completed', 'blocked')),
  sort_order integer not null default 0,
  due_at timestamptz,
  meta text,
  created_at timestamptz not null default now()
);

create index deliverables_workspace_id_idx on console.deliverables (workspace_id);

alter table console.deliverables enable row level security;

create policy "members and admins can read deliverables"
  on console.deliverables for select
  to authenticated
  using (
    console.is_admin()
    or exists (
      select 1 from console.workspace_members m
      where m.workspace_id = deliverables.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "admins can manage deliverables"
  on console.deliverables for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select on console.deliverables to authenticated;
grant insert, update, delete on console.deliverables to authenticated;
grant select, insert, update, delete on console.deliverables to service_role;
