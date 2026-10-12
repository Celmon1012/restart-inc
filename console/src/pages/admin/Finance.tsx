// Financial overview across every client, from console-admin-finance (the only
// thing holding LAGO_API_KEY for a cross-client read). Figures are per
// currency and never summed across currencies.

import { Link } from "wouter";
import { formatAmount, formatDate } from "@/lib/format";
import { ArrowRight } from "lucide-react";
import { FinancePage } from "@/components/admin/FinancePage";
import { OperatingCosts } from "@/components/admin/OperatingCosts";
import { nextDue } from "@/lib/financeBooks";

import type { FinanceOverview, Totals } from "@/lib/financeOverview";
export { loadFinanceOverview } from "@/lib/financeOverview";
export type { FinanceOverview } from "@/lib/financeOverview";

const nonZero = (t: Totals | undefined) => Object.entries(t ?? {}).filter(([, v]) => v !== 0);

/** "NGN 1,200,000.00 · $4,000.00", or an em dash when there's nothing. For tables and hint lines. */
export function formatTotals(t: Totals | undefined): string {
  const entries = nonZero(t);
  if (entries.length === 0) return "—";
  return entries.map(([currency, cents]) => formatAmount(cents, currency)).join(" · ");
}

/** Short form for stat tiles: "₦1.63M", "$149". Full value goes in the title. */
function formatCompact(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 2
    }).format(cents / 100);
  } catch {
    return formatAmount(cents, currency);
  }
}

/**
 * Stat-tile value: one compact line per currency, so a tile holding NGN and
 * USD stacks instead of cramming both full-precision figures onto one line.
 */
export function TotalsValue({ totals }: { totals: Totals | undefined }) {
  // NGN is the home currency (Restart invoices from Nigeria), so it leads at
  // full size; any other currency sits underneath, smaller and muted.
  const entries = nonZero(totals).sort(([a], [b]) => (a === "NGN" ? -1 : b === "NGN" ? 1 : a.localeCompare(b)));
  if (entries.length === 0) return <>—</>;
  return (
    <span className="stat-totals" title={formatTotals(totals)}>
      {entries.map(([currency, cents], i) => (
        <span key={currency} className={i === 0 ? "stat-totals-primary" : "stat-totals-secondary"}>
          {formatCompact(cents, currency)}
        </span>
      ))}
    </span>
  );
}

function MonthlyBars({ monthly, currency }: { monthly: FinanceOverview["monthly"]; currency: string }) {
  const values = monthly.map((m) => m.collected[currency] ?? 0);
  const max = Math.max(...values, 1);
  return (
    <div className="admin-bars" role="img" aria-label={`Collected revenue in ${currency}, last 12 months`}>
      {monthly.map((m, i) => {
        const label = new Date(`${m.month}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
        return (
          <div className="admin-bar" key={m.month} title={`${label}: ${formatAmount(values[i], currency)}`}>
            <i style={{ height: `${(values[i] / max) * 100}%` }} />
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminFinance() {
  return (
    <FinancePage title="Overview" description="Where the business stands: revenue, expenses and what needs attention." needs={["finance", "books"]}>
      {({ finance: data, books, reloadBooks }) => {
        const today = new Date().toISOString().slice(0, 10);
        const overdueInvoices = data.openInvoices.filter((i) => i.overdue).length;
        const billsDue = books.expenses
          .filter((e) => e.cadence !== "one_off")
          .map((e) => ({ e, due: nextDue(e, books.payments) }))
          .filter((x): x is { e: (typeof books.expenses)[number]; due: string } => x.due !== null && x.due <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
        const billsOverdue = billsDue.filter((b) => b.due < today).length;
        const currencies = Array.from(new Set(data.monthly.flatMap((m) => Object.keys(m.collected)).concat(Object.keys(data.totals.collected))));
        const attention: Array<{ key: string; text: string; href: string; warn: boolean }> = [];
        if (overdueInvoices > 0) attention.push({ key: "inv", text: `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"}, ${formatTotals(data.totals.overdue)} owed`, href: "/finance/invoices", warn: true });
        if (billsDue.length > 0) attention.push({ key: "bills", text: `${billsDue.length} expense${billsDue.length === 1 ? "" : "s"} due within a week${billsOverdue ? `, ${billsOverdue} overdue` : ""}: ${billsDue.slice(0, 3).map((b) => b.e.name).join(", ")}`, href: "/finance/expenses", warn: billsOverdue > 0 });
        if (books.paymentsAvailable && books.accounts.length === 0) attention.push({ key: "acc", text: "No accounts set up yet, so payments can't record where they were paid from", href: "/finance/accounts", warn: false });

        return (
          <>
            <div className="cp-stats">
              <div>
                <small>MRR</small>
                <strong><TotalsValue totals={data.totals.mrr} /></strong>
                <em>{data.activeSubscriptions} active subscription{data.activeSubscriptions === 1 ? "" : "s"}</em>
              </div>
              <div>
                <small>COLLECTED THIS MONTH (EX-VAT)</small>
                <strong><TotalsValue totals={data.totals.collectedThisMonth} /></strong>
                <em>{formatTotals(data.totals.collected)} all-time</em>
              </div>
              <div>
                <small>OUTSTANDING</small>
                <strong className={Object.keys(data.totals.outstanding).length ? "warn" : undefined}><TotalsValue totals={data.totals.outstanding} /></strong>
                <em>{data.openInvoices.length} unpaid invoice{data.openInvoices.length === 1 ? "" : "s"}</em>
              </div>
              <div>
                <small>OVERDUE</small>
                <strong className={Object.keys(data.totals.overdue).length ? "warn" : undefined}><TotalsValue totals={data.totals.overdue} /></strong>
                <em>{overdueInvoices} past due date</em>
              </div>
            </div>

            {data.invoicesTruncated && (
              <p className="admin-muted mt-2">Showing the most recent {data.invoiceCount} invoices; older ones aren't counted.</p>
            )}

            <div className="admin-section">
              <h2 className="admin-section-title">Needs attention</h2>
              {attention.length === 0 ? (
                <div className="dash-empty-state">Nothing needs attention.</div>
              ) : (
                <div className="admin-table-wrap">
                  {attention.map((a) => (
                    <Link key={a.key} href={a.href} className="admin-task-row" style={{ textDecoration: "none" }}>
                      <span className={a.warn ? "admin-danger" : undefined}>{a.text}</span>
                      <span className="admin-task-context"><ArrowRight size={12} /></span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <OperatingCosts finance={data} books={books} refresh={reloadBooks} view="summary" />

            {currencies.length > 0 && (
              <div className="admin-section">
                <h2 className="admin-section-title">Collected revenue, last 12 months</h2>
                {currencies.map((c) => (
                  <div className="cp-card mb-4" key={c}>
                    <div className="cp-card-head">
                      <span>{c}</span>
                      <em>{formatAmount(data.monthly.reduce((sum, m) => sum + (m.collected[c] ?? 0), 0), c)} in 12 months</em>
                    </div>
                    <MonthlyBars monthly={data.monthly} currency={c} />
                  </div>
                ))}
              </div>
            )}
          </>
        );
      }}
    </FinancePage>
  );
}
