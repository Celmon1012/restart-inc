// Hosting, all of it in one place: client servers (what each client pays against what the server
// costs, the margin) and Restart's own servers (cost only), each tagged Client or Internal.
// Hetzner servers are hinted from Coolify; Contabo servers are kept by hand.

import { FinancePage } from "@/components/admin/FinancePage";
import { DeploymentMargins } from "@/components/admin/DeploymentMargins";

export default function FinanceHosting() {
  return (
    <FinancePage title="Hosting" description="Every server, client and internal: what clients pay for hosting against what the servers cost." needs={["finance", "books"]}>
      {({ finance, books, reloadBooks }) => <DeploymentMargins finance={finance} books={books} refresh={reloadBooks} />}
    </FinancePage>
  );
}
