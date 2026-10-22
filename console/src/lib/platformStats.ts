// Range maths for the admin Overview: a window of N days split into buckets, the same window one
// period earlier (for "vs previous" deltas), and counters that drop timestamps into those buckets.

import type { FinanceOverview, PaymentReceived, Totals } from "./financeOverview";

export const RANGES = [
  { key: "7d", days: 7, label: "7d" },
  { key: "30d", days: 30, label: "30d" },
  { key: "90d", days: 90, label: "90d" }
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

const DAY = 86_400_000;

export interface Bucket {
  start: number;
  /** Exclusive end. */
  end: number;
  label: string;
}

export interface Window {
  /** Bucket size in days: daily up to 30 days, weekly beyond. */
  size: number;
  buckets: Bucket[];
  start: number;
  end: number;
  prevStart: number;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function buildWindow(range: RangeKey, now = Date.now()): Window {
  const days = RANGES.find((r) => r.key === range)!.days;
  const size = days <= 30 ? 1 : 7;
  const count = Math.ceil(days / size);
  const end = startOfDay(now) + DAY;
  const start = end - count * size * DAY;
  const buckets = Array.from({ length: count }, (_, i) => {
    const s = start + i * size * DAY;
    const e = s + size * DAY;
    return { start: s, end: e, label: size === 1 ? shortDate(s) : `${shortDate(s)} – ${shortDate(e - DAY)}` };
  });
  return { size, buckets, start, end, prevStart: start - count * size * DAY };
}

const inRange = (ms: number, from: number, to: number) => Number.isFinite(ms) && ms >= from && ms < to;

/** How many of these timestamps fall in each bucket, plus the total this window and the one before. */
export function countByBucket(win: Window, stamps: Array<string | null | undefined>) {
  const series = win.buckets.map(() => 0);
  let current = 0;
  let previous = 0;
  for (const s of stamps) {
    if (!s) continue;
    const t = new Date(s).getTime();
    if (inRange(t, win.start, win.end)) {
      series[Math.floor((t - win.start) / (win.size * DAY))] += 1;
      current += 1;
    } else if (inRange(t, win.prevStart, win.start)) previous += 1;
  }
  return { series, current, previous };
}

/** Payments received per bucket in naira (kobo), and per-currency totals for this window and the one before. */
export function paymentsByBucket(win: Window, payments: PaymentReceived[]) {
  const series = win.buckets.map(() => 0);
  const current: Totals = {};
  const previous: Totals = {};
  for (const p of payments) {
    const t = new Date(p.date).getTime();
    if (inRange(t, win.start, win.end)) {
      current[p.currency] = (current[p.currency] ?? 0) + p.amountCents;
      if (p.currency === "NGN") series[Math.floor((t - win.start) / (win.size * DAY))] += p.amountCents;
    } else if (inRange(t, win.prevStart, win.start)) {
      previous[p.currency] = (previous[p.currency] ?? 0) + p.amountCents;
    }
  }
  return { series, current, previous };
}

/** Change against the previous window, as a rounded percent. Null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Average recurring revenue per billed client, in kobo (NGN only, matching the MRR tile's primary figure). */
export function arpuNgn(finance: FinanceOverview | null | undefined): number | null {
  const mrr = finance?.totals.mrr.NGN;
  const clients = finance?.billedClients;
  return mrr && clients ? Math.round(mrr / clients) : null;
}
