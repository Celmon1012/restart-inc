// Client-facing task list for this project: everything on the checklists of its
// milestones in one place, with what is waiting on the client pulled to the top.
// Read-only. Restart assigns, schedules and ticks off tasks from Ops; a task that
// is for the client stays "waiting on you" until Restart marks it done.
//
// Members can read console.deliverables and deliverable_tasks for their own
// workspace (RLS), so this needs no function of its own.

import { useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { HealthBadge } from "@/components/HealthBadge";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { consoleSchema } from "@/lib/supabase";
import type { Deliverable } from "@/lib/deliverables";
import { formatDate } from "@/lib/format";
import { Check } from "lucide-react";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";

interface Task {
  id: string;
  deliverable_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  owner?: "team" | "client";
  due_at?: string | null;
}

type Filter = "you" | "open" | "done" | "all";

const today = () => new Date().toISOString().slice(0, 10);

export default function ClientTasks() {
  const { activeWorkspace } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("you");

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<{ milestones: Deliverable[]; tasks: Task[] }>(
    async (signal) => {
      if (!activeWorkspace) return { milestones: [], tasks: [] };
      const { data: rows, error: dbError } = await consoleSchema()
        .from("deliverables")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("sort_order", { ascending: true });
      if (signal.aborted) return { milestones: [], tasks: [] };
      if (dbError) throw dbError;
      const milestones: Deliverable[] = rows ?? [];
      let tasks: Task[] = [];
      if (milestones.length > 0) {
        const { data: taskRows, error: taskError } = await consoleSchema()
          .from("deliverable_tasks")
          .select("*")
          .in("deliverable_id", milestones.map((m) => m.id))
          .order("sort_order");
        if (taskError) throw taskError;
        tasks = (taskRows ?? []) as Task[];
      }
      return { milestones, tasks };
    },
    [activeWorkspace?.id],
    { enabled: Boolean(activeWorkspace), errorMessage: "Failed to load tasks" }
  );
  const milestones = data?.milestones ?? [];
  const tasks = data?.tasks ?? [];

  const waitingOnYou = tasks.filter((t) => t.owner === "client" && !t.is_done);
  const inProgress = tasks.filter((t) => t.owner !== "client" && !t.is_done);
  const done = tasks.filter((t) => t.is_done);
  const overdue = (t: Task) => !t.is_done && Boolean(t.due_at) && (t.due_at as string) < today();

  const shown = tasks.filter((t) => (filter === "all" ? true : filter === "you" ? t.owner === "client" && !t.is_done : filter === "open" ? !t.is_done : t.is_done));

  return (
    <ConsoleLayout onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading tasks" : error ? `Could not load tasks: ${error}` : `${shown.length} tasks shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">{(activeWorkspace?.name ?? "PROJECT").toUpperCase()}</span>
          <h1>Tasks</h1>
          <p>Everything on this project's checklists, and what's waiting on you.</p>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading tasks…" />
      ) : error ? (
        <ErrorAlert message={`Couldn't load tasks: ${error}`} onRetry={retry} retryLabel="Reload tasks" />
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet" hint="Tasks appear here as your project's milestones get their checklists." />
      ) : (
        <>
          <div className="cp-stats mb-6">
            <div>
              <small>WAITING ON YOU</small>
              <strong className={waitingOnYou.length ? "warn" : undefined}>{waitingOnYou.length}</strong>
              <em>{waitingOnYou.length ? "needs your input" : "nothing needed from you"}</em>
            </div>
            <div>
              <small>IN PROGRESS</small>
              <strong>{inProgress.length}</strong>
              <em>with the Restart team</em>
            </div>
            <div>
              <small>DONE</small>
              <strong>{done.length}</strong>
              <em>of {tasks.length} tasks</em>
            </div>
            <div>
              <small>OVERDUE</small>
              <strong className={tasks.filter(overdue).length ? "warn" : undefined}>{tasks.filter(overdue).length}</strong>
              <em>past their deadline</em>
            </div>
          </div>

          <div className="admin-toolbar">
            {([
              ["you", `Waiting on you (${waitingOnYou.length})`],
              ["open", "All open"],
              ["done", "Done"],
              ["all", "All"]
            ] as Array<[Filter, string]>).map(([f, label]) => (
              <button key={f} className={`dash-tab-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="dash-empty-state">{filter === "you" ? "Nothing is waiting on you right now." : "No tasks in this view."}</div>
          ) : (
            <div className="dash-sprints-view">
              {milestones
                .filter((m) => shown.some((t) => t.deliverable_id === m.id))
                .map((m) => (
                  <div className="sprint-card" key={m.id}>
                    <div className="sprint-status-tag">
                      {m.status.replace("-", " ").toUpperCase()}
                      {m.due_at && ` · DUE ${formatDate(m.due_at).toUpperCase()}`}
                      <HealthBadge status={m.status} dueAt={m.due_at} />
                    </div>
                    <h4>{m.title}</h4>
                    <div className="deliverable-tasklist" style={{ marginTop: 12 }}>
                      {shown
                        .filter((t) => t.deliverable_id === m.id)
                        .map((t) => (
                          <div className="deliverable-task-row" key={t.id}>
                            <span className={`deliverable-task-check ${t.is_done ? "done" : ""}`} aria-label={t.is_done ? "Done" : "Not done"}>
                              {t.is_done && <Check size={12} />}
                            </span>
                            <span className="task-body">
                              <span className={t.is_done ? "done" : ""}>{t.title}</span>
                              {t.owner === "client" && !t.is_done && <span className="admin-warn">waiting on you</span>}
                              {t.due_at && !t.is_done && (
                                <span className={overdue(t) ? "admin-warn" : "admin-muted"}>
                                  {overdue(t) ? "overdue · " : "due "}
                                  {formatDate(t.due_at)}
                                </span>
                              )}
                              {!t.is_done && t.owner !== "client" && <span className="admin-muted">with Restart</span>}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </ConsoleLayout>
  );
}
