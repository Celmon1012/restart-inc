// Posts a reply into an existing support conversation on behalf of the
// caller -- a client's own message, or an admin's own reply. This is NOT
// how an agent-drafted proposal gets sent -- that's console-support-send,
// gated on is_admin and a 'proposed' row existing.
//
// POST /functions/v1/console-support-reply
// body: { conversation_id: string, body: string }  -- conversation_id is
// console.support_conversations' own row id, not Chatwoot's.
//
// Two different Chatwoot APIs, same reasoning as console-support-create:
// an admin's reply is a genuine agent action (Application API,
// message_type: "outgoing"); a member's reply has to go through the
// Client API (inbox_identifier + the conversation's stored
// chatwoot_source_id) to actually persist as a real incoming message --
// the Application API's create-message endpoint doesn't honor
// message_type: "incoming" no matter what you pass it.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHATWOOT_API_URL = (Deno.env.get("CHATWOOT_API_URL") ?? "https://support.restart.ng").replace(/\/$/, "");
const CHATWOOT_API_ACCESS_TOKEN = Deno.env.get("CHATWOOT_API_ACCESS_TOKEN")!;
const CHATWOOT_ACCOUNT_ID = Deno.env.get("CHATWOOT_ACCOUNT_ID")!;
const CHATWOOT_INBOX_IDENTIFIER = Deno.env.get("CHATWOOT_INBOX_IDENTIFIER")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function getUser(jwt: string): Promise<{ id: string; email?: string; isAdmin: boolean; roles: string[] } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  // app_metadata, not user_metadata -- only settable via the service-role Admin API, never via
  // the user's own auth.updateUser() call, so an account can never grant itself this by editing
  // its own profile.
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  // Staff roles (owner / ops / finance) are rows in console.staff_roles; my_roles() returns the
  // caller's own. If it can't be reached, fall back to the admin claim alone (the old behaviour).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/my_roles`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    });
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
    }
  } catch {
    // keep the claim-only result
  }
  // "isAdmin" for this function means: holds one of "owner", "ops".
  return { id: user.id, email: user.email, isAdmin: roles.some((r) => ["owner", "ops"].includes(r)), roles };
}

// Runs as the caller's own JWT -- support_conversations' RLS (member of
// that workspace, or admin) is what actually stops a client replying into
// someone else's conversation, not app code.
interface ConversationRow {
  chatwoot_conversation_id: number;
  chatwoot_source_id: string | null;
}

async function getConversationRow(jwt: string, id: string): Promise<ConversationRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_conversations?id=eq.${encodeURIComponent(id)}&select=chatwoot_conversation_id,chatwoot_source_id`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`support_conversations lookup -> ${res.status}`);
  const rows: ConversationRow[] = await res.json();
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

  // Admin-only extras, used by the admin Support Desk:
  //   private: true   -> post as a Chatwoot private note (staff-only by construction)
  //   status: "open" | "pending" | "resolved" -> toggle the conversation's status;
  //                      body is optional when only changing status
  let payload: { conversation_id?: string; body?: string; private?: boolean; status?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const wantsStatus = typeof payload.status === "string";
  if (!payload.conversation_id || (!payload.body?.trim() && !wantsStatus)) {
    return json({ error: "conversation_id and body are required" }, 400);
  }
  if ((wantsStatus || payload.private) && !caller.isAdmin) {
    return json({ error: "Forbidden" }, 403);
  }
  if (wantsStatus && !["open", "pending", "resolved"].includes(payload.status!)) {
    return json({ error: "status must be open, pending, or resolved" }, 400);
  }

  try {
    const row = await getConversationRow(jwt, payload.conversation_id);
    if (!row) return json({ error: "Not found" }, 404);

    if (wantsStatus) {
      const res = await fetch(
        `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${row.chatwoot_conversation_id}/toggle_status`,
        {
          method: "POST",
          headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ status: payload.status }),
        }
      );
      if (!res.ok) throw new Error(`Chatwoot toggle_status -> ${res.status}: ${await res.text()}`);
      if (!payload.body?.trim()) return json({ status: payload.status });
    }

    if (caller.isAdmin) {
      const res = await fetch(
        `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${row.chatwoot_conversation_id}/messages`,
        {
          method: "POST",
          headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ content: payload.body!.trim(), message_type: "outgoing", private: Boolean(payload.private) }),
        }
      );
      if (!res.ok) throw new Error(`Chatwoot messages -> ${res.status}: ${await res.text()}`);
    } else {
      if (!row.chatwoot_source_id) {
        return json({ error: "This conversation predates client-reply support -- open a new ticket instead" }, 409);
      }
      const res = await fetch(
        `${CHATWOOT_API_URL}/public/api/v1/inboxes/${CHATWOOT_INBOX_IDENTIFIER}/contacts/${row.chatwoot_source_id}/conversations/${row.chatwoot_conversation_id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: payload.body!.trim() }),
        }
      );
      if (!res.ok) throw new Error(`Chatwoot public messages -> ${res.status}: ${await res.text()}`);
    }

    return json({ sent: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
