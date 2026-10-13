// Reports: profit and loss by month, the VAT position, and CSV exports for the accountant.
//   Revenue : collected from invoices, ex-VAT (Lago), in NGN at the rates in Rates & cash.
//   Costs   : hosting and operating expenses spread across the months they cover (the accrual view),
//             not the day a bill was paid. Cash timing lives on the Cashflow page.
// Everything is NGN; amounts in other currencies are converted at the saved rates.

import { useState } from "react";
import { consoleSchema } from "@/lib/supabase";
import { downloadCsv } from "@/lib/csv";
import { formatAmount, formatDate } from "@/lib/format";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { CADENCE_LABEL, EXPENSE_CATEGORIES, hostingExpenseIds, hostingInMonth, monthKey, overheadInMonth, toNgn, totalsToNgn, type Books } from "@/lib/financeBooks";
import type { FinanceOverview } from "@/lib/financeOverview";

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
const naira = (cents: number) => Math.round(cents) / 100;
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + by, 1)));
};
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

type Period = "last6" | "last12" | "thisYear" | "lastYear";
const PERIOD_LABEL: Record<Period, string> = { last6: "Last 6 months", last12: "Last 12 months", thisYear: "This year", lastYear: "Last year" };

function monthsFor(period: Period): string[] {
  const now = monthKey(new Date());
  const year = Number(now.slice(0, 4));
  if (period === "last6" || period === "last12") {
    const n = period === "last6" ? 6 : 12;
    return Array.from({ length: n }, (_, i) => shiftMonth(now, i - (n - 1)));
  }
  const y = period === "thisYear" ? year : year - 1;
  const last = period === "thisYear" ? Number(now.slice(5, 7)) : 12;
  return Array.from({ length: last }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
}

interface Remittance {
  id: string;
  paid_on: string;
  amount_cents: number;
  reference: string | null;
  created_by_email?: string | null;
}

export function ReportsPanel({ finance, books }: { finance: FinanceOverview; books: Books }) {
  const { settings } = books;
  const [period, setPeriod] = useState<Period>("last12");
  const remittances = useAsyncResource<Remittance[]>(
    async () => {
      const { data, error } = await consoleSchema().from("vat_remittances").select("*").order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, amount_cents: Number(r.amount_cents) })) as Remittance[];
    },
    [],
    { errorMessage: "Failed to load VAT remittances" }
  );

  const months = monthsFor(period);
  const first = `${months[0]}-01`;
  const last = `${months[months.length - 1]}-31`;
  const inPeriod = (date: string) => date >= first && date <= last;

  const rows = months.map((month) => {
    const revenue = totalsToNgn(finance.monthly.find((m) => m.month === month)?.collected, settings);
    const hosting = hostingInMonth(books, month);
    const operating = overheadInMonth(books, month);
    return { month, revenue, hosting, operating, profit: revenue - hosting - operating };
  });
  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const revenue = sum((r) => r.revenue);
  const hosting = sum((r) => r.hosting);
  const operating = sum((r) => r.operating);
  const profit = revenue - hosting - operating;

  const vatCollected = finance.totals.vatCollected?.NGN ?? 0;
  const vatRemitted = (remittances.data ?? []).reduce((s, r) => s + r.amount_cents, 0);
  const vatOwed = vatCollected - vatRemitted;
  const inputVat = books.payments.filter((p) => !p.voided_at && inPeriod(p.paid_on)).reduce((s, p) => s + toNgn(p.vat_cents, p.currency, settings), 0);

  const stamp = new Date().toISOString().slice(0, 10);
  const expenseById = new Map(books.expenses.map((e) => [e.id, e]));
  const accountById = new Map(books.accounts.map((a) => [a.id, a]));
  const hostingIds = hostingExpenseIds(books);

  const exportPnl = () =>
    downloadCsv(
      `restart-profit-and-loss-${stamp}.csv`,
      ["month", "revenue_collected_ex_vat_ngn", "hosting_ngn", "operating_ngn", "profit_ngn", "margin_percent"],
      [
        ...rows.map((r) => [r.month, naira(r.revenue), naira(r.hosting), naira(r.operating), naira(r.profit), r.revenue > 0 ? Math.round((r.profit / r.revenue) * 100) : ""]),
        ["total", naira(revenue), naira(hosting), naira(operating), naira(profit), revenue > 0 ? Math.round((profit / revenue) * 100) : ""]
      ]
    );

  const exportExpenses = () =>
    downloadCsv(
      `restart-expenses-${stamp}.csv`,
      ["name", "type", "category", "amount", "currency", "cadence", "starts", "ends", "notes", "recorded_by"],
      books.expenses.map((e) => [e.name, hostingIds.has(e.id) ? "hosting" : "operating", EXPENSE_CATEGORIES[e.category], e.amount_cents / 100, e.currency, CADENCE_LABEL[e.cadence], e.start_date, e.end_date, e.notes, e.created_by_email])
    );

  const exportPayments = () =>
    downloadCsv(
      `restart-payments-${stamp}.csv`,
      ["paid_on", "expense", "category", "amount", "currency", "fx_rate", "amount_ngn", "vat_included", "account", "reference", "covers_to", "status", "void_reason", "recorded_by", "recorded_at", "voided_by"],
      books.payments
        .filter((p) => inPeriod(p.paid_on))
        .slice()
        .sort((a, b) => a.paid_on.localeCompare(b.paid_on))
        .map((p) => {
          const e = expenseById.get(p.expense_id);
          return [p.paid_on, e?.name, e ? EXPENSE_CATEGORIES[e.category] : "", p.amount_cents / 100, p.currency, p.fx_rate, p.amount_ngn_cents / 100, p.vat_cents / 100, p.account_id ? accountById.get(p.account_id)?.name : "", p.reference, p.period_end, p.voided_at ? "void" : "paid", p.void_reason, p.created_by_email, p.created_at, p.voided_by_email];
        })
    );

  const exportInvoices = () =>
    downloadCsv(
      `restart-open-invoices-${stamp}.csv`,
      ["invoice", "client", "issued", "due", "status", "overdue", "amount_due", "invoice_total", "currency"],
      finance.openInvoices.map((i) => [i.number, i.client, i.issuingDate, i.dueDate, i.paymentStatus, i.overdue ? "yes" : "no", i.totalDueAmountCents / 100, i.totalAmountCents / 100, i.currency])
    );

  const exportVat = () =>
    downloadCsv(
      `restart-vat-remittances-${stamp}.csv`,
      ["paid_on", "amount_ngn", "reference", "logged_by"],
      (remittances.data ?? []).filter((r) => inPeriod(r.paid_on)).map((r) => [r.paid_on, naira(r.amount_cents), r.reference, r.created_by_email])
    );

  const exports: Array<{ label: string; hint: string; run: () => void; disabled?: boolean }> = [
    { label: "Profit and loss", hint: "Month by month for the period above", run: exportPnl },
    { label: "Payments made", hint: "Costs paid in the period, with account and who recorded them", run: exportPayments, disabled: !books.paymentsAvailable },
    { label: "Expenses register", hint: "Every recurring and one-off expense", run: exportExpenses },
    { label: "Open invoices", hint: "Unpaid invoices today, overdue flagged", run: exportInvoices },
    { label: "VAT remittances", hint: "VAT paid over in the period", run: exportVat, disabled: !remittances.data }
  ];

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
        </select>
      </div>

      <div className="cp-stats">
        <div>
          <small>REVENUE</small>
          <strong>{ngn(revenue)}</strong>
          <em>collected, ex-VAT</em>
        </div>
        <div>
          <small>COSTS</small>
          <strong>{ngn(hosting + operating)}</strong>
          <em>{ngn(hosting)} hosting · {ngn(operating)} operating</em>
        </div>
        <div>
          <small>PROFIT</small>
          <strong className={profit < 0 ? "warn" : undefined}>{ngn(profit)}</strong>
          <em>revenue less costs</em>
        </div>
        <div>
          <small>MARGIN</small>
          <strong className={profit < 0 ? "warn" : undefined}>{pct(profit, revenue)}</strong>
          <em>profit as a share of revenue</em>
        </div>
      </div>

      <div className="admin-table-wrap mt-4">
        <table className="admin-table">
          <thead>
            <tr><th>Month</th><th className="num">Revenue</th><th className="num">Hosting</th><th className="num">Operating</th><th className="num">Profit</th><th className="num">Margin</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td>{monthLabel(r.month)}</td>
                <td className="num">{ngn(r.revenue)}</td>
                <td className="num">{ngn(r.hosting)}</td>
                <td className="num">{ngn(r.operating)}</td>
                <td className={`num${r.profit < 0 ? " warn" : ""}`}>{ngn(r.profit)}</td>
                <td className="num">{pct(r.profit, r.revenue)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td>Total</td>
              <td className="num">{ngn(revenue)}</td>
              <td className="num">{ngn(hosting)}</td>
              <td className="num">{ngn(operating)}</td>
              <td className={`num${profit < 0 ? " warn" : ""}`}>{ngn(profit)}</td>
              <td className="num">{pct(profit, revenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="admin-muted mt-2">
        Revenue is what was collected in each month, ex-VAT. Costs are spread over the months they cover, so a yearly bill counts one twelfth each month.
      </p>

      <h2 className="admin-section-title" style={{ marginTop: 32 }}>VAT</h2>
      <div className="cp-stats">
        <div>
          <small>OWED NOW</small>
          <strong className={vatOwed > 0 ? "warn" : undefined}>{remittances.data ? ngn(vatOwed) : "…"}</strong>
          <em>collected less remitted, all time</em>
        </div>
        <div>
          <small>COLLECTED</small>
          <strong>{ngn(vatCollected)}</strong>
          <em>on invoices, all time</em>
        </div>
        <div>
          <small>REMITTED</small>
          <strong>{remittances.data ? ngn(vatRemitted) : "…"}</strong>
          <em>{remittances.data ? `${remittances.data.length} payment${remittances.data.length === 1 ? "" : "s"} logged` : "loading"}</em>
        </div>
        <div>
          <small>VAT ON COSTS</small>
          <strong>{ngn(inputVat)}</strong>
          <em>shown on receipts, {PERIOD_LABEL[period].toLowerCase()}</em>
        </div>
      </div>
      {remittances.error && <p className="admin-warn mt-2">Couldn't load VAT remittances: {remittances.error}</p>}

      <h2 className="admin-section-title" style={{ marginTop: 32 }}>Export for your accountant</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <tbody>
            {exports.map((x) => (
              <tr key={x.label}>
                <td><strong>{x.label}</strong><div className="admin-muted">{x.hint}</div></td>
                <td className="num"><button className="dash-tab-btn" onClick={x.run} disabled={x.disabled}>Download CSV</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-muted mt-2">
        Profit and loss, payments and VAT follow the period above; the expenses register and open invoices are as of {formatDate(stamp)}.
        Amounts are in naira, with other currencies converted at the saved rates.
      </p>
    </div>
  );
}
