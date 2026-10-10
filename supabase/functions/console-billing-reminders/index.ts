// Weekly reminders for overdue Lago invoices.
// Scheduled by pg_cron once a day (see
// supabase/migrations/20261009120000_console_billing_reminders_cron.sql).
//
// Lago sends invoice.payment_overdue once, when an invoice passes its due date
// (handled by lago-webhook). This function covers what Lago's own dunning
// would (a licensed feature): a reminder every REMINDER_INTERVAL_DAYS after the
// due date, up to REMINDER_MAX, for any invoice that is finalized, not paid in
// full and past its due date -- including one-off invoices raised directly in Lago.
//
// State lives on the invoice itself, in Lago metadata (reminder_count,
// reminder_last_sent), so there is no table to migrate. Lago's metadata update
// REPLACES the whole set, so existing entries are always sent back with their ids.
//
// Call with ?dry=1 (same x-cron-secret header) to preview without sending.
// Each run emails the client once per due invoice and sends one summary to staff.
// A partial payment shows the amount still due. The Resend Idempotency-Key
// (invoice + reminder number) stops a retried run from sending the same reminder twice.
//
// Zero external imports, same cold-start reasoning as every other function here.

const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const LAGO_API_URL = (Deno.env.get("LAGO_API_URL") ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = Deno.env.get("LAGO_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const BILLING_FROM = Deno.env.get("BILLING_FROM") ?? "Restart Billing <billing@restart.ng>";
const BILLING_NOTIFY_EMAIL = Deno.env.get("BILLING_NOTIFY_EMAIL") ?? "billing@restart.ng";
const INTERVAL_DAYS = Number(Deno.env.get("REMINDER_INTERVAL_DAYS") ?? "7");
const MAX_REMINDERS = Number(Deno.env.get("REMINDER_MAX") ?? "4");
const MAX_PAGES = 10;
const DAY_MS = 86_400_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface Meta {
  lago_id?: string;
  key: string;
  value: string;
}

interface LagoInvoice {
  lago_id: string;
  number: string;
  status: string;
  payment_status: string;
  payment_due_date?: string | null;
  currency: string;
  total_amount_cents: number;
  total_due_amount_cents?: number;
  total_paid_amount_cents?: number;
  file_url?: string | null;
  customer?: { external_id?: string | null; name?: string | null; email?: string | null };
  metadata?: Meta[];
}

const lagoHeaders = { Authorization: `Bearer ${LAGO_API_KEY}`, "Content-Type": "application/json" };

async function fetchInvoices(): Promise<LagoInvoice[]> {
  const all: LagoInvoice[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${LAGO_API_URL}/api/v1/invoices?per_page=100&page=${page}`, { headers: lagoHeaders });
    if (!res.ok) throw new Error(`Lago invoices -> ${res.status}`);
    const body = await res.json();
    all.push(...((body.invoices ?? []) as LagoInvoice[]));
    if (!body.meta?.next_page || (body.invoices ?? []).length === 0) break;
  }
  return all;
}

async function recordReminder(inv: LagoInvoice, count: number, nowIso: string) {
  const existing = inv.metadata ?? [];
  const next: Meta[] = existing.map((m) => ({ ...m }));
  const upsert = (key: string, value: string) => {
    const hit = next.find((m) => m.key === key);
    if (hit) hit.value = value;
    else next.push({ key, value });
  };
  upsert("reminder_count", String(count));
  upsert("reminder_last_sent", nowIso);
  const res = await fetch(`${LAGO_API_URL}/api/v1/invoices/${inv.lago_id}`, {
    method: "PUT",
    headers: lagoHeaders,
    // Lago keeps `id` for entries it already has and creates the ones without.
    body: JSON.stringify({
      invoice: { metadata: next.map((m) => (m.lago_id ? { id: m.lago_id, key: m.key, value: m.value } : { key: m.key, value: m.value })) },
    }),
  });
  if (!res.ok) throw new Error(`Lago metadata update ${inv.number} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

function money(cents: number, currency = "NGN"): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "there";

function recipients(inv: LagoInvoice): string[] {
  return (inv.customer?.email ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

async function sendEmail(to: string[], subject: string, text: string, idempotencyKey: string) {
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

function reminderEmail(inv: LagoInvoice, daysOverdue: number, due: number) {
  const cur = inv.currency;
  const paid = inv.total_paid_amount_cents ?? 0;
  return {
    subject: `Reminder: invoice ${inv.number} is ${daysOverdue} days overdue (${money(due, cur)})`,
    text: [
      `Hi ${firstName(inv.customer?.name)},`,
      "",
      `Invoice ${inv.number} was due on ${longDate(inv.payment_due_date!)} and is now ${daysOverdue} days overdue.`,
      paid > 0
        ? `Paid so far: ${money(paid, cur)} of ${money(inv.total_amount_cents, cur)}. Amount outstanding: ${money(due, cur)}.`
        : `Amount outstanding: ${money(due, cur)}.`,
      inv.file_url ? `\nPDF: ${inv.file_url}` : "",
      "",
      "If you've already paid, reply with the payment reference and we'll reconcile it.",
      "",
      "Restart Inc",
      "billing@restart.ng",
    ].join("\n"),
  };
}

async function run(dry: boolean) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const invoices = await fetchInvoices();
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const inv of invoices) {
    if (inv.status !== "finalized" || inv.payment_status === "succeeded" || !inv.payment_due_date) continue;
    // Breadmaker Systems bills through its own entity on this Lago (customers "bm-…") and runs its own
    // emails; same guard as lago-webhook, so its buyers never get Restart-branded reminders.
    if ((inv.customer?.external_id ?? "").startsWith("bm-")) continue;
    const due = inv.total_due_amount_cents ?? inv.total_amount_cents - (inv.total_paid_amount_cents ?? 0);
    if (due <= 0) continue;
    const dueMs = new Date(inv.payment_due_date).getTime();
    if (!(dueMs < now)) continue; // not overdue yet

    const meta = new Map((inv.metadata ?? []).map((m) => [m.key, m.value]));
    const count = Number(meta.get("reminder_count") ?? "0") || 0;
    const last = meta.get("reminder_last_sent");
    const daysOverdue = Math.floor((now - dueMs) / DAY_MS);

    // Weekly cadence anchored on the due date, then on the last reminder.
    const reference = last ? new Date(last).getTime() : dueMs;
    const wait = INTERVAL_DAYS * DAY_MS;
    if (count >= MAX_REMINDERS) { skipped.push(`${inv.number}: reached ${MAX_REMINDERS} reminders`); continue; }
    if (now - reference < wait) continue;

    const to = recipients(inv);
    if (!to.length) { skipped.push(`${inv.number}: no email on the Lago customer`); continue; }

    const m = reminderEmail(inv, daysOverdue, due);
    try {
      if (!dry) {
        await sendEmail(to, m.subject, m.text, `lago:reminder:${inv.lago_id}:${count + 1}`);
        await recordReminder(inv, count + 1, nowIso);
      }
      sent.push(`${inv.number} (${inv.customer?.name ?? "customer"}, ${money(due, inv.currency)}, reminder ${count + 1}/${MAX_REMINDERS})`);
    } catch (err) {
      failed.push(`${inv.number}: ${(err as Error).message}`);
    }
  }

  if (dry) return { dry: true, wouldSend: sent, skipped, failed };
  if (sent.length || skipped.length || failed.length) {
    const lines = [
      sent.length ? `Reminders sent (${sent.length}):\n${sent.map((s) => `- ${s}`).join("\n")}` : "",
      skipped.length ? `Not sent (${skipped.length}):\n${skipped.map((s) => `- ${s}`).join("\n")}` : "",
      failed.length ? `Failed (${failed.length}):\n${failed.map((s) => `- ${s}`).join("\n")}` : "",
    ].filter(Boolean);
    try {
      await sendEmail(
        [BILLING_NOTIFY_EMAIL],
        `Overdue reminders: ${sent.length} sent${failed.length ? `, ${failed.length} failed` : ""}`,
        lines.join("\n\n"),
        `lago:reminder-summary:${nowIso.slice(0, 10)}`
      );
    } catch (err) {
      console.error("console-billing-reminders summary failed:", (err as Error).message);
    }
  }
  return { sent: sent.length, skipped: skipped.length, failed: failed.length };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);
  try {
    // ?dry=1 lists what would be sent without emailing or recording anything.
    return json(await run(new URL(req.url).searchParams.get("dry") === "1"));
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
