// The headline numbers behind the Finance overview: six months of revenue against costs, what it costs to
// run the business each month, how much recurring revenue covers that, and how long cash lasts. All in
// naira at the rates in Rates & cash (money in other currencies is converted first).
//
//   Revenue : collected from invoices, ex-VAT (Lago), in the month it was received.
//   Costs   : client hosting plus operating expenses, spread over the months they cover.
//   Run rate: hosting plus the recurring operating costs for this month (one-offs left out).
//   Runway  : cash on hand over the average net burn of the last three months.

import { costSplitInMonth, expenseInMonth, hostingExpenseIds, hostingInMonth, monthKey, overheadInMonth, toNgn, totalsToNgn, type Books } from "@/lib/financeBooks";
import type { FinanceOverview } from "@/lib/financeOverview";

export interface MonthRow {
  key: string;
  collected: number;
  /** All hosting: client servers and Restart's own. */
  hosting: number;
  domains: number;
  /** Everything that is not hosting or a domain. */
  overhead: number;
  cost: number;
  net: number;
}

export interface Summary {
  thisMonth: string;
  /** Oldest first, the last six months including this one. */
  months: MonthRow[];
  runRate: number;
  costThisMonth: number;
  /** Billed recurring revenue per month, after coupons. */
  mrr: number;
  mrrCoverage: number | null;
  breakEvenGap: number;
  avgCollected: number;
  avgCost: number;
  margin3m: number | null;
  burn: number;
  runwayMonths: number | null;
  cash: number;
}

export function summarise(finance: FinanceOverview, books: Books): Summary {
  const rates = books.settings;
  const now = new Date();
  const thisMonth = monthKey(now);
  const hostingIds = hostingExpenseIds(books);
  const operating = books.expenses.filter((e) => !hostingIds.has(e.id));

  const months: MonthRow[] = Array.from({ length: 6 }, (_, i) => {
    const key = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1)));
    const collected = totalsToNgn(finance.monthly.find((m) => m.month === key)?.collected, rates);
    const split = costSplitInMonth(books, key);
    const cost = split.hosting + split.domains + split.operating;
    return { key, collected, hosting: split.hosting, domains: split.domains, overhead: split.operating, cost, net: collected - cost };
  });

  const recurringOverhead = operating
    .filter((e) => e.cadence !== "one_off")
    .reduce((s, e) => s + toNgn(expenseInMonth(e, thisMonth), e.currency, rates), 0);
  const runRate = hostingInMonth(books, thisMonth) + recurringOverhead;

  const last3 = months.slice(-3);
  const avgCollected = last3.reduce((s, m) => s + m.collected, 0) / 3;
  const avgCost = last3.reduce((s, m) => s + m.cost, 0) / 3;
  const mrr = totalsToNgn(finance.totals.mrr, rates) - totalsToNgn(finance.totals.discount, rates);
  const burn = Math.max(0, avgCost - avgCollected);

  return {
    thisMonth,
    months,
    runRate,
    costThisMonth: hostingInMonth(books, thisMonth) + overheadInMonth(books, thisMonth),
    mrr,
    mrrCoverage: runRate > 0 ? mrr / runRate : null,
    breakEvenGap: Math.max(0, runRate - mrr),
    avgCollected,
    avgCost,
    margin3m: avgCollected > 0 ? ((avgCollected - avgCost) / avgCollected) * 100 : null,
    burn,
    runwayMonths: burn > 0 ? rates.cash_ngn_cents / burn : null,
    cash: rates.cash_ngn_cents
  };
}
