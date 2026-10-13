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
    inputSchema: {
      type: "object",
      properties: { status: prop("open (default), or one status such as pending_review, awaiting_payment, paid, in_progress, done.") },
      additionalProperties: false,
    },
    run: async (a) => {
      const status = str(a, "status", 30) ?? "open";
      const [rows, workspaces]: [Array<Record<string, unknown>>, Workspace[]] = await Promise.all([
        pg("server_requests?select=id,workspace_id,kind,status,requested_tier,hosting,reason,engineer_note,created_at&order=created_at.desc&limit=100"),
        pg("workspaces?select=id,name"),
      ]);
      const names = new Map(workspaces.map((w) => [w.id, w.name]));
      const open = ["pending_review", "awaiting_payment", "paid", "in_progress"];
      return rows
        .filter((r) => (status === "open" ? open.includes(String(r.status)) : status === "all" ? true : r.status === status))
        .map((r) => ({ ...r, project: names.get(String(r.workspace_id)) ?? null }));
    },
  },

  // -------- changing tasks and milestones --------
  {
    name: "create_task",
    tier: "ops",
    description:
      "Add a checklist task to a milestone. owner 'team' (default) is Restart's own work and can name an assignee; owner 'client' is something the client has to do or send, and has no assignee. Dates are YYYY-MM-DD.",
    inputSchema: {
      type: "object",
      properties: {
        milestone_id: prop("Milestone id (UUID) from get_project."),
        title: prop("What needs doing, in a short plain sentence."),
        owner: prop("team (default) or client.", { enum: ["team", "client"] }),
        assignee_email: prop("A teammate's email (team tasks only)."),
        due_date: prop("Deadline, YYYY-MM-DD."),
      },
      required: ["milestone_id", "title"],
      additionalProperties: false,
    },
    run: async (a) => {
      const milestone = await getMilestone(uuid(a, "milestone_id"));
      const title = str(a, "title", 200, true)!;
      const owner = oneOf(a, "owner", ["team", "client"] as const) ?? "team";
      const assigneeEmail = str(a, "assignee_email", 200);
      if (owner === "client" && assigneeEmail) throw new Error("A task for the client can't have a team assignee.");
      const assignee = assigneeEmail ? await assignable(assigneeEmail) : null;
      const due = date(a, "due_date") ?? null;
      const existing: Array<{ sort_order: number }> = await pg(`deliverable_tasks?deliverable_id=eq.${milestone.id}&select=sort_order&order=sort_order.desc&limit=1`);
      const rows: Task[] = await pg("deliverable_tasks", {
        method: "POST",
        write: true,
        body: JSON.stringify({ deliverable_id: milestone.id, title, owner, assignee_id: assignee?.id ?? null, due_at: due, sort_order: existing.length ? existing[0].sort_order + 1 : 0 }),
      });
      await logAgent(milestone.id, `Added task: ${title}${assignee ? ` (assigned to ${assignee.email})` : ""}${due ? `, due ${due}` : ""}`, { task_id: rows[0].id });
      return { created: { id: rows[0].id, title, owner, assignee: assignee?.email ?? null, due }, milestone: milestone.title };
    },
  },
  {
    name: "update_task",
    tier: "ops",
    description:
      "Change a task's title, who it's for, its assignee or its deadline. Pass only what changes. assignee_email null removes the assignee; due_date null removes the deadline. Setting owner 'client' clears any assignee.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: prop("Task id (UUID) from get_project or list_tasks."),
        title: prop("New title."),
        owner: prop("team or client.", { enum: ["team", "client"] }),
        assignee_email: { type: ["string", "null"], description: "A teammate's email, or null to unassign." },
        due_date: { type: ["string", "null"], description: "YYYY-MM-DD, or null to clear." },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
    run: async (a) => {
      const task = await getTask(uuid(a, "task_id"));
      const patch: Record<string, unknown> = {};
      const said: string[] = [];
      const title = str(a, "title", 200);
      if (title) { patch.title = title; said.push(`renamed to "${title}"`); }
      const owner = oneOf(a, "owner", ["team", "client"] as const);
      if (owner) {
        patch.owner = owner;
        said.push(`now for ${owner}`);
        if (owner === "client") patch.assignee_id = null;
      }
      if ("assignee_email" in a) {
        const email = a.assignee_email === null ? null : str(a, "assignee_email", 200) ?? null;
        if (email) {
          if ((owner ?? task.owner) === "client") throw new Error("A task for the client can't have a team assignee.");
          const m = await assignable(email);
          patch.assignee_id = m.id;
          said.push(`assigned to ${m.email}`);
        } else {
          patch.assignee_id = null;
          said.push("unassigned");
        }
      }
      const due = date(a, "due_date");
      if (due !== undefined) { patch.due_at = due; said.push(due ? `due ${due}` : "deadline cleared"); }
      if (Object.keys(patch).length === 0) throw new Error("Nothing to change. Pass at least one of title, owner, assignee_email, due_date.");
      const rows: Task[] = await pg(`deliverable_tasks?id=eq.${task.id}`, { method: "PATCH", write: true, body: JSON.stringify(patch) });
      await logAgent(task.deliverable_id, `Updated task "${rows[0].title}": ${said.join(", ")}`, { task_id: task.id });
      return { updated: rows[0].id, changes: said };
    },
  },
  {
    name: "complete_task",
    tier: "ops",
    description: "Mark a task done (or, with done=false, not done). Do this only when the work really is finished.",
    inputSchema: {
      type: "object",
      properties: { task_id: prop("Task id (UUID)."), done: { type: "boolean", description: "true (default) to complete, false to reopen." } },
      required: ["task_id"],
      additionalProperties: false,
    },
    run: async (a) => {
      const task = await getTask(uuid(a, "task_id"));
      const done = a.done === false ? false : true;
      if (task.is_done === done) return { unchanged: true, task: task.title, done };
      await pg(`deliverable_tasks?id=eq.${task.id}`, { method: "PATCH", write: true, body: JSON.stringify({ is_done: done }) });
      await logAgent(task.deliverable_id, `${done ? "Completed" : "Reopened"} task: ${task.title}`, { task_id: task.id });
      return { task: task.title, done };
    },
  },
  {
    name: "create_milestone",
    tier: "ops",
    description: "Add a milestone to a project, after its existing ones. Clients see the title and description on their Delivery tab, so write both for the client.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: prop("Project id (UUID)."),
        title: prop("Milestone title."),
        description: prop("What this milestone delivers, written for the client."),
        due_date: prop("YYYY-MM-DD."),
        status: prop("not-started (default), in-progress, completed or blocked.", { enum: [...MILESTONE_STATUSES] }),
      },
      required: ["project_id", "title"],
      additionalProperties: false,
    },
    run: async (a) => {
      const ws = await getWorkspace(uuid(a, "project_id"));
      const title = str(a, "title", 160, true)!;
      const last: Array<{ sort_order: number }> = await pg(`deliverables?workspace_id=eq.${ws.id}&select=sort_order&order=sort_order.desc&limit=1`);
      const due = date(a, "due_date");
      const rows: Milestone[] = await pg("deliverables", {
        method: "POST",
        write: true,
        body: JSON.stringify({
          workspace_id: ws.id,
          title,
          description: str(a, "description", 2000) ?? null,
          status: oneOf(a, "status", MILESTONE_STATUSES) ?? "not-started",
          due_at: due ? `${due}T00:00:00Z` : null,
          sort_order: last.length ? last[0].sort_order + 1 : 0,
        }),
      });
      await logAgent(rows[0].id, `Created milestone "${title}"`);
      return { created: { id: rows[0].id, title }, project: ws.name };
    },
  },
  {
    name: "update_milestone",
    tier: "ops",
    description:
      "Change a milestone's status, title, description or due date. Status is what the client sees, so change it only when it's true: in-progress, completed or blocked. due_date null clears it.",
    inputSchema: {
      type: "object",
      properties: {
        milestone_id: prop("Milestone id (UUID)."),
        status: prop("not-started, in-progress, completed or blocked.", { enum: [...MILESTONE_STATUSES] }),
        title: prop("New title."),
        description: prop("New description (client-facing)."),
        due_date: { type: ["string", "null"], description: "YYYY-MM-DD, or null to clear." },
      },
      required: ["milestone_id"],
      additionalProperties: false,
    },
    run: async (a) => {
      const m = await getMilestone(uuid(a, "milestone_id"));
      const patch: Record<string, unknown> = {};
      const said: string[] = [];
      const status = oneOf(a, "status", MILESTONE_STATUSES);
      if (status && status !== m.status) { patch.status = status; said.push(`status ${m.status} to ${status}`); }
      const title = str(a, "title", 160);
      if (title) { patch.title = title; said.push(`renamed to "${title}"`); }
      const description = str(a, "description", 2000);
      if (description) { patch.description = description; said.push("description updated"); }
      const due = date(a, "due_date");
      if (due !== undefined) { patch.due_at = due ? `${due}T00:00:00Z` : null; said.push(due ? `due ${due}` : "due date cleared"); }
      if (Object.keys(patch).length === 0) return { unchanged: true, milestone: m.title };
      await pg(`deliverables?id=eq.${m.id}`, { method: "PATCH", write: true, body: JSON.stringify(patch) });
      await logAgent(m.id, `Updated milestone "${m.title}": ${said.join(", ")}`);
      return { milestone: m.title, changes: said };
    },
  },
  {
    name: "set_project_lead",
    tier: "ops",
    description: "Name the teammate who leads a project (an owner or Ops person), or clear it with lead_email null.",
    inputSchema: {
      type: "object",
      properties: { project_id: prop("Project id (UUID)."), lead_email: { type: ["string", "null"], description: "A teammate's email, or null to clear." } },
      required: ["project_id", "lead_email"],
      additionalProperties: false,
    },
    run: async (a) => {
      const ws = await getWorkspace(uuid(a, "project_id"));
      const email = a.lead_email === null ? null : str(a, "lead_email", 200, true)!;
      const lead = email ? await assignable(email) : null;
      await pg(`workspaces?id=eq.${ws.id}`, { method: "PATCH", write: true, body: JSON.stringify({ lead_id: lead?.id ?? null }) });
      return { project: ws.name, lead: lead?.email ?? null };
    },
  },
  {
    name: "add_note",
    tier: "ops",
    description: "Leave an internal note on a milestone's timeline (never shown to the client). Use it to record what you found or did.",
    inputSchema: {
      type: "object",
      properties: { milestone_id: prop("Milestone id (UUID)."), note: prop("The note.") },
      required: ["milestone_id", "note"],
      additionalProperties: false,
    },
    run: async (a) => {
      const m = await getMilestone(uuid(a, "milestone_id"));
      const note = str(a, "note", 4000, true)!;
      await pg("deliverable_activities", {
        method: "POST",
        write: true,
        body: JSON.stringify({ deliverable_id: m.id, actor: "agent", activity_type: "note", body: note, status: "complete" }),
      });
      return { added: true, milestone: m.title };
    },
  },
  {
    name: "propose_client_update",
    tier: "ops",
    description:
      "Draft an email to the client about a milestone. This only saves a proposal: nothing is sent. A person reviews and approves it in the console (the milestone's Activity section), and only then does the client get it. Keep it short, specific and plain.",
    inputSchema: {
      type: "object",
      properties: { milestone_id: prop("Milestone id (UUID)."), subject: prop("Email subject."), body: prop("Email body, plain text.") },
      required: ["milestone_id", "subject", "body"],
      additionalProperties: false,
    },
    run: async (a) => {
      const m = await getMilestone(uuid(a, "milestone_id"));
      const pending: Array<{ id: string }> = await pg(`deliverable_activities?deliverable_id=eq.${m.id}&activity_type=eq.agent_proposal&status=eq.proposed&select=id`);
      if (pending.length > 0) throw new Error("This milestone already has a proposed client update waiting for review. Ask the user to approve or reject it first.");
      const subject = str(a, "subject", 200, true)!;
      const body = str(a, "body", 6000, true)!;
      await pg("deliverable_activities", {
        method: "POST",
        write: true,
        body: JSON.stringify({
          deliverable_id: m.id,
          actor: "agent",
          activity_type: "agent_proposal",
          body: "Drafted an update for the client, waiting for review.",
          payload: { subject, body },
          requires_approval: true,
          status: "proposed",
        }),
      });
      return { saved: "proposal", sent: false, review_in: `console, project "${(await getWorkspace(m.workspace_id)).name}", Milestones tab, Activity` };
    },
  },

  // -------- finance (owner token only, read-only) --------
  {
    name: "finance_overview",
    tier: "owner",
    description:
      "Read-only money position: cash on hand, what clients owe (total and overdue) in each currency and per client, and the monthly cost run-rate. For invoice detail use list_invoices.",
    inputSchema: noArgs,
    run: async () => {
      const [invoices, settings, expenses] = await Promise.all([
        fetchInvoices(),
        pg("finance_settings?select=usd_ngn,eur_ngn,cash_ngn_cents&id=eq.true").catch(() => []),
        pg("expenses?select=name,amount_cents,currency,cadence,start_date,end_date").catch(() => []) as Promise<Array<{ amount_cents: number; currency: string; cadence: string; end_date: string | null }>>,
      ]);
      const open = invoices.filter((i) => i.status === "finalized" && i.payment_status !== "succeeded");
      const byCurrency: Record<string, { outstanding: number; overdue: number }> = {};
      const byClient: Record<string, { outstanding: number; overdue: number; currency: string }> = {};
      for (const i of open) {
        const due = i.total_due_amount_cents ?? i.total_amount_cents;
        const late = i.payment_overdue === true || (i.payment_due_date ? i.payment_due_date < today() : false);
        const c = (byCurrency[i.currency] ??= { outstanding: 0, overdue: 0 });
        c.outstanding += due;
        if (late) c.overdue += due;
        const name = i.customer?.name ?? i.customer?.external_id ?? "unknown";
        const k = (byClient[name] ??= { outstanding: 0, overdue: 0, currency: i.currency });
        k.outstanding += due;
        if (late) k.overdue += due;
      }
      const s = (settings as Array<{ usd_ngn: number; eur_ngn: number; cash_ngn_cents: number }>)[0];
      const rate = (cur: string) => (cur === "NGN" ? 1 : cur === "USD" ? Number(s?.usd_ngn ?? 0) : cur === "EUR" ? Number(s?.eur_ngn ?? 0) : 0);
      const perMonth = (e: { amount_cents: number; cadence: string }) =>
        e.cadence === "weekly" ? (e.amount_cents * 52) / 12 : e.cadence === "quarterly" ? e.amount_cents / 3 : e.cadence === "annual" ? e.amount_cents / 12 : e.cadence === "monthly" ? e.amount_cents : 0;
      const runRate = expenses.filter((e) => !e.end_date || e.end_date >= today()).reduce((sum, e) => sum + perMonth(e) * rate(e.currency), 0);
      return {
        note: "Amounts are in minor units (kobo or cents): divide by 100.",
        cash_on_hand_ngn: s?.cash_ngn_cents ?? null,
        owed_by_clients: byCurrency,
        owed_by_client: Object.entries(byClient).map(([client, v]) => ({ client, ...v })).sort((x, y) => y.overdue - x.overdue),
        monthly_costs_run_rate_ngn: Math.round(runRate),
        open_invoices: open.length,
      };
    },
  },
  {
    name: "list_invoices",
    tier: "owner",
    description: "Read-only list of invoices from billing. status: open (default), overdue, paid or all. Optionally filter by part of a client's name.",
    inputSchema: {
      type: "object",
      properties: {
        status: prop("open (default), overdue, paid or all.", { enum: ["open", "overdue", "paid", "all"] }),
        client: prop("Part of the client's name."),
        limit: { type: "integer", description: "Maximum invoices (default 50, up to 200)." },
      },
      additionalProperties: false,
    },
    run: async (a) => {
      const status = oneOf(a, "status", ["open", "overdue", "paid", "all"] as const) ?? "open";
      const client = str(a, "client", 80)?.toLowerCase();
      const max = limit(a, 50, 200);
      const invoices = await fetchInvoices();
      return invoices
        .filter((i) => i.status === "finalized")
        .filter((i) => {
          const paid = i.payment_status === "succeeded";
          const late = !paid && (i.payment_overdue === true || (i.payment_due_date ? i.payment_due_date < today() : false));
          return status === "all" ? true : status === "paid" ? paid : status === "open" ? !paid : late;
        })
        .filter((i) => !client || (i.customer?.name ?? i.customer?.external_id ?? "").toLowerCase().includes(client))
        .sort((x, y) => y.issuing_date.localeCompare(x.issuing_date))
        .slice(0, max)
        .map((i) => ({
          number: i.number,
          client: i.customer?.name ?? i.customer?.external_id ?? null,
          issued: i.issuing_date,
          due: i.payment_due_date ?? null,
          status: i.payment_status,
          total: i.total_amount_cents,
          amount_due: i.total_due_amount_cents ?? i.total_amount_cents,
          vat: i.taxes_amount_cents ?? 0,
          currency: i.currency,
          pdf: i.file_url,
        }));
    },
  },
  {
    name: "list_expenses",
    tier: "owner",
    description: "Read-only list of Restart's own recurring and one-off costs (what the business spends), with currency and cadence.",
    inputSchema: noArgs,
    run: async () => {
      const rows: Array<Record<string, unknown>> = await pg("expenses?select=name,category,amount_cents,currency,cadence,start_date,end_date,notes&order=start_date.desc");
      return { note: "Amounts are in minor units: divide by 100.", expenses: rows };
    },
  },
];

interface LagoInvoice {
  number: string;
  issuing_date: string;
  payment_due_date?: string | null;
  status: string;
  payment_status: string;
  payment_overdue?: boolean;
  total_amount_cents: number;
  total_due_amount_cents?: number;
  taxes_amount_cents?: number;
  currency: string;
  file_url: string | null;
  customer?: { external_id?: string; name?: string | null };
}

async function fetchInvoices(): Promise<LagoInvoice[]> {
  const all: LagoInvoice[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await lago(`/invoices?per_page=100&page=${page}`);
    const batch: LagoInvoice[] = res?.invoices ?? [];
    // Breadmaker is a separate business; its money never belongs in Restart's books.
    all.push(...batch.filter((i) => !(i.customer?.external_id ?? "").startsWith("bm-")));
    if (!res?.meta?.next_page || batch.length === 0) break;
  }
  return all;
}

const toolsByName = new Map(tools.map((t) => [t.name, t]));
const allowed = (tier: Tier) => tools.filter((t) => t.tier === "ops" || tier === "owner");

// ---- MCP protocol --------------------------------------------------------------------------

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(req: RpcRequest, tier: Tier) {
  const isNotification = req.id === undefined;
  switch (req.method) {
    case "initialize": {
      const asked = typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "";
      return rpcResult(req.id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Restart's console: projects, milestones, checklist tasks and the team" +
          (tier === "owner" ? ", plus read-only finance." : ".") +
          " Start with portfolio_overview, then get_project before changing anything. Tasks marked owner 'client' are waiting on the client: don't do them, draft a reminder with propose_client_update. You can't send anything to a client or delete anything; a client message is only ever a proposal a person approves. Every change you make is logged on the milestone's timeline as the agent.",
      });
    }
    case "ping":
      return rpcResult(req.id, {});
    case "tools/list":
      return rpcResult(req.id, { tools: allowed(tier).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = toolsByName.get(String(req.params?.name ?? ""));
      if (!tool || !allowed(tier).includes(tool)) return rpcError(req.id, -32602, `Unknown tool: ${String(req.params?.name)}`);
      try {
        const out = await tool.run((req.params?.arguments as Args) ?? {});
        return rpcResult(req.id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        // Tool failures come back as a result with isError so the model can read the message and adjust.
        return rpcResult(req.id, { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true });
      }
    }
    default:
      return isNotification ? null : rpcError(req.id, -32601, `Method not found: ${req.method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const tier: Tier | null = tokenMatches(given, OWNER_TOKEN) ? "owner" : tokenMatches(given, OPS_TOKEN) ? "ops" : null;
  if (!tier) return json({ error: "Unauthorized" }, 401);

  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((r) => handle(r, tier)))).filter((r) => r !== null);
    return out.length ? json(out) : new Response(null, { status: 202 });
  }
  const out = await handle(body, tier);
  return out ? json(out) : new Response(null, { status: 202 });
});
