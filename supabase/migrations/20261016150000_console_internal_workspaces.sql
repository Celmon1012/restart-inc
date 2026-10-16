-- Which projects are Restart's own (contact email on restart.ng), so the Hosting and Domains pages
-- tag their servers and domains INTERNAL, not CLIENT. Staff of every role may ask: it returns ids only.
-- Apply as supabase_admin; safe to run twice.

create or replace function console.internal_workspace_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not console.has_staff_access() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return query select w.id from console.workspaces w where lower(coalesce(w.contact_email, '')) like '%@restart.ng';
end;
$$;

revoke all on function console.internal_workspace_ids() from public, anon;
grant execute on function console.internal_workspace_ids() to authenticated;

notify pgrst, 'reload schema';
