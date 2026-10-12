// Every checklist item across every client in one table (task, project, assignee, due, status)
// -- the "what's on our plate" view Projects can't give, since Projects is one client at a time. Tasks are console.deliverable_tasks; embedding the parent
// deliverable and its workspace works because both FKs exist, and RLS lets an
// admin read every row.

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
import { Check, Search } from "lucide-react";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { toast } from "sonner";
import type { Deliverable } from "@/lib/deliverables";

interface TaskRow {
  id: string;
  title: string;
  is_done: boolean;
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

type Filter = "open" | "overdue" | "done" | "all";
// "anyone", "mine", "unassigned", "client", or a team member's user id.
type Who = string;

export default function AdminTasks() {
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [who, setWho] = useState<Who>("anyone");
  const [project, setProject] = useState("all");
  const [, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const { user } = useAuth();
  const team = useAsyncResource(() => loadTeamMembers(), []);

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<TaskRow[]>(
    async (signal) => {
      const [tasksRes, deliverablesRes, names] = await Promise.all([
        consoleSchema().from("deliverable_tasks").select("id,title,is_done,sort_order,created_at,deliverable_id,owner,assignee_id,due_at").order("sort_order", { ascending: true }),
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

  const toggle = async (task: TaskRow) => {
    const write = () => consoleSchema().from("deliverable_tasks").update({ is_done: !task.is_done }).eq("id", task.id);
    let { error: updateError } = await write();
    // A dropped connection ("Failed to fetch") is worth one more try before bothering anyone.
    if (updateError && /fetch|network/i.test(updateError.message)) {
      await new Promise((r) => setTimeout(r, 700));
      ({ error: updateError } = await write());
    }
    if (updateError) {
      toast.error(/fetch|network/i.test(updateError.message) ? "Couldn't reach the server. Check your connection and try again." : updateError.message);
      return;
    }
    await refresh();
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const isOverdue = (t: TaskRow) => !t.is_done && Boolean(t.due_at) && (t.due_at as string) < todayIso;
  const overdueTasks = tasks.filter(isOverdue).length;

  const needle = search.trim().toLowerCase();
  const visible = tasks
    .filter(
      (t) =>
        (filter === "all" || (filter === "open" ? !t.is_done : filter === "overdue" ? isOverdue(t) : t.is_done)) &&
        (project === "all" || t.deliverable?.workspace?.id === project) &&
        (who === "anyone" ||
          (who === "client"
            ? t.owner === "client"
            : who === "mine"
              ? t.owner === "team" && t.assignee_id === user?.id
              : who === "unassigned"
                ? t.owner === "team" && !t.assignee_id
                : t.owner === "team" && t.assignee_id === who)) &&
        (!needle || [t.title, t.deliverable?.title, t.deliverable?.workspace?.name].some((v) => v?.toLowerCase().includes(needle)))
    )
    // Soonest deadline first, tasks without one last; ties by project then milestone order.
    .sort(
      (a, b) =>
        (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") ||
        (a.deliverable?.workspace?.name ?? "").localeCompare(b.deliverable?.workspace?.name ?? "") ||
        (a.deliverable?.sort_order ?? 0) - (b.deliverable?.sort_order ?? 0) ||
        a.sort_order - b.sort_order
    );
  const projects = Array.from(
    new Map(tasks.filter((t) => t.deliverable?.workspace).map((t) => [t.deliverable!.workspace!.id, t.deliverable!.workspace!.name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const statusOf = (t: TaskRow): { label: string; tone: "" | "warning" | "down" } =>
    t.is_done
      ? { label: "DONE", tone: "" }
      : isOverdue(t)
        ? { label: "OVERDUE", tone: "down" }
        : t.deliverable?.status === "blocked"
          ? { label: "BLOCKED", tone: "warning" }
          : { label: "OPEN", tone: "" };


  const openCount = tasks.filter((t) => !t.is_done).length;
  const blockedOpen = tasks.filter((t) => !t.is_done && t.deliverable?.status === "blocked").length;
  const overdueOpen = tasks.filter(
    (t) => !t.is_done && t.deliverable?.due_at && new Date(t.deliverable.due_at) < new Date() && t.deliverable.status !== "completed"
  ).length;

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading tasks" : error ? `Could not load tasks: ${error}` : `${visible.length} tasks shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Tasks</h1>
          <p>Every open checklist item across every client, in one list.</p>
        </div>
        <AddTask onAdded={refresh} />
      </div>

      {error && <ErrorAlert message={`Couldn't load tasks: ${error}`} onRetry={retry} retryLabel="Reload tasks" />}

      {!loading && tasks.length > 0 && (
        <div className="cp-stats mb-6">
          <div>
            <small>OPEN</small>
            <strong>{openCount}</strong>
            <em>of {tasks.length} checklist items</em>
          </div>
          <div>
            <small>ON BLOCKED MILESTONES</small>
            <strong className={blockedOpen ? "warn" : undefined}>{blockedOpen}</strong>
            <em>{blockedOpen ? "need unblocking first" : "Nothing blocked"}</em>
          </div>
          <div>
            <small>ON OVERDUE MILESTONES</small>
            <strong className={overdueOpen ? "warn" : undefined}>{overdueOpen}</strong>
            <em>{overdueOpen ? "milestone due date passed" : "Nothing overdue"}</em>
          </div>
          <div>
            <small>CLIENTS WITH OPEN WORK</small>
            <strong>{new Set(tasks.filter((t) => !t.is_done).map((t) => t.deliverable?.workspace?.id)).size}</strong>
            <em>active engagements</em>
          </div>
        </div>
      )}

      <div className="admin-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Status">
          <option value="open">Open</option>
          <option value="overdue">Overdue ({overdueTasks})</option>
          <option value="done">Done</option>
          <option value="all">All statuses</option>
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
      </div>

      {loading ? (
        <LoadingState label="Loading tasks…" />
      ) : error ? null : tasks.length === 0 ? (
        <EmptyState title="No checklist items yet" hint="Add checklist items to milestones from Projects and they appear here." />
      ) : visible.length === 0 ? (
        <div className="dash-empty-state">No tasks match this view.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Task</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const st = statusOf(t);
                const ws = t.deliverable?.workspace;
                return (
                  <Fragment key={t.id}>
                    <tr className={isOverdue(t) ? "row-overdue" : undefined}>
                      <td>
                        <button
                          className={`deliverable-task-check ${t.is_done ? "done" : ""}`}
                          onClick={() => void toggle(t)}
                          aria-label={t.is_done ? "Mark not done" : "Mark done"}
                        >
                          {t.is_done && <Check size={12} />}
                        </button>
                      </td>
                      <td className="wrap">
                        <strong className={t.is_done ? "done" : undefined}>{t.title}</strong>
                        {t.deliverable && <div className="admin-muted">{t.deliverable.title}</div>}
                      </td>
                      <td>{ws?.name ?? "—"}</td>
                      <td>{assigneeLabel(t, team.data ?? [])}</td>
                      <td>{t.due_at ? formatDate(t.due_at) : "—"}</td>
                      <td><span className={`cp-status ${st.tone}`}>{st.label}</span></td>
                      <td className="num">
                        <RowMenu
                          label={`Actions for ${t.title}`}
                          items={[
                            { label: "Edit", onClick: () => setEditingId(editingId === t.id ? null : t.id) },
                            { label: t.is_done ? "Mark not done" : "Mark done", onClick: () => void toggle(t) },
                            ...(ws ? [{ label: "Open project", onClick: () => setLocation(`/admin/projects/${ws.id}`) }] : [])
                          ]}
                        />
                      </td>
                    </tr>
                    {editingId === t.id && (
                      <tr>
                        <td colSpan={7}>
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
          </table>
        </div>
      )}
    </ConsoleLayout>
  );
}
