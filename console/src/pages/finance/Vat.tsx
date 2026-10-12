// VAT position: collected on invoices less remitted to the tax authority.

import { FinancePage } from "@/components/admin/FinancePage";
import { VatPanel } from "@/components/admin/VatPanel";

export default function FinanceVat() {
  return (
    <FinancePage title="VAT" description="VAT collected on invoices, what you've remitted, and what's still owed." needs={["finance"]}>
      {({ finance }) => <VatPanel finance={finance} />}
    </FinancePage>
  );
}
