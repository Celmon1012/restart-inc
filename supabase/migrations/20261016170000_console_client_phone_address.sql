-- Phone and address on a client's details (console.client_details), alongside name, role, website and type.
-- admin_save_client takes them too; the old five-argument version is dropped.
-- Apply as supabase_admin; safe to run twice.

alter table console.client_details
  add column if not exists phone text,
  add column if not exists address text;

drop function if exists console.admin_save_client(text, text, text, text, text);

create or replace function console.admin_save_client(
  p_email text,
  p_contact_name text,
  p_role text,
  p_website text,
  p_client_type text,
  p_phone text default null,
  p_address text default null
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

  insert into console.client_details (email, contact_name, role, website, client_type, phone, address, updated_at, updated_by)
  values (
    v_email,
    left(nullif(btrim(coalesce(p_contact_name, '')), ''), 120),
    left(nullif(btrim(coalesce(p_role, '')), ''), 120),
    left(nullif(btrim(coalesce(p_website, '')), ''), 200),
    nullif(btrim(coalesce(p_client_type, '')), ''),
    left(nullif(btrim(coalesce(p_phone, '')), ''), 60),
    left(nullif(btrim(coalesce(p_address, '')), ''), 300),
    now(),
    auth.uid()
  )
  on conflict (email) do update
    set contact_name = excluded.contact_name,
        role = excluded.role,
        website = excluded.website,
        client_type = excluded.client_type,
        phone = excluded.phone,
        address = excluded.address,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

revoke all on function console.admin_save_client(text, text, text, text, text, text, text) from public, anon;
grant execute on function console.admin_save_client(text, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
