#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
# Staff roles (Owner / Ops / Finance): console-billing, sync-lago-payment-provider.
set -e
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

async function getUser(jwt: string): Promise<{ id: string; email?: string; isAdmin: boolean; roles: string[] } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  // app_metadata, not user_metadata -- only settable via the service-role Admin API, never via
  // the user's own auth.updateUser() call, so an account can never grant itself this by editing
  // its own profile.
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  // Staff roles (owner / ops / finance) are rows in console.staff_roles; my_roles() returns the
  // caller's own. If it can't be reached, fall back to the admin claim alone (the old behaviour).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/my_roles`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    });
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
    }
  } catch {
    // keep the claim-only result
  }
  // "isAdmin" for this function means: holds one of "owner", "finance".
  return { id: user.id, email: user.email, isAdmin: roles.some((r) => ["owner", "finance"].includes(r)), roles };
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

// A slow Lago must never leave the Billing page spinning: the edge runtime kills a
// request that outlives its wall clock and the browser then waits with no answer.
// Reads give up after 10s; the payment link (an external Flutterwave call, and only a
// convenience button) after 6s, so the invoice still shows without it.
const LAGO_READ_TIMEOUT_MS = 10_000;
const LAGO_PAYMENT_URL_TIMEOUT_MS = 6_000;

// Each Lago call logs its status and time, so a slow or refused one shows up in the edge
// function logs (Coolify > supabase service > Runtime Logs) instead of as a bare "non-2xx".
async function lagoFetch(path: string) {
  const started = Date.now();
  try {
    const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${LAGO_API_KEY}` },
      signal: AbortSignal.timeout(LAGO_READ_TIMEOUT_MS),
    });
    console.log(`console-billing lago GET ${path.split("?")[0]} -> ${res.status} in ${Date.now() - started}ms`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lago ${path} -> ${res.status}`);
    return res.json();
  } catch (err) {
    console.error(`console-billing lago GET ${path.split("?")[0]} failed after ${Date.now() - started}ms: ${(err as Error).message}`);
    throw err;
  }
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
    signal: AbortSignal.timeout(LAGO_PAYMENT_URL_TIMEOUT_MS),
  });
  console.log(`console-billing lago POST ${path} -> ${res.status}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, error: body };
  return { ok: true, body };
}

interface LagoSubscription {
  external_id: string;
  plan_code: string;
  status: string;
  started_at: string | null;
  // The price of the plan this subscription actually runs on, which differs from the
  // catalog plan when a per-customer override applies.
  plan_amount_cents?: number;
  plan_amount_currency?: string;
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
  const result = await lagoPost(`/invoices/${encodeURIComponent(lagoInvoiceId)}/payment_url`).catch(
    (err): { ok: false; status: number; error: unknown } => ({ ok: false, status: 0, error: (err as Error).message })
  );
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
        amountCents: s.plan_amount_cents ?? plan?.amount_cents ?? null,
        currency: s.plan_amount_currency ?? plan?.amount_currency ?? null,
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
    console.error(`console-billing failed: ${(err as Error).message}`);
    return json({ error: `Failed to load billing data: ${(err as Error).message}` }, 502);
  }
});
__RESTART_FN_EOF__
mkdir -p /home/deno/functions/sync-lago-payment-provider
cat > /home/deno/functions/sync-lago-payment-provider/index.ts <<'__RESTART_FN_EOF__'
// Admin-only fix for a real gap in Lago's Flutterwave community connector:
// selecting a provider in the customer edit UI saves customer.payment_provider
// (a plain field) but never creates the underlying PaymentProviderCustomer
// link record that Invoices::Payments::GeneratePaymentUrlService actually
// checks -- so "Open payment link" fails with "not linked to a valid payment
// provider" even though the customer looks fully configured.
//
// Confirmed by reading Lago's own source (getlago/lago-api,
// app/services/customers/upsert_from_api_service.rb): the link is only
// created when billing_configuration.sync_with_provider is explicitly true.
// There's no toggle for this in the dashboard UI for the Flutterwave
// connector, so this has to be done via a direct API call -- this function
// is that call, reusable for any customer/provider, not just YATA/Flutterwave.
//
// POST /functions/v1/sync-lago-payment-provider
//   body: { externalCustomerId: string, paymentProvider?: string, paymentProviderCode?: string }
//   defaults: paymentProvider "flutterwave", paymentProviderCode "flutterwave"
//   (the code is whatever the Flutterwave integration is called in Lago -- it changes if the
//   integration is deleted and re-added, so pass paymentProviderCode if yours differs)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LAGO_API_URL = (Deno.env.get("LAGO_API_URL") ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = Deno.env.get("LAGO_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function getUser(jwt: string): Promise<{ id: string; email?: string; isAdmin: boolean; roles: string[] } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  // app_metadata, not user_metadata -- only settable via the service-role Admin API, never via
  // the user's own auth.updateUser() call, so an account can never grant itself this by editing
  // its own profile.
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  // Staff roles (owner / ops / finance) are rows in console.staff_roles; my_roles() returns the
  // caller's own. If it can't be reached, fall back to the admin claim alone (the old behaviour).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/my_roles`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    });
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
    }
  } catch {
    // keep the claim-only result
  }
  // "isAdmin" for this function means: holds one of "owner", "finance".
  return { id: user.id, email: user.email, isAdmin: roles.some((r) => ["owner", "finance"].includes(r)), roles };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (!caller.isAdmin) return json({ error: "Forbidden -- admin only" }, 403);

  let body: { externalCustomerId?: string; paymentProvider?: string; paymentProviderCode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const externalCustomerId = body.externalCustomerId;
  if (!externalCustomerId) return json({ error: "externalCustomerId is required" }, 400);

  const paymentProvider = body.paymentProvider ?? "flutterwave";
  const paymentProviderCode = body.paymentProviderCode ?? "flutterwave";

  // Lago's customers resource only registers create/index/show/destroy --
  // there's no PUT/update route. An update is POST to the collection
  // endpoint, upserted by external_id in the body (Customers::UpsertFromApiService).
  const res = await fetch(`${LAGO_API_URL}/api/v1/customers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LAGO_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: {
        external_id: externalCustomerId,
        billing_configuration: {
          payment_provider: paymentProvider,
          payment_provider_code: paymentProviderCode,
          sync_with_provider: true,
          // Without this, PaymentProviders::CreateCustomerFactory runs
          // async (a background job) -- confirmed 2026-09-18: the first
          // attempt returned 200 but the link still didn't exist moments
          // later. Forcing sync so a real failure shows up here instead of
          // disappearing into a queue.
          sync: true,
        },
      },
    }),
  });

  const responseBody = await res.json().catch(() => null);

  if (!res.ok) {
    return json({ error: "Lago rejected the sync request", status: res.status, lagoResponse: responseBody }, 502);
  }

  return json({
    synced: true,
    paymentProvider: responseBody?.customer?.billing_configuration?.payment_provider ?? null,
    note: "If this succeeded, the customer's provider-customer link should now exist. Re-check console-billing or Lago's 'Open payment link' to confirm.",
    lagoResponse: responseBody,
  });
});
__RESTART_FN_EOF__
ls -l /home/deno/functions/console-billing /home/deno/functions/sync-lago-payment-provider
