// Cashflow: cash in against cash out by month, six months back and six forward, in NGN.
//   Back    : collected from invoices (ex-VAT) against costs actually paid (payments ledger by date paid).
//   Forward : billed MRR (less coupons) plus what is still outstanding on open invoices, against
//             scheduled expenses and hosting. The balance runs on from the cash figure in Rates & cash.
// Currencies other than NGN are converted at the rates in Rates & cash.

import { formatAmount } from "@/lib/format";
import { hostingInMonth, monthKey, overheadInMonth, totalsToNgn, type Books } from "@/lib/financeBooks";
import type { FinanceOverview } from "@/lib/financeOverview";

const BACK = 6;
const FORWARD = 6;

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + by, 1)));
};

interface Row {
  month: string;
  kind: "actual" | "now" | "forecast";
  inflow: number;
  outflow: number;
}

export function CashflowPanel({ finance, books }: { finance: FinanceOverview; books: Books }) {
  const { settings } = books;
  const thisMonth = monthKey(new Date());
  const livePayments = books.payments.filter((p) => !p.voided_at);

  const paidIn = (month: string) => livePayments.filter((p) => p.paid_on.slice(0, 7) === month).reduce((s, p) => s + p.amount_ngn_cents, 0);
  const costIn = (month: string) => hostingInMonth(books, month) + overheadInMonth(books, month);
  const collectedIn = (month: string) => totalsToNgn(finance.monthly.find((m) => m.month === month)?.collected, settings);

  const outstanding = totalsToNgn(finance.totals.outstanding, settings);
  const billedMrr = totalsToNgn(finance.totals.mrr, settings) - totalsToNgn(finance.totals.discount, settings);

  const rows: Row[] = [];
  for (let i = -BACK; i <= FORWARD; i++) {
    const month = shiftMonth(thisMonth, i);
    if (i < 0) {
      // With no payments ledger yet, fall back to what the expenses say was due.
      rows.push({ month, kind: "actual", inflow: collectedIn(month), outflow: books.paymentsAvailable ? paidIn(month) : costIn(month) });
    } else if (i === 0) {
      // Already collected this month, plus everything still waiting to be paid.
      rows.push({ month, kind: "now", inflow: collectedIn(month) + outstanding, outflow: costIn(month) });
    } else {
      rows.push({ month, kind: "forecast", inflow: billedMrr, outflow: costIn(month) });
    }
  }

  // Balance runs forward from today's cash; the past is walked back from it.
  const nowIdx = BACK;
  const closing: number[] = new Array(rows.length);
  closing[nowIdx] = settings.cash_ngn_cents + (rows[nowIdx].inflow - rows[nowIdx].outflow);
  for (let i = nowIdx + 1; i < rows.length; i++) closing[i] = closing[i - 1] + rows[i].inflow - rows[i].outflow;
  for (let i = nowIdx - 1; i >= 0; i--) closing[i] = closing[i + 1] - (rows[i + 1].inflow - rows[i + 1].outflow);

  const forward = rows.slice(nowIdx + 1);
  const avgBurn = forward.reduce((s, r) => s + r.outflow, 0) / forward.length;
  const avgNet = forward.reduce((s, r) => s + r.inflow - r.outflow, 0) / forward.length;
  const dryIdx = closing.findIndex((c, i) => i > nowIdx && c < 0);
  const runway = dryIdx >= 0 ? monthLabel(rows[dryIdx].month) : null;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.inflow, r.outflow)));

  return (
    <div className="admin-section">
      <div className="cp-stats">
        <div>
          <small>CASH NOW</small>
          <strong>{ngn(settings.cash_ngn_cents)}</strong>
          <em>set in Rates &amp; cash</em>
        </div>
        <div>
          <small>MONTHLY BURN</small>
          <strong>{ngn(avgBurn)}</strong>
          <em>expenses and hosting, next {FORWARD} months</em>
        </div>
        <div>
          <small>NET PER MONTH</small>
          <strong className={avgNet < 0 ? "warn" : undefined}>{ngn(avgNet)}</strong>
          <em>billed MRR less costs</em>
        </div>
        <div>
          <small>CASH RUNS OUT</small>
          <strong className={runway ? "warn" : undefined}>{runway ?? `Not in ${FORWARD} months`}</strong>
          <em>if nothing else changes</em>
        </div>
      </div>

      <div className="admin-table-wrap mt-4">
        <table className="admin-table">
          <thead>
            <tr><th>Month</th><th className="num">In</th><th className="num">Out</th><th className="num">Net</th><th className="num">Balance</th><th aria-label="In against out" /></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const net = r.inflow - r.outflow;
              return (
                <tr key={r.month} style={r.kind === "now" ? { fontWeight: 600 } : r.kind === "forecast" ? { opacity: 0.85 } : undefined}>
                  <td>{monthLabel(r.month)}{r.kind === "now" ? " (this month)" : r.kind === "forecast" ? " · forecast" : ""}</td>
                  <td className="num">{ngn(r.inflow)}</td>
                  <td className="num">{ngn(r.outflow)}</td>
                  <td className={`num${net < 0 ? " warn" : ""}`}>{ngn(net)}</td>
                  <td className={`num${closing[i] < 0 ? " warn" : ""}`}>{ngn(closing[i])}</td>
                  <td style={{ width: 140 }} aria-hidden="true">
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ height: 5, width: `${(r.inflow / max) * 100}%`, background: "currentColor", opacity: 0.7 }} />
                      <div style={{ height: 5, width: `${(r.outflow / max) * 100}%`, background: "currentColor", opacity: 0.3 }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="admin-muted mt-2">
        In is ex-VAT. This month's In is what has been collected plus all open invoices ({ngn(outstanding)}); later months use billed MRR of {ngn(billedMrr)}.
        Past balances are worked back from the cash figure, so they are only as good as that figure.
        {!books.paymentsAvailable && " Past Out uses what expenses were due, as the payments ledger isn't set up."}
      </p>
    </div>
  );
}
