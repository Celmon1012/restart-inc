// The follow-up agent. Scheduled by pg_cron (see
// supabase/migrations/20260917170000_console_agent_cron.sql), not called by
// the console SPA -- there is no browser origin here, so unlike every other
// function in this repo there's no CORS handling and no user JWT to
// forward.
//
// That's the one deliberate deviation from house style worth flagging:
// every other function in supabase/functions authorizes with the CALLER's
// own JWT against RLS-protected PostgREST, specifically so Postgres (not
// app code) enforces who can see what. A cron trigger has no caller session
// to forward, so this function authenticates via a shared secret
// (x-cron-secret, compared to CRON_SECRET) and reads/writes console.* with
// the service-role key instead. That's a wider blast radius than any other
// function here holds, which is exactly why its actions are constrained in
// code: it may freely read/write internal-only fields (stage, notes,
// follow-up timing) but it can never send anything -- a client-facing
// action always lands as an 'agent_proposal' row with status='proposed'
// and stops there. Only an admin, through the console UI and the separate
// console-agent-send function (which *does* run under the admin's own
// JWT), can turn a proposal into something a client actually receives.
//
// v1 scope is inquiries only. Deliverable-due reminders are a natural
// follow-on once there's an activities table for workspace-level items to
// log against (console.deliverables has no timeline of its own yet, unlike
// console.inquiries) -- rather than force that through inquiry_activities'
// inquiry_id-shaped schema, it's left for a later migration.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const MODEL = "claude-sonnet-5";

// New leads get a day's grace before the agent chases them (someone may
// already be on it); anything already contacted goes stale after 3 days of
// silence. Both are deliberately conservative for a v1 -- easy to tighten
// once the drafts it produces have earned some trust.
const NEW_LEAD_GRACE_HOURS = 24;
const CONTACTED_STALE_HOURS = 72;
const MAX_INQUIRIES_PER_RUN = 20;

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
  // A plain POST/PATCH with no `Prefer: return=representation` comes back
  // with an empty body -- 201 for an insert, 204 for an update -- so this
  // can't just special-case 204. Parsing "" as JSON throws "Unexpected end
  // of JSON input", which is exactly what happened here the first time a
  // write actually ran (every 204 case so far had been a genuine no-op).
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

interface InquiryRow {
  id: string;
  created_at: string;
  name: string;
  email: string;
  company: string | null;
  service_tier: string | null;
  budget_range: string | null;
  project_stage: string | null;
  target_timeline: string | null;
  project_brief: string | null;
  status: string;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
}

interface ActivityRow {
  id: string;
  actor: string;
  activity_type: string;
  body: string | null;
  status: string;
  created_at: string;
}

function needsAttention(inquiry: InquiryRow): boolean {
  const now = Date.now();
  if (inquiry.next_follow_up_at) {
    return new Date(inquiry.next_follow_up_at).getTime() <= now;
  }
  const reference = inquiry.last_contacted_at ?? inquiry.created_at;
  const graceHours = inquiry.status === "new" ? NEW_LEAD_GRACE_HOURS : CONTACTED_STALE_HOURS;
  return now - new Date(reference).getTime() >= graceHours * 60 * 60 * 1000;
}

const TOOLS = [
  {
    name: "update_inquiry_stage",
    description: "Move this inquiry to a new pipeline stage. Internal-only -- applies immediately.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["new", "contacted", "qualified", "won", "lost", "archived"] },
        reason: { type: "string", description: "One sentence on why, for the internal timeline." },
      },
      required: ["status", "reason"],
    },
  },
  {
    name: "add_internal_note",
    description: "Leave a note on this inquiry's timeline for staff. Internal-only -- applies immediately.",
    input_schema: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"],
    },
  },
  {
    name: "set_follow_up_reminder",
    description: "Set when this inquiry should next be reviewed. Internal-only -- applies immediately.",
    input_schema: {
      type: "object",
      properties: {
        follow_up_at: { type: "string", description: "ISO 8601 timestamp." },
        reason: { type: "string" },
      },
      required: ["follow_up_at", "reason"],
    },
  },
  {
    name: "draft_followup_email",
    description:
      "Draft a follow-up email to the prospect. Client-facing -- this NEVER sends anything. It creates a proposal an admin must review, edit if needed, and approve before it goes out.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["subject", "body"],
    },
  },
];

const SYSTEM_PROMPT = `You are Restart Inc's lead follow-up assistant, reviewing one inquiry at a time from the console.inquiries pipeline.

Restart Inc builds and operates infrastructure and AI engineering work for clients. Prospects reach out via a "Start a Project" form.

For the inquiry given, decide what (if anything) should happen next. You may call zero or more tools:
- update_inquiry_stage / add_internal_note / set_follow_up_reminder happen immediately -- staff has already authorized these routine actions.
- draft_followup_email only ever creates a suggestion for a human to review, edit, and send -- never call it if a follow-up email was already proposed recently and hasn't been rejected (check the activity history first).

Be conservative: if nothing useful needs to happen right now (e.g. it's too soon, or staff already has it in hand per the notes), call no tools at all rather than manufacturing busywork. When you do draft an email, keep it short, specific to what this prospect actually asked for, and in a direct, technical, no-fluff tone -- not generic sales copy.`;

function hasPendingProposal(activities: ActivityRow[]): boolean {
  return activities.some((a) => a.activity_type === "agent_proposal" && a.status === "proposed");
}

async function callClaude(inquiry: InquiryRow, activities: ActivityRow[]) {
  const context = {
    inquiry,
    recent_activity: activities.slice(-10).map((a) => ({
      when: a.created_at,
      actor: a.actor,
      type: a.activity_type,
      status: a.status,
      note: a.body,
    })),
    current_time: new Date().toISOString(),
  };

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
      messages: [{ role: "user", content: JSON.stringify(context) }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic -> ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return (data.content ?? []).filter((block: { type: string }) => block.type === "tool_use");
}

async function applyToolCall(inquiry: InquiryRow, call: { name: string; input: Record<string, unknown> }): Promise<boolean> {
  switch (call.name) {
    case "update_inquiry_stage": {
      const status = call.input.status as string;
      await pg(`inquiries?id=eq.${inquiry.id}`, { method: "PATCH", profile: "write", body: JSON.stringify({ status }) });
      await pg("inquiry_activities", {
        method: "POST",
        profile: "write",
        body: JSON.stringify({
          inquiry_id: inquiry.id,
          actor: "agent",
          activity_type: "stage_change",
          body: `${inquiry.status} → ${status}: ${call.input.reason ?? ""}`,
          payload: { from: inquiry.status, to: status },
        }),
      });
      return true;
    }
    case "add_internal_note": {
      await pg("inquiry_activities", {
        method: "POST",
        profile: "write",
        body: JSON.stringify({
          inquiry_id: inquiry.id,
          actor: "agent",
          activity_type: "note",
          body: String(call.input.note ?? ""),
        }),
      });
      return true;
    }
    case "set_follow_up_reminder": {
      const followUpAt = String(call.input.follow_up_at ?? "");
      await pg(`inquiries?id=eq.${inquiry.id}`, {
        method: "PATCH",
        profile: "write",
        body: JSON.stringify({ next_follow_up_at: followUpAt }),
      });
      await pg("inquiry_activities", {
        method: "POST",
        profile: "write",
        body: JSON.stringify({
          inquiry_id: inquiry.id,
          actor: "agent",
          activity_type: "agent_auto_action",
          body: `Follow-up reminder set for ${followUpAt}: ${call.input.reason ?? ""}`,
          payload: { follow_up_at: followUpAt },
        }),
      });
      return true;
    }
    case "draft_followup_email": {
      await pg("inquiry_activities", {
        method: "POST",
        profile: "write",
        body: JSON.stringify({
          inquiry_id: inquiry.id,
          actor: "agent",
          activity_type: "agent_proposal",
          body: "Drafted a follow-up email for review.",
          payload: { subject: call.input.subject, body: call.input.body },
          requires_approval: true,
          status: "proposed",
        }),
      });
      return true;
    }
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const run = await pg("agent_runs", {
    method: "POST",
    profile: "write",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ model: MODEL }),
  });
  const runId = run[0].id;

  let inquiriesScanned = 0;
  let actionsCreated = 0;
  let runError: string | null = null;

  try {
    const candidates: InquiryRow[] = await pg(
      "inquiries?status=in.(new,contacted,qualified)&select=*&order=created_at.asc"
    );
    inquiriesScanned = candidates.length;

    const toReview = candidates.filter(needsAttention).slice(0, MAX_INQUIRIES_PER_RUN);

    for (const inquiry of toReview) {
      const activities: ActivityRow[] = await pg(
        `inquiry_activities?inquiry_id=eq.${inquiry.id}&select=*&order=created_at.asc`
      );
      if (hasPendingProposal(activities)) continue;

      const toolCalls = await callClaude(inquiry, activities);
      for (const call of toolCalls) {
        const applied = await applyToolCall(inquiry, { name: call.name, input: call.input });
        if (applied) actionsCreated++;
      }
    }
  } catch (err) {
    runError = (err as Error).message;
  }

  await pg(`agent_runs?id=eq.${runId}`, {
    method: "PATCH",
    profile: "write",
    body: JSON.stringify({
      finished_at: new Date().toISOString(),
      inquiries_scanned: inquiriesScanned,
      deliverables_scanned: 0,
      actions_created: actionsCreated,
      error: runError,
    }),
  });

  if (runError) return json({ error: runError }, 500);
  return json({ inquiriesScanned, actionsCreated });
});
