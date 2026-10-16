// Domains, all in one place: every domain name Restart pays for, client and internal, with its
// registrar, what it costs a year and when it renews. A domain is a yearly expense, so it is paid and
// audited like any other (Mark paid, the payment ledger) and shows as one row on Expenses.

import { FinancePage } from "@/components/admin/FinancePage";
import { DomainsPanel } from "@/components/admin/DomainsPanel";

export default function FinanceDomains() {
  return (
    <FinancePage title="Domains" description="Every domain, client and internal: who it is registered with, what it costs and when it renews." needs={["finance", "books"]}>
      {({ books, reloadBooks }) => <DomainsPanel books={books} refresh={reloadBooks} />}
    </FinancePage>
  );
}
