-- Domains, kept like hosting: a domain is a yearly expense (category 'domains') with a registrar
-- (the expense's vendor) and, for a client's domain, the project it belongs to. Restart's own
-- domains have no project. They are listed on the Domains page and show as one row on Expenses.
-- Apply as supabase_admin; safe to run twice.

alter table console.expenses drop constraint if exists expenses_category_check;
alter table console.expenses
  add constraint expenses_category_check check (category in (
    'infrastructure', 'software', 'utilities', 'people', 'marketing',
    'travel', 'equipment', 'legal_tax', 'banking_fees', 'domains', 'other'
  ));

alter table console.expenses
  add column if not exists workspace_id uuid references console.workspaces (id) on delete set null;

notify pgrst, 'reload schema';
