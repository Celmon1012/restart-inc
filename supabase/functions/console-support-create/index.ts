// Opens a new support conversation: finds or creates the workspace's
// Chatwoot contact, creates the conversation + its first message there,
// and records the mapping in console.support_conversations.
//
// POST /functions/v1/console-support-create
// body: { workspace_id: string, subject: string, message: string }
//
// Runs as the caller's own JWT (like console-data) -- console.workspaces/
// workspace_members RLS is what actually enforces that a plain member can
// only open a ticket for their own workspace. Chatwoot's inbox/contact
// tokens are the only secret here, which is why this has to be a function
// at all rather than a direct client insert.
//
// Uses TWO different Chatwoot APIs on purpose, not by accident:
// - The agent-token Application API (chatwootGet/chatwootPost below) only
//   for finding/creating the contact and its contact_inbox -- that's an
//   agent-side operation.
// - Chatwoot's separate, unauthenticated-by-design Client API
//   (chatwootPublicPost, keyed by inbox_identifier + the contact's
//   source_id) to actually create the conversation and its first message
//   -- confirmed the hard way that the Application API's create-message
//   endpoint does NOT genuinely persist a message when message_type is
//   set to "incoming"; that representation is only real when created
//   through the Client API, which is what a real contact/widget uses.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHATWOOT_API_URL = (Deno.env.get("CHATWOOT_API_URL") ?? "https://support.restart.ng").replace(/\/$/, "");
const CHATWOOT_API_ACCESS_TOKEN = Deno.env.get("CHATWOOT_API_ACCESS_TOKEN")!;
const CHATWOOT_ACCOUNT_ID = Deno.env.get("CHATWOOT_ACCOUNT_ID")!;
const CHATWOOT_INBOX_ID = Deno.env.get("CHATWOOT_INBOX_ID")!;
const CHATWOOT_INBOX_IDENTIFIER = Deno.env.get("CHATWOOT_INBOX_IDENTIFIER")!;

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

interface WorkspaceRow {
  id: string;
  name: string;
  contact_email: string | null;
}

// Runs as the caller's own JWT against RLS -- a plain member only ever
// gets back their own workspace row here (or none, if it's not theirs).
async function getWorkspace(jwt: string, workspaceId: string): Promise<WorkspaceRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=id,name,contact_email`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`workspace lookup -> ${res.status}`);
  const rows: WorkspaceRow[] = await res.json();
  return rows[0] ?? null;
}

async function chatwootGet(path: string) {
  const res = await fetch(`${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}${path}`, {
    headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN },
  });
  if (!res.ok) throw new Error(`Chatwoot ${path} -> ${res.status}`);
  return res.json();
}

async function chatwootPost(path: string, body: unknown) {
  const res = await fetch(`${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}${path}`, {
    method: "POST",
    headers: { api_access_token: CHATWOOT_API_ACCESS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Chatwoot ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

// The Client API -- no api_access_token, authorized purely by knowing the
// inbox_identifier + contact_identifier (source_id) pair, exactly like a
// real widget session would be.
async function chatwootPublicPost(path: string, body: unknown) {
  const res = await fetch(`${CHATWOOT_API_URL}/public/api/v1/inboxes/${CHATWOOT_INBOX_IDENTIFIER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Chatwoot public ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

// Finds the workspace's Chatwoot contact by email, or creates one; either
// way, ensures it has a contact_inbox (and therefore a source_id) for
// OUR api-channel inbox specifically -- an existing contact found by
// email may have been created against a different inbox entirely (e.g.
// a widget conversation from the marketing site).
async function findOrCreateContact(email: string, name: string): Promise<{ contactId: number; sourceId: string }> {
  const found = await chatwootGet(`/contacts/search?q=${encodeURIComponent(email)}`);
  const candidates: any[] = Array.isArray(found) ? found : (found.payload ?? []);
  const existing = candidates.find((c) => c.email === email);

  if (existing) {
    const contactInbox = await chatwootPost(`/contacts/${existing.id}/contact_inboxes`, { inbox_id: Number(CHATWOOT_INBOX_ID) });
    return { contactId: existing.id, sourceId: contactInbox.source_id };
  }

  const created = await chatwootPost("/contacts", { inbox_id: Number(CHATWOOT_INBOX_ID), email, name });
  const sourceId = created.contact_inboxes?.[0]?.source_id;
  return { contactId: created.id, sourceId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  let body: { workspace_id?: string; subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.workspace_id || !body.message?.trim()) {
    return json({ error: "workspace_id and message are required" }, 400);
  }

  try {
    const workspace = await getWorkspace(jwt, body.workspace_id);
    if (!workspace) return json({ error: "Not a member of that workspace" }, 403);
    if (!workspace.contact_email) {
      return json({ error: "This workspace has no contact_email set yet -- add one before opening a ticket" }, 400);
    }

    const { contactId, sourceId } = await findOrCreateContact(workspace.contact_email, workspace.name);

    const conversation = await chatwootPublicPost(`/contacts/${sourceId}/conversations`, {
      custom_attributes: { workspace_id: workspace.id, workspace_name: workspace.name },
    });

    await chatwootPublicPost(`/contacts/${sourceId}/conversations/${conversation.id}/messages`, {
      content: body.subject ? `${body.subject}\n\n${body.message}` : body.message,
    });

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/support_conversations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Profile": "console",
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        workspace_id: workspace.id,
        chatwoot_conversation_id: conversation.id,
        chatwoot_contact_id: contactId,
        chatwoot_source_id: sourceId,
      }),
    });
    if (!insertRes.ok) throw new Error(`support_conversations insert -> ${insertRes.status}`);
    const [row] = await insertRes.json();

    return json({ id: row.id, chatwootConversationId: conversation.id });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
