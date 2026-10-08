#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container.
# Then set OUTREACH_MCP_TOKEN on the edge runtime (a long random string) and
# deploy this function with JWT verification off.
set -e
mkdir -p /home/deno/functions/console-outreach-mcp
cat > /home/deno/functions/console-outreach-mcp/index.ts <<'__RESTART_FN_EOF__'
// MCP server for Restart's outbound prospecting, called from Claude Code.
//
// Claude does the thinking (research, scoring, drafting); this function is
// the memory: it stores prospects and touches in console.prospects and
// console.prospect_touches (see 20261008120000_console_outreach.sql) and
// hands back who needs attention next.
//
// Nothing here sends anything. draft_outreach saves a draft; the person
// sends it (from Gmail, WhatsApp, LinkedIn) and then tells Claude, which
// calls mark_touch_sent. A prospect marked do_not_contact is refused by
// every drafting tool, and an "unsubscribe" reply sets it automatically.
//
// Transport: MCP streamable HTTP, JSON responses only (no SSE, no sessions).
// Claude Code connects with:
//   claude mcp add --transport http restart-outreach \
//     https://<supabase-host>/functions/v1/console-outreach-mcp \
//     --header "Authorization: Bearer <OUTREACH_MCP_TOKEN>"
//
// Auth is a static bearer token in OUTREACH_MCP_TOKEN. Deploy with JWT
// verification off for this function: Claude Code sends this token, not a
// Supabase JWT. A request without the right token gets a 401 and touches
// nothing.
//
// Zero external imports, same cold-start reasoning as every other function
// here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_TOKEN = Deno.env.get("OUTREACH_MCP_TOKEN") ?? "";

const SERVER_INFO = { name: "restart-outreach", version: "0.1.0" };
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_FOLLOWUP_DAYS = 4;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function pg(path: string, init: RequestInit & { write?: boolean } = {}) {
  const { write = false, ...rest } = init;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      [write ? "Content-Profile" : "Accept-Profile"]: "console",
      ...(write ? { Prefer: "return=representation" } : {}),
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`PostgREST ${path} -> ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Constant-time comparison, so the token can't be recovered by timing.
function tokenMatches(given: string) {
  if (!MCP_TOKEN || given.length !== MCP_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ MCP_TOKEN.charCodeAt(i);
  return diff === 0;
}

// ---- argument helpers ------------------------------------------------------

type Args = Record<string, unknown>;

function str(a: Args, key: string, max: number, required = false): string | undefined {
  const v = a[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new Error(`${key} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new Error(`${key} must be a string`);
  const t = v.trim();
  if (t.length > max) throw new Error(`${key} is too long (max ${max})`);
  if (required && !t) throw new Error(`${key} is required`);
  return t || undefined;
}

function oneOf<T extends string>(a: Args, key: string, allowed: readonly T[], required = false): T | undefined {
  const v = str(a, key, 40, required);
  if (v === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(v)) throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
  return v as T;
}

function uuid(a: Args, key: string): string {
  const v = str(a, key, 40, true)!;
  if (!UUID_RE.test(v)) throw new Error(`${key} must be a UUID`);
  return v;
}

function int(a: Args, key: string, min: number, max: number, fallback?: number): number | undefined {
  const v = a[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  return v;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const SEGMENTS = ["ng_sme", "intl_sme"] as const;
const TIERS = ["A", "B", "warm"] as const;
const SIZES = ["1-10", "11-50", "51-200", "200+"] as const;
const CHANNELS = ["email", "whatsapp", "linkedin", "call", "other"] as const;
const STATUSES = [
  "new", "researched", "scored", "drafted", "contacted", "replied",
  "meeting", "proposal", "won", "lost", "disqualified",
] as const;
const CLASSIFICATIONS = ["interested", "not_now", "not_interested", "wrong_person", "unsubscribe", "other"] as const;

// ---- data access -----------------------------------------------------------

interface Prospect {
  id: string;
  company: string;
  status: string;
  do_not_contact: boolean;
  [k: string]: unknown;
}

async function getProspect(id: string): Promise<Prospect> {
  const rows: Prospect[] = await pg(`prospects?id=eq.${id}&select=*`);
  if (!rows?.length) throw new Error(`No prospect with id ${id}`);
  return rows[0];
}

async function patchProspect(id: string, patch: Record<string, unknown>): Promise<Prospect> {
  const rows: Prospect[] = await pg(`prospects?id=eq.${id}`, { method: "PATCH", write: true, body: JSON.stringify(patch) });
  return rows[0];
}

function assertContactable(p: Prospect) {
  if (p.do_not_contact) {
    throw new Error(`${p.company} is marked do_not_contact (${p.do_not_contact_reason ?? "no reason recorded"}). Not drafting.`);
  }
  if (p.status === "disqualified" || p.status === "lost" || p.status === "won") {
    throw new Error(`${p.company} is ${p.status}; change its status first if you really mean to contact it.`);
  }
}

// A status only moves forward through the early funnel on its own; later
// stages (meeting, proposal, won, lost) are set deliberately.
const EARLY = ["new", "researched", "scored", "drafted"];
function advance(current: string, to: string) {
  return EARLY.includes(current) && EARLY.indexOf(to) > EARLY.indexOf(current) ? to : current;
}

// ---- tools -----------------------------------------------------------------

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (a: Args) => Promise<unknown>;
}

const strProp = (description: string) => ({ type: "string", description });
const idProp = strProp("Prospect id (UUID).");

const tools: Tool[] = [
  {
    name: "add_prospect",
    description:
      "Add a company to the outreach pipeline. If a prospect with the same email exists it is returned instead of creating a duplicate. Segment ng_sme = Nigerian SME, intl_sme = international SME. Tier A = deep personalisation, B = lighter, warm = referral or past contact.",
    inputSchema: {
      type: "object",
      properties: {
        company: strProp("Company name."),
        website: strProp("Company website."),
        country: strProp("Country."),
        industry: strProp("Industry."),
        size_band: { type: "string", enum: SIZES },
        segment: { type: "string", enum: SEGMENTS },
        contact_name: strProp("Decision-maker name."),
        contact_role: strProp("Decision-maker role."),
        email: strProp("Contact email."),
        phone: strProp("Contact phone in international format."),
        linkedin_url: strProp("Contact LinkedIn URL."),
        source: strProp("Where this lead came from (e.g. referral, maps, linkedin)."),
        tier: { type: "string", enum: TIERS },
        notes: strProp("Anything worth remembering."),
      },
      required: ["company"],
    },
    async run(a) {
      const email = str(a, "email", 320)?.toLowerCase();
      if (email) {
        const existing: Prospect[] = await pg(`prospects?email=eq.${encodeURIComponent(email)}&select=*`);
        if (existing?.length) return { created: false, note: "A prospect with this email already exists.", prospect: existing[0] };
      }
      const row = {
        company: str(a, "company", 200, true),
        website: str(a, "website", 300),
        country: str(a, "country", 100),
        industry: str(a, "industry", 120),
        size_band: oneOf(a, "size_band", SIZES),
        segment: oneOf(a, "segment", SEGMENTS),
        contact_name: str(a, "contact_name", 200),
        contact_role: str(a, "contact_role", 200),
        email,
        phone: str(a, "phone", 40),
        linkedin_url: str(a, "linkedin_url", 300),
        source: str(a, "source", 100),
        tier: oneOf(a, "tier", TIERS),
        notes: str(a, "notes", 5000),
      };
      const rows: Prospect[] = await pg("prospects", { method: "POST", write: true, body: JSON.stringify(row) });
      return { created: true, prospect: rows[0] };
    },
  },
  {
    name: "list_prospects",
    description:
      "List prospects, highest fit score first. Filter by status, tier, segment or minimum score. Returns summary fields only; use get_prospect for the full record.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: STATUSES },
        tier: { type: "string", enum: TIERS },
        segment: { type: "string", enum: SEGMENTS },
        min_score: { type: "integer", minimum: 0, maximum: 100 },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 25." },
      },
    },
    async run(a) {
      const q = [
        "select=id,company,website,country,industry,segment,tier,status,fit_score,contact_name,contact_role,email,next_followup_at,last_contacted_at,do_not_contact",
        "order=fit_score.desc.nullslast,created_at.desc",
        `limit=${int(a, "limit", 1, 100, 25)}`,
      ];
      const status = oneOf(a, "status", STATUSES);
      const tier = oneOf(a, "tier", TIERS);
      const segment = oneOf(a, "segment", SEGMENTS);
      const min = int(a, "min_score", 0, 100);
      if (status) q.push(`status=eq.${status}`);
      if (tier) q.push(`tier=eq.${tier}`);
      if (segment) q.push(`segment=eq.${segment}`);
      if (min !== undefined) q.push(`fit_score=gte.${min}`);
      return await pg(`prospects?${q.join("&")}`);
    },
  },
  {
    name: "get_prospect",
    description: "Full prospect record plus every touch (drafts, sent messages, replies), newest first.",
    inputSchema: { type: "object", properties: { id: idProp }, required: ["id"] },
    async run(a) {
      const id = uuid(a, "id");
      const [prospect, touches] = await Promise.all([
        getProspect(id),
        pg(`prospect_touches?prospect_id=eq.${id}&select=*&order=created_at.desc`),
      ]);
      return { prospect, touches };
    },
  },
  {
    name: "save_research",
    description:
      "Save the research brief you wrote for a prospect: what they do, what is likely broken or slow in their operations, a specific hook, and anything that disqualifies them. Include sources (URLs) so claims can be checked. Moves a 'new' prospect to 'researched'.",
    inputSchema: {
      type: "object",
      properties: {
        id: idProp,
        brief: strProp("The research brief (max 8000 chars)."),
        sources: { type: "array", items: { type: "string" }, description: "URLs the brief is based on." },
      },
      required: ["id", "brief"],
    },
    async run(a) {
      const id = uuid(a, "id");
      const p = await getProspect(id);
      const sources = Array.isArray(a.sources) ? a.sources.filter((s) => typeof s === "string").slice(0, 30) : undefined;
      return await patchProspect(id, {
        research_brief: str(a, "brief", 8000, true),
        research_sources: sources,
        status: advance(p.status, "researched"),
      });
    },
  },
  {
    name: "save_score",
    description:
      "Save the ICP fit score (0-100) with a short reason, and optionally set the tier (A for the best fits). Moves an early-stage prospect to 'scored'.",
    inputSchema: {
      type: "object",
      properties: {
        id: idProp,
        fit_score: { type: "integer", minimum: 0, maximum: 100 },
        reason: strProp("Why this score (max 2000 chars)."),
        tier: { type: "string", enum: TIERS },
      },
      required: ["id", "fit_score", "reason"],
    },
    async run(a) {
      const id = uuid(a, "id");
      const p = await getProspect(id);
      const tier = oneOf(a, "tier", TIERS);
      return await patchProspect(id, {
        fit_score: int(a, "fit_score", 0, 100),
        score_reason: str(a, "reason", 2000, true),
        ...(tier ? { tier } : {}),
        status: advance(p.status, "scored"),
      });
    },
  },
  {
    name: "draft_outreach",
    description:
      "Save an outreach message as a DRAFT for the person to review and send. This does not send anything. Refused for do_not_contact, won, lost or disqualified prospects. Use step 1 for the first message, 2+ for follow-ups.",
    inputSchema: {
      type: "object",
      properties: {
        prospect_id: idProp,
        channel: { type: "string", enum: ["email", "whatsapp", "linkedin"] },
        subject: strProp("Email subject (email only)."),
        body: strProp("Message body."),
        step: { type: "integer", minimum: 1, maximum: 20, description: "Sequence step. Default 1." },
      },
      required: ["prospect_id", "channel", "body"],
    },
    async run(a) {
      const id = uuid(a, "prospect_id");
      const p = await getProspect(id);
      assertContactable(p);
      const rows = await pg("prospect_touches", {
        method: "POST",
        write: true,
        body: JSON.stringify({
          prospect_id: id,
          channel: oneOf(a, "channel", ["email", "whatsapp", "linkedin"] as const, true),
          direction: "outbound",
          status: "draft",
          step: int(a, "step", 1, 20, 1),
          subject: str(a, "subject", 300),
          body: str(a, "body", 10000, true),
        }),
      });
      await patchProspect(id, { status: advance(p.status, "drafted") });
      return { draft: rows[0], note: "Saved as a draft. Nothing was sent." };
    },
  },
  {
    name: "list_pending_drafts",
    description: "Drafts waiting for review, oldest first, with the prospect's company and contact.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } },
    async run(a) {
      const drafts: Array<{ prospect_id: string }> = await pg(
        `prospect_touches?status=eq.draft&select=*&order=created_at.asc&limit=${int(a, "limit", 1, 100, 25)}`
      );
      if (!drafts?.length) return [];
      const ids = [...new Set(drafts.map((d) => d.prospect_id))].join(",");
      const prospects: Prospect[] = await pg(`prospects?id=in.(${ids})&select=id,company,contact_name,email,phone,tier,fit_score`);
      const byId = new Map(prospects.map((p) => [p.id, p]));
      // Joined here rather than with PostgREST embedding, which does not
      // work on this self-hosted instance.
      return drafts.map((d) => ({ ...d, prospect: byId.get(d.prospect_id) ?? null }));
    },
  },
  {
    name: "mark_touch_sent",
    description:
      "Record that a person sent a draft. Call this ONLY after the user confirms they actually sent it. Marks the touch sent, the prospect contacted, and schedules the next follow-up.",
    inputSchema: {
      type: "object",
      properties: {
        touch_id: strProp("Touch id (UUID)."),
        followup_in_days: { type: "integer", minimum: 1, maximum: 60, description: `Default ${DEFAULT_FOLLOWUP_DAYS}.` },
      },
      required: ["touch_id"],
    },
    async run(a) {
      const touchId = uuid(a, "touch_id");
      const touches: Array<{ id: string; prospect_id: string; status: string; direction: string }> = await pg(
        `prospect_touches?id=eq.${touchId}&select=id,prospect_id,status,direction`
      );
      const t = touches?.[0];
      if (!t) throw new Error(`No touch with id ${touchId}`);
      if (t.direction !== "outbound" || !["draft", "approved"].includes(t.status)) {
        throw new Error(`Touch is ${t.direction}/${t.status}; only an outbound draft or approved touch can be marked sent.`);
      }
      const p = await getProspect(t.prospect_id);
      assertContactable(p);
      const now = new Date().toISOString();
      await pg(`prospect_touches?id=eq.${touchId}`, {
        method: "PATCH",
        write: true,
        body: JSON.stringify({ status: "sent", sent_at: now, decided_at: now }),
      });
      return await patchProspect(p.id, {
        status: EARLY.includes(p.status) ? "contacted" : p.status,
        last_contacted_at: now,
        next_followup_at: daysFromNow(int(a, "followup_in_days", 1, 60, DEFAULT_FOLLOWUP_DAYS)!),
      });
    },
  },
  {
    name: "log_reply",
    description:
      "Record a reply from a prospect and your classification of it. Clears the scheduled follow-up. 'unsubscribe' marks the prospect do_not_contact immediately. 'interested' moves it to 'replied'.",
    inputSchema: {
      type: "object",
      properties: {
        prospect_id: idProp,
        channel: { type: "string", enum: CHANNELS },
        body: strProp("The reply text."),
        classification: { type: "string", enum: CLASSIFICATIONS },
      },
      required: ["prospect_id", "channel", "body", "classification"],
    },
    async run(a) {
      const id = uuid(a, "prospect_id");
      const p = await getProspect(id);
      const classification = oneOf(a, "classification", CLASSIFICATIONS, true)!;
      const touch = await pg("prospect_touches", {
        method: "POST",
        write: true,
        body: JSON.stringify({
          prospect_id: id,
          channel: oneOf(a, "channel", CHANNELS, true),
          direction: "inbound",
          status: "received",
          body: str(a, "body", 10000, true),
          classification,
        }),
      });
      const patch: Record<string, unknown> = { next_followup_at: null };
      if (classification === "unsubscribe") {
        patch.do_not_contact = true;
        patch.do_not_contact_reason = "Asked to stop (logged reply)";
      } else if (classification === "not_interested") {
        patch.status = "lost";
      } else if (!["meeting", "proposal", "won"].includes(p.status)) {
        patch.status = "replied";
      }
      return { touch: touch[0], prospect: await patchProspect(id, patch) };
    },
  },
  {
    name: "list_due_followups",
    description:
      "Prospects whose follow-up date has arrived (or passed), most overdue first. Excludes do_not_contact. Use draft_outreach with the next step for each.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } },
    async run(a) {
      return await pg(
        `prospects?next_followup_at=lte.${encodeURIComponent(new Date().toISOString())}&do_not_contact=eq.false` +
          `&select=id,company,contact_name,email,tier,status,fit_score,last_contacted_at,next_followup_at` +
          `&order=next_followup_at.asc&limit=${int(a, "limit", 1, 100, 25)}`
      );
    },
  },
  {
    name: "set_prospect_status",
    description:
      "Move a prospect to a status (e.g. meeting, proposal, won, lost, disqualified) with an optional note. Terminal statuses clear the follow-up.",
    inputSchema: {
      type: "object",
      properties: { id: idProp, status: { type: "string", enum: STATUSES }, note: strProp("Appended to notes.") },
      required: ["id", "status"],
    },
    async run(a) {
      const id = uuid(a, "id");
      const p = await getProspect(id);
      const status = oneOf(a, "status", STATUSES, true)!;
      const note = str(a, "note", 1000);
      const patch: Record<string, unknown> = { status };
      if (["won", "lost", "disqualified"].includes(status)) patch.next_followup_at = null;
      if (note) {
        const prior = typeof p.notes === "string" && p.notes ? `${p.notes}\n` : "";
        patch.notes = `${prior}[${new Date().toISOString().slice(0, 10)}] ${note}`.slice(0, 5000);
      }
      return await patchProspect(id, patch);
    },
  },
  {
    name: "mark_do_not_contact",
    description: "Permanently stop all outreach to a prospect (opt-out, wrong fit, asked by a third party). Clears the follow-up.",
    inputSchema: {
      type: "object",
      properties: { id: idProp, reason: strProp("Why.") },
      required: ["id", "reason"],
    },
    async run(a) {
      const id = uuid(a, "id");
      return await patchProspect(id, {
        do_not_contact: true,
        do_not_contact_reason: str(a, "reason", 500, true),
        next_followup_at: null,
      });
    },
  },
  {
    name: "pipeline_summary",
    description: "Counts of prospects per status, plus drafts waiting and follow-ups due. A quick read on where the funnel stands.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      const [rows, drafts, due]: [Array<{ status: string }>, Array<{ id: string }>, Array<{ id: string }>] = await Promise.all([
        pg("prospects?select=status&limit=10000"),
        pg("prospect_touches?status=eq.draft&select=id&limit=10000"),
        pg(`prospects?next_followup_at=lte.${encodeURIComponent(new Date().toISOString())}&do_not_contact=eq.false&select=id&limit=10000`),
      ]);
      const byStatus: Record<string, number> = {};
      for (const r of rows ?? []) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      return { total: rows?.length ?? 0, by_status: byStatus, drafts_waiting: drafts?.length ?? 0, followups_due: due?.length ?? 0 };
    },
  },
];

const toolsByName = new Map(tools.map((t) => [t.name, t]));

// ---- JSON-RPC --------------------------------------------------------------

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handle(req: RpcRequest) {
  const isNotification = req.id === undefined;
  switch (req.method) {
    case "initialize": {
      const asked = typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "";
      return rpcResult(req.id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Restart's outbound prospecting memory. Research and write the content yourself, then save it with these tools. Drafts are never sent from here: the user sends them and confirms before you call mark_touch_sent. Respect do_not_contact.",
      });
    }
    case "ping":
      return rpcResult(req.id, {});
    case "tools/list":
      return rpcResult(req.id, {
        tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
    case "tools/call": {
      const tool = toolsByName.get(String(req.params?.name ?? ""));
      if (!tool) return rpcError(req.id, -32602, `Unknown tool: ${String(req.params?.name)}`);
      try {
        const out = await tool.run((req.params?.arguments as Args) ?? {});
        return rpcResult(req.id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        // Tool failures go back as a result with isError so Claude can read
        // the message and adjust, rather than as a protocol error.
        return rpcResult(req.id, {
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        });
      }
    }
    default:
      return isNotification ? null : rpcError(req.id, -32601, `Method not found: ${req.method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !tokenMatches(auth.slice(7).trim())) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter((r) => r !== null);
    return out.length ? json(out) : new Response(null, { status: 202 });
  }
  const out = await handle(body);
  return out ? json(out) : new Response(null, { status: 202 });
});
__RESTART_FN_EOF__
echo "console-outreach-mcp written"
