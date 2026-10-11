-- Service ledger: what each client deployment costs Restart to run.
--
-- The sale side already exists (Lago subscription -> MRR per workspace). This
-- adds the cost side so Finance can show margin per deployment:
--   margin = workspace MRR - sum(cost of its active services)
--
-- console.services: one row per cost-bearing thing behind a workspace
-- (normally its server). coolify_server_uuid is set for Hetzner servers
-- synced from Coolify, so Finance can notice when the server disappears and
-- offer to end the row; it is null for manually tracked servers (Contabo).
-- Cost accrues from started_on to ended_on (prorated by day), then stops.
--
-- Also: EUR becomes a valid cost currency (Hetzner bills in EUR) with its own
-- rate on finance_settings. Admin-only, like the other finance tables.

alter table console.expenses drop constraint if exists expenses_currency_check;
alter table console.expenses
  add constraint expenses_currency_check check (currency in ('NGN', 'USD', 'EUR'));

alter table console.finance_settings
  add column if not exists eur_ngn numeric(12, 4) not null default 1650 check (eur_ngn > 0);

create table if not exists console.services (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  workspace_id uuid not null references console.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  provider text not null default 'hetzner' check (provider in ('hetzner', 'contabo', 'other')),
  coolify_server_uuid text check (char_length(coolify_server_uuid) <= 100),
  monthly_cost_cents bigint not null check (monthly_cost_cents >= 0),
  currency text not null default 'EUR' check (currency in ('NGN', 'USD', 'EUR')),
  started_on date not null default current_date,
  ended_on date,
  notes text check (char_length(notes) <= 1000),

  check (ended_on is null or ended_on >= started_on)
);

create index if not exists services_workspace_idx on console.services (workspace_id);
-- A Coolify server backs at most one live service row.
create unique index if not exists services_coolify_server_key
  on console.services (coolify_server_uuid)
  where coolify_server_uuid is not null and ended_on is null;

create or replace function console.services_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_set_updated_at on console.services;
create trigger services_set_updated_at
  before update on console.services
  for each row execute function console.services_set_updated_at();

alter table console.services enable row level security;

drop policy if exists "admins manage services" on console.services;
create policy "admins manage services"
  on console.services for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select, insert, update, delete on console.services to authenticated;
grant select, insert, update, delete on console.services to service_role;

notify pgrst, 'reload schema';
