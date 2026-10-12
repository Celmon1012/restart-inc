// Operating expenses: recurring and one-off costs that aren't tied to one client (tools, people,
// fees, internet, shared servers), with what is due next, plus the exchange rates and cash on
// hand that the figures and runway are measured against.

import { FinancePage } from "@/components/admin/FinancePage";
import { OperatingCosts } from "@/components/admin/OperatingCosts";

export default function FinanceExpenses() {
  return (
    <FinancePage title="Expenses" description="Operating expenses, what's due next, and the rates and cash the figures use." needs={["finance", "books"]}>
      {({ finance, books, reloadBooks }) => <OperatingCosts finance={finance} books={books} refresh={reloadBooks} view="costs" />}
    </FinancePage>
  );
}
