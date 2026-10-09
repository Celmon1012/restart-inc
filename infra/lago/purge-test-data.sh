#!/bin/sh
# Paste into the Coolify terminal of the restart-billing "db" container.
# Writes the purge script to /tmp/purge.sql and runs it as a DRY RUN (it ends with ROLLBACK).
cat > /tmp/purge.sql <<'__PURGE_SQL__'
-- Purge Lago test data: the 10 already-deleted test customers and everything under them.
-- Run with: psql -U lago -d lago -v ON_ERROR_STOP=1 -P pager=off -f /tmp/purge.sql
--
-- Ends with ROLLBACK, so the first run is a dry run that only prints what it WOULD delete.
-- Read the counts, then change the last statement to COMMIT and run it again:
--   sed -i 's/^rollback;$/commit;/' /tmp/purge.sql
--
-- How it works: starting from the customer ids, follow every foreign key that points at a
-- row we are deleting (invoices, fees, subscriptions, payments, credit notes, ...) until the
-- whole tree is collected, then delete exactly those rows. Guards abort (and roll back)
-- if the tree reaches anything that is not test data.
-- session_replication_role = replica skips FK checks, so deletion order does not matter;
-- it needs a superuser, which is what the lago database user is.

begin;
set local session_replication_role = replica;

create temp table purge_customers (id uuid primary key);
insert into purge_customers values
  ('30db525d-f29c-4726-9df5-265ff0514526'),  -- Smoke Test Customer
  ('e6c16134-8f41-4b6d-88e9-9c21628478ad'),  -- idem-probe-should-fail-no-name
  ('1fad3a6c-2b4c-4c11-a3a9-92cee6c3e4b5'),  -- Idem Test
  ('6560469f-bdc0-41b3-beec-16273b8b3628'),  -- Ademola Usuf (adeusuf.co@gmail.com)
  ('1befc007-1aaa-4044-8eb7-983401c5c8de'),  -- Ademola Usuf (usufademola@gmail.com)
  ('9580e474-3f6d-4653-8ad9-3fa770c584f0'),  -- Checkout Test
  ('c4f725e9-0418-4a6d-bb86-c3ecb88c4305'),  -- WF1 Test
  ('ccf9bbb6-16c4-4c12-bf45-17288873a448'),  -- WF1 Test2
  ('3e160bdb-ff6b-4d0d-8157-27c4ded86b58'),  -- Handler Test
  ('ce1ac0ff-2541-47f9-9aef-8385069a0107');  -- Segun Awolope (old deleted record)

-- Guard 1: every one of them is an already-deleted customer.
do $$
declare n int;
begin
  select count(*) into n from customers c join purge_customers p using (id) where c.deleted_at is not null;
  if n <> 10 then raise exception 'expected 10 deleted customers, found %', n; end if;
end $$;

create temp table purged (tbl regclass not null, id uuid not null, primary key (tbl, id));

-- Collect a row and everything that references it, recursively.
create function pg_temp.purge(p_table regclass, p_ids uuid[]) returns void language plpgsql as $f$
declare
  r record;
  new_ids uuid[];
  child_ids uuid[];
begin
  select coalesce(array_agg(i), '{}') into new_ids
  from unnest(p_ids) i
  where not exists (select 1 from purged where tbl = p_table and id = i);
  if array_length(new_ids, 1) is null then return; end if;
  insert into purged select p_table, unnest(new_ids);

  for r in
    select c.conrelid::regclass as child,
           a.attname as col,
           exists (
             select 1 from pg_attribute x
             where x.attrelid = c.conrelid and x.attname = 'id' and not x.attisdropped
               and format_type(x.atttypid, null) = 'uuid'
           ) as has_uuid_id
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = p_table and array_length(c.conkey, 1) = 1
  loop
    if r.has_uuid_id then
      execute format('select coalesce(array_agg(id), ''{}'') from %s where %I = any($1)', r.child, r.col)
        into child_ids using new_ids;
      perform pg_temp.purge(r.child, child_ids);
    else
      -- join tables without a uuid id: delete directly by the foreign key.
      execute format('delete from %s where %I = any($1)', r.child, r.col) using new_ids;
    end if;
  end loop;
end $f$;

select pg_temp.purge('customers'::regclass, array(select id from purge_customers));

-- References that are not foreign keys (polymorphic columns).
select pg_temp.purge('payments'::regclass, array(
  select id from payments
  where customer_id in (select id from purge_customers)
     or invoice_id in (select id from purged where tbl = 'invoices'::regclass)
     or (payable_type = 'Invoice' and payable_id in (select id from purged where tbl = 'invoices'::regclass))
));
select pg_temp.purge('webhooks'::regclass, array(select id from webhooks where object_id in (select id from purged)));
select pg_temp.purge('integration_resources'::regclass, array(select id from integration_resources where syncable_id in (select id from purged)));

-- Guard 2: the tree stays inside test data.
do $$
declare n int;
begin
  select count(*) into n from purged where tbl = 'invoices'::regclass;
  if n <> 32 then raise exception 'expected 32 invoices, collected %', n; end if;

  if exists (select 1 from purged where tbl = 'customers'::regclass and id not in (select id from purge_customers)) then
    raise exception 'collected a customer that is not on the purge list';
  end if;
  if exists (
    select 1 from invoices i
    where i.id in (select id from purged where tbl = 'invoices'::regclass)
      and i.customer_id not in (select id from purge_customers)
  ) then raise exception 'collected an invoice belonging to a kept customer'; end if;
  if exists (
    select 1 from subscriptions s
    where s.id in (select id from purged where tbl = 'subscriptions'::regclass)
      and s.customer_id not in (select id from purge_customers)
  ) then raise exception 'collected a subscription belonging to a kept customer'; end if;
  if exists (select 1 from purged where id in (
    '893cf81d-9404-4179-9c44-2d3f5aa756ae',  -- Yata Network
    '70f4cc01-8bfc-4967-8dfd-51ea07b8506b',  -- Bec Okezue Stores
    'a5e7d0d5-5abc-4380-aacc-38631f190b11'   -- Restart Inc.
  )) then raise exception 'a kept customer is in the purge set'; end if;
  if exists (select 1 from purged where tbl::text in
    ('organizations', 'billing_entities', 'plans', 'billable_metrics', 'users', 'memberships', 'api_keys', 'taxes', 'coupons', 'add_ons')
  ) then raise exception 'collected shared configuration, not test data'; end if;
end $$;

-- What would be deleted.
select tbl::text as "table", count(*) as rows from purged group by tbl order by count(*) desc, tbl::text;

-- Delete.
do $$
declare r record; n bigint;
begin
  for r in select tbl, array_agg(id) as ids from purged group by tbl loop
    execute format('delete from %s where id = any($1)', r.tbl) using r.ids;
    get diagnostics n = row_count;
    raise notice 'deleted % rows from %', n, r.tbl;
  end loop;
end $$;

-- Guard 3: what is left is exactly the real data.
do $$
declare inv int; cust int;
begin
  select count(*) into inv from invoices;
  select count(*) into cust from customers;
  if inv <> 4 then raise exception 'expected 4 invoices to remain, found %', inv; end if;
  if cust <> 3 then raise exception 'expected 3 customers to remain, found %', cust; end if;
end $$;

select 'remaining' as what, (select count(*) from customers) as customers, (select count(*) from invoices) as invoices, (select count(*) from subscriptions) as subscriptions;

rollback;
__PURGE_SQL__
psql -U lago -d lago -v ON_ERROR_STOP=1 -P pager=off -f /tmp/purge.sql
