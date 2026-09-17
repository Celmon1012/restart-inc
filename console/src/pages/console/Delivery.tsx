// Per-workspace deliverables with a real checklist and the same follow-up
// agent trust pattern already proven on Leads: internal flags land as
// 'agent_auto_action' automatically, anything client-facing is an
// 'agent_proposal' an admin must approve (via console-deliverable-send)
// or reject before it goes anywhere near the client. See
// supabase/migrations/20260917200000_console_deliverable_activities.sql
// for why this table is staff-only even though deliverables itself isn't.

import { useEffect, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ActivityTimeline, type AgentActivity } from "@/components/ActivityTimeline";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { consoleSchema, supabase } from "@/lib/supabase";
import type { Deliverable } from "@/lib/deliverables";
import { Check, Plus, Send, Trash2 } from "lucide-react";

interface DeliverableTask {
  id: string;
  deliverable_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
}

interface DeliverableActivity extends AgentActivity {
  deliverable_id: string;
}

const STATUS_LABEL: Record<Deliverable["status"], string> = {
  "not-started": "NOT STARTED",
  "in-progress": "IN PROGRESS",
  completed: "COMPLETED",
  blocked: "BLOCKED"
};

const STATUS_CYCLE: Deliverable["status"][] = ["not-started", "in-progress", "completed", "blocked"];

function DeliverableCard({
  milestone,
  order,
  isAdmin,
  tasks,
  activities,
  detailsLoading,
  onStatusChange,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddNote,
  onApprove,
  onReject
}: {
  milestone: Deliverable;
  order: number;
  isAdmin: boolean;
  tasks: DeliverableTask[];
  activities: DeliverableActivity[];
  detailsLoading: boolean;
  onStatusChange: (id: string, status: Deliverable["status"]) => void;
  onAddTask: (deliverableId: string, title: string) => Promise<void>;
  onToggleTask: (taskId: string, isDone: boolean) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddNote: (deliverableId: string, body: string) => Promise<void>;
  onApprove: (activity: AgentActivity, subject: string, body: string) => Promise<void>;
  onReject: (activity: AgentActivity) => Promise<void>;
}) {
  const [newTask, setNewTask] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const doneCount = tasks.filter((t) => t.is_done).length;

  return (
    <div className={`sprint-card ${milestone.status === "in-progress" ? "in-progress" : ""}`}>
      <div className={`sprint-status-tag ${milestone.status === "in-progress" ? "active" : ""}`}>
        {STATUS_LABEL[milestone.status]} · MILESTONE {String(order).padStart(2, "0")}
      </div>
      <h4>{milestone.title}</h4>
      {milestone.description && <p>{milestone.description}</p>}
      {milestone.meta && <div className="sprint-meta">{milestone.meta}</div>}

      {isAdmin && (
        <div className="lead-stage-buttons mt-4">
          {STATUS_CYCLE.filter((s) => s !== milestone.status).map((s) => (
            <button key={s} className="dash-tab-btn" onClick={() => onStatusChange(milestone.id, s)}>
              {STATUS_LABEL[s].toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <div className="deliverable-tasklist-section">
        <span className="meta-k">
          Checklist {tasks.length > 0 && `(${doneCount}/${tasks.length})`}
        </span>
        {tasks.length === 0 ? (
          <p className="key-desc">No checklist items yet.</p>
        ) : (
          <div className="deliverable-tasklist">
            {tasks.map((task) => (
              <div className="deliverable-task-row" key={task.id}>
                <button
                  className={`deliverable-task-check ${task.is_done ? "done" : ""}`}
                  disabled={!isAdmin}
                  onClick={() => onToggleTask(task.id, !task.is_done)}
                  aria-label={task.is_done ? "Mark not done" : "Mark done"}
                >
                  {task.is_done && <Check size={12} />}
                </button>
                <span className={task.is_done ? "done" : ""}>{task.title}</span>
                {isAdmin && (
                  <button className="deliverable-task-remove" onClick={() => onDeleteTask(task.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <div className="deliverable-task-add">
            <input
              className="console-input"
              placeholder="Add a checklist item…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newTask.trim()) {
                  await onAddTask(milestone.id, newTask.trim());
                  setNewTask("");
                }
              }}
            />
            <button
              className="dash-tab-btn"
              disabled={!newTask.trim()}
              onClick={async () => {
                await onAddTask(milestone.id, newTask.trim());
                setNewTask("");
              }}
            >
              <Plus size={13} />
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="lead-activity-section">
          <span className="card-kicker">ACTIVITY</span>
          <ActivityTimeline
            activities={activities}
            loading={detailsLoading}
            onApprove={onApprove}
            onReject={onReject}
          />
          <div className="lead-note-form">
            <textarea
              placeholder="Add a note…"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
            />
            <button
              className="dash-action-btn"
              disabled={!noteDraft.trim()}
              onClick={async () => {
                await onAddNote(milestone.id, noteDraft.trim());
                setNoteDraft("");
              }}
            >
              <Send size={13} />
              <span>Add note</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Delivery() {
  const { user } = useAuth();
  const { activeWorkspace, isAdmin } = useWorkspace();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [tasksByDeliverable, setTasksByDeliverable] = useState<Record<string, DeliverableTask[]>>({});
  const [activitiesByDeliverable, setActivitiesByDeliverable] = useState<Record<string, DeliverableActivity[]>>({});
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = async (ids: string[]) => {
    if (ids.length === 0 || !isAdmin) {
      setDetailsLoading(false);
      return;
    }
    setDetailsLoading(true);
    const [tasksRes, activitiesRes] = await Promise.all([
      consoleSchema().from("deliverable_tasks").select("*").in("deliverable_id", ids).order("sort_order"),
      consoleSchema()
        .from("deliverable_activities")
        .select("*")
        .in("deliverable_id", ids)
        .order("created_at", { ascending: true })
    ]);
    const tasksMap: Record<string, DeliverableTask[]> = {};
    for (const id of ids) tasksMap[id] = [];
    for (const t of tasksRes.data ?? []) (tasksMap[t.deliverable_id] ??= []).push(t);
    const activitiesMap: Record<string, DeliverableActivity[]> = {};
    for (const id of ids) activitiesMap[id] = [];
    for (const a of activitiesRes.data ?? []) (activitiesMap[a.deliverable_id] ??= []).push(a);
    setTasksByDeliverable(tasksMap);
    setActivitiesByDeliverable(activitiesMap);
    setDetailsLoading(false);
  };

  const load = () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: dbError } = await consoleSchema()
          .from("deliverables")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .order("sort_order", { ascending: true });
        if (dbError) throw dbError;
        const rows: Deliverable[] = data ?? [];
        setDeliverables(rows);
        await loadDetails(rows.map((d) => d.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load delivery data");
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  const reloadDeliverableDetails = (deliverableId: string) => loadDetails(deliverables.map((d) => d.id));

  const handleStatusChange = async (id: string, status: Deliverable["status"]) => {
    const { error: updateError } = await consoleSchema().from("deliverables").update({ status }).eq("id", id);
    if (!updateError) load();
  };

  const handleAddTask = async (deliverableId: string, title: string) => {
    await consoleSchema()
      .from("deliverable_tasks")
      .insert({ deliverable_id: deliverableId, title, sort_order: (tasksByDeliverable[deliverableId] ?? []).length });
    await reloadDeliverableDetails(deliverableId);
  };

  const handleToggleTask = async (taskId: string, isDone: boolean) => {
    const deliverableId = Object.values(tasksByDeliverable).flat().find((t) => t.id === taskId)?.deliverable_id;
    await consoleSchema().from("deliverable_tasks").update({ is_done: isDone }).eq("id", taskId);
    if (deliverableId) await reloadDeliverableDetails(deliverableId);
  };

  const handleDeleteTask = async (taskId: string) => {
    const deliverableId = Object.values(tasksByDeliverable).flat().find((t) => t.id === taskId)?.deliverable_id;
    await consoleSchema().from("deliverable_tasks").delete().eq("id", taskId);
    if (deliverableId) await reloadDeliverableDetails(deliverableId);
  };

  const handleAddNote = async (deliverableId: string, body: string) => {
    if (!user) return;
    await consoleSchema()
      .from("deliverable_activities")
      .insert({ deliverable_id: deliverableId, actor: "admin", actor_user_id: user.id, activity_type: "note", body });
    await reloadDeliverableDetails(deliverableId);
  };

  const handleApproveProposal = async (activity: AgentActivity, subject: string, body: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("console-deliverable-send", {
        body: { activity_id: activity.id, subject, body }
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      await loadDetails(deliverables.map((d) => d.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send client update");
    }
  };

  const handleRejectProposal = async (activity: AgentActivity) => {
    if (!user) return;
    await consoleSchema()
      .from("deliverable_activities")
      .update({ status: "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
      .eq("id", activity.id);
    await loadDetails(deliverables.map((d) => d.id));
  };

  return (
    <ConsoleLayout>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Delivery</h1>
          <p>What's shipped, and what we're building right now.</p>
        </div>
      </div>

      {loading ? (
        <div className="dash-empty-state">Loading delivery milestones…</div>
      ) : error ? (
        <div className="dash-empty-state">Couldn't load delivery data: {error}</div>
      ) : deliverables.length === 0 ? (
        <div className="dash-empty-state">No delivery milestones recorded for this workspace yet.</div>
      ) : (
        <div className="dash-sprints-view">
          {deliverables.map((milestone, idx) => (
            <DeliverableCard
              key={milestone.id}
              milestone={milestone}
              order={idx + 1}
              isAdmin={isAdmin}
              tasks={tasksByDeliverable[milestone.id] ?? []}
              activities={activitiesByDeliverable[milestone.id] ?? []}
              detailsLoading={detailsLoading}
              onStatusChange={handleStatusChange}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onAddNote={handleAddNote}
              onApprove={handleApproveProposal}
              onReject={handleRejectProposal}
            />
          ))}
        </div>
      )}
    </ConsoleLayout>
  );
}
