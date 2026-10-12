// Restart's own cost side of the books: overhead (console.expenses), what each
// client deployment costs to run (console.services), and the FX rates / cash
// balance (console.finance_settings). Pure helpers below fold everything into
// NGN kobo so the Finance page can set it against revenue from Lago.

import { consoleSchema } from "./supabase";

export type CostCurrency = "NGN" | "USD" | "EUR";
export const COST_CURRENCIES: CostCurrency[] = ["NGN", "USD", "EUR"];

export type Cadence = "monthly" | "quarterly" | "annual" | "one_off";

export const EXPENSE_CATEGORIES = {
  infrastructure: "Infrastructure & hosting",
  software: "Software & tools",
  utilities: "Internet, power & phone",
  people: "People",
  marketing: "Marketing",
  travel: "Travel & transport",
  equipment: "Equipment & office",
  legal_tax: "Legal, tax & accounting",
  banking_fees: "Banking & fees",
  other: "Other"
} as const;
export const CADENCE_LABEL: Record<Cadence, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", one_off: "One-off" };

export interface Expense {
  id: string;
  name: string;
  category: keyof typeof EXPENSE_CATEGORIES;
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
  /** The expense that holds this server's cost (amount, currency, dates). The cost fields above mirror it. */
  expense_id?: string | null;
}

export interface Settings {
  usd_ngn: number;
  eur_ngn: number;
  cash_ngn_cents: number;
}

export interface Account {
  id: string;
  name: string;
  kind: "bank" | "card" | "cash" | "wallet";
  currency: CostCurrency;
  note: string | null;
  active: boolean;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
}

/** A payment actually made against an expense (console.expense_payments). */
export interface ExpensePayment {
  id: string;
  expense_id: string;
  account_id: string | null;
  paid_on: string;
  period_end: string | null;
  amount_cents: number;
  currency: CostCurrency;
  fx_rate: number;
  amount_ngn_cents: number;
  vat_cents: number;
  reference: string | null;
  note: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export interface Books {
  expenses: Expense[];
  services: Service[];
  settings: Settings;
  accounts: Account[];
  payments: ExpensePayment[];
  /** False until the payments migration has been applied; the cost panels still work without it. */
  paymentsAvailable: boolean;
}

export async function loadBooks(): Promise<Books> {
  const [exp, svc, set] = await Promise.all([
    consoleSchema().from("expenses").select("id,name,category,amount_cents,currency,cadence,start_date,end_date,notes").order("start_date", { ascending: false }),
    consoleSchema().from("services").select("*").order("started_on", { ascending: false }),
    consoleSchema().from("finance_settings").select("usd_ngn,eur_ngn,cash_ngn_cents").eq("id", true).maybeSingle()
  ]);
  if (exp.error) throw exp.error;
  if (svc.error) throw svc.error;
  if (set.error) throw set.error;

  // Accounts and payments are additive: a missing table must not take the cost panels down.
  const [acc, pay] = await Promise.all([
    consoleSchema().from("finance_accounts").select("*").order("name"),
    consoleSchema()
      .from("expense_payments")
      .select("id,expense_id,account_id,paid_on,period_end,amount_cents,currency,fx_rate,amount_ngn_cents,vat_cents,reference,note,created_at,voided_at,void_reason")
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
  ]);
  const paymentsAvailable = !acc.error && !pay.error;
  const expenses = (exp.data ?? []).map((e) => ({ ...e, amount_cents: Number(e.amount_cents) })) as Expense[];
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  return {
    accounts: (paymentsAvailable ? acc.data ?? [] : []) as Account[],
    payments: (paymentsAvailable ? pay.data ?? [] : []).map((p) => ({
      ...p,
      amount_cents: Number(p.amount_cents),
      amount_ngn_cents: Number(p.amount_ngn_cents),
      vat_cents: Number(p.vat_cents),
      fx_rate: Number(p.fx_rate)
    })) as ExpensePayment[],
    paymentsAvailable,
    // bigint comes back as a number from PostgREST; numeric may arrive as a string.
    expenses,
    // A server's cost lives on its linked expense (so it can be paid and audited like any other);
    // overlay it so everything that reads a service's cost, dates and currency sees the expense's.
    services: (svc.data ?? []).map((sv) => {
      const exp = sv.expense_id ? expenseById.get(sv.expense_id as string) : undefined;
      return {
        ...sv,
        monthly_cost_cents: exp ? exp.amount_cents : Number(sv.monthly_cost_cents),
        currency: exp ? exp.currency : sv.currency,
        started_on: exp ? exp.start_date : sv.started_on,
        ended_on: exp ? exp.end_date : sv.ended_on
      };
    }) as Service[],
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

/** Expenses that hold a client server's cost: counted as hosting, not as operating expenses. */
export const hostingExpenseIds = (b: Books): Set<string> =>
  new Set(b.services.map((sv) => sv.expense_id).filter((id): id is string => Boolean(id)));

export const overheadInMonth = (b: Books, month: string) => {
  const hosting = hostingExpenseIds(b);
  return b.expenses
    .filter((e) => !hosting.has(e.id))
    .reduce((sum, e) => sum + toNgn(expenseInMonth(e, month), e.currency, b.settings), 0);
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const todayIso = () => isoDate(new Date());

/** The date one billing period after `date` ("YYYY-MM-DD"), clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addPeriod(date: string, cadence: Exclude<Cadence, "one_off">): string {
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return isoDate(target);
}

/** The last day covered by a period that starts on `due`. */
export function periodEndFor(due: string, cadence: Exclude<Cadence, "one_off">): string {
  const next = new Date(`${addPeriod(due, cadence)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() - 1);
  return isoDate(next);
}

/**
 * When a recurring expense is next due, or null for a one-off or one that has ended.
 * After a payment it is the day after that payment's period ends. With no payment recorded
 * yet it is the current billing cycle's date, counted from the start date, so a cost that was
 * set up before payments were tracked shows as due now rather than months overdue.
 */
export function nextDue(expense: Expense, payments: ExpensePayment[]): string | null {
  if (expense.cadence === "one_off") return null;
  const cadence = expense.cadence;
  const covered = payments
    .filter((p) => p.expense_id === expense.id && !p.voided_at && p.period_end)
    .map((p) => p.period_end as string)
    .sort();
  let due: string;
  if (covered.length > 0) {
    const next = new Date(`${covered[covered.length - 1]}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    due = isoDate(next);
  } else {
    due = expense.start_date;
    const today = todayIso();
    for (let guard = 0; guard < 600; guard++) {
      const following = addPeriod(due, cadence);
      if (following > today) break;
      due = following;
    }
  }
  if (expense.end_date && due > expense.end_date) return null;
  return due;
}

export const isPaymentLive = (p: ExpensePayment) => !p.voided_at;
