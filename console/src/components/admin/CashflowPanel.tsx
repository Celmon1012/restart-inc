// Cashflow: cash in against cash out by month, six months back and six forward, in NGN.
//   Back    : collected from invoices (ex-VAT) against costs actually paid (payments ledger by date paid).
//   This month: what is still to come in (open invoices) against what is still to be paid. Cash now already
//             holds what was collected and paid so far this month, so those are shown but not counted twice.
//   Forward : billed MRR (less coupons) against bills on the day they fall due (a yearly bill in its own
//             month, not smoothed). The balance runs on from the cash figure in Rates & cash.
// Currencies other than NGN are converted at the rates in Rates & cash.

import { formatAmount, formatNairaCompact, formatNairaWhole } from "@/lib/format";
import { cashDueInMonth, hostingInMonth, monthKey, overheadInMonth, totalsToNgn, type Books } from "@/lib/financeBooks";
import type { FinanceOverview } from "@/lib/financeOverview";

const BACK = 6;
const FORWARD = 6;

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
// Stat tiles stay on one line however big the money gets: a short figure, the exact amount on hover.
const tileValue = { fontSize: "1.5rem", whiteSpace: "nowrap" as const };
const cell = { whiteSpace: "nowrap" as const };
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
  // Past months with no payments ledger: what the expenses say was due, smoothed.
  const costIn = (month: string) => hostingInMonth(books, month) + overheadInMonth(books, month);
  const collectedIn = (month: string) => totalsToNgn(finance.monthly.find((m) => m.month === month)?.collected, settings);

  // Overdue invoices are part of "outstanding" but may never arrive on time, so they are shown
  // separately and left out of the forecast until they are paid.
  const overdue = totalsToNgn(finance.totals.overdue, settings);
  const outstanding = Math.max(0, totalsToNgn(finance.totals.outstanding, settings) - overdue);
  const billedMrr = totalsToNgn(finance.totals.mrr, settings) - totalsToNgn(finance.totals.discount, settings);

  const rows: Row[] = [];
  for (let i = -BACK; i <= FORWARD; i++) {
    const month = shiftMonth(thisMonth, i);
    if (i < 0) {
      // With no payments ledger yet, fall back to what the expenses say was due.
      rows.push({ month, kind: "actual", inflow: collectedIn(month), outflow: books.paymentsAvailable ? paidIn(month) : costIn(month) });
    } else if (i === 0) {
      // Already collected this month, plus everything still waiting to be paid.
      rows.push({ month, kind: "now", inflow: collectedIn(month) + outstanding, outflow: Math.max(cashDueInMonth(books, month), books.paymentsAvailable ? paidIn(month) : 0) });
    } else {
      rows.push({ month, kind: "forecast", inflow: billedMrr, outflow: cashDueInMonth(books, month) });
    }
  }

  // Cash now already includes this month's collections and payments so far, so only the rest of the
  // month moves it: open invoices still to come in, bills still to be paid.
  const nowIdx = BACK;
  const collectedSoFar = collectedIn(thisMonth);
  const paidSoFar = books.paymentsAvailable ? paidIn(thisMonth) : 0;
  const stillToPay = Math.max(0, rows[nowIdx].outflow - paidSoFar);
  const closing: number[] = new Array(rows.length);
  closing[nowIdx] = settings.cash_ngn_cents + outstanding - stillToPay;
  for (let i = nowIdx + 1; i < rows.length; i++) closing[i] = closing[i - 1] + rows[i].inflow - rows[i].outflow;
  // Last month's closing is today's cash less what has moved so far this month; earlier months walk back from it.
  closing[nowIdx - 1] = settings.cash_ngn_cents - (collectedSoFar - paidSoFar);
  for (let i = nowIdx - 2; i >= 0; i--) closing[i] = closing[i + 1] - (rows[i + 1].inflow - rows[i + 1].outflow);

  const forward = rows.slice(nowIdx + 1);
  const avgBurn = forward.reduce((s, r) => s + r.outflow, 0) / forward.length;
  const avgNet = forward.reduce((s, r) => s + r.inflow - r.outflow, 0) / forward.length;
  const dryIdx = closing.findIndex((c, i) => i > nowIdx && c < 0);
  const runway = dryIdx >= 0 ? monthLabel(rows[dryIdx].month) : null;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.inflow, r.outflow)));

  return (
    <div className="admin-section">
      <div className="cp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div>
          <small>CASH NOW</small>
          <strong style={tileValue} title={ngn(settings.cash_ngn_cents)}>{formatNairaCompact(settings.cash_ngn_cents)}</strong>
          <em>set in Rates &amp; cash</em>
        </div>
        <div>
          <small>MONTHLY BURN</small>
          <strong style={tileValue} title={ngn(avgBurn)}>{formatNairaCompact(avgBurn)}</strong>
          <em>bills falling due, next {FORWARD} months</em>
        </div>
        <div>
          <small>NET PER MONTH</small>
          <strong className={avgNet < 0 ? "warn" : undefined} style={tileValue} title={ngn(avgNet)}>{formatNairaCompact(avgNet)}</strong>
          <em>billed MRR less costs</em>
        </div>
        <div>
          <small>OVERDUE, NOT COUNTED</small>
          <strong className={overdue > 0 ? "warn" : undefined} style={tileValue} title={ngn(overdue)}>{formatNairaCompact(overdue)}</strong>
          <em>{overdue > 0 ? "late invoices, left out until paid" : "nothing overdue"}</em>
        </div>
        <div>
          <small>CASH RUNS OUT</small>
          <strong className={runway ? "warn" : undefined} style={tileValue}>{runway ?? `Not in ${FORWARD} months`}</strong>
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
                  <td className="num" style={cell} title={ngn(r.inflow)}>{formatNairaWhole(r.inflow)}</td>
                  <td className="num" style={cell} title={ngn(r.outflow)}>{formatNairaWhole(r.outflow)}</td>
                  <td className={`num${net < 0 ? " warn" : ""}`} style={cell} title={ngn(net)}>{formatNairaWhole(net)}</td>
                  <td className={`num${closing[i] < 0 ? " warn" : ""}`} style={cell} title={ngn(closing[i])}>{formatNairaWhole(closing[i])}</td>
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
        In is ex-VAT. This month's In is what has been collected plus open invoices that aren't overdue ({ngn(outstanding)}); overdue invoices ({ngn(overdue)}) are left out until paid; later months use billed MRR of {ngn(billedMrr)}.
        Cash now already holds this month's collections and payments so far, so the balance only moves by the rest of the month.
        Bills count in the month they fall due, so a yearly bill shows in its own month. Past balances are worked back from the cash figure, so they are only as good as that figure.
        {!books.paymentsAvailable && " Past Out uses what expenses were due, as the payments ledger isn't set up."}
      </p>
    </div>
  );
}
