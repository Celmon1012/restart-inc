// Shared frame for every page in the Finance area: the layout, the page header, and the loading
// and error states for the two data sources a page may need.
//   finance : revenue, invoices and subscriptions from Lago (console-admin-finance)
//   books   : Restart's own cost side from the database (expenses, servers, payments, accounts, rates)
// A page lists what it needs; only those are loaded, so a page that doesn't read Lago never waits
// for it. The render function always receives both keys, but the one a page didn't ask for is not
// loaded and must not be used.

import type { ReactNode } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { loadBooks, type Books } from "@/lib/financeBooks";
import { loadFinanceOverview, type FinanceOverview } from "@/lib/financeOverview";

export interface FinanceData {
  finance: FinanceOverview;
  books: Books;
  /** Reload the cost side (after a write) without blanking the page. */
  reloadBooks: () => Promise<void>;
  /** Reload everything. */
  reloadAll: () => Promise<void>;
}

export function FinancePage({
  title,
  description,
  needs,
  actions,
  children
}: {
  title: string;
  description: string;
  needs: Array<"finance" | "books">;
  actions?: ReactNode;
  children: (data: FinanceData) => ReactNode;
}) {
  const wantFinance = needs.includes("finance");
  const wantBooks = needs.includes("books");
  const finance = useAsyncResource<FinanceOverview>(() => loadFinanceOverview(), [], { enabled: wantFinance, errorMessage: "Failed to load finance data" });
  const books = useAsyncResource<Books>(() => loadBooks(), [], { enabled: wantBooks, errorMessage: "Failed to load costs" });

  const loading = (wantFinance && finance.loading) || (wantBooks && books.loading);
  const error = (wantFinance && finance.error) || (wantBooks && books.error) || null;
  const refreshing = finance.refreshing || books.refreshing;
  const ready = (!wantFinance || finance.data) && (!wantBooks || books.data);

  const reloadBooks = async () => { if (wantBooks) await books.refresh(); };
  const reloadAll = async () => { await Promise.all([wantFinance ? finance.refresh() : undefined, wantBooks ? books.refresh() : undefined]); };

  return (
    <ConsoleLayout area="finance" onRefresh={() => void reloadAll()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? `Loading ${title.toLowerCase()}` : error ? `Could not load ${title.toLowerCase()}: ${error}` : `${title} loaded`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">FINANCE</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions}
      </div>

      {loading ? (
        <LoadingState label={`Loading ${title.toLowerCase()}…`} />
      ) : error ? (
        <ErrorAlert
          message={`Couldn't load ${title.toLowerCase()}: ${error}`}
          onRetry={() => { if (wantFinance) finance.retry(); if (wantBooks) books.retry(); }}
          retryLabel="Reload"
        />
      ) : !ready ? null : (
        children({
          finance: finance.data as FinanceOverview,
          books: books.data as Books,
          reloadBooks,
          reloadAll
        })
      )}
    </ConsoleLayout>
  );
}
