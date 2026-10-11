-- VAT remittances: money paid to the tax authority.
--
-- The Finance overview computes VAT collected from Lago invoices (the tax
-- portion of each payment). VAT owed = collected - remitted. Each row here is
-- one payment to the tax authority, in NGN minor units, entered by hand. To
-- start from a known balance, log an opening remittance for any VAT already
-- paid before the console tracked it.
--
-- Admin-only: read and write gated by console.is_admin(). No anon access.

create table if not exists console.vat_remittances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  paid_on date not null default current_date,
  amount_cents bigint not null check (amount_cents > 0),
  reference text check (char_length(reference) <= 200),
  note text check (char_length(note) <= 500)
);

create index if not exists vat_remittances_paid_on_idx on console.vat_remittances (paid_on desc);

alter table console.vat_remittances enable row level security;

drop policy if exists "admins manage vat remittances" on console.vat_remittances;
create policy "admins manage vat remittances"
  on console.vat_remittances for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update, delete on console.vat_remittances to authenticated;
grant select, insert, update, delete on console.vat_remittances to service_role;

notify pgrst, 'reload schema';
