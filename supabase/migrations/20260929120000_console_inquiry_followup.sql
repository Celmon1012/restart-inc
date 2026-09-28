-- Follow-up for the public lead forms: saved drafts, resume links, and an
-- acknowledgement email for every submitted brief or scorecard.
--
-- Start a Project now asks for contact details on step 1 and saves the rest
-- of the brief as the visitor goes. Someone who leaves halfway is no longer
-- lost: console-inquiry-notify emails them a link back to exactly where they
-- stopped (at most two reminders, and one click stops them).
--
-- Drafts live in their own table, not in console.inquiries, so nothing that
-- reads leads today (Leads, Overview, the follow-up agent) has to learn to
-- skip half-written ones. A draft only becomes an inquiry when it is sent.
--
-- Anon never touches console.inquiry_drafts directly. Every read and write
-- goes through the security-definer functions below, keyed by the draft's
-- resume_token -- a random uuid the visitor's browser (or their resume link)
-- holds. Knowing a token is the only way to read or change its draft.

create table console.inquiry_drafts (
  id uuid primary key default gen_random_uuid(),
  resume_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  origin text not null default 'start_project_page' check (origin in ('start_project_page', 'scorecard')),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  company text check (char_length(company) <= 200),
  phone text check (phone is null or phone ~ '^\+[0-9]{8,15}$'),
  whatsapp_opt_in boolean not null default false,
  last_step smallint not null default 1 check (last_step between 1 and 4),
  -- The rest of the form, as the visitor left it. Opaque to the database.
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 16384),
  submitted_at timestamptz,
  submitted_inquiry_id uuid references console.inquiries (id) on delete set null,
  nudges_sent smallint not null default 0,
  -- 2 for an abandoned Start a Project draft; 0 for the draft made for a
  -- scorecard lead, who already heard from us once in the acknowledgement.
  max_nudges smallint not null default 2 check (max_nudges between 0 and 2),
  last_nudged_at timestamptz,
  followups_stopped_at timestamptz
);

create index inquiry_drafts_open_idx on console.inquiry_drafts (updated_at)
  where submitted_at is null and followups_stopped_at is null;

alter table console.inquiry_drafts enable row level security;

create policy "admins can read inquiry drafts"
  on console.inquiry_drafts for select
  to authenticated
  using (console.is_admin());

grant select on console.inquiry_drafts to authenticated;
grant select, insert, update, delete on console.inquiry_drafts to service_role;

-- Contact channel and acknowledgement tracking on submitted inquiries.
alter table console.inquiries
  add column phone text check (phone is null or phone ~ '^\+[0-9]{8,15}$'),
  add column whatsapp_opt_in boolean not null default false,
  add column ack_sent_at timestamptz;

-- Leads that arrived before this migration were answered by hand. Mark them
-- as acknowledged so the first notify run doesn't email the whole backlog.
update console.inquiries set ack_sent_at = created_at where ack_sent_at is null;

-- ------------------------------------------------------------------ --
-- Draft functions (anon-callable)
-- ------------------------------------------------------------------ --

-- Create a draft (p_token null, or a token that no longer matches an open
-- draft) or update the open draft the token points at. Returns the token
-- the caller should keep using.
create or replace function console.save_inquiry_draft(
  p_token uuid,
  p_name text,
  p_email text,
  p_company text,
  p_phone text,
  p_whatsapp_opt_in boolean,
  p_last_step int,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if p_token is not null then
    update console.inquiry_drafts
       set name = p_name,
           email = p_email,
           company = nullif(p_company, ''),
           phone = nullif(p_phone, ''),
           whatsapp_opt_in = coalesce(p_whatsapp_opt_in, false) and nullif(p_phone, '') is not null,
           last_step = greatest(1, least(4, coalesce(p_last_step, 1))),
           payload = coalesce(p_payload, '{}'::jsonb),
           updated_at = now()
     where resume_token = p_token
       and submitted_at is null
    returning resume_token into v_token;
    if v_token is not null then
      return v_token;
    end if;
  end if;

  insert into console.inquiry_drafts (name, email, company, phone, whatsapp_opt_in, last_step, payload)
  values (
    p_name,
    p_email,
    nullif(p_company, ''),
    nullif(p_phone, ''),
    coalesce(p_whatsapp_opt_in, false) and nullif(p_phone, '') is not null,
    greatest(1, least(4, coalesce(p_last_step, 1))),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning resume_token into v_token;
  return v_token;
end;
$$;

-- Read a draft back for the resume link. submitted_reference is set when the
-- brief was already sent, so the page can say so instead of re-opening it.
create or replace function console.get_inquiry_draft(p_token uuid)
returns table (
  origin text,
  name text,
  email text,
  company text,
  phone text,
  whatsapp_opt_in boolean,
  last_step smallint,
  payload jsonb,
  submitted_reference text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.origin, d.name, d.email, d.company, d.phone, d.whatsapp_opt_in, d.last_step, d.payload,
         i.reference_id
    from console.inquiry_drafts d
    left join console.inquiries i on i.id = d.submitted_inquiry_id
   where d.resume_token = p_token;
$$;

-- Close a draft once its brief has been inserted into console.inquiries.
-- The inquiry itself is still written by the page's normal insert, so a
-- failure here never costs a lead -- at worst the draft gets a reminder
-- the notify function then suppresses (it checks for a later inquiry from
-- the same email before sending).
create or replace function console.mark_inquiry_draft_submitted(p_token uuid, p_reference_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  update console.inquiry_drafts d
     set submitted_at = now(),
         submitted_inquiry_id = (select i.id from console.inquiries i where i.reference_id = p_reference_id)
   where d.resume_token = p_token
     and d.submitted_at is null
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

-- The "stop reminders" link in every nudge email.
create or replace function console.stop_inquiry_followups(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  update console.inquiry_drafts
     set followups_stopped_at = coalesce(followups_stopped_at, now())
   where resume_token = p_token
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

revoke execute on function console.save_inquiry_draft(uuid, text, text, text, text, boolean, int, jsonb) from public;
revoke execute on function console.get_inquiry_draft(uuid) from public;
revoke execute on function console.mark_inquiry_draft_submitted(uuid, text) from public;
revoke execute on function console.stop_inquiry_followups(uuid) from public;

grant execute on function console.save_inquiry_draft(uuid, text, text, text, text, boolean, int, jsonb) to anon, authenticated;
grant execute on function console.get_inquiry_draft(uuid) to anon, authenticated;
grant execute on function console.mark_inquiry_draft_submitted(uuid, text) to anon, authenticated;
grant execute on function console.stop_inquiry_followups(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ --
-- Schedule
-- ------------------------------------------------------------------ --

-- Every 10 minutes: acknowledgements for new leads, then reminders for
-- abandoned drafts. Same pg_cron + pg_net wiring as the follow-up agent
-- (20260917170000_console_agent_cron.sql), same shared secret. Set the URL
-- once, by hand, before this job can succeed:
--
--   alter database postgres set app.settings.console_inquiry_notify_url =
--     'https://<supabase-host>/functions/v1/console-inquiry-notify';
--
-- The function needs RESEND_API_KEY, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY
-- and optionally SITE_URL / WHATSAPP_NUMBER / RESEND_FROM.

select cron.schedule(
  'console-inquiry-notify',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.console_inquiry_notify_url', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', current_setting('app.settings.console_cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);
