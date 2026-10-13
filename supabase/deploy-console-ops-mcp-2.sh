#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container (restart-backend service).
# console-ops-mcp: the MCP server for running Restart from Claude Code / OpenClaw. Too big to paste in one go,
# so it is two scripts: run part 1, then part 2 (it appends), and check the last line shows the file size.
# PART 2 of 2 (run after part 1)
set -e
cat >> /home/deno/functions/console-ops-mcp/index.ts <<'__RESTART_FN_EOF__'
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
__RESTART_FN_EOF__
wc -l /home/deno/functions/console-ops-mcp/index.ts
ls -l /home/deno/functions/console-ops-mcp/index.ts
