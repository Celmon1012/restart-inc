#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container (restart-backend service).
# console-ops-mcp: the MCP server for running Restart from Claude Code / OpenClaw. Too big to paste in one go,
# so it is two scripts: run part 1, then part 2 (it appends), and check the last line shows the file size.
# PART 1 of 2
set -e
mkdir -p /home/deno/functions/console-ops-mcp
cat > /home/deno/functions/console-ops-mcp/index.ts <<'__RESTART_FN_EOF__'
// MCP server for running Restart from Claude Code (or any MCP client, such as OpenClaw): see every
// project, task and teammate, assign and complete work, and, with the owner token, read finance.
//
// What it can do, and what it never does:
//   - Reads: projects, milestones, checklist tasks, server requests, the team, and (owner token
//     only) invoices, expenses and cash position, read-only.
//   - Writes: create and change tasks and milestones, set a project's lead, add internal notes.
//     Every write leaves an "agent" entry on the milestone's activity timeline, so the console shows
//     what Claude did and what a person did.
//   - Never: deletes anything, sends anything to a client, changes billing or infrastructure. A
//     message for a client is saved as a proposal that a person approves in the console, exactly
//     like the console's other agent proposals.
//
// Transport: MCP streamable HTTP, JSON responses only. Connect Claude Code with:
//   claude mcp add --transport http restart-console \
//     https://<supabase-host>/functions/v1/console-ops-mcp \
//     --header "Authorization: Bearer <token>"
//
// Two static bearer tokens, set as secrets on the edge runtime:
//   CONSOLE_MCP_TOKEN        Ops tier: everything above except finance.
//   CONSOLE_MCP_OWNER_TOKEN  Owner tier: Ops tier plus the read-only finance tools.
// Either may be left unset. A request without a matching token gets a 401 and touches nothing.
// Rotate a token by changing the secret; nothing else depends on it.
//
// Zero external imports, same cold-start reasoning as every other function here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LAGO_API_URL = (Deno.env.get("LAGO_API_URL") ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = Deno.env.get("LAGO_API_KEY") ?? "";
const OPS_TOKEN = Deno.env.get("CONSOLE_MCP_TOKEN") ?? "";
const OWNER_TOKEN = Deno.env.get("CONSOLE_MCP_OWNER_TOKEN") ?? "";

const SERVER_INFO = { name: "restart-console", version: "0.1.0" };
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Tier = "ops" | "owner";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ---- data access ---------------------------------------------------------------------------

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
  if (!res.ok) throw new Error(`Database ${path.split("?")[0]} -> ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function lago(path: string) {
  if (!LAGO_API_KEY) throw new Error("Billing isn't reachable from here (LAGO_API_KEY is not set on the edge runtime).");
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, { headers: { Authorization: `Bearer ${LAGO_API_KEY}` } });
  if (!res.ok) throw new Error(`Lago ${path.split("?")[0]} -> ${res.status}`);
  return res.json();
}

function tokenMatches(given: string, expected: string) {
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ---- argument helpers ----------------------------------------------------------------------

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
  if (!UUID_RE.test(v)) throw new Error(`${key} must be an id (UUID)`);
  return v;
}

function date(a: Args, key: string): string | null | undefined {
  // undefined = not given, null = clear it, string = YYYY-MM-DD
  if (!(key in a)) return undefined;
  const v = a[key];
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !DATE_RE.test(v)) throw new Error(`${key} must be a date like 2026-10-31, or null to clear it`);
  return v;
}

function limit(a: Args, fallback: number, max: number): number {
  const v = a.limit;
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > max) throw new Error(`limit must be a whole number from 1 to ${max}`);
  return v;
}

const today = () => new Date().toISOString().slice(0, 10);

// ---- the team ------------------------------------------------------------------------------

interface Member {
  id: string;
  email: string;
  roles: string[];
}

async function team(): Promise<Member[]> {
  const [usersRes, roleRows] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }),
    pg("staff_roles?select=user_id,role") as Promise<Array<{ user_id: string; role: string }>>,
  ]);
  if (!usersRes.ok) throw new Error(`Couldn't read the team (${usersRes.status})`);
  const users: Array<{ id: string; email?: string; app_metadata?: { is_admin?: boolean } }> = (await usersRes.json())?.users ?? [];
  const rolesOf = new Map<string, string[]>();
  for (const r of roleRows ?? []) rolesOf.set(r.user_id, [...(rolesOf.get(r.user_id) ?? []), r.role]);
  return users
    .map((u) => {
      const roles = new Set(rolesOf.get(u.id) ?? []);
      if (u.app_metadata?.is_admin) roles.add("owner");
      return { id: u.id, email: u.email ?? "", roles: [...roles].sort() };
    })
    .filter((m) => m.roles.length > 0)
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** Who a task or a project can be assigned to: owners and Ops. */
async function assignable(email: string): Promise<Member> {
  const wanted = email.trim().toLowerCase();
  const found = (await team()).find((m) => m.email.toLowerCase() === wanted && (m.roles.includes("owner") || m.roles.includes("ops")));
  if (!found) throw new Error(`${email} isn't an owner or Ops teammate. Use list_team to see who can be assigned.`);
  return found;
}

// ---- shared lookups ------------------------------------------------------------------------

interface Workspace {
  id: string;
  name: string;
  contact_email: string | null;
  engagement_type: string | null;
  lead_id: string | null;
  archived_at: string | null;
  [k: string]: unknown;
}
interface Milestone {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  sort_order: number;
}
interface Task {
  id: string;
  deliverable_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  owner: "team" | "client";
  assignee_id: string | null;
  due_at: string | null;
}

const MILESTONE_STATUSES = ["not-started", "in-progress", "completed", "blocked"] as const;

async function getWorkspace(id: string): Promise<Workspace> {
  const rows: Workspace[] = await pg(`workspaces?id=eq.${id}&select=*`);
  if (!rows?.length) throw new Error(`No project with id ${id}`);
  return rows[0];
}

async function getMilestone(id: string): Promise<Milestone> {
  const rows: Milestone[] = await pg(`deliverables?id=eq.${id}&select=*`);
  if (!rows?.length) throw new Error(`No milestone with id ${id}`);
  return rows[0];
}

async function getTask(id: string): Promise<Task> {
  const rows: Task[] = await pg(`deliverable_tasks?id=eq.${id}&select=*`);
  if (!rows?.length) throw new Error(`No task with id ${id}`);
  return rows[0];
}

/** One line on the milestone's timeline saying the agent did something, so a person can see it. */
async function logAgent(deliverableId: string, body: string, payload: Record<string, unknown> = {}) {
  try {
    await pg("deliverable_activities", {
      method: "POST",
      write: true,
      body: JSON.stringify({ deliverable_id: deliverableId, actor: "agent", activity_type: "agent_auto_action", body, payload, status: "complete" }),
    });
  } catch {
    // The change itself already went through; a missing timeline line must not undo or hide it.
  }
}

const emailOf = (members: Member[], id: string | null) => (id ? members.find((m) => m.id === id)?.email ?? null : null);

// ---- tools ---------------------------------------------------------------------------------

interface Tool {
  name: string;
  description: string;
  tier: Tier; // the lowest tier that may use it
  inputSchema: Record<string, unknown>;
  run: (a: Args) => Promise<unknown>;
}

const prop = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const noArgs = { type: "object", properties: {}, additionalProperties: false };

const tools: Tool[] = [
  // -------- overview and reading --------
  {
    name: "portfolio_overview",
    tier: "ops",
    description:
      "The whole picture in one call: projects by state, open and overdue tasks, tasks waiting on clients, blocked milestones, server requests awaiting review, and each teammate's workload. Start here.",
    inputSchema: noArgs,
    run: async () => {
      const [workspaces, milestones, tasks, requests, members]: [Workspace[], Milestone[], Task[], Array<{ status: string }>, Member[]] = await Promise.all([
        pg("workspaces?select=id,name,lead_id,archived_at"),
        pg("deliverables?select=id,workspace_id,title,status,due_at"),
        pg("deliverable_tasks?select=id,deliverable_id,is_done,owner,assignee_id,due_at"),
        pg("server_requests?select=status").catch(() => []),
        team(),
      ]);
      const live = workspaces.filter((w) => !w.archived_at);
      const t = today();
      const open = tasks.filter((x) => !x.is_done);
      const overdue = open.filter((x) => x.due_at && x.due_at < t);
      const perPerson = members
        .filter((m) => m.roles.includes("owner") || m.roles.includes("ops"))
        .map((m) => ({
          email: m.email,
          leads_projects: live.filter((w) => w.lead_id === m.id).length,
          open_tasks: open.filter((x) => x.owner === "team" && x.assignee_id === m.id).length,
          overdue_tasks: overdue.filter((x) => x.owner === "team" && x.assignee_id === m.id).length,
        }));
      return {
        projects: live.length,
        projects_without_lead: live.filter((w) => !w.lead_id).length,
        milestones: { total: milestones.length, blocked: milestones.filter((m) => m.status === "blocked").length, in_progress: milestones.filter((m) => m.status === "in-progress").length },
        tasks: {
          open: open.length,
          overdue: overdue.length,
          waiting_on_client: open.filter((x) => x.owner === "client").length,
          team_unassigned: open.filter((x) => x.owner === "team" && !x.assignee_id).length,
        },
        server_requests_awaiting_review: (requests ?? []).filter((r) => r.status === "pending_review").length,
        team: perPerson,
      };
    },
  },
  {
    name: "list_projects",
    tier: "ops",
    description: "List projects (client engagements) with lead, progress and what's due next. Filter by lead (an email, or 'none'), or search by name.",
    inputSchema: {
      type: "object",
      properties: {
        lead: prop("A teammate's email, or 'none' for projects without a lead."),
        search: prop("Part of the project or client name."),
        include_archived: { type: "boolean", description: "Include archived projects. Default false." },
      },
      additionalProperties: false,
    },
    run: async (a) => {
      const lead = str(a, "lead", 200);
      const search = str(a, "search", 80)?.toLowerCase();
      const [workspaces, milestones, tasks, members]: [Workspace[], Milestone[], Task[], Member[]] = await Promise.all([
        pg("workspaces?select=*&order=name"),
        pg("deliverables?select=id,workspace_id,title,status,due_at"),
        pg("deliverable_tasks?select=id,deliverable_id,is_done,owner,due_at"),
        team(),
      ]);
      const leadId = lead && lead !== "none" ? members.find((m) => m.email.toLowerCase() === lead.toLowerCase())?.id : undefined;
      if (lead && lead !== "none" && !leadId) throw new Error(`No teammate with email ${lead}`);
      const wsOfMilestone = new Map(milestones.map((m) => [m.id, m.workspace_id]));
      return workspaces
        .filter((w) => a.include_archived === true || !w.archived_at)
        .filter((w) => !search || w.name.toLowerCase().includes(search) || (w.contact_email ?? "").toLowerCase().includes(search))
        .filter((w) => !lead || (lead === "none" ? !w.lead_id : w.lead_id === leadId))
        .map((w) => {
          const mine = milestones.filter((m) => m.workspace_id === w.id);
          const myTasks = tasks.filter((x) => wsOfMilestone.get(x.deliverable_id) === w.id);
          return {
            id: w.id,
            name: w.name,
            client_email: w.contact_email,
            engagement: w.engagement_type,
            lead: emailOf(members, w.lead_id),
            archived: Boolean(w.archived_at),
            milestones: `${mine.filter((m) => m.status === "completed").length}/${mine.length} complete`,
            current_milestone: mine.find((m) => m.status === "in-progress")?.title ?? null,
            blocked_milestones: mine.filter((m) => m.status === "blocked").length,
            open_tasks: myTasks.filter((x) => !x.is_done).length,
            next_due: mine.filter((m) => m.status !== "completed" && m.due_at).map((m) => m.due_at as string).sort()[0] ?? null,
          };
        });
    },
  },
  {
    name: "get_project",
    tier: "ops",
    description:
      "Everything about one project: the brief and contact, its lead, every milestone with its checklist tasks (ids included, so you can update them), recent timeline activity, and server requests. Use this before changing anything on a project.",
    inputSchema: { type: "object", properties: { project_id: prop("Project id (UUID) from list_projects.") }, required: ["project_id"], additionalProperties: false },
    run: async (a) => {
      const id = uuid(a, "project_id");
      const ws = await getWorkspace(id);
      const milestones: Milestone[] = await pg(`deliverables?workspace_id=eq.${id}&select=*&order=sort_order`);
      const ids = milestones.map((m) => m.id);
      const inList = ids.length ? `in.(${ids.join(",")})` : "in.(00000000-0000-0000-0000-000000000000)";
      const [tasks, activities, requests, members]: [Task[], Array<Record<string, unknown>>, Array<Record<string, unknown>>, Member[]] = await Promise.all([
        pg(`deliverable_tasks?deliverable_id=${inList}&select=*&order=sort_order`),
        pg(`deliverable_activities?deliverable_id=${inList}&select=deliverable_id,created_at,actor,activity_type,body,status&order=created_at.desc&limit=40`),
        pg(`server_requests?workspace_id=eq.${id}&select=id,kind,status,reason,engineer_note,created_at&order=created_at.desc&limit=10`).catch(() => []),
        team(),
      ]);
      return {
        project: {
          id: ws.id,
          name: ws.name,
          client_email: ws.contact_email,
          engagement: ws.engagement_type,
          lead: emailOf(members, ws.lead_id),
          brief: (ws.onboarding as { brief?: string } | null)?.brief ?? null,
          archived: Boolean(ws.archived_at),
        },
        milestones: milestones.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          status: m.status,
          due: m.due_at?.slice(0, 10) ?? null,
          tasks: tasks
            .filter((x) => x.deliverable_id === m.id)
            .map((x) => ({
              id: x.id,
              title: x.title,
              done: x.is_done,
              owner: x.owner,
              assignee: emailOf(members, x.assignee_id),
              due: x.due_at,
              overdue: !x.is_done && Boolean(x.due_at) && (x.due_at as string) < today(),
            })),
          recent_activity: activities.filter((x) => x.deliverable_id === m.id).slice(0, 5),
        })),
        server_requests: requests,
      };
    },
  },
  {
    name: "list_tasks",
    tier: "ops",
    description:
      "Checklist tasks across every project, newest deadline first. Filter by status (open, overdue, done, all), by who it's for (a teammate's email, 'unassigned', or 'client' for tasks waiting on the client), by project, or by a due date.",
    inputSchema: {
      type: "object",
      properties: {
        status: prop("open (default), overdue, done or all.", { enum: ["open", "overdue", "done", "all"] }),
        assignee: prop("A teammate's email, 'unassigned' (team tasks with nobody), or 'client'."),
        project_id: prop("Only this project (UUID)."),
        due_before: prop("Only tasks due on or before this date (YYYY-MM-DD)."),
        limit: { type: "integer", description: "Maximum tasks to return (default 100, up to 300)." },
      },
      additionalProperties: false,
    },
    run: async (a) => {
      const status = oneOf(a, "status", ["open", "overdue", "done", "all"] as const) ?? "open";
      const assignee = str(a, "assignee", 200);
      const projectId = a.project_id ? uuid(a, "project_id") : undefined;
      const dueBefore = date(a, "due_before") ?? undefined;
      const max = limit(a, 100, 300);
      const [tasks, milestones, workspaces, members]: [Task[], Milestone[], Workspace[], Member[]] = await Promise.all([
        pg("deliverable_tasks?select=*&order=due_at.asc.nullslast"),
        pg("deliverables?select=id,workspace_id,title,status"),
        pg("workspaces?select=id,name"),
        team(),
      ]);
      const msById = new Map(milestones.map((m) => [m.id, m]));
      const wsById = new Map(workspaces.map((w) => [w.id, w.name]));
      const assigneeId = assignee && !["unassigned", "client"].includes(assignee) ? members.find((m) => m.email.toLowerCase() === assignee.toLowerCase())?.id : undefined;
      if (assignee && !["unassigned", "client"].includes(assignee) && !assigneeId) throw new Error(`No teammate with email ${assignee}`);
      const t = today();
      return tasks
        .filter((x) => (status === "all" ? true : status === "done" ? x.is_done : status === "open" ? !x.is_done : !x.is_done && Boolean(x.due_at) && (x.due_at as string) < t))
        .filter((x) => !projectId || msById.get(x.deliverable_id)?.workspace_id === projectId)
        .filter((x) => !dueBefore || (x.due_at !== null && x.due_at <= dueBefore))
        .filter((x) => !assignee || (assignee === "client" ? x.owner === "client" : assignee === "unassigned" ? x.owner === "team" && !x.assignee_id : x.assignee_id === assigneeId))
        .slice(0, max)
        .map((x) => {
          const m = msById.get(x.deliverable_id);
          return {
            id: x.id,
            title: x.title,
            done: x.is_done,
            owner: x.owner,
            assignee: emailOf(members, x.assignee_id),
            due: x.due_at,
            overdue: !x.is_done && Boolean(x.due_at) && (x.due_at as string) < t,
            project: m ? wsById.get(m.workspace_id) ?? null : null,
            project_id: m?.workspace_id ?? null,
            milestone: m?.title ?? null,
            milestone_id: x.deliverable_id,
            milestone_status: m?.status ?? null,
          };
        });
    },
  },
  {
    name: "list_team",
    tier: "ops",
    description: "Everyone with a staff role (owner, ops, finance), with their open and overdue task counts. Only owners and Ops can be assigned work.",
    inputSchema: noArgs,
    run: async () => {
      const [members, tasks]: [Member[], Array<{ is_done: boolean; owner: string; assignee_id: string | null; due_at: string | null }>] = await Promise.all([
        team(),
        pg("deliverable_tasks?select=is_done,owner,assignee_id,due_at"),
      ]);
      const t = today();
      return members.map((m) => ({
        email: m.email,
        roles: m.roles,
        can_be_assigned: m.roles.includes("owner") || m.roles.includes("ops"),
        open_tasks: tasks.filter((x) => !x.is_done && x.owner === "team" && x.assignee_id === m.id).length,
        overdue_tasks: tasks.filter((x) => !x.is_done && x.owner === "team" && x.assignee_id === m.id && x.due_at && x.due_at < t).length,
      }));
    },
  },
  {
    name: "list_server_requests",
    tier: "ops",
    description: "Server capacity requests from clients (read-only). Reviewing and quoting them is done in the console.",
__RESTART_FN_EOF__
wc -l /home/deno/functions/console-ops-mcp/index.ts
