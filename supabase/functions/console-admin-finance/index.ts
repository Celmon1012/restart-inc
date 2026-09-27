// Admin-only financial overview across every client -- the back-office
// counterpart to console-billing, which only ever answers for one workspace.
// Same reason for existing as console-billing: LAGO_API_KEY can read every
// client's invoices and must never reach the browser.
//
// GET /functions/v1/console-admin-finance
//
// Authorization is two layers: the caller's app_metadata.is_admin (checked
// here, since this function reads Lago globally rather than per workspace),
// and the workspaces lookup running as the caller's own JWT under RLS.
//
// Amounts are kept per currency and never summed across currencies -- NGN
// and USD invoices can't be meaningfully added without an FX rate we don't own.
//
// Zero external imports, same cold-start reasoning as every other function here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LAGO_API_URL = (Deno.env.get("LAGO_API_URL") ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = Deno.env.get("LAGO_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Invoices are paged 100 at a time; this caps a single overview at 1,000 of the
// most recent, which is plenty for an overview and bounds the function's runtime.
const MAX_INVOICE_PAGES = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function getUser(jwt: string): Promise<{ id: string; isAdmin: boolean } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  return { id: user.id, isAdmin: Boolean(user.app_metadata?.is_admin) };
}

async function getWorkspaces(jwt: string): Promise<Array<{ id: string; name: string; lago_customer_id: string | null }>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?select=id,name,lago_customer_id`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" },
  });
  if (!res.ok) throw new Error(`workspaces lookup -> ${res.status}`);
  return res.json();
}

async function lagoFetch(path: string) {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, { headers: { Authorization: `Bearer ${LAGO_API_KEY}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lago ${path} -> ${res.status}`);
  return res.json();
}

interface LagoInvoice {
  lago_id: string;
  number: string;
  issuing_date: string;
  payment_due_date?: string | null;
  status: string;
  payment_status: string;
  payment_overdue?: boolean;
  total_amount_cents: number;
  currency: string;
  file_url: string | null;
  customer?: { external_id?: string; name?: string | null };
}

interface LagoSubscription {
  external_id: string;
  plan_code: string;
  status: string;
}

interface LagoPlan {
  code: string;
  name: string;
  amount_cents: number;
  amount_currency: string;
  interval: string;
}

// Normalise a plan's price to a monthly figure for MRR.
function monthlyCents(plan: LagoPlan): number {
  switch (plan.interval) {
    case "weekly":
      return Math.round((plan.amount_cents * 52) / 12);
    case "quarterly":
      return Math.round(plan.amount_cents / 3);
    case "semiannual":
      return Math.round(plan.amount_cents / 6);
    case "yearly":
      return Math.round(plan.amount_cents / 12);
    default:
      return plan.amount_cents;
  }
}

async function fetchAllInvoices(): Promise<LagoInvoice[]> {
  const all: LagoInvoice[] = [];
  for (let page = 1; page <= MAX_INVOICE_PAGES; page++) {
    const res = await lagoFetch(`/invoices?per_page=100&page=${page}`);
    const batch: LagoInvoice[] = res?.invoices ?? [];
    all.push(...batch);
    const next = res?.meta?.next_page;
    if (!next || batch.length === 0) break;
  }
  return all;
}

type Totals = Record<string, number>;
const add = (t: Totals, currency: string, cents: number) => {
  t[currency] = (t[currency] ?? 0) + cents;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);

  try {
    const workspaces = await getWorkspaces(jwt);
    const byCustomer = new Map(workspaces.filter((w) => w.lago_customer_id).map((w) => [w.lago_customer_id!, w]));

    const [invoices, plansRes, subsByCustomer] = await Promise.all([
      fetchAllInvoices(),
      lagoFetch(`/plans?per_page=100`),
      Promise.all(
        [...byCustomer.keys()].map(async (customerId) => {
          const res = await lagoFetch(
            `/subscriptions?external_customer_id=${encodeURIComponent(customerId)}&status[]=active&status[]=pending`
          ).catch(() => null);
          return [customerId, (res?.subscriptions ?? []) as LagoSubscription[]] as const;
        })
      ),
    ]);
    const planByCode = new Map<string, LagoPlan>(((plansRes?.plans ?? []) as LagoPlan[]).map((p) => [p.code, p]));

    const collected: Totals = {};
    const outstanding: Totals = {};
    const overdue: Totals = {};
    const mrr: Totals = {};
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const collectedThisMonth: Totals = {};

    // Last 12 calendar months of collected revenue, per currency.
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    const monthly: Record<string, Totals> = Object.fromEntries(months.map((m) => [m, {}]));

    type ClientRow = {
      workspaceId: string | null;
      name: string;
      customerId: string;
      collected: Totals;
      outstanding: Totals;
      overdue: Totals;
      mrr: Totals;
      invoiceCount: number;
      lastInvoiceAt: string | null;
    };
    const clients = new Map<string, ClientRow>();
    const clientFor = (customerId: string, fallbackName?: string | null): ClientRow => {
      if (!clients.has(customerId)) {
        const ws = byCustomer.get(customerId);
        clients.set(customerId, {
          workspaceId: ws?.id ?? null,
          name: ws?.name ?? fallbackName ?? customerId,
          customerId,
          collected: {},
          outstanding: {},
          overdue: {},
          mrr: {},
          invoiceCount: 0,
          lastInvoiceAt: null,
        });
      }
      return clients.get(customerId)!;
    };
    for (const customerId of byCustomer.keys()) clientFor(customerId);

    const isOverdue = (inv: LagoInvoice) =>
      inv.payment_overdue === true ||
      (inv.payment_due_date ? new Date(inv.payment_due_date) < now : false);

    for (const inv of invoices) {
      // Drafts and voided invoices aren't money owed or earned.
      if (inv.status !== "finalized") continue;
      const customerId = inv.customer?.external_id ?? "unknown";
      const client = clientFor(customerId, inv.customer?.name);
      client.invoiceCount++;
      if (!client.lastInvoiceAt || inv.issuing_date > client.lastInvoiceAt) client.lastInvoiceAt = inv.issuing_date;

      if (inv.payment_status === "succeeded") {
        add(collected, inv.currency, inv.total_amount_cents);
        add(client.collected, inv.currency, inv.total_amount_cents);
        const month = inv.issuing_date.slice(0, 7);
        if (monthly[month]) add(monthly[month], inv.currency, inv.total_amount_cents);
        if (month === thisMonth) add(collectedThisMonth, inv.currency, inv.total_amount_cents);
      } else {
        add(outstanding, inv.currency, inv.total_amount_cents);
        add(client.outstanding, inv.currency, inv.total_amount_cents);
        if (isOverdue(inv)) {
          add(overdue, inv.currency, inv.total_amount_cents);
          add(client.overdue, inv.currency, inv.total_amount_cents);
        }
      }
    }

    let activeSubscriptions = 0;
    for (const [customerId, subs] of subsByCustomer) {
      for (const sub of subs) {
        if (sub.status !== "active") continue;
        activeSubscriptions++;
        const plan = planByCode.get(sub.plan_code);
        if (!plan) continue;
        const cents = monthlyCents(plan);
        add(mrr, plan.amount_currency, cents);
        add(clientFor(customerId).mrr, plan.amount_currency, cents);
      }
    }

    const openInvoices = invoices
      .filter((inv) => inv.status === "finalized" && inv.payment_status !== "succeeded")
      .sort((a, b) => a.issuing_date.localeCompare(b.issuing_date))
      .map((inv) => ({
        number: inv.number,
        client: clientFor(inv.customer?.external_id ?? "unknown", inv.customer?.name).name,
        workspaceId: byCustomer.get(inv.customer?.external_id ?? "")?.id ?? null,
        issuingDate: inv.issuing_date,
        dueDate: inv.payment_due_date ?? null,
        paymentStatus: inv.payment_status,
        overdue: isOverdue(inv),
        totalAmountCents: inv.total_amount_cents,
        currency: inv.currency,
        fileUrl: inv.file_url,
      }));

    return json({
      generatedAt: now.toISOString(),
      totals: { collected, collectedThisMonth, outstanding, overdue, mrr },
      activeSubscriptions,
      billedClients: byCustomer.size,
      unbilledClients: workspaces.length - byCustomer.size,
      invoiceCount: invoices.length,
      invoicesTruncated: invoices.length >= MAX_INVOICE_PAGES * 100,
      monthly: months.map((m) => ({ month: m, collected: monthly[m] })),
      clients: [...clients.values()].sort((a, b) => a.name.localeCompare(b.name)),
      openInvoices,
    });
  } catch (err) {
    return json({ error: `Failed to load finance data: ${(err as Error).message}` }, 502);
  }
});
