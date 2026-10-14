// Financial overview across every client, from console-admin-finance (the only
// thing holding LAGO_API_KEY for a cross-client read). Figures are per
// currency and never summed across currencies.

import { Link } from "wouter";
import { formatAmount, formatNairaCompact, formatNairaWhole } from "@/lib/format";
import { ArrowRight } from "lucide-react";
import { FinancePage } from "@/components/admin/FinancePage";
import { ExpenseCharts, type ChartItem } from "@/components/admin/ExpenseCharts";
import { Meter, RevenueCostsChart } from "@/components/admin/FinanceCharts";
import { EXPENSE_CATEGORIES, expenseInMonth, hostingExpenseIds, nextDue, serviceInMonth, toNgn, totalsToNgn } from "@/lib/financeBooks";
import { summarise } from "@/lib/financeSummary";

import type { FinanceOverview, Totals } from "@/lib/financeOverview";
export { loadFinanceOverview } from "@/lib/financeOverview";
export type { FinanceOverview } from "@/lib/financeOverview";

const nonZero = (t: Totals | undefined) => Object.entries(t ?? {}).filter(([, v]) => v !== 0);

/** "₦1,200,000.00 · $4,000.00", or an em dash when there's nothing. For tables and hint lines. */
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
    })
      .format(cents / 100)
      // one house style for short figures: 1.29m, 223.33k, 1.2bn
      .replace(/([0-9])K$/, "$1k")
      .replace(/([0-9])M$/, "$1m")
      .replace(/([0-9])B$/, "$1bn")
      .replace(/([0-9])T$/, "$1tn");
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

/** Contracted MRR less what coupons give away, per currency (never below zero). */
function netOf(mrr: Totals, discount: Totals | undefined): Totals {
  const out: Totals = {};
  for (const [c, v] of Object.entries(mrr)) out[c] = Math.max(0, v - (discount?.[c] ?? 0));
  return out;
}

export default function AdminFinance() {
  return (
    <FinancePage title="Overview" description="Where the business stands: revenue, expenses and what needs attention." needs={["finance", "books"]}>
      {({ finance: data, books }) => {
        const today = new Date().toISOString().slice(0, 10);
        const rates = books.settings;
        const summary = summarise(data, books);
        const thisMonthRow = summary.months[summary.months.length - 1];
        const overdueInvoices = data.openInvoices.filter((i) => i.overdue).length;
        const billsDue = books.expenses
          .filter((e) => e.cadence !== "one_off")
          .map((e) => ({ e, due: nextDue(e, books.payments) }))
          .filter((x): x is { e: (typeof books.expenses)[number]; due: string } => x.due !== null && x.due <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
        const billsOverdue = billsDue.filter((b) => b.due < today).length;
        const attention: Array<{ key: string; text: string; href: string; warn: boolean }> = [];
        if (overdueInvoices > 0) attention.push({ key: "inv", text: `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"}, ${formatTotals(data.totals.overdue)} owed`, href: "/finance/invoices", warn: true });
        if (billsDue.length > 0) attention.push({ key: "bills", text: `${billsDue.length} expense${billsDue.length === 1 ? "" : "s"} due within a week${billsOverdue ? `, ${billsOverdue} overdue` : ""}: ${billsDue.slice(0, 3).map((b) => b.e.name).join(", ")}`, href: "/finance/expenses", warn: billsOverdue > 0 });
        if (books.paymentsAvailable && books.accounts.length === 0) attention.push({ key: "acc", text: "No accounts set up yet, so payments can't record where they were paid from", href: "/finance/accounts", warn: false });

        // What this month's costs are made of: operating expenses by category, and client hosting.
        const hostingIds = hostingExpenseIds(books);
        const costItems: ChartItem[] = [
          ...books.expenses
            .filter((e) => !hostingIds.has(e.id))
            .map((e) => ({ id: e.id, name: e.name, category: e.category, categoryLabel: EXPENSE_CATEGORIES[e.category], monthly: toNgn(expenseInMonth(e, summary.thisMonth), e.currency, rates) })),
          ...books.services.map((sv) => ({ id: sv.id, name: sv.name, category: "client_hosting", categoryLabel: "Client hosting", monthly: toNgn(serviceInMonth(sv, summary.thisMonth), sv.currency, rates) }))
        ];

        const outstandingNgn = totalsToNgn(data.totals.outstanding, rates);
        const overdueNgn = totalsToNgn(data.totals.overdue, rates);
        const covered = summary.mrrCoverage !== null && summary.mrrCoverage >= 1;
        const runwayText = rates.cash_ngn_cents === 0 ? "Cash not set" : summary.burn === 0 ? "Self-funding" : summary.runwayMonths === null ? "—" : `${summary.runwayMonths.toFixed(1)} months`;

        return (
          <>
            <div className="cp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div>
                <small>MRR</small>
                <strong><TotalsValue totals={data.totals.mrr} /></strong>
                <em>
                  {data.activeSubscriptions} active subscription{data.activeSubscriptions === 1 ? "" : "s"}
                  {Object.keys(data.totals.discount ?? {}).length > 0 ? ` · ${formatTotals(netOf(data.totals.mrr, data.totals.discount))} billed after coupons` : ""}
                </em>
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
              <div>
                <small>NET THIS MONTH</small>
                <strong className={thisMonthRow.net < 0 ? "warn" : undefined} style={{ whiteSpace: "nowrap" }} title={formatNairaWhole(thisMonthRow.net)}>{formatNairaCompact(thisMonthRow.net)}</strong>
                <em>collected less costs so far</em>
              </div>
            </div>

            {data.invoicesTruncated && (
              <p className="admin-muted mt-2">Showing the most recent {data.invoiceCount} invoices; older ones aren't counted.</p>
            )}

            {attention.length > 0 && (
              <div className="admin-section">
                <h2 className="admin-section-title">Needs attention</h2>
                <div className="admin-table-wrap">
                  {attention.map((a) => (
                    <Link key={a.key} href={a.href} className="admin-task-row" style={{ textDecoration: "none" }}>
                      <span className={a.warn ? "admin-danger" : undefined}>{a.text}</span>
                      <span className="admin-task-context"><ArrowRight size={12} /></span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="admin-section">
              <h2 className="admin-section-title">Revenue vs costs</h2>
              <div className="exp-layout">
                <div className="fin-stack">
                  <div className="exp-charts">
                    <div className="fin-card-title">Last six months</div>
                    <RevenueCostsChart months={summary.months} />
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th className="num">Collected</th>
                          <th className="num">Hosting</th>
                          <th className="num">Operating</th>
                          <th className="num">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...summary.months].reverse().map((m) => (
                          <tr key={m.key}>
                            <td>{new Date(`${m.key}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}</td>
                            <td className="num" style={{ whiteSpace: "nowrap" }}>{formatNairaWhole(m.collected)}</td>
                            <td className="num" style={{ whiteSpace: "nowrap" }}>{formatNairaWhole(m.hosting)}</td>
                            <td className="num" style={{ whiteSpace: "nowrap" }}>{formatNairaWhole(m.overhead)}</td>
                            <td className={`num ${m.net < 0 ? "admin-warn" : "admin-ok"}`} style={{ whiteSpace: "nowrap" }}>{formatNairaWhole(m.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="admin-muted">
                    All in naira at the rates under Settings, Rates & cash. Revenue is what was collected in the month, ex-VAT. Hosting is the server cost of client deployments; operating is everything else, with annual and quarterly costs spread evenly across months.
                  </p>
                </div>

                <aside className="fin-stack">
                  <div className="exp-charts">
                    <ExpenseCharts items={costItems} variant="donut" title="Where this month's costs go" />
                  </div>
                  <div className="exp-charts">
                    <div className="fin-card-title">Health</div>
                    <Meter
                      label="Recurring revenue covers costs"
                      value={summary.mrrCoverage === null ? "—" : `${Math.round(summary.mrrCoverage * 100)}%`}
                      fill={summary.mrrCoverage}
                      tone={summary.mrrCoverage !== null && !covered ? "warn" : undefined}
                      note={summary.mrrCoverage === null ? "Add expenses to see this." : covered ? `${formatNairaCompact(summary.mrr)} a month against ${formatNairaCompact(summary.runRate)} of costs.` : `${formatNairaCompact(summary.mrr)} billed against ${formatNairaCompact(summary.runRate)} of monthly costs: ${formatNairaCompact(summary.breakEvenGap)} short of break-even.`}
                    />
                    <Meter
                      label="Cash runway"
                      value={runwayText}
                      fill={summary.runwayMonths === null ? (summary.burn === 0 && rates.cash_ngn_cents > 0 ? 1 : null) : summary.runwayMonths / 12}
                      tone={summary.runwayMonths !== null && summary.runwayMonths < 6 ? "warn" : undefined}
                      note={rates.cash_ngn_cents === 0 ? "Set cash on hand under Settings, Rates & cash." : `${formatNairaCompact(rates.cash_ngn_cents)} cash, ${formatNairaCompact(summary.burn)} net burn a month (3-month average). Bar is 12 months.`}
                    />
                    <Meter
                      label="Unpaid invoices that are overdue"
                      value={outstandingNgn > 0 ? `${Math.round((overdueNgn / outstandingNgn) * 100)}%` : "None owed"}
                      fill={outstandingNgn > 0 ? overdueNgn / outstandingNgn : 0}
                      tone={overdueNgn > 0 ? "warn" : undefined}
                      note={outstandingNgn > 0 ? `${formatNairaCompact(overdueNgn)} of ${formatNairaCompact(outstandingNgn)} outstanding is past its due date.` : "Everything billed has been paid."}
                    />
                    {summary.margin3m !== null && (
                      <p className="admin-muted" style={{ margin: "8px 0 0" }}>
                        3-month margin {summary.margin3m.toFixed(1)}%: collected {formatNairaCompact(summary.avgCollected)} against costs {formatNairaCompact(summary.avgCost)} a month.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </>
        );
      }}
    </FinancePage>
  );
}
