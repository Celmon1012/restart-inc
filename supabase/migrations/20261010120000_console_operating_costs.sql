-- Restart's own operating costs, so the Finance page can set them against
-- revenue (net, margin, break-even MRR, runway).
--
-- console.expenses: one row per cost line. Recurring lines (monthly,
-- quarterly, annual) are spread evenly per month between start_date and
-- end_date; a one_off line counts only in the month of start_date.
-- Amounts are minor units (kobo / cents) like everything else in the console.
--
-- console.finance_settings: a single row holding the USD->NGN rate used to
-- fold dollar costs and revenue into naira, and the cash balance runway is
-- measured against. Both are typed in by hand -- nothing here reads a bank.
--
-- Admin-only: read and write are gated by console.is_admin(). No anon access.

create table if not exists console.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'other' check (category in (
    'infrastructure', 'software', 'people', 'marketing', 'legal_tax', 'banking_fees', 'other'
  )),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD')),
  cadence text not null default 'monthly' check (cadence in ('monthly', 'quarterly', 'annual', 'one_off')),
  start_date date not null default current_date,
  end_date date,
  notes text check (char_length(notes) <= 1000),

  check (end_date is null or end_date >= start_date)
);

create index if not exists expenses_start_idx on console.expenses (start_date desc);

create or replace function console.expenses_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on console.expenses;
create trigger expenses_set_updated_at
  before update on console.expenses
  for each row execute function console.expenses_set_updated_at();

create table if not exists console.finance_settings (
  id boolean primary key default true check (id),
  updated_at timestamptz not null default now(),
  usd_ngn numeric(12, 4) not null default 1500 check (usd_ngn > 0),
  cash_ngn_cents bigint not null default 0 check (cash_ngn_cents >= 0)
);

insert into console.finance_settings (id) values (true) on conflict (id) do nothing;

alter table console.expenses enable row level security;
alter table console.finance_settings enable row level security;

drop policy if exists "admins manage expenses" on console.expenses;
create policy "admins manage expenses"
  on console.expenses for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

drop policy if exists "admins read finance settings" on console.finance_settings;
create policy "admins read finance settings"
  on console.finance_settings for select
  to authenticated
  using (console.is_admin());

drop policy if exists "admins update finance settings" on console.finance_settings;
create policy "admins update finance settings"
  on console.finance_settings for update
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update, delete on console.expenses to authenticated;
grant select, update on console.finance_settings to authenticated;
grant select, insert, update, delete on console.expenses to service_role;
grant select, update on console.finance_settings to service_role;

notify pgrst, 'reload schema';
