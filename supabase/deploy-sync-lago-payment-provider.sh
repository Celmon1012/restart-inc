#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
set -e
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
ls -l /home/deno/functions/sync-lago-payment-provider
