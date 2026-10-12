// Hosting: a client's hosting plans against the cost of their servers (the margin), plus the
// services sold alongside (revenue only). Hetzner servers are hinted from Coolify; Contabo
// servers are kept by hand.

import { FinancePage } from "@/components/admin/FinancePage";
import { DeploymentMargins } from "@/components/admin/DeploymentMargins";

export default function FinanceHosting() {
  return (
    <FinancePage title="Hosting" description="What clients pay for hosting against what their servers cost, and the services you sell alongside." needs={["finance", "books"]}>
      {({ finance, books, reloadBooks }) => <DeploymentMargins finance={finance} books={books} refresh={reloadBooks} />}
    </FinancePage>
  );
}
