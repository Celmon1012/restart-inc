-- Server capacity requests from the console's Infrastructure tab, replacing
-- the "Request Upgrade" / "Deploy New Server" mailto links.
--
-- Flow (the Operate plan): a member asks for an upgrade or an additional
-- server -> an engineer reviews it first (is it capacity, or is it a slow
-- query?) -> quotes it and attaches the Lago invoice -> the client pays
-- through the invoice's payment link -> the lago-webhook function marks the
-- request paid -> an engineer resizes/provisions and marks it done.
-- Nothing is provisioned before payment, except for accounts staff choose
-- to put on invoice terms (they move a request straight to in_progress).
--
-- Members read their workspace's requests and create them only through
-- console.request_server_change(); admins manage everything.

create table console.server_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references console.workspaces (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('upgrade', 'new_server')),
  -- Coolify server UUID for upgrades; null for a new server.
  server_uuid text check (char_length(server_uuid) <= 100),
  requested_tier text not null check (requested_tier in ('s', 'm', 'l')),
  reason text check (char_length(reason) <= 2000),
  status text not null default 'pending_review' check (status in (
    'pending_review',   -- engineer hasn't looked yet
    'awaiting_payment', -- quoted; invoice attached
    'paid',             -- invoice paid (set by lago-webhook)
    'in_progress',      -- engineer resizing/provisioning (or on invoice terms)
    'done',
    'declined',         -- e.g. "don't upgrade; fix this query instead"
    'cancelled'
  )),
  engineer_note text check (char_length(engineer_note) <= 4000),
  lago_invoice_id text check (char_length(lago_invoice_id) <= 100)
);

create index server_requests_workspace_idx on console.server_requests (workspace_id, created_at desc);
create unique index server_requests_invoice_idx on console.server_requests (lago_invoice_id) where lago_invoice_id is not null;

create or replace function console.touch_server_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger server_requests_touch
  before update on console.server_requests
  for each row execute function console.touch_server_request();

alter table console.server_requests enable row level security;

create policy "members and admins can read server requests"
  on console.server_requests for select
  to authenticated
  using (
    console.is_admin()
    or exists (
      select 1 from console.workspace_members m
      where m.workspace_id = server_requests.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "admins can manage server requests"
  on console.server_requests for all
  to authenticated
  using (console.is_admin())
  with check (console.is_admin());

grant select on console.server_requests to authenticated;
grant update on console.server_requests to authenticated;
grant select, insert, update, delete on console.server_requests to service_role;

-- Members create requests only through this function, so the requester,
-- workspace membership, and open-request cap are enforced server-side.
create or replace function console.request_server_change(
  p_workspace_id uuid,
  p_kind text,
  p_server_uuid text,
  p_tier text,
  p_reason text
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
  if p_tier not in ('s', 'm', 'l') then
    raise exception 'Unknown server size' using errcode = '22023';
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

  insert into console.server_requests (workspace_id, requested_by, kind, server_uuid, requested_tier, reason)
  values (
    p_workspace_id,
    v_uid,
    p_kind,
    case when p_kind = 'upgrade' then btrim(p_server_uuid) else null end,
    p_tier,
    v_reason
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function console.request_server_change(uuid, text, text, text, text) from public, anon;
grant execute on function console.request_server_change(uuid, text, text, text, text) to authenticated;
