-- Read-only drift check: which supabase/migrations/* are not fully reflected
-- in this database. Production migrations are applied by hand (no migration
-- history table), so this probes each migration's key objects instead --
-- tables, columns, functions, policies, grants, check constraints.
--
-- Run: psql -U postgres -d postgres -P pager=off -f check-migrations.sql
-- Output: one row per migration that is missing something, listing what.
-- No rows = everything present. Update the probe list when adding a migration.

with probe(migration, kind, obj, detail) as (
  values
    ('20260916120000_console_workspaces',            'table',  'console.workspaces', null),
    ('20260916120000_console_workspaces',            'table',  'console.workspace_members', null),
    ('20260916120000_console_workspaces',            'grant',  'console.workspaces', 'authenticated:SELECT'),
    ('20260916180000_console_admin_visibility',      'func',   'console.is_admin', null),
    ('20260916180000_console_admin_visibility',      'policy', 'console.workspaces', 'members and admins can read workspaces'),
    ('20260916190000_console_workspace_billing',     'column', 'console.workspaces', 'lago_customer_id'),
    ('20260917120000_console_inquiries',             'table',  'console.inquiries', null),
    ('20260917120000_console_inquiries',             'policy', 'console.inquiries', 'anyone can submit an inquiry'),
    ('20260917120000_console_inquiries',             'policy', 'console.inquiries', 'admins can read inquiries'),
    ('20260917120000_console_inquiries',             'grant',  'console.inquiries', 'authenticated:SELECT'),
    ('20260917130000_console_inquiries_pipeline',    'column', 'console.inquiries', 'assigned_to'),
    ('20260917130000_console_inquiries_pipeline',    'column', 'console.inquiries', 'next_follow_up_at'),
    ('20260917130000_console_inquiries_pipeline',    'column', 'console.inquiries', 'last_contacted_at'),
    ('20260917130000_console_inquiries_pipeline',    'check',  'inquiries_status_check', 'won'),
    ('20260917130000_console_inquiries_pipeline',    'policy', 'console.inquiries', 'admins can update inquiries'),
    ('20260917130000_console_inquiries_pipeline',    'grant',  'console.inquiries', 'authenticated:UPDATE'),
    ('20260917140000_console_inquiry_activities',    'table',  'console.inquiry_activities', null),
    ('20260917140000_console_inquiry_activities',    'policy', 'console.inquiry_activities', 'admins can read inquiry activities'),
    ('20260917140000_console_inquiry_activities',    'grant',  'console.inquiry_activities', 'authenticated:INSERT'),
    ('20260917150000_console_deliverables',          'table',  'console.deliverables', null),
    ('20260917150000_console_deliverables',          'policy', 'console.deliverables', 'admins can manage deliverables'),
    ('20260917150000_console_deliverables',          'grant',  'console.deliverables', 'authenticated:SELECT'),
    ('20260917150000_console_deliverables',          'grant',  'console.deliverables', 'authenticated:INSERT'),
    ('20260917160000_console_agent_runs',            'table',  'console.agent_runs', null),
    ('20260917160000_console_agent_runs',            'grant',  'console.agent_runs', 'authenticated:SELECT'),
    ('20260917170000_console_agent_cron',            'ext',    'pg_cron', null),
    ('20260917170000_console_agent_cron',            'ext',    'pg_net', null),
    ('20260917180000_console_workspace_contact',     'column', 'console.workspaces', 'contact_email'),
    ('20260917190000_console_deliverable_tasks',     'table',  'console.deliverable_tasks', null),
    ('20260917190000_console_deliverable_tasks',     'policy', 'console.deliverable_tasks', 'members and admins can read deliverable tasks'),
    ('20260917190000_console_deliverable_tasks',     'grant',  'console.deliverable_tasks', 'authenticated:SELECT'),
    ('20260917190000_console_deliverable_tasks',     'grant',  'console.deliverable_tasks', 'authenticated:UPDATE'),
    ('20260917200000_console_deliverable_activities','table',  'console.deliverable_activities', null),
    ('20260917200000_console_deliverable_activities','policy', 'console.deliverable_activities', 'admins can read deliverable activities'),
    ('20260917200000_console_deliverable_activities','policy', 'console.deliverable_activities', 'admins can insert deliverable activities'),
    ('20260917200000_console_deliverable_activities','policy', 'console.deliverable_activities', 'admins can update deliverable activities'),
    ('20260917200000_console_deliverable_activities','grant',  'console.deliverable_activities', 'authenticated:INSERT'),
    ('20260918100000_console_support_conversations', 'table',  'console.support_conversations', null),
    ('20260918100000_console_support_conversations', 'policy', 'console.support_conversations', 'members and admins can record support conversations'),
    ('20260918100000_console_support_conversations', 'grant',  'console.support_conversations', 'authenticated:INSERT'),
    ('20260918110000_console_support_proposals',     'table',  'console.support_proposals', null),
    ('20260918110000_console_support_proposals',     'grant',  'console.support_proposals', 'authenticated:UPDATE'),
    ('20260918120000_console_support_source_id',     'column', 'console.support_conversations', 'chatwoot_source_id'),
    ('20260923120000_console_self_onboarding',       'column', 'console.workspaces', 'client_type'),
    ('20260923120000_console_self_onboarding',       'column', 'console.workspaces', 'engagement_type'),
    ('20260923120000_console_self_onboarding',       'column', 'console.workspaces', 'qualification'),
    ('20260923120000_console_self_onboarding',       'column', 'console.workspaces', 'onboarding'),
    ('20260923120000_console_self_onboarding',       'column', 'console.workspaces', 'created_by'),
    ('20260923120000_console_self_onboarding',       'check',  'inquiries_source_check', 'console_onboarding'),
    ('20260923120000_console_self_onboarding',       'func',   'console.complete_onboarding', null),
    ('20260925120000_console_inquiries_scorecard',   'column', 'console.inquiries', 'scorecard'),
    ('20260925120000_console_inquiries_scorecard',   'check',  'inquiries_source_check', 'scorecard'),
    ('20260925130000_console_create_project',        'func',   'console.create_project', null),
    ('20260925130000_console_create_project',        'check',  'inquiries_source_check', 'console_new_project'),
    ('20260926120000_console_server_requests',       'table',  'console.server_requests', null),
    ('20260926120000_console_server_requests',       'policy', 'console.server_requests', 'admins can manage server requests'),
    ('20260926120000_console_server_requests',       'grant',  'console.server_requests', 'authenticated:SELECT'),
    ('20260926120000_console_server_requests',       'func',   'console.request_server_change', null),
    ('20260927120000_console_server_requests_your_cloud', 'column', 'console.server_requests', 'hosting'),
    ('20260927120000_console_server_requests_your_cloud', 'column', 'console.server_requests', 'cloud_provider'),
    ('20260928120000_console_anon_schema_usage',     'schema', 'console', 'anon:USAGE'),
    ('20260928130000_console_create_project_admin',  'funcsrc','console.create_project', 'is_admin'),
    ('20260929120000_console_inquiry_followup',      'table',  'console.inquiry_drafts', null),
    ('20260929120000_console_inquiry_followup',      'column', 'console.inquiries', 'phone'),
    ('20260929120000_console_inquiry_followup',      'column', 'console.inquiries', 'whatsapp_opt_in'),
    ('20260929120000_console_inquiry_followup',      'column', 'console.inquiries', 'ack_sent_at'),
    ('20260929120000_console_inquiry_followup',      'func',   'console.save_inquiry_draft', null),
    ('20260929120000_console_inquiry_followup',      'func',   'console.stop_inquiry_followups', null),
    ('20261008120000_console_outreach',              'table',  'console.prospects', null),
    ('20261008120000_console_outreach',              'table',  'console.prospect_touches', null),
    ('20261008120000_console_outreach',              'grant',  'console.prospects', 'service_role:INSERT'),
    ('20261008120000_console_outreach',              'grant',  'console.prospect_touches', 'service_role:INSERT'),
    ('20261008120000_console_outreach',              'policy', 'console.prospects', 'admins can read prospects'),
    ('20261008120000_console_outreach',              'policy', 'console.prospect_touches', 'admins can read prospect touches')
),
checked as (
  select
    migration,
    kind || ' ' || obj || coalesce(' / ' || detail, '') as item,
    case kind
      when 'table'  then to_regclass(obj) is not null
      when 'column' then exists (
        select 1 from information_schema.columns
        where table_schema = split_part(obj, '.', 1) and table_name = split_part(obj, '.', 2) and column_name = detail)
      when 'func'   then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = split_part(obj, '.', 1) and p.proname = split_part(obj, '.', 2))
      when 'funcsrc' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = split_part(obj, '.', 1) and p.proname = split_part(obj, '.', 2) and p.prosrc like '%' || detail || '%')
      when 'policy' then exists (
        select 1 from pg_policies
        where schemaname = split_part(obj, '.', 1) and tablename = split_part(obj, '.', 2) and policyname = detail)
      -- CASE (not AND) so has_table_privilege never sees a missing table.
      when 'grant'  then case when to_regclass(obj) is null then false
        else has_table_privilege(split_part(detail, ':', 1), obj, split_part(detail, ':', 2)) end
      when 'schema' then has_schema_privilege(split_part(detail, ':', 1), obj, split_part(detail, ':', 2))
      when 'check'  then exists (
        select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where n.nspname = 'console' and c.conname = obj and pg_get_constraintdef(c.oid) like '%''' || detail || '''%')
      when 'ext'    then exists (select 1 from pg_extension where extname = obj)
    end as ok
  from probe
)
select migration, count(*) filter (where not ok) || '/' || count(*) as missing, string_agg(item, E'\n') filter (where not ok) as what
from checked
group by migration
having bool_or(not ok)
order by migration;
