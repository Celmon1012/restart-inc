#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container (restart-backend service).
# console-admin-record-payment: Record payment on the console Invoices page. Now records a real payment of the amount received.
set -e
mkdir -p /home/deno/functions/console-admin-record-payment
cat > /home/deno/functions/console-admin-record-payment/index.ts <<'__RESTART_FN_EOF__'
// Admin-only: record an offline payment (bank transfer / direct deposit) against a Lago invoice.
//
// The payment is created through Lago's payments API for the amount actually received, so a part
// payment shows as one, the invoice's balance and its payment list in Lago stay right, and Lago
// marks the invoice paid itself once the payments cover it. If that API is not available (Lago's
// manual payments are license-gated on self-hosted builds), a payment of the full balance falls
// back to the older route: setting payment_status to "succeeded" through the invoice update API,
// with the date and reference written to the invoice's metadata. A part payment needs the API.
//
// POST /functions/v1/console-admin-record-payment
// { invoiceId: string (Lago lago_id), amountCents?: number (default: the whole balance),
//   paidOn?: "YYYY-MM-DD", reference?: string, method?: string }
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

  let body: { invoiceId?: string; amountCents?: number; paidOn?: string; reference?: string; method?: string };
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

    // What is still owing; a payment can be for all of it or part of it, never more.
    const due = Number(invoice.total_due_amount_cents ?? invoice.total_amount_cents);
    const requested = body.amountCents === undefined || body.amountCents === null ? due : Math.round(Number(body.amountCents));
    if (!Number.isFinite(requested) || requested <= 0) return json({ error: "Enter an amount greater than zero" }, 400);
    if (requested > due) return json({ error: `That is more than the ${due / 100} still owing on this invoice` }, 400);

    // First choice: a real payment record for the amount received.
    const paymentRes = await fetch(`${LAGO_API_URL}/api/v1/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        payment: {
          invoice_id: invoiceId,
          amount_cents: requested,
          reference: [reference, `recorded by ${caller.email ?? caller.id}`].filter(Boolean).join(" · ").slice(0, 250),
          paid_at: `${paidOn}T12:00:00Z`,
        },
      }),
    });
    if (paymentRes.ok) {
      const after = await fetch(`${LAGO_API_URL}/api/v1/invoices/${invoiceId}`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      return json({ ok: true, number: invoice.number, paymentStatus: after?.invoice?.payment_status ?? null, via: "payment" });
    }
    const paymentDetail = await paymentRes.text().catch(() => "");
    // The older route can only say "paid in full", so it is used only for a full payment.
    if (requested < due) {
      return json({ error: `Lago would not record the part payment (${paymentRes.status}): ${paymentDetail.slice(0, 300)}` }, 502);
    }

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
ls -l /home/deno/functions/console-admin-record-payment/index.ts
