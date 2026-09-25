// Lago -> console bridge for the Operate plan's server requests.
//
// When a client pays the Lago invoice attached to a server request (through
// the invoice's Flutterwave payment link), Lago sends
// invoice.payment_status_updated. This marks the matching
// console.server_requests row "paid" so the client sees it move and staff
// know to schedule the resize/provisioning. Nothing is provisioned here --
// that stays an engineer's step until automatic provisioning is built.
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

  let event: { webhook_type?: string; invoice?: { lago_id?: string; payment_status?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Acknowledge everything else so Lago doesn't retry events we don't use.
  if (event.webhook_type !== "invoice.payment_status_updated") return json({ ok: true, ignored: event.webhook_type });
  const invoice = event.invoice;
  if (!invoice?.lago_id || invoice.payment_status !== "succeeded") return json({ ok: true, ignored: "not a successful payment" });

  try {
    const updated = await markPaid(invoice.lago_id);
    return json({ ok: true, updated });
  } catch (err) {
    // 500 so Lago retries: a transient database error shouldn't lose a payment.
    return json({ error: (err as Error).message }, 500);
  }
});
