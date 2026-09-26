-- "Your cloud" option for server requests: a client who wants the Managed
-- Environment operations on a server in their own cloud account (or on-prem)
-- instead of on Restart-hosted capacity. Billed on the managed-env-byo-*
-- plans (management fee only) plus the client-cloud-onboarding-* add-on.
--
-- A client-hosted request has no S/M/L tier: the client picks and pays for
-- the server, so it records where it lives and roughly what it is instead.
-- Only new_server requests can be client-hosted; resizing a server the
-- client owns happens in their provider's console.

alter table console.server_requests
  add column hosting text not null default 'restart' check (hosting in ('restart', 'client')),
  add column cloud_provider text check (cloud_provider in ('aws', 'gcp', 'azure', 'digitalocean', 'on_prem', 'other')),
  add column cloud_region text check (char_length(cloud_region) <= 100),
  add column cloud_spec text check (char_length(cloud_spec) <= 200);

alter table console.server_requests alter column requested_tier drop not null;

alter table console.server_requests add constraint server_requests_hosting_shape check (
  (hosting = 'restart' and requested_tier is not null and cloud_provider is null)
  or (hosting = 'client' and kind = 'new_server' and requested_tier is null and cloud_provider is not null)
);

-- New parameters change the signature, so replace rather than overload
-- (an overload with defaults would make PostgREST calls ambiguous).
drop function console.request_server_change(uuid, text, text, text, text);

create or replace function console.request_server_change(
  p_workspace_id uuid,
  p_kind text,
  p_server_uuid text,
  p_tier text,
  p_reason text,
  p_hosting text default 'restart',
  p_cloud_provider text default null,
  p_cloud_region text default null,
  p_cloud_spec text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_open int;
  v_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_hosting text := coalesce(p_hosting, 'restart');
  v_region text := nullif(btrim(coalesce(p_cloud_region, '')), '');
  v_spec text := nullif(btrim(coalesce(p_cloud_spec, '')), '');
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from console.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = v_uid
  ) and not console.is_admin() then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  if p_kind not in ('upgrade', 'new_server') then
    raise exception 'Unknown request type' using errcode = '22023';
  end if;
  if v_hosting not in ('restart', 'client') then
    raise exception 'Unknown hosting option' using errcode = '22023';
  end if;

  if v_hosting = 'restart' then
    if p_tier is null or p_tier not in ('s', 'm', 'l') then
      raise exception 'Unknown server size' using errcode = '22023';
    end if;
  else
    if p_kind <> 'new_server' then
      raise exception 'Resize a server in your own cloud from your provider''s console' using errcode = '22023';
    end if;
    if p_cloud_provider is null or p_cloud_provider not in ('aws', 'gcp', 'azure', 'digitalocean', 'on_prem', 'other') then
      raise exception 'Choose where the server runs' using errcode = '22023';
    end if;
    if v_region is not null and char_length(v_region) > 100 then
      raise exception 'Keep the region under 100 characters' using errcode = '22023';
    end if;
    if v_spec is not null and char_length(v_spec) > 200 then
      raise exception 'Keep the server size under 200 characters' using errcode = '22023';
    end if;
  end if;

  if p_kind = 'upgrade' and nullif(btrim(coalesce(p_server_uuid, '')), '') is null then
    raise exception 'Choose the server to upgrade' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 2000 then
    raise exception 'Keep the description under 2,000 characters' using errcode = '22023';
  end if;

  select count(*) into v_open
  from console.server_requests r
  where r.workspace_id = p_workspace_id
    and r.status in ('pending_review', 'awaiting_payment', 'paid', 'in_progress');
  if v_open >= 3 then
    raise exception 'This project already has 3 open server requests. We''ll get to them first.' using errcode = '54000';
  end if;

  insert into console.server_requests (
    workspace_id, requested_by, kind, server_uuid, requested_tier, reason,
    hosting, cloud_provider, cloud_region, cloud_spec
  )
  values (
    p_workspace_id,
    v_uid,
    p_kind,
    case when p_kind = 'upgrade' then btrim(p_server_uuid) else null end,
    case when v_hosting = 'restart' then p_tier else null end,
    v_reason,
    v_hosting,
    case when v_hosting = 'client' then p_cloud_provider else null end,
    case when v_hosting = 'client' then v_region else null end,
    case when v_hosting = 'client' then v_spec else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function console.request_server_change(uuid, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function console.request_server_change(uuid, text, text, text, text, text, text, text, text) to authenticated;
