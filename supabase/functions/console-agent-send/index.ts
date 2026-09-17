// Turns an agent's drafted follow-up email into one that's actually sent.
// This is the one step in the whole agent pipeline that's allowed to touch
// a real inbox, which is exactly why it's a separate function from
// console-agent-run: that function operates under service-role with no
// human in the loop, this one runs as the CALLER's own JWT (like
// console-data/console-billing) and requires is_admin, so every send is
// tied to a specific admin's decision, not the agent's own authority.
//
// Rejecting a proposal doesn't come through here at all -- that's a plain
// RLS-protected update the console UI makes directly against
// console.inquiry_activities (admins can update it), no secret involved.
// This function exists only because RESEND_API_KEY must never reach the
// browser.
//
// POST /functions/v1/console-agent-send
// body: { activity_id: string, subject?: string, body?: string }
// subject/body let an admin edit the draft before sending -- what actually
// went out is recorded on the activity row, which may differ from the
// agent's original draft.
//
// Zero external imports, same cold-start reasoning as every other function
// here.

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

async function getUser(jwt: string): Promise<{ id: string; isAdmin: boolean } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  return { id: user.id, isAdmin: Boolean(user.app_metadata?.is_admin) };
}

interface ActivityRow {
  id: string;
  inquiry_id: string;
  activity_type: string;
  status: string;
  payload: { subject?: string; body?: string } | null;
}

interface InquiryRow {
  email: string;
  name: string;
}

// Runs as the caller's own JWT against RLS -- same reasoning as every
// other read in this repo's functions: Postgres enforces that only an
// admin can see/touch this row, not this function trusting a client flag.
async function getActivity(jwt: string, id: string): Promise<ActivityRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inquiry_activities?id=eq.${encodeURIComponent(id)}&select=id,inquiry_id,activity_type,status,payload`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" } }
  );
  if (!res.ok) throw new Error(`activity lookup -> ${res.status}`);
  const rows: ActivityRow[] = await res.json();
  return rows[0] ?? null;
}

async function getInquiry(jwt: string, id: string): Promise<InquiryRow | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?id=eq.${encodeURIComponent(id)}&select=email,name`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" },
  });
  if (!res.ok) throw new Error(`inquiry lookup -> ${res.status}`);
  const rows: InquiryRow[] = await res.json();
  return rows[0] ?? null;
}

async function sendEmail(to: string, subject: string, body: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      text: body,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend -> ${res.status}: ${await res.text()}`);
  }
}

async function markSent(jwt: string, activityId: string, callerId: string, subject: string, body: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/inquiry_activities?id=eq.${encodeURIComponent(activityId)}`, {
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

    const inquiry = await getInquiry(jwt, activity.inquiry_id);
    if (!inquiry) return json({ error: "Related inquiry not found" }, 404);

    const subject = body.subject ?? activity.payload?.subject ?? "";
    const emailBody = body.body ?? activity.payload?.body ?? "";
    if (!subject || !emailBody) return json({ error: "Draft is missing a subject or body" }, 400);

    await sendEmail(inquiry.email, subject, emailBody);
    await markSent(jwt, activity.id, caller.id, subject, emailBody);

    return json({ sent: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
