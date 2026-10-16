// Every checklist item across every client in one compact table -- the "what's on our plate" view
// Projects can't give, since Projects is one client at a time. Tasks are console.deliverable_tasks;
// embedding the parent deliverable and its workspace works because both FKs exist, and RLS lets an
// admin read every row. Status and priority change in place; tick rows for bulk changes.

import { Fragment, useState } from "react";
import { useLocation } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { consoleSchema } from "@/lib/supabase";
import { loadTeamMembers, loadWorkspaceNames } from "@/lib/admin";
import { useAuth } from "@/contexts/AuthContext";
import { AddTask } from "@/components/admin/AddTask";
import { RowMenu } from "@/components/admin/RowMenu";
import { TaskEditForm, assigneeLabel } from "@/components/admin/TaskEdit";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { Search } from "lucide-react";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { toast } from "sonner";
import type { Deliverable } from "@/lib/deliverables";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_RANK,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  priorityOfTask,
  statusOfTask,
  type TaskPriority,
  type TaskStatus
} from "@/lib/tasks";

interface TaskRow {
  id: string;
  title: string;
  is_done: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_at?: string | null;
  sort_order: number;
  created_at: string;
  owner: "team" | "client";
  assignee_id: string | null;
  due_at: string | null;
  deliverable: {
    id: string;
    title: string;
    status: Deliverable["status"];
    due_at: string | null;
    sort_order: number;
    workspace: { id: string; name: string } | null;
  } | null;
}

// "open" = everything not complete; a status value filters to just that status.
type Filter = "open" | "overdue" | "all" | TaskStatus;
// "anyone", "mine", "unassigned", "client", or a team member's user id.
type Who = string;

export default function AdminTasks() {
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [who, setWho] = useState<Who>("anyone");
  const [project, setProject] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDue, setBulkDue] = useState("");
  const [, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const { user } = useAuth();
  const team = useAsyncResource(() => loadTeamMembers(), []);

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<TaskRow[]>(
    async (signal) => {
      const [tasksRes, deliverablesRes, names] = await Promise.all([
        // "*" so the page still loads before the status/priority migration has been applied.
        consoleSchema().from("deliverable_tasks").select("*").order("sort_order", { ascending: true }),
        consoleSchema().from("deliverables").select("id,title,status,due_at,sort_order,workspace_id"),
        loadWorkspaceNames()
      ]);
      if (signal.aborted) return [];
      if (tasksRes.error) throw tasksRes.error;
      if (deliverablesRes.error) throw deliverablesRes.error;
      const deliverables = new Map((deliverablesRes.data ?? []).map((d) => [d.id as string, d]));
      return (tasksRes.data ?? []).map((t) => {
        const d = deliverables.get(t.deliverable_id);
        return {
          ...t,
          deliverable: d
            ? {
                id: d.id,
                title: d.title,
                status: d.status,
                due_at: d.due_at,
                sort_order: d.sort_order,
                workspace: names.has(d.workspace_id) ? { id: d.workspace_id, name: names.get(d.workspace_id)! } : null
              }
            : null
        } as TaskRow;
      });
    },
    [],
    { errorMessage: "Failed to load tasks" }
  );
  const tasks = data ?? [];

  /** Write a change to one or more tasks, retrying once on a dropped connection. */
  const update = async (ids: string[], patch: Record<string, unknown>) => {
    if (ids.length === 0) return false;
    const write = () => consoleSchema().from("deliverable_tasks").update(patch).in("id", ids);
    let { error: updateError } = await write();
    if (updateError && /fetch|network/i.test(updateError.message)) {
      await new Promise((r) => setTimeout(r, 700));
      ({ error: updateError } = await write());
    }
    if (updateError) {
      const missing = /status|priority|start_at/.test(updateError.message) && /column|schema cache/i.test(updateError.message);
      toast.error(
        missing
          ? "Status and priority need the task migration (20261017120000). Apply it, then try again."
          : /fetch|network/i.test(updateError.message)
            ? "Couldn't reach the server. Check your connection and try again."
            : updateError.message
      );
      return false;
    }
    await refresh();
    return true;
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const isDone = (t: TaskRow) => statusOfTask(t) === "complete";
  const isOverdue = (t: TaskRow) => !isDone(t) && Boolean(t.due_at) && (t.due_at as string) < todayIso;
  const overdueTasks = tasks.filter(isOverdue).length;
  const mine = (t: TaskRow) => t.owner === "team" && t.assignee_id === user?.id;

  const needle = search.trim().toLowerCase();
  const visible = tasks
    .filter(
      (t) =>
        (filter === "all" ||
          (filter === "open" ? !isDone(t) : filter === "overdue" ? isOverdue(t) : statusOfTask(t) === filter)) &&
        (priorityFilter === "all" || priorityOfTask(t) === priorityFilter) &&
        (project === "all" || t.deliverable?.workspace?.id === project) &&
        (who === "anyone" ||
          (who === "client"
            ? t.owner === "client"
            : who === "mine"
              ? mine(t)
              : who === "unassigned"
                ? t.owner === "team" && !t.assignee_id
                : t.owner === "team" && t.assignee_id === who)) &&
        (!needle || [t.title, t.deliverable?.title, t.deliverable?.workspace?.name].some((v) => v?.toLowerCase().includes(needle)))
    )
    // Soonest deadline first, tasks without one last; then the more urgent first, then project and milestone order.
    .sort(
      (a, b) =>
        (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") ||
        TASK_PRIORITY_RANK[priorityOfTask(b)] - TASK_PRIORITY_RANK[priorityOfTask(a)] ||
        (a.deliverable?.workspace?.name ?? "").localeCompare(b.deliverable?.workspace?.name ?? "") ||
        (a.deliverable?.sort_order ?? 0) - (b.deliverable?.sort_order ?? 0) ||
        a.sort_order - b.sort_order
    );
  const projects = Array.from(
    new Map(tasks.filter((t) => t.deliverable?.workspace).map((t) => [t.deliverable!.workspace!.id, t.deliverable!.workspace!.name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const statusCount = (s: TaskStatus) => tasks.filter((t) => statusOfTask(t) === s).length;
  const myStatusCount = (s: TaskStatus) => tasks.filter((t) => statusOfTask(t) === s && mine(t)).length;

  const visibleIds = visible.map((t) => t.id);
  const picked = visibleIds.filter((id) => selected.has(id));
  const allPicked = visibleIds.length > 0 && picked.length === visibleIds.length;
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const bulk = async (patch: Record<string, unknown>, done: string) => {
    if (await update(picked, patch)) {
      toast.success(`${done} (${picked.length})`);
      setSelected(new Set());
      setBulkDue("");
    }
  };

  const exportCsv = () =>
    downloadCsv(
      `restart-tasks-${todayIso}.csv`,
      ["task", "project", "milestone", "status", "priority", "assignee", "start", "due"],
      visible.map((t) => [
        t.title,
        t.deliverable?.workspace?.name ?? "",
        t.deliverable?.title ?? "",
        TASK_STATUS_LABEL[statusOfTask(t)],
        TASK_PRIORITY_LABEL[priorityOfTask(t)],
        assigneeLabel(t, team.data ?? []),
        t.start_at ?? "",
        t.due_at ?? ""
      ])
    );

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading tasks" : error ? `Could not load tasks: ${error}` : `${visible.length} tasks shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Tasks</h1>
          <p>Every checklist item across every client, in one list.</p>
        </div>
        <AddTask onAdded={refresh} />
      </div>

      {error && <ErrorAlert message={`Couldn't load tasks: ${error}`} onRetry={retry} retryLabel="Reload tasks" />}

      {!loading && tasks.length > 0 && (
        <div className="task-strip">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`task-strip-tile st-${s} ${filter === s ? "active" : ""}`}
              onClick={() => setFilter(filter === s ? "open" : s)}
              aria-pressed={filter === s}
            >
              <span><strong>{statusCount(s)}</strong> {TASK_STATUS_LABEL[s]}</span>
              <em>My tasks: {myStatusCount(s)}</em>
            </button>
          ))}
        </div>
      )}

      <div className="admin-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Status">
          <option value="open">Open</option>
          <option value="overdue">Overdue ({overdueTasks})</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
          <option value="all">All statuses</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "all" | TaskPriority)} aria-label="Priority">
          <option value="all">Any priority</option>
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>)}
        </select>
        <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
          <option value="all">All projects</option>
          {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Assigned to">
          <option value="anyone">Anyone</option>
          <option value="mine">Mine</option>
          <option value="unassigned">Team, unassigned</option>
          <option value="client">Waiting on client</option>
          {(team.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.email.split("@")[0]}</option>)}
        </select>
        <span className="admin-toolbar-spacer" />
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search tasks, milestones, projects…" aria-label="Search tasks" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="dash-tab-btn" onClick={exportCsv} disabled={visible.length === 0}>Export CSV</button>
      </div>

      {picked.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <strong>{picked.length} selected</strong>
          <button className="dash-tab-btn" onClick={() => void bulk({ status: "complete" }, "Marked complete")}>Mark complete</button>
          <select value="" onChange={(e) => e.target.value && void bulk({ status: e.target.value }, "Status set")} aria-label="Set status">
            <option value="">Set status…</option>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
          </select>
          <select value="" onChange={(e) => e.target.value && void bulk({ priority: e.target.value }, "Priority set")} aria-label="Set priority">
            <option value="">Set priority…</option>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>)}
          </select>
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              void bulk(v === "client" ? { owner: "client", assignee_id: null } : v === "none" ? { owner: "team", assignee_id: null } : { owner: "team", assignee_id: v }, "Assigned");
            }}
            aria-label="Assign to"
          >
            <option value="">Assign to…</option>
            {(team.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.email.split("@")[0]}</option>)}
            <option value="client">Client to do</option>
            <option value="none">Unassigned</option>
          </select>
          <label className="admin-muted">
            Due <input type="date" value={bulkDue} onChange={(e) => setBulkDue(e.target.value)} aria-label="Set due date" />
          </label>
          {bulkDue && <button className="dash-tab-btn active" onClick={() => void bulk({ due_at: bulkDue }, "Due date set")}>Apply</button>}
          <span className="admin-toolbar-spacer" />
          <button className="dash-tab-btn" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading tasks…" />
      ) : error ? null : tasks.length === 0 ? (
        <EmptyState title="No checklist items yet" hint="Add checklist items to milestones from Projects and they appear here." />
      ) : visible.length === 0 ? (
        <div className="dash-empty-state">No tasks match this view.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table tasks-compact">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allPicked}
                    onChange={() => setSelected(allPicked ? new Set() : new Set(visibleIds))}
                    aria-label="Select all shown tasks"
                  />
                </th>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Start</th>
                <th>Due</th>
                <th>Assigned to</th>
                <th>Priority</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const ws = t.deliverable?.workspace;
                const status = statusOfTask(t);
                const priority = priorityOfTask(t);
                return (
                  <Fragment key={t.id}>
                    <tr className={isOverdue(t) ? "row-overdue" : undefined}>
                      <td>
                        <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleRow(t.id)} aria-label={`Select ${t.title}`} />
                      </td>
                      <td className="task-name" title={t.deliverable ? `${t.title} · ${t.deliverable.title}` : t.title}>
                        <strong className={status === "complete" ? "done" : undefined}>{t.title}</strong>
                        {t.deliverable && <span className="admin-muted"> · {t.deliverable.title}</span>}
                      </td>
                      <td className="admin-muted">{ws?.name ?? "—"}</td>
                      <td>
                        <select
                          className={`status-select st-${status}`}
                          value={status}
                          onChange={(e) => void update([t.id], { status: e.target.value })}
                          aria-label={`Status of ${t.title}`}
                        >
                          {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td className="admin-muted">{t.start_at ? formatDate(t.start_at) : "—"}</td>
                      <td className={isOverdue(t) ? "admin-danger" : "admin-muted"}>{t.due_at ? formatDate(t.due_at) : "—"}</td>
                      <td>{assigneeLabel(t, team.data ?? [])}</td>
                      <td>
                        <select
                          className={`priority-select pr-${priority}`}
                          value={priority}
                          onChange={(e) => void update([t.id], { priority: e.target.value })}
                          aria-label={`Priority of ${t.title}`}
                        >
                          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>)}
                        </select>
                      </td>
                      <td className="num">
                        <RowMenu
                          label={`Actions for ${t.title}`}
                          items={[
                            { label: "Edit", onClick: () => setEditingId(editingId === t.id ? null : t.id) },
                            { label: status === "complete" ? "Reopen" : "Mark complete", onClick: () => void update([t.id], { status: status === "complete" ? "in_progress" : "complete" }) },
                            ...(ws ? [{ label: "Open project", onClick: () => setLocation(`/admin/projects/${ws.id}`) }] : [])
                          ]}
                        />
                      </td>
                    </tr>
                    {editingId === t.id && (
                      <tr>
                        <td colSpan={9}>
                          <TaskEditForm
                            task={t}
                            team={team.data ?? []}
                            onDone={async (saved) => { setEditingId(null); if (saved) await refresh(); }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9} className="admin-muted">
                  {visible.length} of {tasks.length} tasks · {visible.filter(isOverdue).length} overdue
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ConsoleLayout>
  );
}
