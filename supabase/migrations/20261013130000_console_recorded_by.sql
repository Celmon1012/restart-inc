-- Who did what in the books: each payment, VAT remittance and expense keeps the email of the
-- person who recorded it, and a voided payment keeps who voided it.
--
-- The email is stamped by the database from the caller's token, not sent by the browser, so it
-- can't be typed in as someone else. Writes made by a function with the service key carry no
-- token, so they keep whatever the function sent (or stay empty).
--
-- Apply as supabase_admin (these tables are owned by it); safe to run twice.

alter table console.expense_payments add column if not exists created_by_email text;
alter table console.expense_payments add column if not exists voided_by_email text;
alter table console.vat_remittances add column if not exists created_by_email text;
alter table console.expenses add column if not exists created_by_email text;

create or replace function console.stamp_recorded_by()
returns trigger
language plpgsql
as $$
declare
  who text := nullif(auth.jwt() ->> 'email', '');
begin
  if who is not null then
    new.created_by_email := who;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_recorded_by on console.expense_payments;
create trigger stamp_recorded_by before insert on console.expense_payments
  for each row execute function console.stamp_recorded_by();
drop trigger if exists stamp_recorded_by on console.vat_remittances;
create trigger stamp_recorded_by before insert on console.vat_remittances
  for each row execute function console.stamp_recorded_by();
drop trigger if exists stamp_recorded_by on console.expenses;
create trigger stamp_recorded_by before insert on console.expenses
  for each row execute function console.stamp_recorded_by();

-- A payment can only be voided (once); every other change is refused. Voiding now also records who.
create or replace function console.expense_payments_guard()
returns trigger
language plpgsql
as $$
begin
  if old.voided_at is not null then
    raise exception 'A voided payment cannot be changed' using errcode = '42501';
  end if;
  if new.voided_at is null
     or (to_jsonb(new) - 'voided_at' - 'void_reason' - 'voided_by_email')
        is distinct from (to_jsonb(old) - 'voided_at' - 'void_reason' - 'voided_by_email') then
    raise exception 'Payments can only be voided, not edited' using errcode = '42501';
  end if;
  new.voided_by_email := coalesce(nullif(auth.jwt() ->> 'email', ''), new.voided_by_email);
  return new;
end;
$$;

-- Fill in the people already on record. The guard refuses edits, so step it aside for this one update.
alter table console.expense_payments disable trigger expense_payments_guard;
update console.expense_payments p
   set created_by_email = u.email
  from auth.users u
 where u.id = p.created_by and p.created_by_email is null;
alter table console.expense_payments enable trigger expense_payments_guard;

notify pgrst, 'reload schema';
