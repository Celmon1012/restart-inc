// Cash in against cash out by month, with a six-month forecast and the cash runway.

import { FinancePage } from "@/components/admin/FinancePage";
import { CashflowPanel } from "@/components/admin/CashflowPanel";

export default function FinanceCashflow() {
  return (
    <FinancePage title="Cashflow" description="Cash in and out by month, six months back and forward, and when the cash runs out." needs={["finance", "books"]}>
      {({ finance, books }) => <CashflowPanel finance={finance} books={books} />}
    </FinancePage>
  );
}
