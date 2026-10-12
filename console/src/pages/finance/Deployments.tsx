// Margin per client deployment: what each client pays (Lago MRR) against what their servers
// cost. Hetzner servers are hinted from Coolify; Contabo servers are kept by hand.

import { FinancePage } from "@/components/admin/FinancePage";
import { DeploymentMargins } from "@/components/admin/DeploymentMargins";

export default function FinanceDeployments() {
  return (
    <FinancePage title="Deployments" description="Sale price against server cost for every client deployment." needs={["finance", "books"]}>
      {({ finance, books, reloadBooks }) => <DeploymentMargins finance={finance} books={books} refresh={reloadBooks} />}
    </FinancePage>
  );
}
