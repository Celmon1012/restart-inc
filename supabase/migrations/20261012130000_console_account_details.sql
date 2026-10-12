-- Bank details on a finance account, so the list says exactly which account a cost was
-- paid from: the bank, the account name as it appears at the bank, and the account number
-- (a Nigerian NUBAN is 10 digits; a card or wallet can use its last digits or a handle).
-- Admin-only like the rest of the finance tables (RLS from the accounts migration).

alter table console.finance_accounts
  add column if not exists bank_name text check (char_length(bank_name) <= 120),
  add column if not exists account_name text check (char_length(account_name) <= 160),
  add column if not exists account_number text check (char_length(account_number) <= 40);

notify pgrst, 'reload schema';
