// Posts a reply into an existing support conversation on behalf of the
// caller -- a client's own message (message_type: "incoming", same as if
// they'd emailed in) or an admin's own reply (message_type: "outgoing").
// This is NOT how an agent-drafted proposal gets sent -- that's
// console-support-send, gated on is_admin and a 'proposed' row existing.
//
// POST /functions/v1/console-support-reply
// body: { conversation_id: string, body: string }  -- conversation_id is
// console.support_conversations' own row id, not Chatwoot's.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHATWOOT_API_URL = (Deno.env.get("CHATWOOT_API_URL") ?? "https://support.restart.ng").replace(/\/$/, "");
const CHATWOOT_API_ACCESS_TOKEN = Deno.env.get("CHATWOOT_API_ACCESS_TOKEN")!;
const CHATWOOT_ACCOUNT_ID = Deno.env.get("CHATWOOT_ACCOUNT_ID")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function getUser(jwt: string): Promise<{ id: string; isAdmin: boolean } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  return { id: user.id, isAdmin: Boolean(user.app_metadata?.is_admin) };
}

// Runs as the caller's own JWT -- support_conversations' RLS (member of
// that workspace, or admin) is what actually stops a client replying into
// someone else's conversation, not app code.
async function getConversationRow(jwt: string, id: string): Promise<{ chatwoot_conversation_id: number } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_conversations?id=eq.${encodeURIComponent(id)}&select=chatwoot_conversation_id`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`support_conversations lookup -> ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  let payload: { conversation_id?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!payload.conversation_id || !payload.body?.trim()) {
    return json({ error: "conversation_id and body are required" }, 400);
  }

  try {
    const row = await getConversationRow(jwt, payload.conversation_id);
    if (!row) return json({ error: "Not found" }, 404);

    const res = await fetch(
      `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${row.chatwoot_conversation_id}/messages`,
      {
        method: "POST",
        headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: payload.body.trim(),
          message_type: caller.isAdmin ? "outgoing" : "incoming",
        }),
      }
    );
    if (!res.ok) throw new Error(`Chatwoot messages -> ${res.status}: ${await res.text()}`);

    return json({ sent: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
