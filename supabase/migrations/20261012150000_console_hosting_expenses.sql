-- A client server's cost becomes a normal expense.
--
-- Until now console.services held a server's monthly cost itself, so it could not be marked paid,
-- did not appear on the Expenses page and was outside the payment ledger. Now each service points
-- at an expense (console.services.expense_id) that holds the cost: amount, currency, start and end.
-- The server (provider, Coolify link, client) stays on the service; the money lives on the expense,
-- so Mark paid, the payment ledger, receipts and the CSV export all cover hosting too.
--
-- Existing services are converted here: each gets an expense (category infrastructure, monthly),
-- copied from its current cost and dates. The old cost columns on services are left in place and
-- ignored once expense_id is set (a later migration can drop them).
--
-- Deleting a service never deletes its expense; an expense with payments can't be deleted at all
-- (expense_payments.expense_id is ON DELETE RESTRICT), so the audit trail stays whole.

alter table console.services
  add column if not exists expense_id uuid references console.expenses (id) on delete restrict;

create unique index if not exists services_expense_key on console.services (expense_id) where expense_id is not null;

do $$
declare
  s record;
  new_id uuid;
begin
  for s in select * from console.services where expense_id is null loop
    insert into console.expenses (name, category, amount_cents, currency, cadence, start_date, end_date, notes)
    values (
      s.name || ' (' || initcap(s.provider) || ')',
      'infrastructure',
      s.monthly_cost_cents,
      s.currency,
      'monthly',
      s.started_on,
      s.ended_on,
      s.notes
    )
    returning id into new_id;

    update console.services set expense_id = new_id where id = s.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
