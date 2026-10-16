// Hosting, all of it in one place: every server with its IP address and cost, client and Restart's own,
// each tagged Client or Internal. A server can run several projects.
// Hetzner servers are hinted from Coolify; Contabo servers are kept by hand.

import { FinancePage } from "@/components/admin/FinancePage";
import { DeploymentMargins } from "@/components/admin/DeploymentMargins";

export default function FinanceHosting() {
  return (
    <FinancePage title="Hosting" description="Every server, client and internal: where it runs, which projects it hosts and what it costs." needs={["books"]}>
      {({ books, reloadBooks }) => <DeploymentMargins books={books} refresh={reloadBooks} />}
    </FinancePage>
  );
}
