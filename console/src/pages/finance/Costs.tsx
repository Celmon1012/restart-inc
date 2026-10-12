// Overhead: recurring and one-off costs that aren't tied to one client (tools, people, fees,
// shared servers), with what is due next, plus the exchange rates and cash on hand that
// costs and runway are measured against.

import { FinancePage } from "@/components/admin/FinancePage";
import { OperatingCosts } from "@/components/admin/OperatingCosts";

export default function FinanceCosts() {
  return (
    <FinancePage title="Costs" description="Overhead, what's due next, and the rates and cash the figures use." needs={["finance", "books"]}>
      {({ finance, books, reloadBooks }) => <OperatingCosts finance={finance} books={books} refresh={reloadBooks} view="costs" />}
    </FinancePage>
  );
}
