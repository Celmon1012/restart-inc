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
