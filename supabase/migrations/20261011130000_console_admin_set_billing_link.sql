-- Admin: link (or, with NULL, unlink) a console project's Lago customer.
--
-- Until now workspaces.lago_customer_id was set by hand in SQL. This backs the
-- "Link billing" control on a project's Billing tab, which picks from the Lago
-- customers listed by console-admin-finance.
--
-- SECURITY DEFINER because authenticated has select-only on console.workspaces.
-- console.is_admin() is the whole boundary, checked first. The unique
-- constraint on lago_customer_id already stops two projects sharing a customer;
-- the check below turns that into a readable message. Breadmaker customers
-- (bm-...) are a separate entity and are refused.

create or replace function console.admin_set_workspace_billing(
  p_workspace_id uuid,
  p_lago_customer_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := nullif(btrim(coalesce(p_lago_customer_id, '')), '');
begin
  if not console.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if v_id is not null and v_id like 'bm-%' then
    raise exception 'Breadmaker customers are billed separately and cannot be linked here' using errcode = '22023';
  end if;

  if v_id is not null and exists (
    select 1 from console.workspaces w
    where w.lago_customer_id = v_id and w.id <> p_workspace_id
  ) then
    raise exception 'That billing customer is already linked to another project' using errcode = '23505';
  end if;

  update console.workspaces
  set lago_customer_id = v_id
  where id = p_workspace_id;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function console.admin_set_workspace_billing(uuid, text) from public, anon;
grant execute on function console.admin_set_workspace_billing(uuid, text) to authenticated;

notify pgrst, 'reload schema';
