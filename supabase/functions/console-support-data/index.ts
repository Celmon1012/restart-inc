// Support conversation list + thread proxy. Same shape as console-data:
// console.support_conversations only maps a Chatwoot conversation to a
// workspace -- every message and the conversation's own status/state
// stays in Chatwoot, fetched live here, never mirrored into Postgres.
//
// GET /functions/v1/console-support-data                      -> list of the caller's visible conversations, with a live summary each
// GET /functions/v1/console-support-data?conversation_id=<id> -> full thread (messages) for one conversation, plus any pending proposal
//
// Zero external imports, same cold-start reasoning as every other
// function here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHATWOOT_API_URL = (Deno.env.get("CHATWOOT_API_URL") ?? "https://support.restart.ng").replace(/\/$/, "");
const CHATWOOT_API_ACCESS_TOKEN = Deno.env.get("CHATWOOT_API_ACCESS_TOKEN")!;
const CHATWOOT_ACCOUNT_ID = Deno.env.get("CHATWOOT_ACCOUNT_ID")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

interface ConversationRow {
  id: string;
  workspace_id: string;
  chatwoot_conversation_id: number;
  workspaces?: { name: string } | null;
}

// Runs as the caller's own JWT -- console.support_conversations' RLS
// policy (member of that workspace, or admin) is what actually scopes
// this, not app code.
async function getMyConversationRows(jwt: string): Promise<ConversationRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_conversations?select=id,workspace_id,chatwoot_conversation_id,workspaces(name)&order=created_at.desc`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`support_conversations lookup -> ${res.status}`);
  return res.json();
}

async function getPendingProposal(jwt: string, conversationRowId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_proposals?conversation_id=eq.${conversationRowId}&status=eq.proposed&select=*&order=created_at.desc&limit=1`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  // Non-admins get an empty array back here (RLS), not an error -- that's fine.
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

async function chatwootFetch(path: string) {
  const res = await fetch(`${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}${path}`, {
    headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`Chatwoot ${path} -> ${res.status}`);
  }
  return res.json();
}

function summarize(conversation: any) {
  const messages = conversation.messages ?? [];
  const lastVisible = [...messages].reverse().find((m: any) => !m.private);
  return {
    status: conversation.status,
    lastMessage: lastVisible?.content ?? null,
    lastActivityAt: conversation.last_activity_at ? conversation.last_activity_at * 1000 : conversation.created_at * 1000,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const conversationId = new URL(req.url).searchParams.get("conversation_id");

  try {
    if (conversationId) {
      // Belt-and-suspenders: confirm this row is one RLS actually let the
      // caller see before trusting the client-supplied chatwoot id at all.
      const rows = await getMyConversationRows(jwt);
      const row = rows.find((r) => r.id === conversationId);
      if (!row) return json({ error: "Not found" }, 404);

      // The "show conversation" endpoint only embeds a single-message
      // preview, not full history -- confirmed against a real conversation
      // where it silently returned just the most recent message. The
      // dedicated messages endpoint (wrapped in {meta, payload}) is what
      // actually returns the full thread.
      const conversation = await chatwootFetch(`/conversations/${row.chatwoot_conversation_id}`);
      const messagesRes = await chatwootFetch(`/conversations/${row.chatwoot_conversation_id}/messages`);
      conversation.messages = messagesRes.payload ?? [];
      // Private notes are staff-only by construction in Chatwoot -- this
      // function must enforce that too, since it's the only thing standing
      // between a client and the raw Chatwoot payload (which includes them).
      if (!caller.isAdmin) {
        conversation.messages = conversation.messages.filter((m: any) => !m.private);
      }
      // Likewise, a pending draft is only ever surfaced to admins (RLS on
      // support_proposals already returns [] for a non-admin, but be explicit).
      const proposal = caller.isAdmin ? await getPendingProposal(jwt, row.id) : null;
      return json({ conversation, proposal });
    }

    const rows = await getMyConversationRows(jwt);
    const summaries = await Promise.all(
      rows.map(async (row) => {
        try {
          const conversation = await chatwootFetch(`/conversations/${row.chatwoot_conversation_id}`);
          return { id: row.id, workspaceId: row.workspace_id, workspaceName: row.workspaces?.name ?? null, ...summarize(conversation) };
        } catch {
          return { id: row.id, workspaceId: row.workspace_id, workspaceName: row.workspaces?.name ?? null, status: "unknown", lastMessage: null, lastActivityAt: null };
        }
      })
    );
    return json({ conversations: summaries });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
