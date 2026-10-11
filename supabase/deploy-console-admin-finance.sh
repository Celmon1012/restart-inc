#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
set -e
mkdir -p /home/deno/functions/console-admin-finance
cat > /home/deno/functions/console-admin-finance/index.ts <<'__RESTART_FN_EOF__'
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
  total_due_amount_cents?: number;
  total_paid_amount_cents?: number;
  taxes_amount_cents?: number;
  currency: string;
  file_url: string | null;
  customer?: { external_id?: string; name?: string | null };
}

interface LagoSubscription {
  external_id: string;
  plan_code: string;
  status: string;
  // The price of the plan this subscription actually runs on. A per-customer
  // override is a copy of the plan under the same code, which /plans doesn't list,
  // so the plan looked up by code carries the standard price, not the agreed one.
  plan_amount_cents?: number;
  plan_amount_currency?: string;
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

// Breadmaker Systems is a separate entity billed on the same Lago (customers "bm-…");
// its money never belongs in Restart's books.
const isBreadmaker = (externalId: string | null | undefined) => (externalId ?? "").startsWith("bm-");

async function fetchAllInvoices(): Promise<LagoInvoice[]> {
  const all: LagoInvoice[] = [];
  for (let page = 1; page <= MAX_INVOICE_PAGES; page++) {
    const res = await lagoFetch(`/invoices?per_page=100&page=${page}`);
    const batch: LagoInvoice[] = res?.invoices ?? [];
    all.push(...batch.filter((inv) => !isBreadmaker(inv.customer?.external_id)));
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

  // ?customers=1 -> the Lago customers a project can be linked to (Breadmaker's
  // are left out), for the "Link billing" control on a project's Billing tab.
  if (new URL(req.url).searchParams.get("customers")) {
    try {
      const customers: Array<{ externalId: string; name: string | null; email: string | null }> = [];
      for (let page = 1; page <= MAX_INVOICE_PAGES; page++) {
        const res = await lagoFetch(`/customers?per_page=100&page=${page}`);
        const batch: Array<{ external_id: string; name?: string | null; email?: string | null }> = res?.customers ?? [];
        for (const c of batch) {
          if (!isBreadmaker(c.external_id)) customers.push({ externalId: c.external_id, name: c.name ?? null, email: c.email ?? null });
        }
        if (!res?.meta?.next_page || batch.length === 0) break;
      }
      return json({ customers });
    } catch (err) {
      return json({ error: `Failed to load Lago customers: ${(err as Error).message}` }, 502);
    }
  }

  try {
    const workspaces = await getWorkspaces(jwt);
    const byCustomer = new Map(workspaces.filter((w) => w.lago_customer_id && !isBreadmaker(w.lago_customer_id)).map((w) => [w.lago_customer_id!, w]));

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
    // VAT is not revenue: collected/monthly/client figures below are ex-VAT, and the
    // tax portion of each payment is tracked here as owed to the tax authority.
    const vatCollected: Totals = {};
    const vatCollectedThisMonth: Totals = {};

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

      // Recorded payments count as collected even before the invoice is paid in
      // full (payment_status stays "pending" until then). An invoice marked paid
      // without a payment record has no paid total, so it counts in full.
      const paid = inv.payment_status === "succeeded"
        ? inv.total_amount_cents
        : Math.min(inv.total_paid_amount_cents ?? 0, inv.total_amount_cents);
      const due = inv.payment_status === "succeeded"
        ? 0
        : Math.max(inv.total_due_amount_cents ?? inv.total_amount_cents - paid, 0);
      if (paid > 0) {
        // Split the payment pro rata into net revenue and the VAT inside it.
        const total = inv.total_amount_cents;
        const vat = total > 0 ? Math.round(paid * Math.min(Math.max(inv.taxes_amount_cents ?? 0, 0), total) / total) : 0;
        const net = paid - vat;
        const month = inv.issuing_date.slice(0, 7);
        add(collected, inv.currency, net);
        add(client.collected, inv.currency, net);
        if (monthly[month]) add(monthly[month], inv.currency, net);
        if (month === thisMonth) add(collectedThisMonth, inv.currency, net);
        if (vat > 0) {
          add(vatCollected, inv.currency, vat);
          if (month === thisMonth) add(vatCollectedThisMonth, inv.currency, vat);
        }
      }
      if (due > 0) {
        add(outstanding, inv.currency, due);
        add(client.outstanding, inv.currency, due);
        if (isOverdue(inv)) {
          add(overdue, inv.currency, due);
          add(client.overdue, inv.currency, due);
        }
      }
    }

    let activeSubscriptions = 0;
    for (const [customerId, subs] of subsByCustomer) {
      for (const sub of subs) {
        if (sub.status !== "active") continue;
        activeSubscriptions++;
        const catalogPlan = planByCode.get(sub.plan_code);
        if (!catalogPlan) continue;
        // Price from the subscription itself (honours per-customer overrides); the
        // catalog plan still supplies the billing interval.
        const plan = {
          ...catalogPlan,
          amount_cents: sub.plan_amount_cents ?? catalogPlan.amount_cents,
          amount_currency: sub.plan_amount_currency ?? catalogPlan.amount_currency,
        };
        const cents = monthlyCents(plan);
        add(mrr, plan.amount_currency, cents);
        add(clientFor(customerId).mrr, plan.amount_currency, cents);
      }
    }

    const openInvoices = invoices
      .filter((inv) => inv.status === "finalized" && inv.payment_status !== "succeeded")
      .sort((a, b) => a.issuing_date.localeCompare(b.issuing_date))
      .map((inv) => ({
        id: inv.lago_id,
        number: inv.number,
        client: clientFor(inv.customer?.external_id ?? "unknown", inv.customer?.name).name,
        workspaceId: byCustomer.get(inv.customer?.external_id ?? "")?.id ?? null,
        issuingDate: inv.issuing_date,
        dueDate: inv.payment_due_date ?? null,
        paymentStatus: inv.payment_status,
        overdue: isOverdue(inv),
        totalAmountCents: inv.total_amount_cents,
        totalDueAmountCents: inv.total_due_amount_cents ?? inv.total_amount_cents,
        currency: inv.currency,
        fileUrl: inv.file_url,
      }));

    return json({
      generatedAt: now.toISOString(),
      totals: { collected, collectedThisMonth, outstanding, overdue, mrr, vatCollected, vatCollectedThisMonth },
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
__RESTART_FN_EOF__
ls -l /home/deno/functions/console-admin-finance
