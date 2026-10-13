// Profit and loss by month, the VAT position and CSV exports for the accountant.

import { FinancePage } from "@/components/admin/FinancePage";
import { ReportsPanel } from "@/components/admin/ReportsPanel";

export default function FinanceReports() {
  return (
    <FinancePage title="Reports" description="Profit and loss by month, the VAT position, and exports for your accountant." needs={["finance", "books"]}>
      {({ finance, books }) => <ReportsPanel finance={finance} books={books} />}
    </FinancePage>
  );
}
