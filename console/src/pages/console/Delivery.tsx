// Client-facing, read-only view of this workspace's delivery milestones and
// their checklists. Restart curates all of it from the admin area
// (pages/admin/Projects.tsx) -- status changes, checklist edits, internal notes,
// and agent proposals all live there, so nothing here writes.
//
// Members can read console.deliverables and deliverable_tasks for their own
// workspace (RLS); deliverable_activities is staff-only and never loaded here.

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

interface DeliverableTask {
  id: string;
  deliverable_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  // "client" = waiting on the client to do it; staff ticks it off when they have.
  owner?: "team" | "client";
}

const STATUS_LABEL: Record<Deliverable["status"], string> = {
  "not-started": "NOT STARTED",
  "in-progress": "IN PROGRESS",
  completed: "COMPLETED",
  blocked: "BLOCKED"
};

function DeliverableCard({ milestone, order, tasks }: { milestone: Deliverable; order: number; tasks: DeliverableTask[] }) {
  const doneCount = tasks.filter((t) => t.is_done).length;
  return (
    <div className={`sprint-card ${milestone.status === "in-progress" ? "in-progress" : ""}`}>
      <div className={`sprint-status-tag ${milestone.status === "in-progress" ? "active" : ""}`}>
        {STATUS_LABEL[milestone.status]} · MILESTONE {String(order).padStart(2, "0")}
        {milestone.due_at && ` · DUE ${formatDate(milestone.due_at).toUpperCase()}`}
        <HealthBadge status={milestone.status} dueAt={milestone.due_at} />
      </div>
      <h4>{milestone.title}</h4>
      {milestone.description && <p>{milestone.description}</p>}
      {milestone.meta && <div className="sprint-meta">{milestone.meta}</div>}

      {tasks.length > 0 && (
        <div className="deliverable-tasklist-section">
          <span className="meta-k">
            Checklist ({doneCount}/{tasks.length})
          </span>
          <div className="deliverable-tasklist">
            {tasks.map((task) => (
              <div className="deliverable-task-row" key={task.id}>
                <span className={`deliverable-task-check ${task.is_done ? "done" : ""}`} aria-label={task.is_done ? "Done" : "Not done"}>
                  {task.is_done && <Check size={12} />}
                </span>
                <span className={task.is_done ? "done" : ""}>{task.title}</span>
                {task.owner === "client" && !task.is_done && <span className="admin-warn"> · waiting on you</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Delivery() {
  const { activeWorkspace } = useWorkspace();
  const [tasksByDeliverable, setTasksByDeliverable] = useState<Record<string, DeliverableTask[]>>({});

  // Keyed on the active workspace; a switch aborts the previous request so one
  // workspace's milestones can never land under another's name.
  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<Deliverable[]>(
    async (signal) => {
      if (!activeWorkspace) return [];
      const { data: rows, error: dbError } = await consoleSchema()
        .from("deliverables")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("sort_order", { ascending: true });
      if (signal.aborted) return [];
      if (dbError) throw dbError;
      const deliverables: Deliverable[] = rows ?? [];
      const ids = deliverables.map((d) => d.id);
      const map: Record<string, DeliverableTask[]> = {};
      if (ids.length > 0) {
        const { data: tasks } = await consoleSchema().from("deliverable_tasks").select("*").in("deliverable_id", ids).order("sort_order");
        for (const t of tasks ?? []) (map[t.deliverable_id] ??= []).push(t);
      }
      if (!signal.aborted) setTasksByDeliverable(map);
      return deliverables;
    },
    [activeWorkspace?.id],
    { enabled: Boolean(activeWorkspace), errorMessage: "Failed to load delivery data" }
  );
  const deliverables = data ?? [];

  return (
    <ConsoleLayout onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion
        message={
          loading
            ? "Loading delivery milestones"
            : error
              ? `Could not load delivery data: ${error}`
              : `${deliverables.length} delivery milestone${deliverables.length === 1 ? "" : "s"} loaded`
        }
      />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Delivery</h1>
          <p>What's shipped, and what we're building right now.</p>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading delivery milestones…" />
      ) : error ? (
        <ErrorAlert message={`Couldn't load delivery data: ${error}`} onRetry={retry} retryLabel="Reload milestones" />
      ) : deliverables.length === 0 ? (
        <EmptyState
          title="No delivery milestones yet"
          hint="Milestones appear here as soon as your engagement starts, each with its own checklist."
        />
      ) : (
        <div className="dash-sprints-view">
          {deliverables.map((milestone, idx) => (
            <DeliverableCard key={milestone.id} milestone={milestone} order={idx + 1} tasks={tasksByDeliverable[milestone.id] ?? []} />
          ))}
        </div>
      )}
    </ConsoleLayout>
  );
}
