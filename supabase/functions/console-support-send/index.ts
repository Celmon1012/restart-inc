// Turns an agent-drafted support reply into a real message. Same shape as
// console-agent-send/console-deliverable-send: runs as the admin's own
// JWT (not service-role), requires is_admin, so every send is tied to a
// specific admin's decision, never the agent's own authority.
//
// Rejecting a proposal doesn't come through here -- that's a plain
// RLS-protected update on console.support_proposals from the console UI.
// This function exists only because CHATWOOT_API_ACCESS_TOKEN must never
// reach the browser.
//
// POST /functions/v1/console-support-send
// body: { proposal_id: string, body?: string } -- body lets an admin edit
// the draft before sending; what actually went out isn't re-stored here
// (Chatwoot is already the record of it once sent).

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

async function getUser(jwt: string): Promise<{ id: string; email?: string; isAdmin: boolean; roles: string[] } | null> {
  // The caller's token is checked by the auth service, and in parallel their effective staff roles
  // are read as themselves. Owner is the admin claim or an owner row; Ops and Finance count only
  // when the session passed the second factor (aal2), which the database decides, not this code.
  const headers = { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY };
  const [res, rolesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/my_effective_roles`, {
      method: "POST",
      headers: { ...headers, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null),
  ]);
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  // app_metadata, not user_metadata -- only settable via the service-role Admin API, never via
  // the user's own auth.updateUser() call, so an account can never grant itself this by editing
  // its own profile.
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  // If the role lookup can't be reached, fall back to the admin claim alone.
  if (rolesRes?.ok) {
    const list = await rolesRes.json().catch(() => null);
    if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
  }
  // "isAdmin" for this function means: holds one of "owner", "ops".
  return { id: user.id, email: user.email, isAdmin: roles.some((r) => ["owner", "ops"].includes(r)), roles };
}

interface ProposalRow {
  id: string;
  conversation_id: string;
  body: string;
  status: string;
}

async function getProposal(jwt: string, id: string): Promise<ProposalRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_proposals?id=eq.${encodeURIComponent(id)}&select=id,conversation_id,body,status`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`support_proposals lookup -> ${res.status}`);
  const rows: ProposalRow[] = await res.json();
  return rows[0] ?? null;
}

async function getChatwootConversationId(jwt: string, conversationRowId: string): Promise<number | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_conversations?id=eq.${encodeURIComponent(conversationRowId)}&select=chatwoot_conversation_id`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`support_conversations lookup -> ${res.status}`);
  const rows = await res.json();
  return rows[0]?.chatwoot_conversation_id ?? null;
}

async function markDecided(jwt: string, proposalId: string, callerId: string, status: "approved" | "rejected") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/support_proposals?id=eq.${encodeURIComponent(proposalId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Profile": "console",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, decided_by: callerId, decided_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`support_proposals update -> ${res.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (!caller.isAdmin) return json({ error: "Forbidden -- admin only" }, 403);

  let payload: { proposal_id?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!payload.proposal_id) return json({ error: "proposal_id is required" }, 400);

  try {
    const proposal = await getProposal(jwt, payload.proposal_id);
    if (!proposal) return json({ error: "Proposal not found" }, 404);
    if (proposal.status !== "proposed") return json({ error: "This proposal has already been decided" }, 409);

    const chatwootConversationId = await getChatwootConversationId(jwt, proposal.conversation_id);
    if (!chatwootConversationId) return json({ error: "Related conversation not found" }, 404);

    const content = (payload.body ?? proposal.body).trim();
    if (!content) return json({ error: "Draft is empty" }, 400);

    const res = await fetch(
      `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${chatwootConversationId}/messages`,
      {
        method: "POST",
        headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ content, message_type: "outgoing", private: false }),
      }
    );
    if (!res.ok) throw new Error(`Chatwoot messages -> ${res.status}: ${await res.text()}`);

    await markDecided(jwt, proposal.id, caller.id, "approved");

    return json({ sent: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
