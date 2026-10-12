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
