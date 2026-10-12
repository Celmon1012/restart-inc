// The payment ledger: every payment actually made against a cost, with the account it came from
// and its reference. Voiding only, never editing or deleting. CSV export for the accountant.

import { FinancePage } from "@/components/admin/FinancePage";
import { ExpensePayments } from "@/components/admin/ExpensePayments";

export default function FinancePayments() {
  return (
    <FinancePage title="Payments" description="What was paid, from which account, and with which reference." needs={["books"]}>
      {({ books, reloadBooks }) => <ExpensePayments books={books} refresh={reloadBooks} />}
    </FinancePage>
  );
}
