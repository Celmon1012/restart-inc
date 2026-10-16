-- Who an expense is paid to (Namecheap, Upperlink, Google...). Free text; the console suggests
-- vendors already used so the same one is spelled the same way each time.
-- Apply as supabase_admin; safe to run twice.

alter table console.expenses
  add column if not exists vendor text check (char_length(vendor) <= 120);

notify pgrst, 'reload schema';
