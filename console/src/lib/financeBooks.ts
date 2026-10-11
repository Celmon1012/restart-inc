// Restart's own cost side of the books: overhead (console.expenses), what each
// client deployment costs to run (console.services), and the FX rates / cash
// balance (console.finance_settings). Pure helpers below fold everything into
// NGN kobo so the Finance page can set it against revenue from Lago.

import { consoleSchema } from "./supabase";

export type CostCurrency = "NGN" | "USD" | "EUR";
export const COST_CURRENCIES: CostCurrency[] = ["NGN", "USD", "EUR"];

export type Cadence = "monthly" | "quarterly" | "annual" | "one_off";

export interface Expense {
  id: string;
  name: string;
  category: "infrastructure" | "software" | "people" | "marketing" | "legal_tax" | "banking_fees" | "other";
  amount_cents: number;
  currency: CostCurrency;
  cadence: Cadence;
  start_date: string;
  end_date: string | null;
  notes: string | null;
}

export interface Service {
  id: string;
  workspace_id: string;
  name: string;
  provider: "hetzner" | "contabo" | "other";
  coolify_server_uuid: string | null;
  monthly_cost_cents: number;
  currency: CostCurrency;
  started_on: string;
  ended_on: string | null;
  notes: string | null;
}

export interface Settings {
  usd_ngn: number;
  eur_ngn: number;
  cash_ngn_cents: number;
}

export interface Books {
  expenses: Expense[];
  services: Service[];
  settings: Settings;
}

export async function loadBooks(): Promise<Books> {
  const [exp, svc, set] = await Promise.all([
    consoleSchema().from("expenses").select("id,name,category,amount_cents,currency,cadence,start_date,end_date,notes").order("start_date", { ascending: false }),
    consoleSchema().from("services").select("id,workspace_id,name,provider,coolify_server_uuid,monthly_cost_cents,currency,started_on,ended_on,notes").order("started_on", { ascending: false }),
    consoleSchema().from("finance_settings").select("usd_ngn,eur_ngn,cash_ngn_cents").eq("id", true).maybeSingle()
  ]);
  if (exp.error) throw exp.error;
  if (svc.error) throw svc.error;
  if (set.error) throw set.error;
  return {
    // bigint comes back as a number from PostgREST; numeric may arrive as a string.
    expenses: (exp.data ?? []).map((e) => ({ ...e, amount_cents: Number(e.amount_cents) })) as Expense[],
    services: (svc.data ?? []).map((s) => ({ ...s, monthly_cost_cents: Number(s.monthly_cost_cents) })) as Service[],
    settings: {
      usd_ngn: Number(set.data?.usd_ngn ?? 1500),
      eur_ngn: Number(set.data?.eur_ngn ?? 1650),
      cash_ngn_cents: Number(set.data?.cash_ngn_cents ?? 0)
    }
  };
}

/** Minor units in `currency` -> NGN minor units. Currencies we don't hold a rate for count as 0. */
export function toNgn(cents: number, currency: string, s: Settings): number {
  if (currency === "NGN") return cents;
  if (currency === "USD") return cents * s.usd_ngn;
  if (currency === "EUR") return cents * s.eur_ngn;
  return 0;
}

/** Revenue totals ({NGN: kobo, USD: cents}) -> NGN kobo. */
export function totalsToNgn(t: Record<string, number> | undefined, s: Settings): number {
  return Object.entries(t ?? {}).reduce((sum, [c, v]) => sum + toNgn(v, c, s), 0);
}

export const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** What an overhead expense costs in month "YYYY-MM", in its own currency's minor units. */
export function expenseInMonth(e: Expense, month: string): number {
  if (e.start_date > `${month}-31`) return 0;
  if (e.end_date && e.end_date < `${month}-01`) return 0;
  if (e.cadence === "one_off") return e.start_date.slice(0, 7) === month ? e.amount_cents : 0;
  if (e.cadence === "quarterly") return e.amount_cents / 3;
  if (e.cadence === "annual") return e.amount_cents / 12;
  return e.amount_cents;
}

/**
 * What a service costs in month "YYYY-MM", prorated by the days it was live,
 * so a server ended on the 10th costs a third of the month rather than all or
 * nothing. In its own currency's minor units.
 */
export function serviceInMonth(s: Service, month: string): number {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = Date.UTC(y, m - 1, 1);
  const last = Date.UTC(y, m - 1, daysInMonth);
  const from = Math.max(first, Date.parse(`${s.started_on}T00:00:00Z`));
  const to = Math.min(last, s.ended_on ? Date.parse(`${s.ended_on}T00:00:00Z`) : last);
  if (to < from) return 0;
  const days = Math.round((to - from) / 86_400_000) + 1;
  return (s.monthly_cost_cents * days) / daysInMonth;
}

export const hostingInMonth = (b: Books, month: string) =>
  b.services.reduce((sum, s) => sum + toNgn(serviceInMonth(s, month), s.currency, b.settings), 0);

export const overheadInMonth = (b: Books, month: string) =>
  b.expenses.reduce((sum, e) => sum + toNgn(expenseInMonth(e, month), e.currency, b.settings), 0);
