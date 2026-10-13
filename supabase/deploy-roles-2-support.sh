#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
# Staff roles (Owner / Ops / Finance): console-support-data, console-support-reply, console-support-send, console-deliverable-send.
set -e
mkdir -p /home/deno/functions/console-support-data
cat > /home/deno/functions/console-support-data/index.ts <<'__RESTART_FN_EOF__'
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
  // The ball is in the client's court when Restart spoke last (message_type
  // 1 = outgoing) on a thread still open. The show endpoint only embeds the
  // latest message, so if that one is a private note or activity we can't
  // tell -- report false rather than nag the client on a guess.
  const awaitingClient =
    conversation.status !== "resolved" &&
    lastVisible?.message_type === 1;
  return {
    status: conversation.status,
    awaitingClient,
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
          return { id: row.id, workspaceId: row.workspace_id, workspaceName: row.workspaces?.name ?? null, status: "unknown", awaitingClient: false, lastMessage: null, lastActivityAt: null };
        }
      })
    );
    return json({ conversations: summaries });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
__RESTART_FN_EOF__
mkdir -p /home/deno/functions/console-support-reply
cat > /home/deno/functions/console-support-reply/index.ts <<'__RESTART_FN_EOF__'
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
__RESTART_FN_EOF__
mkdir -p /home/deno/functions/console-support-send
cat > /home/deno/functions/console-support-send/index.ts <<'__RESTART_FN_EOF__'
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
__RESTART_FN_EOF__
mkdir -p /home/deno/functions/console-deliverable-send
cat > /home/deno/functions/console-deliverable-send/index.ts <<'__RESTART_FN_EOF__'
// Deliverables-side twin of console-agent-send -- see that function's
// comment for the full reasoning (admin JWT + is_admin required, since
// this is the one step allowed to touch a real inbox). The only real
// difference: the recipient comes from console.workspaces.contact_email
// (staff-set, see the console_workspace_contact migration) rather than
// inquiries.email, since a deliverable isn't tied to a single prospect
// with an email already on file.
//
// POST /functions/v1/console-deliverable-send
// body: { activity_id: string, subject?: string, body?: string }
//
// Kept as its own function rather than branching console-agent-send on a
// `kind` param -- matches this codebase's convention of small, duplicated,
// single-purpose edge functions (see console-data/console-billing's own
// comments on why: the zero-import/cold-start constraint makes shared
// helpers impractical here anyway).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Restart Inc <hello@restart.ng>";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
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

interface ActivityRow {
  id: string;
  deliverable_id: string;
  activity_type: string;
  status: string;
  payload: { subject?: string; body?: string } | null;
}

interface DeliverableRow {
  workspace_id: string;
}

interface WorkspaceRow {
  contact_email: string | null;
}

async function getActivity(jwt: string, id: string): Promise<ActivityRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/deliverable_activities?id=eq.${encodeURIComponent(id)}&select=id,deliverable_id,activity_type,status,payload`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`activity lookup -> ${res.status}`);
  const rows: ActivityRow[] = await res.json();
  return rows[0] ?? null;
}

async function getDeliverable(jwt: string, id: string): Promise<DeliverableRow | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/deliverables?id=eq.${encodeURIComponent(id)}&select=workspace_id`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" },
  });
  if (!res.ok) throw new Error(`deliverable lookup -> ${res.status}`);
  const rows: DeliverableRow[] = await res.json();
  return rows[0] ?? null;
}

async function getWorkspaceContact(jwt: string, workspaceId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=contact_email`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`workspace lookup -> ${res.status}`);
  const rows: WorkspaceRow[] = await res.json();
  return rows[0]?.contact_email ?? null;
}

async function sendEmail(to: string, subject: string, body: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text: body }),
  });
  if (!res.ok) {
    throw new Error(`Resend -> ${res.status}: ${await res.text()}`);
  }
}

async function markSent(jwt: string, activityId: string, callerId: string, subject: string, body: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/deliverable_activities?id=eq.${encodeURIComponent(activityId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Profile": "console",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      activity_type: "email_sent",
      status: "approved",
      payload: { subject, body },
      decided_by: callerId,
      decided_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`activity update -> ${res.status}`);
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

  let body: { activity_id?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.activity_id) return json({ error: "activity_id is required" }, 400);

  try {
    const activity = await getActivity(jwt, body.activity_id);
    if (!activity) return json({ error: "Proposal not found" }, 404);
    if (activity.activity_type !== "agent_proposal" || activity.status !== "proposed") {
      return json({ error: "This proposal has already been decided" }, 409);
    }

    const deliverable = await getDeliverable(jwt, activity.deliverable_id);
    if (!deliverable) return json({ error: "Related deliverable not found" }, 404);

    const contactEmail = await getWorkspaceContact(jwt, deliverable.workspace_id);
    if (!contactEmail) {
      return json({ error: "This workspace has no contact_email set yet -- add one before sending" }, 400);
    }

    const subject = body.subject ?? activity.payload?.subject ?? "";
    const emailBody = body.body ?? activity.payload?.body ?? "";
    if (!subject || !emailBody) return json({ error: "Draft is missing a subject or body" }, 400);

    await sendEmail(contactEmail, subject, emailBody);
    await markSent(jwt, activity.id, caller.id, subject, emailBody);

    return json({ sent: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
__RESTART_FN_EOF__
ls -l /home/deno/functions/console-support-data /home/deno/functions/console-support-reply /home/deno/functions/console-support-send /home/deno/functions/console-deliverable-send
