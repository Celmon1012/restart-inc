-- Lead capture for the public "Start a Project" page and onboarding modal.
--
-- Both forms previously POSTed real prospect leads to https://httpbin.org/post
-- (a public request-echo test service) and treated network failures as
-- success -- every real inquiry was silently discarded and the visitor was
-- told it worked. This table is where those leads actually land.
--
-- Public-facing, unlike the rest of console.*: any visitor (anon, not signed
-- in) can submit one, but only an admin can read them back. There is no
-- update/delete policy at all -- triage happens by changing `status`, which
-- only service_role (Studio or a future admin tool) can do for now.

create table console.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reference_id text not null unique,
  source text not null check (source in ('start_project_page', 'onboarding_modal', 'contact_page')),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  company text check (char_length(company) <= 200),
  service_tier text,
  budget_range text,
  project_stage text,
  target_timeline text,
  project_brief text check (char_length(project_brief) <= 5000),
  user_agent text,
  referrer text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'archived'))
);

create index inquiries_created_at_idx on console.inquiries (created_at desc);

alter table console.inquiries enable row level security;

-- Anyone can submit an inquiry -- this is a public lead form, not a
-- console feature, so there's no auth.uid() to check against.
create policy "anyone can submit an inquiry"
  on console.inquiries for insert
  to anon, authenticated
  with check (true);

-- Only admins can read leads back. Reuses console.is_admin() from
-- 20260916180000_console_admin_visibility.sql.
create policy "admins can read inquiries"
  on console.inquiries for select
  to authenticated
  using (console.is_admin());

grant insert on console.inquiries to anon, authenticated;
grant select on console.inquiries to authenticated;
grant select, insert, update, delete on console.inquiries to service_role;
