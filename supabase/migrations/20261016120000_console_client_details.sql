-- Client details Ops can edit: contact name, role, website, client type.
--
-- A client is still the account behind one or more projects, found by contact email. These
-- details used to come only from the onboarding answers or the lead that arrived with the same
-- email, so a client with neither (Yata Network, Kudi Konsult...) showed dashes and there was
-- nowhere to fix it. A row here, keyed by lower-cased email, overrides what onboarding said.
--
-- Read by Owner and Ops (Finance doesn't see onboarding answers). Written only through
-- admin_save_client, like the other console tables.
--
-- Apply as supabase_admin; safe to run twice.

create table if not exists console.client_details (
  email text primary key check (email = lower(email)),
  contact_name text,
  role text,
  website text,
  client_type text check (client_type in ('startup', 'sme', 'enterprise', 'agency', 'individual')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table console.client_details enable row level security;

drop policy if exists "ops can read client details" on console.client_details;
create policy "ops can read client details"
  on console.client_details for select
  using (console.has_ops_access());

revoke all on console.client_details from anon;
grant select on console.client_details to authenticated;

create or replace function console.admin_save_client(
  p_email text,
  p_contact_name text,
  p_role text,
  p_website text,
  p_client_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not console.has_ops_access() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A client needs an email to save details against' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_client_type, '')), '') is not null
     and btrim(p_client_type) not in ('startup', 'sme', 'enterprise', 'agency', 'individual') then
    raise exception 'Unknown client type' using errcode = '22023';
  end if;

  insert into console.client_details (email, contact_name, role, website, client_type, updated_at, updated_by)
  values (
    v_email,
    left(nullif(btrim(coalesce(p_contact_name, '')), ''), 120),
    left(nullif(btrim(coalesce(p_role, '')), ''), 120),
    left(nullif(btrim(coalesce(p_website, '')), ''), 200),
    nullif(btrim(coalesce(p_client_type, '')), ''),
    now(),
    auth.uid()
  )
  on conflict (email) do update
    set contact_name = excluded.contact_name,
        role = excluded.role,
        website = excluded.website,
        client_type = excluded.client_type,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

revoke all on function console.admin_save_client(text, text, text, text, text) from public, anon;
grant execute on function console.admin_save_client(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
