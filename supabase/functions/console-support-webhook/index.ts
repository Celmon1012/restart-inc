// Receives Chatwoot's message_created webhook and lets the follow-up
// agent react to a new client message -- the third domain it works in,
// after leads (console-agent-run) and deliverables (same function).
//
// Like console-agent-run, this has no user session to authenticate with
// (Chatwoot is the caller, not a browser), so it checks a shared secret
// instead of a JWT -- here a `?secret=` query param on the registered
// webhook URL, since Chatwoot's own webhook signing isn't documented
// clearly enough to implement confidently. It also runs under the
// service-role key for the same reason console-agent-run does: there's no
// admin session to forward.
//
// Same trust boundary as everywhere else: an internal note posts to
// Chatwoot immediately (private:true is already staff-only by
// construction there), but a client-facing reply is only ever stored as a
// 'proposed' row in console.support_proposals -- console-support-send
// (running under a real admin's own JWT) is the only thing that can turn
// it into an actual outgoing message.
//
// v1 scope: only engages when the incoming message's conversation already
// has a console.support_conversations row -- i.e. it was opened through
// console. A message on some other Chatwoot conversation (e.g. someone
// emailing support@ directly with no workspace context) is left alone.
//
// NOTE ON PAYLOAD SHAPE: Chatwoot's message_created webhook payload isn't
// precisely documented in its public API reference at the time this was
// written. This reads `conversation.id` / `conversation_id`, `content`,
// `message_type` (accepting either the string "incoming" or legacy
// numeric 0), and `private` defensively. If Chatwoot's actual payload
// differs, check this function's logs after a real webhook delivery and
// adjust the field reads below -- the rest of the logic doesn't change.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CHATWOOT_WEBHOOK_SECRET = Deno.env.get("CHATWOOT_WEBHOOK_SECRET")!;
const CHATWOOT_API_URL = (Deno.env.get("CHATWOOT_API_URL") ?? "https://support.restart.ng").replace(/\/$/, "");
const CHATWOOT_API_ACCESS_TOKEN = Deno.env.get("CHATWOOT_API_ACCESS_TOKEN")!;
const CHATWOOT_ACCOUNT_ID = Deno.env.get("CHATWOOT_ACCOUNT_ID")!;
const MODEL = "claude-sonnet-5";

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

async function chatwootGet(path: string) {
  const res = await fetch(`${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}${path}`, {
    headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN },
  });
  if (!res.ok) throw new Error(`Chatwoot ${path} -> ${res.status}`);
  return res.json();
}

async function chatwootPostMessage(chatwootConversationId: number, content: string, options: { private: boolean }) {
  const res = await fetch(
    `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${chatwootConversationId}/messages`,
    {
      method: "POST",
      headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ content, message_type: "outgoing", private: options.private }),
    }
  );
  if (!res.ok) throw new Error(`Chatwoot messages -> ${res.status}: ${await res.text()}`);
}

const TOOLS = [
  {
    name: "add_internal_note",
    description: "Leave a private note on this conversation for staff. Internal-only -- posts immediately, never visible to the client.",
    input_schema: { type: "object", properties: { note: { type: "string" } }, required: ["note"] },
  },
  {
    name: "draft_reply",
    description:
      "Draft a reply to the client. Client-facing -- this NEVER sends anything. It creates a proposal an admin must review, edit if needed, and approve before it's actually posted.",
    input_schema: { type: "object", properties: { body: { type: "string" } }, required: ["body"] },
  },
];

const SYSTEM_PROMPT = `You are Restart Inc's support assistant, looking at one conversation on the support desk after the client just sent a new message.

Restart Inc builds and operates infrastructure and AI engineering work for clients.

You may call zero or more tools:
- add_internal_note happens immediately -- staff has already authorized this routine action. Use it for things staff should know (e.g. "this sounds like a billing question" or "they're reporting an outage").
- draft_reply only ever creates a suggestion for a human to review, edit, and send -- never call it if a reply was already proposed and hasn't been rejected. Never promise something you don't actually know (uptime, refunds, timelines) -- if the answer requires real account detail, draft a note instead asking staff to confirm before anything goes to the client.

Be conservative: if the message doesn't need a note or a reply yet (e.g. staff is already actively replying), call no tools at all.`;

function extractIncomingMessage(payload: any): { chatwootConversationId: number; content: string } | null {
  const messageType = payload.message_type;
  const isIncoming = messageType === "incoming" || messageType === 0;
  if (!isIncoming || payload.private) return null;

  const conversationId = payload.conversation?.id ?? payload.conversation_id;
  const content = payload.content;
  if (!conversationId || !content) return null;

  return { chatwootConversationId: conversationId, content };
}

Deno.serve(async (req) => {
  if (new URL(req.url).searchParams.get("secret") !== CHATWOOT_WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (payload.event !== "message_created") {
    return json({ ignored: true });
  }

  const incoming = extractIncomingMessage(payload);
  if (!incoming) return json({ ignored: true });

  try {
    const rows = await pg(
      `support_conversations?chatwoot_conversation_id=eq.${incoming.chatwootConversationId}&select=id`
    );
    const conversationRow = rows[0];
    if (!conversationRow) return json({ ignored: true, reason: "not a console-originated conversation" });

    const pending = await pg(
      `support_proposals?conversation_id=eq.${conversationRow.id}&status=eq.proposed&select=id&limit=1`
    );
    if (pending.length > 0) return json({ skipped: true, reason: "proposal already pending" });

    const conversation = await chatwootGet(`/conversations/${incoming.chatwootConversationId}`);
    const recentMessages = (conversation.messages ?? []).slice(-10).map((m: any) => ({
      from: m.message_type === "incoming" ? "client" : "restart",
      private: Boolean(m.private),
      content: m.content,
    }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: [{ role: "user", content: JSON.stringify({ recent_messages: recentMessages }) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic -> ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const toolCalls = (data.content ?? []).filter((block: { type: string }) => block.type === "tool_use");

    let actionsCreated = 0;
    for (const call of toolCalls) {
      if (call.name === "add_internal_note") {
        await chatwootPostMessage(incoming.chatwootConversationId, String(call.input.note ?? ""), { private: true });
        actionsCreated++;
      } else if (call.name === "draft_reply") {
        await pg("support_proposals", {
          method: "POST",
          profile: "write",
          body: JSON.stringify({ conversation_id: conversationRow.id, body: String(call.input.body ?? "") }),
        });
        actionsCreated++;
      }
    }

    return json({ actionsCreated });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
