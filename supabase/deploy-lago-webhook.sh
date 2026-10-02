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
ls -l /home/deno/functions/lago-webhook
