// The numbers the finance figures are converted and measured against: the USD and EUR exchange
// rates (dollar and euro expenses and revenue are folded into naira at these) and the cash on
// hand that runway is measured against.

import { FinancePage } from "@/components/admin/FinancePage";
import { OperatingCosts } from "@/components/admin/OperatingCosts";

export default function FinanceRates() {
  return (
    <FinancePage
      title="Rates & cash"
      description="Exchange rates for dollar and euro amounts, and the cash balance runway is measured against."
      needs={["finance", "books"]}
    >
      {({ finance, books, reloadBooks }) => <OperatingCosts finance={finance} books={books} refresh={reloadBooks} view="rates" />}
    </FinancePage>
  );
}
