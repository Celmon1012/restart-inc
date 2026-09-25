-- Leads from the public Production Readiness Scorecard (/scorecard).
--
-- A visitor who finishes the scorecard can ask for a senior engineer's
-- review of their result. That request lands here like any other inquiry,
-- with its own source so it can be told apart in the Leads view, and the
-- structured result kept alongside the human-readable project_brief:
--
--   { "score": 55, "band": "Functional, with real exposure",
--     "areas": { "observability": 33, "delivery": 67, ... },
--     "weakest": ["observability", "security"] }
--
-- Insert policy is unchanged (anyone can submit; only admins read), so no
-- new grants are needed.

alter table console.inquiries
  drop constraint inquiries_source_check,
  add constraint inquiries_source_check
    check (source in ('start_project_page', 'onboarding_modal', 'contact_page', 'console_onboarding', 'scorecard'));

alter table console.inquiries
  add column scorecard jsonb
    check (scorecard is null or (jsonb_typeof(scorecard) = 'object' and pg_column_size(scorecard) <= 4096));
