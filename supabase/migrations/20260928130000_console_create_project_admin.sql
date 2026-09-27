-- Let admins create projects from the console for their own account.
--
-- create_project() (20260925130000) requires an existing membership, since
-- a member's first workspace goes through onboarding. Admins skip
-- onboarding (ProtectedRoute/needsOnboarding exempt them), so an admin with
-- no membership was rejected with "Finish onboarding first". Admins now
-- pass that check, and their projects skip the Leads inquiry -- a staff
-- member's own project isn't an inbound lead.
--
-- Everything else (per-account cap, input validation, membership row for
-- the caller) is unchanged.

create or replace function console.create_project(
  p_name text,
  p_engagement_type text,
  p_timeline text,
  p_budget text,
  p_brief text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_brief text := nullif(btrim(coalesce(p_brief, '')), '');
  v_full_name text;
  v_created int;
  v_workspace uuid;
  v_qualification text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if v_email is null or char_length(v_email) < 3 then
    raise exception 'Your account has no email address on file' using errcode = '22023';
  end if;
  if not console.is_admin()
     and not exists (select 1 from console.workspace_members m where m.user_id = v_uid) then
    raise exception 'Finish onboarding first' using errcode = '42501';
  end if;

  select count(*) into v_created from console.workspaces w where w.created_by = v_uid;
  if v_created >= 10 then
    raise exception 'You''ve reached the limit for self-created projects. Contact support to add more.' using errcode = '54000';
  end if;

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Project name must be 2-80 characters' using errcode = '22023';
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
  if v_brief is not null and char_length(v_brief) > 2000 then
    raise exception 'Keep the description under 2,000 characters' using errcode = '22023';
  end if;

  v_qualification := case
    when p_engagement_type = 'exploring' then 'exploring'
    when p_budget in ('25-50k', '50-100k', '100k+') and p_timeline in ('now', '30d') then 'priority'
    when p_budget in ('10-25k', '25-50k', '50-100k', '100k+') then 'qualified'
    else 'nurture'
  end;

  -- Reuse the name the member gave at onboarding for the lead record.
  select w.onboarding ->> 'full_name' into v_full_name
  from console.workspaces w
  where w.created_by = v_uid and w.onboarding ? 'full_name'
  order by w.created_at
  limit 1;

  insert into console.workspaces (
    name, contact_email, engagement_type, qualification, onboarding, created_by
  )
  values (
    v_name,
    v_email,
    p_engagement_type,
    v_qualification,
    jsonb_build_object(
      'source', 'console_new_project',
      'timeline', p_timeline,
      'budget', p_budget,
      'brief', v_brief,
      'completed_at', now()
    ),
    v_uid
  )
  returning id into v_workspace;

  insert into console.workspace_members (workspace_id, user_id)
  values (v_workspace, v_uid);

  -- A staff member's own project isn't an inbound lead.
  if not console.is_admin() then
  insert into console.inquiries (
    reference_id, source, name, email, company,
    service_tier, budget_range, target_timeline, project_brief
  )
  values (
    'RST-' || upper(to_hex((extract(epoch from now()) * 1000)::bigint)) || '-' || (100 + floor(random() * 900))::int,
    'console_new_project',
    coalesce(v_full_name, split_part(v_email, '@', 1)),
    v_email,
    v_name,
    p_engagement_type,
    p_budget,
    p_timeline,
    format(
      'New project from the console: %s. Engagement: %s. Qualification: %s.%s',
      v_name, p_engagement_type, v_qualification,
      case when v_brief is null then '' else E'\n\n' || v_brief end
    )
  );
  end if;

  return v_workspace;
end;
$$;

revoke all on function console.create_project(text, text, text, text, text) from public, anon;
grant execute on function console.create_project(text, text, text, text, text) to authenticated;
