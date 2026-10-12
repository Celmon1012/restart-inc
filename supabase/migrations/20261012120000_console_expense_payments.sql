-- Payments against expenses, and the accounts they are paid from.
--
-- console.expenses is a schedule (what a cost is and how often it recurs). That drives
-- the monthly cost figures but is not evidence of payment. console.expense_payments is
-- the record of each payment actually made: when, how much, from which account, with what
-- reference. A one-off expense is an expense row (cadence one_off) with a single payment.
--
-- Audit properties:
--   * No deletes: delete is not granted, and a trigger refuses any update except voiding.
--   * A mistaken entry is voided with a reason (voided_at, void_reason), never edited or removed.
--   * Each payment keeps who entered it and when (created_by, created_at).
--   * Amounts are kept in the currency billed, plus the NGN cost at the rate used on the day.
--
-- period_end is the last day the payment covers (a monthly renewal paid on 12 Oct covers
-- through 11 Nov). The console derives "next due" from it.
--
-- Admin-only: read and insert gated by console.is_admin(). No anon access.

create table if not exists console.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'bank' check (kind in ('bank', 'card', 'cash', 'wallet')),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD', 'EUR')),
  note text check (char_length(note) <= 500),
  active boolean not null default true
);

create table if not exists console.expense_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),

  expense_id uuid not null references console.expenses (id) on delete restrict,
  account_id uuid references console.finance_accounts (id) on delete restrict,

  paid_on date not null default current_date,
  period_end date,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency in ('NGN', 'USD', 'EUR')),
  -- NGN per 1 unit of `currency` at payment (1 for NGN) and the resulting NGN cost.
  fx_rate numeric(14, 4) not null default 1 check (fx_rate > 0),
  amount_ngn_cents bigint not null check (amount_ngn_cents > 0),
  -- VAT included in amount_cents, if the receipt shows it (input VAT).
  vat_cents bigint not null default 0 check (vat_cents >= 0),
  reference text check (char_length(reference) <= 200),
  note text check (char_length(note) <= 500),

  voided_at timestamptz,
  void_reason text check (char_length(void_reason) <= 300),
  check ((voided_at is null) = (void_reason is null))
);

create index if not exists expense_payments_expense_idx on console.expense_payments (expense_id, paid_on desc);
create index if not exists expense_payments_paid_on_idx on console.expense_payments (paid_on desc);

-- A payment can only be voided (once); every other change is refused.
create or replace function console.expense_payments_guard()
returns trigger
language plpgsql
as $$
begin
  if old.voided_at is not null then
    raise exception 'A voided payment cannot be changed' using errcode = '42501';
  end if;
  if new.voided_at is null
     or (to_jsonb(new) - 'voided_at' - 'void_reason') is distinct from (to_jsonb(old) - 'voided_at' - 'void_reason') then
    raise exception 'Payments can only be voided, not edited' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists expense_payments_guard on console.expense_payments;
create trigger expense_payments_guard
  before update on console.expense_payments
  for each row execute function console.expense_payments_guard();

alter table console.finance_accounts enable row level security;
alter table console.expense_payments enable row level security;

drop policy if exists "admins manage finance accounts" on console.finance_accounts;
create policy "admins manage finance accounts"
  on console.finance_accounts for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

drop policy if exists "admins read expense payments" on console.expense_payments;
create policy "admins read expense payments"
  on console.expense_payments for select
  to authenticated
  using (console.is_admin());

drop policy if exists "admins insert expense payments" on console.expense_payments;
create policy "admins insert expense payments"
  on console.expense_payments for insert
  to authenticated
  with check (console.is_admin());

drop policy if exists "admins void expense payments" on console.expense_payments;
create policy "admins void expense payments"
  on console.expense_payments for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update, delete on console.finance_accounts to authenticated;
grant select, insert, update on console.expense_payments to authenticated;
grant select, insert, update, delete on console.finance_accounts to service_role;
grant select, insert, update on console.expense_payments to service_role;

notify pgrst, 'reload schema';
