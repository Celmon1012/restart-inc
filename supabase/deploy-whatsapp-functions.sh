#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
# Writes console-whatsapp-webhook (new) and console-inquiry-notify (updated).
set -e
mkdir -p /home/deno/functions/console-whatsapp-webhook
cat > /home/deno/functions/console-whatsapp-webhook/index.ts <<'__RESTART_FN_EOF__'
// Inbound WhatsApp messages from Restart's Evolution API instance.
//
// Evolution API calls this for every event on the instance (configure the
// webhook with only MESSAGES_UPSERT enabled). For each incoming text from
// a lead's number it:
//
//   - handles STOP: turns WhatsApp off for every inquiry and draft with
//     that number, records when, and confirms once;
//   - otherwise records the message on that lead's timeline in Leads, so a
//     reply on WhatsApp is seen next to the brief it's about.
//
// Replying is done by a person, from WhatsApp itself or from Chatwoot if
// Evolution's Chatwoot integration is on. Nothing here answers
// automatically except the STOP confirmation.
//
// Evolution doesn't sign its webhooks, so the URL carries a shared secret:
//   https://<supabase-host>/functions/v1/console-whatsapp-webhook?secret=<WHATSAPP_WEBHOOK_SECRET>
// A request without the right secret gets a 401 and touches nothing.
//
// Messages from numbers that aren't a lead are ignored: this function only
// ever writes to leads that gave us that number themselves.
//
// Zero external imports, same cold-start reasoning as every other function
// here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET") ?? "";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "";

const STOP_WORDS = new Set(["STOP", "STOP WHATSAPP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT", "CANCEL", "QUIT", "END"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function pg(path: string, init: RequestInit & { profile?: "read" | "write" } = {}) {
  const { profile = "read", ...rest } = init;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      [profile === "write" ? "Content-Profile" : "Accept-Profile"]: "console",
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`PostgREST ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Constant-time comparison, so the secret can't be recovered by timing.
function secretMatches(given: string | null) {
  if (!WEBHOOK_SECRET || !given || given.length !== WEBHOOK_SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ WEBHOOK_SECRET.charCodeAt(i);
  return diff === 0;
}

interface EvolutionMessage {
  key?: {
    remoteJid?: string;
    remoteJidAlt?: string;
    senderPn?: string;
    fromMe?: boolean;
    id?: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
  };
  messageType?: string;
}

// WhatsApp may address a chat by a privacy id ("...@lid") instead of the
// phone number. Evolution then carries the real number in remoteJidAlt or
// senderPn, depending on version.
function senderPhone(msg: EvolutionMessage): string | null {
  const candidates = [msg.key?.remoteJid, msg.key?.remoteJidAlt, msg.key?.senderPn];
  for (const jid of candidates) {
    if (jid && jid.endsWith("@s.whatsapp.net")) {
      const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    }
  }
  return null;
}

function messageText(msg: EvolutionMessage): string {
  return (msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? "").trim();
}

async function sendWhatsApp(phone: string, text: string) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) return;
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
    method: "POST",
    headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone.replace(/\D/g, ""), text, delay: 1000 }),
  });
}

async function handleMessage(msg: EvolutionMessage) {
  if (msg.key?.fromMe) return "own message";
  const phone = senderPhone(msg);
  if (!phone) return "no phone (group, status or unresolved id)";

  const leads: Array<{ id: string; whatsapp_opt_in: boolean; whatsapp_opted_out_at: string | null }> = await pg(
    `inquiries?phone=eq.${encodeURIComponent(phone)}&select=id,whatsapp_opt_in,whatsapp_opted_out_at&order=created_at.desc&limit=20`
  );
  if (!leads?.length) return "not a lead";
  const latest = leads[0];

  const text = messageText(msg);
  const isStop = STOP_WORDS.has(text.toUpperCase().replace(/[^A-Z ]/g, "").trim());

  if (isStop) {
    const now = new Date().toISOString();
    const alreadyOut = leads.every((l) => l.whatsapp_opted_out_at);
    await pg(`inquiries?phone=eq.${encodeURIComponent(phone)}`, {
      method: "PATCH",
      profile: "write",
      body: JSON.stringify({ whatsapp_opt_in: false, whatsapp_opted_out_at: now }),
    });
    await pg(`inquiry_drafts?phone=eq.${encodeURIComponent(phone)}`, {
      method: "PATCH",
      profile: "write",
      body: JSON.stringify({ whatsapp_opt_in: false }),
    });
    await pg("inquiry_activities", {
      method: "POST",
      profile: "write",
      body: JSON.stringify({
        inquiry_id: latest.id,
        actor: "agent",
        activity_type: "whatsapp_received",
        body: "Replied STOP on WhatsApp. WhatsApp turned off for this number.",
        payload: { from: phone, text, message_id: msg.key?.id ?? null },
      }),
    });
    if (!alreadyOut) {
      await sendWhatsApp(phone, "Done. You won't get any more WhatsApp messages from Restart. Email still reaches us at hello@restart.ng.").catch(
        () => {}
      );
    }
    return "stop";
  }

  const kind = msg.messageType && !["conversation", "extendedTextMessage"].includes(msg.messageType)
    ? msg.messageType
    : null;
  await pg("inquiry_activities", {
    method: "POST",
    profile: "write",
    body: JSON.stringify({
      inquiry_id: latest.id,
      actor: "agent",
      activity_type: "whatsapp_received",
      body: text ? `WhatsApp from ${msg.pushName || phone}: ${text.slice(0, 2000)}` : `WhatsApp ${kind ?? "message"} from ${msg.pushName || phone} (not text; open WhatsApp to see it).`,
      payload: { from: phone, text: text.slice(0, 4000), type: msg.messageType ?? null, message_id: msg.key?.id ?? null },
    }),
  });
  return "logged";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = new URL(req.url);
  if (!secretMatches(url.searchParams.get("secret"))) return json({ error: "Unauthorized" }, 401);

  let payload: { event?: string; data?: EvolutionMessage | EvolutionMessage[] | { messages?: EvolutionMessage[] } };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // "messages.upsert" in v2; "MESSAGES_UPSERT" when webhook-by-events is on.
  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return json({ ignored: payload.event ?? "unknown" });

  const data = payload.data;
  const messages: EvolutionMessage[] = Array.isArray(data)
    ? data
    : data && "messages" in data && Array.isArray(data.messages)
      ? data.messages
      : data
        ? [data as EvolutionMessage]
        : [];

  const results: string[] = [];
  try {
    for (const msg of messages) results.push(await handleMessage(msg));
  } catch (err) {
    // 200 anyway: a retry storm from Evolution wouldn't fix a database error.
    return json({ error: (err as Error).message.slice(0, 300) });
  }
  return json({ results });
});
__RESTART_FN_EOF__
echo "console-whatsapp-webhook written"
mkdir -p /home/deno/functions/console-inquiry-notify
cat > /home/deno/functions/console-inquiry-notify/index.ts <<'__RESTART_FN_EOF__'
// Acknowledgements and resume reminders for the public lead forms.
// Scheduled by pg_cron every 10 minutes (see
// supabase/migrations/20260929120000_console_inquiry_followup.sql).
//
// Two jobs, in this order:
//
//   1. Acknowledge. Every new Start a Project brief or scorecard lead gets
//      one email: their reference, what happens next, and a WhatsApp
//      tap-to-chat link. A scorecard lead also gets a draft brief created
//      for them, prefilled with their result, and a link to continue it.
//   2. Remind. A Start a Project draft that was started and left gets at
//      most two reminders (24h after the last edit, then 48h after the
//      first reminder), each with a link back to where they stopped and a
//      one-click way to stop reminders.
//
// Unlike console-agent-run, this function sends without an admin approving
// each message. That's deliberate and narrow: both messages are fixed
// templates the visitor triggered themselves by using the form, carry no
// judgement about the lead, and are sent at most once (acknowledgement) or
// twice (reminders) per visitor. Anything that reads the lead and decides
// what to say stays with the agent's proposal queue.
//
// Every send is claimed first (a conditional PATCH that only one run can
// win) and only then emailed, so a slow run overlapping the next never sends
// the same message twice. The cost is that a failed send is not retried --
// the right trade for email to a prospect. Failures are logged on the lead's
// timeline.
//
// WhatsApp: every email carries a wa.me link the lead can tap. Leads who
// ticked the WhatsApp opt-in also get the acknowledgement as a WhatsApp
// message, sent through Restart's self-hosted Evolution API instance. That
// is the only WhatsApp message this function sends -- reminders stay
// email-only, and a STOP reply (console-whatsapp-webhook) turns it off.
// If the EVOLUTION_* variables aren't set, WhatsApp is skipped and email
// carries on unchanged.
//
// Zero external imports, same cold-start reasoning as every other function
// here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Restart Inc <hello@restart.ng>";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://restart.ng").replace(/\/$/, "");
const WHATSAPP_NUMBER = Deno.env.get("WHATSAPP_NUMBER") ?? "2349060114747";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "";
const WHATSAPP_ENABLED = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);

const ACK_SOURCES = ["start_project_page", "scorecard"];
const MAX_PER_RUN = 20;
const FIRST_NUDGE_AFTER_HOURS = 24;
const SECOND_NUDGE_AFTER_HOURS = 48;
// A draft nobody touched for two weeks is not worth a reminder.
const DRAFT_MAX_AGE_DAYS = 14;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function pg(path: string, init: RequestInit & { profile?: "read" | "write" } = {}) {
  const { profile = "read", ...rest } = init;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      [profile === "write" ? "Content-Profile" : "Accept-Profile"]: "console",
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`PostgREST ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend -> ${res.status}: ${await res.text()}`);
}

// Evolution API v2: POST /message/sendText/{instance}. `delay` shows the
// lead a "typing..." state for that long first, which also keeps the send
// from looking like a burst.
async function sendWhatsApp(phone: string, text: string) {
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
    method: "POST",
    headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone.replace(/\D/g, ""), text, delay: 1500 }),
  });
  if (!res.ok) throw new Error(`Evolution API -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function logActivity(
  inquiryId: string,
  body: string,
  payload: Record<string, unknown>,
  activityType: "email_sent" | "whatsapp_sent" | "note" = "email_sent"
) {
  await pg("inquiry_activities", {
    method: "POST",
    profile: "write",
    body: JSON.stringify({ inquiry_id: inquiryId, actor: "agent", activity_type: activityType, body, payload }),
  });
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function whatsappLink(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function resumeLink(token: string) {
  return `${SITE_URL}/start-project?resume=${token}`;
}

// ------------------------------------------------------------------ //
// 1. Acknowledgements
// ------------------------------------------------------------------ //

interface InquiryRow {
  id: string;
  reference_id: string;
  source: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  whatsapp_opted_out_at: string | null;
  scorecard: {
    score?: number;
    band?: string;
    weakest_detail?: Array<{ title: string; pct: number; fix: string }>;
  } | null;
}

function projectAck(inq: InquiryRow) {
  const subject = `We have your brief (${inq.reference_id})`;
  const text = [
    `Hi ${firstName(inq.name)},`,
    "",
    `Your project brief reached us. Reference: ${inq.reference_id}.`,
    "",
    "A senior engineer reads it within one business day and replies with whether there's a fit and the first concrete step. If it isn't a fit, we'll say so.",
    "",
    "Anything to add in the meantime, reply to this email, or message us on WhatsApp:",
    whatsappLink(`Hi Restart, following up on my project brief ${inq.reference_id}.`),
    "",
    "Restart Inc",
    SITE_URL.replace(/^https?:\/\//, ""),
  ].join("\n");
  return { subject, text };
}

function scorecardAck(inq: InquiryRow, token: string | null) {
  const sc = inq.scorecard ?? {};
  const score = typeof sc.score === "number" ? sc.score : null;
  const subject = score !== null ? `Your Readiness Score: ${score}/100` : `We have your scorecard (${inq.reference_id})`;
  const weakest = (sc.weakest_detail ?? []).slice(0, 2);
  const text = [
    `Hi ${firstName(inq.name)},`,
    "",
    score !== null ? `Your Readiness Score is ${score}/100${sc.band ? ` (${sc.band})` : ""}.` : "Your scorecard result reached us.",
    ...(weakest.length
      ? ["", "Where to start:", ...weakest.flatMap((w) => ["", `${w.title}: ${w.pct}%`, w.fix])]
      : []),
    "",
    `A senior engineer will look at your result and reply with what we'd fix first. Reference: ${inq.reference_id}.`,
    ...(token
      ? [
          "",
          "If you want a proper answer rather than a general one, the project brief takes about three minutes. Your details and score are already filled in:",
          resumeLink(token),
        ]
      : []),
    "",
    "Or message us on WhatsApp:",
    whatsappLink(`Hi Restart, I just took the Readiness Scorecard (${inq.reference_id}).`),
    "",
    "Restart Inc",
    SITE_URL.replace(/^https?:\/\//, ""),
  ].join("\n");
  return { subject, text };
}

// The WhatsApp version is short on purpose: the email carries the detail
// and the links, this says it arrived and that a person is on the other end.
function whatsappAck(inq: InquiryRow) {
  const lines = [`Hi ${firstName(inq.name)}, this is Restart.`, ""];
  const sc = inq.scorecard ?? {};
  if (inq.source === "scorecard" && typeof sc.score === "number") {
    const weakest = sc.weakest_detail?.[0];
    lines.push(
      `Your Readiness Score is ${sc.score}/100${weakest ? `, and the weakest area is ${weakest.title} (${weakest.pct}%)` : ""}.`,
      `We've emailed ${inq.email} the first fix for each weak area, plus a link to turn it into a project brief.`
    );
  } else {
    lines.push(
      `We have your project brief (${inq.reference_id}). A senior engineer reads it within one business day and replies by email.`
    );
  }
  lines.push("", "If it's easier to talk it through, reply here. A person answers.", "", "Reply STOP to stop WhatsApp messages from us.");
  return lines.join("\n");
}

// A scorecard lead gets a draft brief made for them, so the link in their
// email opens Start a Project with their contact details and result already
// in place. No reminders on it: max_nudges = 0.
async function createScorecardDraft(inq: InquiryRow): Promise<string | null> {
  const sc = inq.scorecard ?? {};
  const weakest = (sc.weakest_detail ?? []).map((w) => w.title).join(", ");
  const brief =
    typeof sc.score === "number"
      ? `Readiness Scorecard: ${sc.score}/100.${weakest ? ` Weakest areas: ${weakest}.` : ""}\n\n`
      : "";
  try {
    const rows = await pg("inquiry_drafts", {
      method: "POST",
      profile: "write",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        origin: "scorecard",
        name: inq.name,
        email: inq.email,
        company: inq.company,
        phone: inq.phone,
        whatsapp_opt_in: inq.whatsapp_opt_in,
        last_step: 2,
        max_nudges: 0,
        payload: { projectBrief: brief },
      }),
    });
    return rows?.[0]?.resume_token ?? null;
  } catch {
    // The acknowledgement is worth sending without the link.
    return null;
  }
}

async function runAcknowledgements() {
  const candidates: InquiryRow[] = await pg(
    `inquiries?ack_sent_at=is.null&source=in.(${ACK_SOURCES.join(",")})` +
      `&select=id,reference_id,source,name,email,company,phone,whatsapp_opt_in,whatsapp_opted_out_at,scorecard` +
      `&order=created_at.asc&limit=${MAX_PER_RUN}`
  );
  let sent = 0;
  for (const inq of candidates) {
    const claimed = await pg(`inquiries?id=eq.${inq.id}&ack_sent_at=is.null`, {
      method: "PATCH",
      profile: "write",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ack_sent_at: new Date().toISOString() }),
    });
    if (!claimed?.length) continue;

    const token = inq.source === "scorecard" ? await createScorecardDraft(inq) : null;
    const { subject, text } = inq.source === "scorecard" ? scorecardAck(inq, token) : projectAck(inq);
    try {
      await sendEmail(inq.email, subject, text);
      await logActivity(inq.id, "Acknowledgement email sent automatically.", { subject, body: text });
      sent++;
    } catch (err) {
      await pg("inquiry_activities", {
        method: "POST",
        profile: "write",
        body: JSON.stringify({
          inquiry_id: inq.id,
          actor: "agent",
          activity_type: "note",
          body: `Acknowledgement email failed and was not retried: ${(err as Error).message.slice(0, 500)}`,
        }),
      }).catch(() => {});
    }

    // Same claim covers WhatsApp: one attempt, never retried.
    if (WHATSAPP_ENABLED && inq.whatsapp_opt_in && inq.phone && !inq.whatsapp_opted_out_at) {
      const message = whatsappAck(inq);
      try {
        await sendWhatsApp(inq.phone, message);
        await logActivity(inq.id, "Acknowledgement sent on WhatsApp automatically.", { to: inq.phone, text: message }, "whatsapp_sent");
      } catch (err) {
        await logActivity(
          inq.id,
          `WhatsApp acknowledgement failed and was not retried: ${(err as Error).message.slice(0, 500)}`,
          { to: inq.phone },
          "note"
        ).catch(() => {});
      }
    }
  }
  return sent;
}

// ------------------------------------------------------------------ //
// 2. Reminders for abandoned drafts
// ------------------------------------------------------------------ //

interface DraftRow {
  id: string;
  resume_token: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  last_step: number;
  nudges_sent: number;
  max_nudges: number;
  last_nudged_at: string | null;
}

const STEP_LABELS: Record<number, string> = {
  1: "your contact details",
  2: "the situation",
  3: "the stakes",
  4: "scope and timing",
};

function reminder(draft: DraftRow) {
  const link = resumeLink(draft.resume_token);
  const stop = `${link}&stop=1`;
  const second = draft.nudges_sent >= 1;
  const subject = second ? "Your project brief is still saved" : "Pick up your project brief where you left off";
  const text = [
    `Hi ${firstName(draft.name)},`,
    "",
    second
      ? "Last note on this. Your project brief is still saved, and the link below opens it where you stopped."
      : `You started a project brief with us and stopped at ${STEP_LABELS[draft.last_step] ?? "an early step"}. Everything you entered is saved.`,
    "",
    `Continue: ${link}`,
    "",
    "A senior engineer reads every finished brief within one business day. If it's easier to talk it through, message us on WhatsApp:",
    whatsappLink("Hi Restart, I started a project brief on your site and would rather talk it through."),
    "",
    `Not the right time? Stop these reminders: ${stop}`,
    "",
    "Restart Inc",
    SITE_URL.replace(/^https?:\/\//, ""),
  ].join("\n");
  return { subject, text };
}

async function runReminders() {
  const now = Date.now();
  const firstCutoff = new Date(now - FIRST_NUDGE_AFTER_HOURS * 3600_000).toISOString();
  const secondCutoff = new Date(now - SECOND_NUDGE_AFTER_HOURS * 3600_000).toISOString();
  const oldest = new Date(now - DRAFT_MAX_AGE_DAYS * 86400_000).toISOString();

  const candidates: DraftRow[] = await pg(
    `inquiry_drafts?submitted_at=is.null&followups_stopped_at=is.null&created_at=gte.${oldest}` +
      `&or=(and(nudges_sent.eq.0,updated_at.lt.${firstCutoff}),and(nudges_sent.eq.1,last_nudged_at.lt.${secondCutoff}))` +
      `&select=id,resume_token,created_at,updated_at,name,email,last_step,nudges_sent,max_nudges,last_nudged_at` +
      `&order=updated_at.asc&limit=${MAX_PER_RUN}`
  );

  let sent = 0;
  for (const draft of candidates) {
    if (draft.nudges_sent >= draft.max_nudges) continue;

    // Sent the brief some other way (another device, the scorecard, the
    // contact page) after starting this draft? Then it's done, not abandoned.
    const later = await pg(
      `inquiries?email=ilike.${encodeURIComponent(draft.email.replace(/[%_*]/g, ""))}&created_at=gte.${draft.created_at}&select=id&limit=1`
    );
    if (later?.length) {
      await pg(`inquiry_drafts?id=eq.${draft.id}`, {
        method: "PATCH",
        profile: "write",
        body: JSON.stringify({ followups_stopped_at: new Date().toISOString() }),
      });
      continue;
    }

    const claimed = await pg(`inquiry_drafts?id=eq.${draft.id}&nudges_sent=eq.${draft.nudges_sent}&submitted_at=is.null`, {
      method: "PATCH",
      profile: "write",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ nudges_sent: draft.nudges_sent + 1, last_nudged_at: new Date().toISOString() }),
    });
    if (!claimed?.length) continue;

    const { subject, text } = reminder(draft);
    try {
      await sendEmail(draft.email, subject, text);
      sent++;
    } catch {
      // Claimed and not retried, same as acknowledgements. There's no lead
      // timeline for a draft to log against.
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const acknowledged = await runAcknowledgements();
    const reminded = await runReminders();
    return json({ acknowledged, reminded });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
__RESTART_FN_EOF__
echo "console-inquiry-notify written"
