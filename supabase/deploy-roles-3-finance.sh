#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
# Staff roles (Owner / Ops / Finance): console-admin-finance, console-admin-record-payment.
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

async function getUser(jwt: string): Promise<{ id: string; email?: string; isAdmin: boolean; roles: string[] } | null> {
  // The caller's token is checked by the auth service, and in parallel their effective staff roles
  // are read as themselves. Owner is the admin claim or an owner row; Ops and Finance count only
  // when the session passed the second factor (aal2), which the database decides, not this code.
  const headers = { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY };
  const [res, rolesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/my_effective_roles`, {
      method: "POST",
      headers: { ...headers, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null),
  ]);
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  // app_metadata, not user_metadata -- only settable via the service-role Admin API, never via
  // the user's own auth.updateUser() call, so an account can never grant itself this by editing
  // its own profile.
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  // If the role lookup can't be reached, fall back to the admin claim alone.
  if (rolesRes?.ok) {
    const list = await rolesRes.json().catch(() => null);
    if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
  }
  // "isAdmin" for this function means: holds one of "owner", "finance".
  return { id: user.id, email: user.email, isAdmin: roles.some((r) => ["owner", "finance"].includes(r)), roles };
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
  metadata?: Array<{ key?: string; value?: string | null }>;
}

// A payment recorded against an invoice (Lago's own Record a payment, or a card payment).
interface LagoPayment {
  invoice_ids?: string[];
  lago_invoice_ids?: string[];
  lago_payable_id?: string;
  amount_cents: number;
  payment_status?: string;
  status?: string;
  created_at?: string;
  paid_at?: string;
}

interface LagoSubscription {
  external_id: string;
  name?: string | null;
  plan_code: string;
  status: string;
  // The price of the plan this subscription actually runs on. A per-customer
  // override is a copy of the plan under the same code, which /plans doesn't list,
  // so the plan looked up by code carries the standard price, not the agreed one.
  plan_amount_cents?: number;
  plan_amount_currency?: string;
}

// A coupon applied to a customer. Recurring ones take a percentage or a fixed amount off each
// invoice until frequency_duration_remaining runs out ("forever" has no end).
interface LagoAppliedCoupon {
  status: string;
  coupon_code?: string;
  percentage_rate?: string | number | null;
  amount_cents?: number | null;
  amount_currency?: string | null;
  frequency?: string;
  frequency_duration_remaining?: number | null;
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

// Every payment Lago knows about, so revenue can be counted in the month the money arrived rather
// than the month the invoice was issued. If this can't be read, callers fall back to the invoice's
// own dates, so the figures never get worse.
async function fetchAllPayments(): Promise<LagoPayment[]> {
  const all: LagoPayment[] = [];
  try {
    for (let page = 1; page <= MAX_INVOICE_PAGES; page++) {
      const res = await lagoFetch(`/payments?per_page=100&page=${page}`);
      const batch: LagoPayment[] = res?.payments ?? [];
      all.push(...batch);
      if (!res?.meta?.next_page || batch.length === 0) break;
    }
  } catch {
    return [];
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

    const [invoices, payments, plansRes, subsByCustomer, couponsByCustomer] = await Promise.all([
      fetchAllInvoices(),
      fetchAllPayments(),
      lagoFetch(`/plans?per_page=100`),
      Promise.all(
        [...byCustomer.keys()].map(async (customerId) => {
          const res = await lagoFetch(
            `/subscriptions?external_customer_id=${encodeURIComponent(customerId)}&status[]=active&status[]=pending`
          ).catch(() => null);
          return [customerId, (res?.subscriptions ?? []) as LagoSubscription[]] as const;
        })
      ),
      Promise.all(
        [...byCustomer.keys()].map(async (customerId) => {
          const res = await lagoFetch(
            `/applied_coupons?external_customer_id=${encodeURIComponent(customerId)}&status=active`
          ).catch(() => null);
          return [customerId, (res?.applied_coupons ?? []) as LagoAppliedCoupon[]] as const;
        })
      ),
    ]);
    const paymentsByInvoice = new Map<string, Array<{ cents: number; date: string }>>();
    for (const p of payments) {
      if ((p.payment_status ?? p.status) && !["succeeded", "paid"].includes(String(p.payment_status ?? p.status))) continue;
      const date = (p.paid_at ?? p.created_at ?? "").slice(0, 10);
      if (!date) continue;
      for (const invoiceId of p.invoice_ids ?? p.lago_invoice_ids ?? (p.lago_payable_id ? [p.lago_payable_id] : [])) {
        paymentsByInvoice.set(invoiceId, [...(paymentsByInvoice.get(invoiceId) ?? []), { cents: p.amount_cents, date }]);
      }
    }
    for (const list of paymentsByInvoice.values()) list.sort((a, b) => a.date.localeCompare(b.date));
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
      // Recurring revenue given away by active coupons each month (same currencies as mrr),
      // and how many more invoices the shortest-lived one covers (null = no end).
      discount: Totals;
      couponInvoicesLeft: number | null;
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
          discount: {},
          couponInvoicesLeft: null,
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
        // Each payment counts in the month it was received. Whatever isn't covered by a payment
        // record (an invoice marked paid through the console) counts on its recorded paid-on date,
        // and failing that the day the invoice was issued.
        const parts: Array<{ month: string; cents: number }> = [];
        let remaining = paid;
        for (const p of paymentsByInvoice.get(inv.lago_id) ?? []) {
          const cents = Math.min(p.cents, remaining);
          if (cents > 0) parts.push({ month: p.date.slice(0, 7), cents });
          remaining -= cents;
        }
        if (remaining > 0) {
          const paidOn = inv.metadata?.find((m) => m.key === "paid_on")?.value;
          parts.push({ month: (paidOn && /^\d{4}-\d{2}/.test(paidOn) ? paidOn : inv.issuing_date).slice(0, 7), cents: remaining });
        }
        for (const part of parts) {
          const partVat = paid > 0 ? Math.round((vat * part.cents) / paid) : 0;
          const partNet = part.cents - partVat;
          add(collected, inv.currency, partNet);
          add(client.collected, inv.currency, partNet);
          if (monthly[part.month]) add(monthly[part.month], inv.currency, partNet);
          if (part.month === thisMonth) add(collectedThisMonth, inv.currency, partNet);
          if (partVat > 0) {
            add(vatCollected, inv.currency, partVat);
            if (part.month === thisMonth) add(vatCollectedThisMonth, inv.currency, partVat);
          }
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

    // Each active subscription as a line, classified by what it sells. Hosting plans are matched
    // with server costs; everything else is a service (labour) and is shown as revenue only.
    const isHostingPlan = (code: string) => code.startsWith("dedicated-server");
    const subscriptionLines: Array<{
      customerId: string;
      workspaceId: string | null;
      planCode: string;
      planName: string;
      subscriptionName: string | null;
      kind: "hosting" | "service";
      monthlyCents: number;
      currency: string;
    }> = [];

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
        subscriptionLines.push({
          customerId,
          workspaceId: byCustomer.get(customerId)?.id ?? null,
          planCode: sub.plan_code,
          planName: catalogPlan.name,
          subscriptionName: sub.name ?? null,
          kind: isHostingPlan(sub.plan_code) ? "hosting" : "service",
          monthlyCents: cents,
          currency: plan.amount_currency,
        });
      }
    }

    // MRR is the contracted price. A coupon can give some or all of it away for a while (a free
    // support period, say), so work out what is actually billed: recurring coupons only, a
    // percentage off every currency or a fixed amount in the coupon's currency, never below zero.
    const discount: Totals = {};
    for (const [customerId, coupons] of couponsByCustomer) {
      const client = clientFor(customerId);
      for (const c of coupons) {
        if (c.status !== "active" || c.frequency === "once") continue;
        const left = c.frequency === "forever" ? null : c.frequency_duration_remaining ?? null;
        if (left !== null && left <= 0) continue;
        const pct = Number(c.percentage_rate ?? 0);
        const take = (currency: string, cents: number) => {
          const room = (client.mrr[currency] ?? 0) - (client.discount[currency] ?? 0);
          const amount = Math.max(0, Math.min(Math.round(cents), room));
          if (amount > 0) add(client.discount, currency, amount);
        };
        if (pct > 0) for (const [currency, cents] of Object.entries(client.mrr)) take(currency, (cents * Math.min(pct, 100)) / 100);
        else if (c.amount_cents && c.amount_currency) take(c.amount_currency, c.amount_cents);
        if (left !== null) client.couponInvoicesLeft = client.couponInvoicesLeft === null ? left : Math.min(client.couponInvoicesLeft, left);
      }
      for (const [currency, cents] of Object.entries(client.discount)) add(discount, currency, cents);
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
      totals: { collected, collectedThisMonth, outstanding, overdue, mrr, discount, vatCollected, vatCollectedThisMonth },
      activeSubscriptions,
      billedClients: byCustomer.size,
      unbilledClients: workspaces.length - byCustomer.size,
      invoiceCount: invoices.length,
      invoicesTruncated: invoices.length >= MAX_INVOICE_PAGES * 100,
      monthly: months.map((m) => ({ month: m, collected: monthly[m] })),
      clients: [...clients.values()].sort((a, b) => a.name.localeCompare(b.name)),
      subscriptions: subscriptionLines,
      openInvoices,
    });
  } catch (err) {
    return json({ error: `Failed to load finance data: ${(err as Error).message}` }, 502);
  }
});
__RESTART_FN_EOF__
mkdir -p /home/deno/functions/console-admin-record-payment
cat > /home/deno/functions/console-admin-record-payment/index.ts <<'__RESTART_FN_EOF__'
// Admin-only: record an offline payment (bank transfer / direct deposit) against
// a Lago invoice. Lago's own "Record a payment" UI is license-gated on self-hosted,
// but the invoice update API is not -- setting payment_status to "succeeded" is
// what marks it paid. Lago keeps no payment date or reference on that path, so
// we write them to the invoice's metadata for the audit trail.
//
// POST /functions/v1/console-admin-record-payment
// { invoiceId: string (Lago lago_id), paidOn?: "YYYY-MM-DD", reference?: string, method?: string }
//
// Zero external imports, same cold-start reasoning as every other function here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LAGO_API_URL = (Deno.env.get("LAGO_API_URL") ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = Deno.env.get("LAGO_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function getUser(jwt: string): Promise<{ id: string; email?: string; isAdmin: boolean; roles: string[] } | null> {
  // The caller's token is checked by the auth service, and in parallel their effective staff roles
  // are read as themselves. Owner is the admin claim or an owner row; Ops and Finance count only
  // when the session passed the second factor (aal2), which the database decides, not this code.
  const headers = { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY };
  const [res, rolesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/my_effective_roles`, {
      method: "POST",
      headers: { ...headers, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null),
  ]);
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  // app_metadata, not user_metadata -- only settable via the service-role Admin API, never via
  // the user's own auth.updateUser() call, so an account can never grant itself this by editing
  // its own profile.
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  // If the role lookup can't be reached, fall back to the admin claim alone.
  if (rolesRes?.ok) {
    const list = await rolesRes.json().catch(() => null);
    if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
  }
  // "isAdmin" for this function means: holds one of "owner", "finance".
  return { id: user.id, email: user.email, isAdmin: roles.some((r) => ["owner", "finance"].includes(r)), roles };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const caller = await getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);

  let body: { invoiceId?: string; paidOn?: string; reference?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { invoiceId } = body;
  if (!invoiceId || !UUID.test(invoiceId)) return json({ error: "invoiceId must be a Lago invoice id" }, 400);
  const paidOn = body.paidOn && DATE.test(body.paidOn) ? body.paidOn : new Date().toISOString().slice(0, 10);
  const reference = (body.reference ?? "").trim().slice(0, 200);
  const method = (body.method ?? "bank_transfer").trim().slice(0, 50);

  const headers = { Authorization: `Bearer ${LAGO_API_KEY}`, "Content-Type": "application/json" };

  try {
    // Refuse anything that isn't a finalized, still-unpaid invoice: marking a
    // draft or voided invoice paid would corrupt the finance totals.
    const current = await fetch(`${LAGO_API_URL}/api/v1/invoices/${invoiceId}`, { headers });
    if (current.status === 404) return json({ error: "Invoice not found" }, 404);
    if (!current.ok) return json({ error: `Lago lookup failed (${current.status})` }, 502);
    const { invoice } = await current.json();
    if (invoice.status !== "finalized") return json({ error: `Invoice is ${invoice.status}, not finalized` }, 409);
    if (invoice.payment_status === "succeeded") return json({ error: "Invoice is already paid" }, 409);

    const metadata = [
      { key: "payment_method", value: method },
      { key: "paid_on", value: paidOn },
      { key: "recorded_by", value: caller.email ?? caller.id },
      ...(reference ? [{ key: "payment_reference", value: reference }] : []),
    ];

    const res = await fetch(`${LAGO_API_URL}/api/v1/invoices/${invoiceId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ invoice: { payment_status: "succeeded", metadata } }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json({ error: `Lago update failed (${res.status}): ${detail.slice(0, 300)}` }, 502);
    }
    const updated = await res.json();
    return json({ ok: true, number: updated.invoice?.number, paymentStatus: updated.invoice?.payment_status });
  } catch (err) {
    return json({ error: `Failed to record payment: ${(err as Error).message}` }, 502);
  }
});
__RESTART_FN_EOF__
ls -l /home/deno/functions/console-admin-finance /home/deno/functions/console-admin-record-payment
