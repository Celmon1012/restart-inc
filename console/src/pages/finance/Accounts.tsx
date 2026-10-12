// The bank accounts, cards and cash floats business costs are paid from, with account numbers.

import { FinancePage } from "@/components/admin/FinancePage";
import { AccountsPanel } from "@/components/admin/AccountsPanel";

export default function FinanceAccounts() {
  return (
    <FinancePage title="Accounts" description="Where business money is paid from, with bank details." needs={["books"]}>
      {({ books, reloadBooks }) => <AccountsPanel books={books} refresh={reloadBooks} />}
    </FinancePage>
  );
}
