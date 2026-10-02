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
