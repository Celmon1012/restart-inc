// Every checklist item across every client, grouped by client and milestone --
// the "what's on our plate" view Projects can't give, since Projects is one
// client at a time. Tasks are console.deliverable_tasks; embedding the parent
// deliverable and its workspace works because both FKs exist, and RLS lets an
// admin read every row.

import { Fragment, useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { HealthBadge } from "@/components/HealthBadge";
import { consoleSchema } from "@/lib/supabase";
import { loadTeamMembers, loadWorkspaceNames } from "@/lib/admin";
import { useAuth } from "@/contexts/AuthContext";
import { AddTask } from "@/components/admin/AddTask";
import { TaskEditForm, TaskInlineMeta } from "@/components/admin/TaskEdit";
import { Check, ArrowRight, Search } from "lucide-react";
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
type Who = "anyone" | "mine" | "client" | "unassigned";

export default function AdminTasks() {
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [who, setWho] = useState<Who>("anyone");
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
    const { error: updateError } = await consoleSchema().from("deliverable_tasks").update({ is_done: !task.is_done }).eq("id", task.id);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    await refresh();
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const isOverdue = (t: TaskRow) => !t.is_done && Boolean(t.due_at) && (t.due_at as string) < todayIso;
  const overdueTasks = tasks.filter(isOverdue).length;

  const needle = search.trim().toLowerCase();
  const visible = tasks.filter(
    (t) =>
      (filter === "all" ||
        (filter === "open" ? !t.is_done : filter === "overdue" ? isOverdue(t) : t.is_done)) &&
      (who === "anyone" ||
        (who === "client" ? t.owner === "client" : who === "mine" ? t.owner === "team" && t.assignee_id === user?.id : t.owner === "team" && !t.assignee_id)) &&
      (!needle ||
        [t.title, t.deliverable?.title, t.deliverable?.workspace?.name].some((v) => v?.toLowerCase().includes(needle)))
  );

  // client -> milestone -> tasks, preserving each milestone's own order.
  const groups = new Map<string, { name: string; workspaceId: string | null; milestones: Map<string, { title: string; order: number; status: string; dueAt: string | null; tasks: TaskRow[] }> }>();
  for (const t of visible) {
    const ws = t.deliverable?.workspace;
    const key = ws?.id ?? "none";
    if (!groups.has(key)) groups.set(key, { name: ws?.name ?? "Unassigned", workspaceId: ws?.id ?? null, milestones: new Map() });
    const g = groups.get(key)!;
    const mKey = t.deliverable?.id ?? "none";
    if (!g.milestones.has(mKey))
      g.milestones.set(mKey, {
        title: t.deliverable?.title ?? "Milestone",
        order: t.deliverable?.sort_order ?? 0,
        status: t.deliverable?.status ?? "",
        dueAt: t.deliverable?.due_at ?? null,
        tasks: []
      });
    g.milestones.get(mKey)!.tasks.push(t);
  }
  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));

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
        {(["open", "overdue", "done", "all"] as Filter[]).map((f) => (
          <button key={f} className={`dash-tab-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "open" ? "Open" : f === "overdue" ? `Overdue (${overdueTasks})` : f === "done" ? "Done" : "All"}
          </button>
        ))}
        <select value={who} onChange={(e) => setWho(e.target.value as Who)} aria-label="Assigned to">
          <option value="anyone">Anyone</option>
          <option value="mine">Mine</option>
          <option value="unassigned">Team, unassigned</option>
          <option value="client">Waiting on client</option>
        </select>
        <span className="admin-toolbar-spacer" />
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search tasks, milestones, clients…" aria-label="Search tasks" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading tasks…" />
      ) : error ? null : tasks.length === 0 ? (
        <EmptyState title="No checklist items yet" hint="Add checklist items to milestones from Projects and they appear here." />
      ) : sortedGroups.length === 0 ? (
        <div className="dash-empty-state">No tasks match this view.</div>
      ) : (
        sortedGroups.map((g) => (
          <div className="admin-group" key={g.workspaceId ?? "none"}>
            <div className="admin-group-head">
              <span>{g.name}</span>
              {g.workspaceId && (
                <Link href={`/admin/projects/${g.workspaceId}`} className="overview-section-link">
                  Open project <ArrowRight size={12} />
                </Link>
              )}
            </div>
            {Array.from(g.milestones.values())
              .sort((a, b) => a.order - b.order)
              .map((m) =>
                m.tasks.map((t) => (
                  <Fragment key={t.id}>
                  <div className="admin-task-row">
                    <button
                      className={`deliverable-task-check ${t.is_done ? "done" : ""}`}
                      onClick={() => toggle(t)}
                      aria-label={t.is_done ? "Mark not done" : "Mark done"}
                    >
                      {t.is_done && <Check size={12} />}
                    </button>
                    <span className={t.is_done ? "done" : ""}>{t.title}</span>
                    <TaskInlineMeta task={t} team={team.data ?? []} onSaved={refresh} />
                    <button className="dash-tab-btn" onClick={() => setEditingId(editingId === t.id ? null : t.id)}>Edit</button>
                    <span className={`admin-task-context ${m.status === "blocked" ? "admin-warn" : ""}`}>
                      {m.title}
                      {m.status === "blocked" ? " · blocked" : ""}
                      {!t.is_done && <HealthBadge status={m.status} dueAt={m.dueAt} />}
                    </span>
                  </div>
                  {editingId === t.id && (
                    <div className="admin-task-row">
                      <TaskEditForm
                        task={t}
                        team={team.data ?? []}
                        onDone={async (saved) => { setEditingId(null); if (saved) await refresh(); }}
                      />
                    </div>
                  )}
                  </Fragment>
                ))
              )}
          </div>
        ))
      )}
    </ConsoleLayout>
  );
}
