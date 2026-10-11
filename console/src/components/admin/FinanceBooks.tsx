// Cost side of Finance: loads the books once and renders per-deployment margins
// and the costs-vs-revenue summary from the same data, so editing a server
// updates the totals immediately.

import { ErrorAlert, LoadingState } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { loadBooks, type Books } from "@/lib/financeBooks";
import type { FinanceOverview } from "@/pages/admin/Finance";
import { DeploymentMargins } from "./DeploymentMargins";
import { VatPanel } from "./VatPanel";
import { OperatingCosts } from "./OperatingCosts";

export function FinanceBooks({ finance }: { finance: FinanceOverview }) {
  const { data, loading, error, retry, refresh } = useAsyncResource<Books>(() => loadBooks(), [], { errorMessage: "Failed to load costs" });

  if (loading) return <LoadingState label="Loading costs…" />;
  if (error) return <ErrorAlert message={`Couldn't load costs: ${error}`} onRetry={retry} retryLabel="Reload costs" />;
  if (!data) return null;

  return (
    <>
      <OperatingCosts finance={finance} books={data} refresh={refresh} />
      <DeploymentMargins finance={finance} books={data} refresh={refresh} />
      <VatPanel finance={finance} />
    </>
  );
}
