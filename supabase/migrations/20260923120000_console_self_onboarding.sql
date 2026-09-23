-- Self-service console onboarding.
--
-- Until now a workspace only existed once restart-inc created it by hand
-- (Studio / service_role) and attached a Coolify project to it -- a new
-- account signing in with Google landed on "No workspace has been assigned
-- to your account yet" with nothing to do. This lets a signed-in account
-- with no membership create its own workspace through a short onboarding
-- wizard, which also prequalifies it (client type, engagement type, fit)
-- and drops a lead into console.inquiries so it shows up in Leads.
--
-- A self-created workspace has no infrastructure yet, so
-- coolify_project_uuid becomes nullable: NULL means "provisioning pending"
-- and console-data returns an empty resource list for it instead of
-- calling Coolify. Staff attach the project later, exactly as before.

alter table console.workspaces
  alter column coolify_project_uuid drop not null;

alter table console.workspaces
  add column client_type text
    check (client_type in ('startup', 'sme', 'enterprise', 'agency', 'individual')),
  add column engagement_type text
    check (engagement_type in ('build', 'scale', 'operate', 'ai', 'advisory', 'exploring')),
  add column qualification text
    check (qualification in ('priority', 'qualified', 'nurture', 'exploring')),
  add column onboarding jsonb,
  add column created_by uuid references auth.users (id) on delete set null;

alter table console.inquiries
  drop constraint inquiries_source_check,
  add constraint inquiries_source_check
    check (source in ('start_project_page', 'onboarding_modal', 'contact_page', 'console_onboarding'));

-- SECURITY DEFINER because a plain member has no insert grant on
-- console.workspaces / workspace_members (assignment stays staff-managed
-- for everything else). The function is the whole boundary here, so it:
--   - only ever acts for auth.uid(), never a caller-supplied user id
--   - only creates a workspace for an account that has none (idempotent:
--     a double-submit returns the existing workspace instead of a second)
--   - validates every enum itself rather than trusting the client
--   - takes the contact email from the verified JWT, not from input
-- qualification is derived here too, so a client can't self-label as
-- "priority" -- it's a triage hint for staff, computed from the answers.
create or replace function console.complete_onboarding(
  p_full_name text,
  p_role text,
  p_company text,
  p_website text,
  p_client_type text,
  p_engagement_type text,
  p_timeline text,
  p_budget text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_existing uuid;
  v_workspace uuid;
  v_qualification text;
  v_company text := nullif(btrim(coalesce(p_company, '')), '');
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if v_email is null or char_length(v_email) < 3 then
    raise exception 'Your account has no email address on file' using errcode = '22023';
  end if;

  select m.workspace_id into v_existing
  from console.workspace_members m
  where m.user_id = v_uid
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  if v_name is null or char_length(v_name) > 200 then
    raise exception 'Enter your name' using errcode = '22023';
  end if;
  if v_company is null or char_length(v_company) > 200 then
    raise exception 'Enter your organization name' using errcode = '22023';
  end if;
  if p_client_type not in ('startup', 'sme', 'enterprise', 'agency', 'individual') then
    raise exception 'Unknown client type' using errcode = '22023';
  end if;
  if p_engagement_type not in ('build', 'scale', 'operate', 'ai', 'advisory', 'exploring') then
    raise exception 'Unknown engagement type' using errcode = '22023';
  end if;
  if p_timeline is not null and p_timeline not in ('now', '30d', 'quarter', 'later') then
    raise exception 'Unknown timeline' using errcode = '22023';
  end if;
  if p_budget is not null and p_budget not in ('lt10k', '10-25k', '25-50k', '50-100k', '100k+', 'unset') then
    raise exception 'Unknown budget range' using errcode = '22023';
  end if;

  v_qualification := case
    when p_engagement_type = 'exploring' then 'exploring'
    when p_budget in ('25-50k', '50-100k', '100k+') and p_timeline in ('now', '30d') then 'priority'
    when p_budget in ('10-25k', '25-50k', '50-100k', '100k+') then 'qualified'
    else 'nurture'
  end;

  insert into console.workspaces (
    name, contact_email, client_type, engagement_type, qualification, onboarding, created_by
  )
  values (
    v_company,
    v_email,
    p_client_type,
    p_engagement_type,
    v_qualification,
    jsonb_build_object(
      'full_name', v_name,
      'role', p_role,
      'website', nullif(btrim(coalesce(p_website, '')), ''),
      'timeline', p_timeline,
      'budget', p_budget,
      'completed_at', now()
    ),
    v_uid
  )
  returning id into v_workspace;

  insert into console.workspace_members (workspace_id, user_id)
  values (v_workspace, v_uid);

  insert into console.inquiries (
    reference_id, source, name, email, company,
    service_tier, budget_range, target_timeline, project_brief
  )
  values (
    'RST-' || upper(to_hex((extract(epoch from now()) * 1000)::bigint)) || '-' || (100 + floor(random() * 900))::int,
    'console_onboarding',
    v_name,
    v_email,
    v_company,
    p_engagement_type,
    p_budget,
    p_timeline,
    format(
      'Console sign-up. Client type: %s. Engagement: %s. Qualification: %s. Role: %s. Website: %s.',
      p_client_type, p_engagement_type, v_qualification,
      coalesce(p_role, '—'), coalesce(nullif(btrim(coalesce(p_website, '')), ''), '—')
    )
  );

  return v_workspace;
end;
$$;

revoke all on function console.complete_onboarding(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function console.complete_onboarding(text, text, text, text, text, text, text, text) to authenticated;
