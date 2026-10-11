#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
set -e
mkdir -p /home/deno/functions/lago-webhook
cat > /home/deno/functions/lago-webhook/index.ts <<'__RESTART_FN_EOF__'
// Lago -> console bridge: server requests, plus the billing emails.
//
// Server requests: when a client pays the Lago invoice attached to a server
// request (through the invoice's Flutterwave payment link), Lago sends
// invoice.payment_status_updated. This marks the matching
// console.server_requests row "paid" so the client sees it move and staff
// know to schedule the resize/provisioning. Nothing is provisioned here --
// that stays an engineer's step until automatic provisioning is built.
//
// Billing emails: Lago's own email scenarios are a licensed feature, and the
// console already sends mail through Resend, so the emails live here. Lago
// sends every webhook whether the invoice was raised from the console or
// directly in Lago, and the recipient is the Lago customer's own email, so
// one-off invoices created straight in Lago are covered too.
//   - invoice.generated              -> client: invoice issued, with the PDF link
//   - invoice.payment_status_updated -> client: payment received (partial or
//                                       full) + staff: payment recorded
//   - invoice.payment_overdue        -> client: invoice overdue
// Emails are best-effort: a failed send is logged and never fails the webhook
// (a 500 would make Lago retry and re-run the rest). Resend's Idempotency-Key
// stops a Lago redelivery from emailing twice.
//
// Setup (in Lago: Developers -> Webhooks):
//   - endpoint: https://<supabase-host>/functions/v1/lago-webhook
//   - signature: HMAC (not JWT)
//   - secret: set LAGO_WEBHOOK_HMAC_KEY on the edge runtime to Lago's HMAC key
// Deploy with JWT verification off for this function: Lago can't send a
// Supabase JWT, so the HMAC signature is the authentication.
//
// Zero external imports, same reason as console-data/console-billing: this
// self-hosted edge runtime re-downloads npm/esm.sh dependencies on every
// cold start. Web Crypto covers HMAC.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_KEY = Deno.env.get("LAGO_WEBHOOK_HMAC_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Billing mail has its own sender (RESEND_FROM is shared with the non-billing functions).
const BILLING_FROM = Deno.env.get("BILLING_FROM") ?? "Restart Billing <billing@restart.ng>";
// Where the "payment recorded" staff alert goes.
const BILLING_NOTIFY_EMAIL = Deno.env.get("BILLING_NOTIFY_EMAIL") ?? "billing@restart.ng";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Lago HMAC signature: base64(HMAC-SHA256(raw request body, hmac key)) in
// the X-Lago-Signature header, with X-Lago-Signature-Algorithm: hmac.
async function validSignature(raw: string, signature: string | null): Promise<boolean> {
  if (!HMAC_KEY || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(HMAC_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const expected = btoa(String.fromCharCode(...mac));
  // Constant-time comparison.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function markPaid(lagoInvoiceId: string): Promise<number> {
  const url =
    `${SUPABASE_URL}/rest/v1/server_requests` +
    `?lago_invoice_id=eq.${encodeURIComponent(lagoInvoiceId)}&status=eq.awaiting_payment`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Content-Profile": "console",
      "Accept-Profile": "console",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "paid" }),
  });
  if (!res.ok) throw new Error(`server_requests update -> ${res.status} ${await res.text()}`);
  const rows: unknown[] = await res.json();
  return rows.length;
}

// ------------------------------------------------------------------ //
// Billing emails
// ------------------------------------------------------------------ //

interface LagoInvoice {
  lago_id?: string;
  number?: string;
  status?: string;
  payment_status?: string;
  payment_due_date?: string | null;
  currency?: string;
  total_amount_cents?: number;
  total_due_amount_cents?: number;
  total_paid_amount_cents?: number;
  file_url?: string | null;
  customer?: { name?: string | null; email?: string | null };
}

function money(cents: number, currency = "NGN"): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "there";

async function sendEmail(to: string[], subject: string, text: string, idempotencyKey: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from: BILLING_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// Lago allows several comma-separated addresses on a customer.
function recipients(inv: LagoInvoice): string[] {
  return (inv.customer?.email ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

const SIGN_OFF = "Restart Inc\nbilling@restart.ng";

function issuedEmail(inv: LagoInvoice) {
  const cur = inv.currency ?? "NGN";
  const due = inv.payment_due_date ? ` Payment is due ${longDate(inv.payment_due_date)}.` : "";
  return {
    subject: `Invoice ${inv.number}: ${money(inv.total_amount_cents ?? 0, cur)}`,
    text: [
      `Hi ${firstName(inv.customer?.name)},`,
      "",
      `Invoice ${inv.number} for ${money(inv.total_amount_cents ?? 0, cur)} has been issued.${due}`,
      inv.file_url ? `\nPDF: ${inv.file_url}` : "",
      "",
      "Reply to this email with the payment reference once you've paid and we'll confirm it.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

function receivedEmail(inv: LagoInvoice) {
  const cur = inv.currency ?? "NGN";
  const total = inv.total_amount_cents ?? 0;
  const paid = inv.payment_status === "succeeded" ? total : Math.min(inv.total_paid_amount_cents ?? 0, total);
  const remaining = Math.max(total - paid, 0);
  const full = remaining === 0;
  return {
    subject: full ? `Payment received: invoice ${inv.number} is paid` : `Payment received toward invoice ${inv.number}`,
    text: [
      `Hi ${firstName(inv.customer?.name)},`,
      "",
      full
        ? `We've received ${money(paid, cur)} and invoice ${inv.number} is paid in full. Thank you.`
        : `We've received a payment toward invoice ${inv.number}. Paid so far: ${money(paid, cur)} of ${money(total, cur)}. Remaining: ${money(remaining, cur)}.`,
      inv.file_url ? `\nInvoice PDF: ${inv.file_url}` : "",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

function overdueEmail(inv: LagoInvoice) {
  const cur = inv.currency ?? "NGN";
  const due = inv.total_due_amount_cents ?? inv.total_amount_cents ?? 0;
  return {
    subject: `Overdue: invoice ${inv.number} (${money(due, cur)})`,
    text: [
      `Hi ${firstName(inv.customer?.name)},`,
      "",
      `Invoice ${inv.number} is past its due date${inv.payment_due_date ? ` of ${longDate(inv.payment_due_date)}` : ""}. Amount outstanding: ${money(due, cur)}.`,
      inv.file_url ? `\nPDF: ${inv.file_url}` : "",
      "",
      "If you've already paid, reply with the payment reference and we'll reconcile it.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

// A paid or partially paid state worth telling someone about. Failed and
// still-unpaid status updates are not emailed.
const hasPayment = (inv: LagoInvoice) => inv.payment_status === "succeeded" || (inv.total_paid_amount_cents ?? 0) > 0;

async function sendBillingEmails(type: string, inv: LagoInvoice): Promise<void> {
  if (!inv.lago_id || inv.status !== "finalized") return;
  const to = recipients(inv);
  const state = `${inv.payment_status}:${inv.total_paid_amount_cents ?? 0}`;
  const jobs: Array<Promise<void>> = [];

  if (type === "invoice.generated" && inv.payment_status !== "succeeded") {
    const m = issuedEmail(inv);
    if (to.length) jobs.push(sendEmail(to, m.subject, m.text, `lago:${type}:${inv.lago_id}`));
  } else if (type === "invoice.payment_overdue") {
    const m = overdueEmail(inv);
    if (to.length) jobs.push(sendEmail(to, m.subject, m.text, `lago:${type}:${inv.lago_id}`));
  } else if (type === "invoice.payment_status_updated" && hasPayment(inv)) {
    const m = receivedEmail(inv);
    const key = `lago:${type}:${inv.lago_id}:${state}`;
    if (to.length) jobs.push(sendEmail(to, m.subject, m.text, key));
    const cur = inv.currency ?? "NGN";
    const total = inv.total_amount_cents ?? 0;
    const paid = inv.payment_status === "succeeded" ? total : inv.total_paid_amount_cents ?? 0;
    jobs.push(
      sendEmail(
        [BILLING_NOTIFY_EMAIL],
        `Payment recorded: ${inv.number} (${money(paid, cur)} of ${money(total, cur)})`,
        [
          `${inv.customer?.name ?? "Customer"}: invoice ${inv.number}, status ${inv.payment_status}.`,
          `Paid ${money(paid, cur)} of ${money(total, cur)}.`,
          to.length ? `Client was emailed at ${to.join(", ")}.` : "No email on the Lago customer, so the client was NOT emailed.",
        ].join("\n"),
        `${key}:staff`
      )
    );
  }

  for (const r of await Promise.allSettled(jobs)) {
    if (r.status === "rejected") console.error(`lago-webhook email (${type}, ${inv.number}) failed:`, (r.reason as Error).message);
  }
}

const EMAIL_EVENTS = ["invoice.generated", "invoice.payment_status_updated", "invoice.payment_overdue"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await req.text();
  const algorithm = req.headers.get("X-Lago-Signature-Algorithm");
  if (algorithm && algorithm.toLowerCase() !== "hmac") {
    return json({ error: "Configure this webhook with HMAC signatures" }, 400);
  }
  if (!(await validSignature(raw, req.headers.get("X-Lago-Signature")))) {
    return json({ error: "Invalid signature" }, 401);
  }

  let event: { webhook_type?: string; invoice?: LagoInvoice };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const type = event.webhook_type ?? "";
  const invoice = event.invoice;

  // Acknowledge everything else so Lago doesn't retry events we don't use.
  if (!EMAIL_EVENTS.includes(type) || !invoice) return json({ ok: true, ignored: type });

  let updated = 0;
  if (type === "invoice.payment_status_updated" && invoice.lago_id && invoice.payment_status === "succeeded") {
    try {
      updated = await markPaid(invoice.lago_id);
    } catch (err) {
      // 500 so Lago retries: a transient database error shouldn't lose a payment.
      return json({ error: (err as Error).message }, 500);
    }
  }

  await sendBillingEmails(type, invoice);
  return json({ ok: true, updated });
});
__RESTART_FN_EOF__
mkdir -p /home/deno/functions/console-billing
cat > /home/deno/functions/console-billing/index.ts <<'__RESTART_FN_EOF__'
// Console billing proxy — same shape as console-data, different external
// system. A Lago API key has full access to every client's billing data
// (invoices, revenue, customer records), so it can never reach the
// browser; this function is the only thing that holds it.
//
// GET /functions/v1/console-billing?workspace_id=<id>
//
// Zero external imports, same reason as console-data: this self-hosted
// edge runtime re-downloads npm/esm.sh dependencies on every cold start
// with no caching, which hit Deno's wall-clock limit and killed the
// isolate before it ever ran. Plain fetch() avoids that entirely.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// No :3000 here -- Coolify's proxy terminates TLS on 443 for this domain and
// routes internally to the container's port 3000. Hitting :3000 directly
// bypasses the proxy and gets "connection refused" (confirmed 2026-09-17).
const LAGO_API_URL = (Deno.env.get("LAGO_API_URL") ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = Deno.env.get("LAGO_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
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

// Runs as the caller's own JWT against RLS -- this is the entire
// authorization boundary. A workspace this account can't see in
// console.workspaces (admin or member) simply comes back empty, and
// that's treated as "not found", not "forbidden", so this can't be used
// to probe which workspace ids exist.
async function getWorkspaceLagoCustomerId(jwt: string, workspaceId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=lago_customer_id`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: SUPABASE_ANON_KEY,
        "Accept-Profile": "console",
      },
    }
  );
  if (!res.ok) throw new Error(`workspace lookup -> ${res.status}`);
  const rows: Array<{ lago_customer_id: string | null }> = await res.json();
  return rows[0]?.lago_customer_id ?? null;
}

async function lagoFetch(path: string) {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${LAGO_API_KEY}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lago ${path} -> ${res.status}`);
  return res.json();
}

// Lago's Rails backend rejects a POST that declares Content-Type: application/json
// but sends no body -- confirmed 2026-09-18: this was the actual reason
// payment_url kept coming back null even after the Flutterwave provider-link
// fix, while Lago's own dashboard button (which sends "{}") worked fine.
async function lagoPost(path: string): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: unknown }> {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LAGO_API_KEY}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, error: body };
  return { ok: true, body };
}

interface LagoSubscription {
  external_id: string;
  plan_code: string;
  status: string;
  started_at: string | null;
}

interface LagoInvoice {
  lago_id: string;
  number: string;
  issuing_date: string;
  status: string;
  payment_status: string;
  total_amount_cents: number;
  // Lago tracks recorded (manual or provider) payments separately from payment_status,
  // which only flips to succeeded once the invoice is paid in full.
  total_due_amount_cents?: number;
  total_paid_amount_cents?: number;
  currency: string;
  file_url: string | null;
}

interface LagoPlan {
  name: string;
  code: string;
  amount_cents: number;
  amount_currency: string;
  interval: string;
}

interface LagoAppliedCoupon {
  coupon_name: string;
  coupon_code: string;
  status: string;
  frequency: string;
  frequency_duration: number | null;
  frequency_duration_remaining: number | null;
  percentage_rate: string | null;
  amount_cents: number | null;
  amount_currency: string | null;
}

// A pending/failed invoice needs a real checkout link, not just a PDF -- this
// is what a client actually clicks to pay. Only invoices already succeeded
// don't need one. Best-effort: if Lago can't generate a link for some reason
// (e.g. the payment provider rejects it), the invoice still shows, just
// without a "Pay Now" button, rather than failing the whole billing fetch.
async function fetchPaymentUrl(lagoInvoiceId: string): Promise<{ url: string | null; error: string | null }> {
  const result = await lagoPost(`/invoices/${encodeURIComponent(lagoInvoiceId)}/payment_url`);
  if (!result.ok) {
    return { url: null, error: `Lago ${result.status}: ${JSON.stringify(result.error)}` };
  }
  // Confirmed against Lago's actual controller/serializer source
  // (Api::V1::InvoicesController#payment_url ->
  // V1::PaymentProviders::InvoicePaymentSerializer): the response root is
  // "invoice_payment_details", not "invoice" -- the previous keys here never
  // matched anything, so this returned null even on a 200 success.
  const body = result.body as { invoice_payment_details?: { payment_url?: string } };
  return { url: body?.invoice_payment_details?.payment_url ?? null, error: null };
}

async function fetchBilling(externalCustomerId: string) {
  const [customerRes, subsRes, invoicesRes, couponsRes] = await Promise.all([
    lagoFetch(`/customers/${encodeURIComponent(externalCustomerId)}`),
    // Lago's default (no status[] filter) only returns "active" subscriptions
    // -- a scheduled/future-dated one (status "pending") silently disappears
    // otherwise, even though it's real and the client should see it coming.
    lagoFetch(
      `/subscriptions?external_customer_id=${encodeURIComponent(externalCustomerId)}&status[]=active&status[]=pending`
    ),
    lagoFetch(`/invoices?external_customer_id=${encodeURIComponent(externalCustomerId)}&per_page=20`),
    lagoFetch(`/applied_coupons?external_customer_id=${encodeURIComponent(externalCustomerId)}&status=active`),
  ]);

  const subscriptions: LagoSubscription[] = subsRes?.subscriptions ?? [];
  const invoices: LagoInvoice[] = invoicesRes?.invoices ?? [];
  const appliedCoupons: LagoAppliedCoupon[] = couponsRes?.applied_coupons ?? [];

  // Plans aren't included inline on a subscription (only plan_code is), so
  // fetch each distinct plan referenced to get its real price/interval.
  const planCodes = [...new Set(subscriptions.map((s) => s.plan_code))];
  const plans = await Promise.all(planCodes.map((code) => lagoFetch(`/plans/${encodeURIComponent(code)}`)));
  const planByCode = new Map<string, LagoPlan>(
    plans.filter((p): p is { plan: LagoPlan } => Boolean(p?.plan)).map((p) => [p.plan.code, p.plan])
  );

  // Only fetch a payment link for invoices that actually need paying --
  // no point generating one for an already-succeeded invoice.
  const paymentUrls = await Promise.all(
    invoices.map((inv) =>
      inv.payment_status === "succeeded" ? Promise.resolve({ url: null, error: null }) : fetchPaymentUrl(inv.lago_id)
    )
  );

  return {
    customer: customerRes?.customer
      ? {
          externalId: externalCustomerId,
          name: customerRes.customer.name,
          // Confirmed 2026-09-18: this lives under billing_configuration, not
          // as a top-level field -- customer.payment_provider is always
          // undefined regardless of whether a provider is actually connected.
          paymentProvider: customerRes.customer.billing_configuration?.payment_provider ?? null,
        }
      : null,
    subscriptions: subscriptions.map((s) => {
      const plan = planByCode.get(s.plan_code);
      return {
        planCode: s.plan_code,
        planName: plan?.name ?? s.plan_code,
        status: s.status,
        startedAt: s.started_at,
        amountCents: plan?.amount_cents ?? null,
        currency: plan?.amount_currency ?? null,
        interval: plan?.interval ?? null,
      };
    }),
    invoices: invoices.map((inv, i) => ({
      lagoId: inv.lago_id,
      number: inv.number,
      issuingDate: inv.issuing_date,
      status: inv.status,
      paymentStatus: inv.payment_status,
      totalAmountCents: inv.total_amount_cents,
      totalPaidAmountCents: inv.total_paid_amount_cents ?? 0,
      totalDueAmountCents: inv.total_due_amount_cents ?? inv.total_amount_cents,
      currency: inv.currency,
      fileUrl: inv.file_url,
      paymentUrl: paymentUrls[i].url,
      // Diagnostic only -- surfaces why a link failed to generate instead of
      // silently showing no "Pay Now" button with no way to tell why.
      paymentUrlError: paymentUrls[i].error,
    })),
    appliedCoupons: appliedCoupons.map((c) => ({
      name: c.coupon_name,
      code: c.coupon_code,
      status: c.status,
      frequency: c.frequency,
      durationTotal: c.frequency_duration,
      durationRemaining: c.frequency_duration_remaining,
      percentageRate: c.percentage_rate,
      amountCents: c.amount_cents,
      amountCurrency: c.amount_currency,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId) return json({ error: "workspace_id is required" }, 400);

  let lagoCustomerId: string | null;
  try {
    lagoCustomerId = await getWorkspaceLagoCustomerId(jwt, workspaceId);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  if (!lagoCustomerId) {
    // Either the workspace doesn't exist, isn't visible to this caller
    // (RLS filtered it out), or billing simply hasn't been configured for
    // it yet -- all three look identical from here, which is correct:
    // this must never reveal whether a workspace id exists.
    return json({ billingConfigured: false });
  }

  try {
    const billing = await fetchBilling(lagoCustomerId);
    return json({ billingConfigured: true, ...billing });
  } catch (err) {
    return json({ error: `Failed to load billing data: ${(err as Error).message}` }, 502);
  }
});
__RESTART_FN_EOF__
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
        add(collected, inv.currency, paid);
        add(client.collected, inv.currency, paid);
        const month = inv.issuing_date.slice(0, 7);
        if (monthly[month]) add(monthly[month], inv.currency, paid);
        if (month === thisMonth) add(collectedThisMonth, inv.currency, paid);
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

async function getUser(jwt: string): Promise<{ id: string; email?: string; isAdmin: boolean } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  return { id: user.id, email: user.email, isAdmin: Boolean(user.app_metadata?.is_admin) };
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
