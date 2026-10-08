-- Outbound prospecting: who Restart reaches out to, and every touch.
--
-- console.inquiries is inbound (someone filled a form). This is the other
-- direction: companies Restart picked, researched and contacted first. They
-- stay in their own tables so cold prospects never mix with real inquiries;
-- a prospect that replies and books a call is converted into an inquiry by
-- hand (or later by a tool), not by sharing rows.
--
-- Written by the console-outreach-mcp edge function (service_role). Admins
-- can read both tables from the console. There is no anon access.
--
-- Trust boundary, same idea as inquiry_activities: Claude only ever
-- creates touches as status 'draft'. A draft becomes 'approved' and then
-- 'sent' only by a person. Nothing in this migration or the MCP function
-- sends anything.
--
-- do_not_contact is the hard stop: the MCP function refuses to draft or
-- schedule anything for a prospect with it set.

create table if not exists console.prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company text not null check (char_length(company) between 1 and 200),
  website text check (char_length(website) <= 300),
  country text check (char_length(country) <= 100),
  industry text check (char_length(industry) <= 120),
  size_band text check (size_band in ('1-10', '11-50', '51-200', '200+')),
  segment text not null default 'ng_sme' check (segment in ('ng_sme', 'intl_sme')),

  contact_name text check (char_length(contact_name) <= 200),
  contact_role text check (char_length(contact_role) <= 200),
  email text check (char_length(email) between 3 and 320),
  phone text check (char_length(phone) <= 40),
  linkedin_url text check (char_length(linkedin_url) <= 300),

  source text not null default 'manual' check (char_length(source) <= 100),
  tier text not null default 'B' check (tier in ('A', 'B', 'warm')),
  status text not null default 'new' check (status in (
    'new', 'researched', 'scored', 'drafted', 'contacted', 'replied',
    'meeting', 'proposal', 'won', 'lost', 'disqualified'
  )),

  research_brief text check (char_length(research_brief) <= 8000),
  research_sources jsonb,
  fit_score integer check (fit_score between 0 and 100),
  score_reason text check (char_length(score_reason) <= 2000),

  last_contacted_at timestamptz,
  next_followup_at timestamptz,

  do_not_contact boolean not null default false,
  do_not_contact_reason text check (char_length(do_not_contact_reason) <= 500),

  notes text check (char_length(notes) <= 5000)
);

-- One row per contact email, ignoring case. Prospects without an email
-- (found by company first) are not constrained.
create unique index if not exists prospects_email_key on console.prospects (lower(email)) where email is not null;
create index if not exists prospects_status_idx on console.prospects (status);
create index if not exists prospects_followup_idx on console.prospects (next_followup_at) where next_followup_at is not null;
create index if not exists prospects_score_idx on console.prospects (fit_score desc nulls last);

create or replace function console.prospects_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prospects_set_updated_at on console.prospects;
create trigger prospects_set_updated_at
  before update on console.prospects
  for each row execute function console.prospects_set_updated_at();

create table if not exists console.prospect_touches (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references console.prospects (id) on delete cascade,
  created_at timestamptz not null default now(),

  channel text not null check (channel in ('email', 'whatsapp', 'linkedin', 'call', 'other')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  -- Outbound: draft -> approved -> sent (or rejected). Inbound: received.
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'rejected', 'received')),
  step integer not null default 1 check (step between 1 and 20),
  subject text check (char_length(subject) <= 300),
  body text not null check (char_length(body) between 1 and 10000),
  -- Reply triage written by Claude on inbound touches:
  -- interested / not_now / not_interested / wrong_person / unsubscribe / other.
  classification text check (classification in (
    'interested', 'not_now', 'not_interested', 'wrong_person', 'unsubscribe', 'other'
  )),
  payload jsonb,
  decided_at timestamptz,
  sent_at timestamptz,

  -- A reply is never a draft; a draft is never inbound.
  check ((direction = 'inbound') = (status = 'received'))
);

create index if not exists prospect_touches_prospect_idx on console.prospect_touches (prospect_id, created_at desc);
create index if not exists prospect_touches_drafts_idx on console.prospect_touches (created_at) where status = 'draft';

alter table console.prospects enable row level security;
alter table console.prospect_touches enable row level security;

drop policy if exists "admins can read prospects" on console.prospects;
create policy "admins can read prospects"
  on console.prospects for select
  to authenticated
  using (console.is_admin());

drop policy if exists "admins can update prospects" on console.prospects;
create policy "admins can update prospects"
  on console.prospects for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

drop policy if exists "admins can read prospect touches" on console.prospect_touches;
create policy "admins can read prospect touches"
  on console.prospect_touches for select
  to authenticated
  using (console.is_admin());

-- Approving or rejecting a draft is an admin update.
drop policy if exists "admins can update prospect touches" on console.prospect_touches;
create policy "admins can update prospect touches"
  on console.prospect_touches for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, update on console.prospects to authenticated;
grant select, update on console.prospect_touches to authenticated;
grant select, insert, update, delete on console.prospects to service_role;
grant select, insert, update, delete on console.prospect_touches to service_role;

notify pgrst, 'reload schema';
