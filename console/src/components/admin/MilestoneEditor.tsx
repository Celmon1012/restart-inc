// Milestone editor for one project (workspace), used on the admin project
// detail page. Carries the controls that used to sit behind isAdmin checks on
// the client Delivery tab
// (status, checklist edits, internal notes, agent proposals) plus creating and
// removing milestones. The client's Delivery tab is now read-only; this is the
// only place the work gets curated.
//
// Writes go straight to console.deliverables/deliverable_tasks/
// deliverable_activities under the admin's own JWT -- RLS
// ("admins can manage ...") is the boundary. Approving a client-facing agent
// proposal still goes through console-deliverable-send, the only step allowed
// to actually contact the client.

import { useState } from "react";
import { ActivityTimeline, type AgentActivity } from "@/components/ActivityTimeline";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HealthBadge } from "@/components/HealthBadge";
import { useAuth } from "@/contexts/AuthContext";
import { consoleSchema, supabase } from "@/lib/supabase";
import type { Deliverable } from "@/lib/deliverables";
import { formatDate } from "@/lib/format";
import { Check, ChevronDown, Plus, Send, X } from "lucide-react";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { toast } from "sonner";
import { loadTeamMembers } from "@/lib/admin";
import { TaskEditForm, assigneeLabel, dueInfo, type TeamMember } from "@/components/admin/TaskEdit";
import { RowMenu } from "@/components/admin/RowMenu";
import { PROJECT_TEMPLATES, applyTemplate, templateFor } from "@/lib/projectTemplates";

interface DeliverableTask {
  id: string;
  deliverable_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  owner?: "team" | "client";
  assignee_id?: string | null;
  due_at?: string | null;
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

type MilestonePatch = Partial<Pick<Deliverable, "title" | "description" | "due_at" | "meta">>;

function EditMilestoneForm({ milestone, onSave, onCancel }: { milestone: Deliverable; onSave: (patch: MilestonePatch) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [dueAt, setDueAt] = useState(milestone.due_at ? milestone.due_at.slice(0, 10) : "");
  const [meta, setMeta] = useState(milestone.meta ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="admin-new-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
          await onSave({ title: title.trim(), description: description.trim() || null, due_at: dueAt ? new Date(dueAt).toISOString() : null, meta: meta.trim() || null });
        } finally {
          setSaving(false);
        }
      }}
    >
      <input className="console-input wide" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" autoFocus />
      <textarea className="wide" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this milestone delivers (the client sees this)" aria-label="Description" />
      <input className="console-input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label="Due date" />
      <input className="console-input wide" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Meta line (optional)" aria-label="Meta line" />
      <div className="admin-form-actions">
        <button type="button" className="console-btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="dash-action-btn" disabled={saving || !title.trim()}>Save</button>
      </div>
    </form>
  );
}

function MilestoneCard({
  milestone,
  order,
  tasks,
  activities,
  detailsLoading,
  team,
  onTaskSaved,
  onStatusChange,
  onUpdate,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddNote,
  onApprove,
  onReject,
  onDelete
}: {
  milestone: Deliverable;
  order: number;
  tasks: DeliverableTask[];
  activities: DeliverableActivity[];
  detailsLoading: boolean;
  team: TeamMember[];
  onTaskSaved: () => Promise<void> | void;
  onStatusChange: (id: string, status: Deliverable["status"]) => void;
  onUpdate: (id: string, patch: MilestonePatch) => Promise<void>;
  onAddTask: (deliverableId: string, title: string) => Promise<void>;
  onToggleTask: (task: DeliverableTask) => Promise<void>;
  onDeleteTask: (task: DeliverableTask) => Promise<void>;
  onAddNote: (deliverableId: string, body: string) => Promise<void>;
  onApprove: (activity: AgentActivity, subject: string, body: string) => Promise<void>;
  onReject: (activity: AgentActivity) => Promise<void>;
  onDelete: (milestone: Deliverable) => void;
}) {
  const [newTask, setNewTask] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Finished milestones fold away so the page stays about what is still to do.
  const [open, setOpen] = useState(milestone.status !== "completed");
  const [showActivity, setShowActivity] = useState(false);
  const doneCount = tasks.filter((t) => t.is_done).length;

  const addTask = async () => {
    if (!newTask.trim()) return;
    await onAddTask(milestone.id, newTask.trim());
    setNewTask("");
  };

  return (
    <div className={`sprint-card ${milestone.status === "in-progress" ? "in-progress" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="deliverable-task-remove"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Fold milestone" : "Open milestone"}
          title={open ? "Fold" : "Open"}
        >
          <ChevronDown size={14} style={{ transform: open ? undefined : "rotate(-90deg)", transition: "transform .15s" }} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={`sprint-status-tag ${milestone.status === "in-progress" ? "active" : ""}`}>
            MILESTONE {String(order).padStart(2, "0")}
            {milestone.due_at && ` · DUE ${formatDate(milestone.due_at).toUpperCase()}`}
            {tasks.length > 0 && ` · ${doneCount}/${tasks.length} DONE`}
            <HealthBadge status={milestone.status} dueAt={milestone.due_at} />
          </div>
          <h4>{milestone.title}</h4>
        </div>
        <select
          className="console-select"
          value={milestone.status}
          onChange={(e) => onStatusChange(milestone.id, e.target.value as Deliverable["status"])}
          aria-label={`Status of ${milestone.title}`}
        >
          {STATUS_CYCLE.map((st) => <option key={st} value={st}>{STATUS_LABEL[st].toLowerCase()}</option>)}
        </select>
        <RowMenu
          label={`Actions for ${milestone.title}`}
          items={[
            { label: "Edit milestone", onClick: () => { setEditing(true); setOpen(true); } },
            { label: "Delete milestone", danger: true, onClick: () => onDelete(milestone) }
          ]}
        />
      </div>

      {open && (
        <>
          {editing ? (
            <EditMilestoneForm
              milestone={milestone}
              onCancel={() => setEditing(false)}
              onSave={async (patch) => { await onUpdate(milestone.id, patch); setEditing(false); }}
            />
          ) : (
            <>
              {milestone.description && <p>{milestone.description}</p>}
              {milestone.meta && <div className="sprint-meta">{milestone.meta}</div>}
            </>
          )}

          <div className="deliverable-tasklist-section">
            <span className="meta-k">Checklist {tasks.length > 0 && `(${doneCount}/${tasks.length})`}</span>
            {tasks.length === 0 ? (
              <p className="key-desc">No checklist items yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th style={{ width: 36 }} /><th>Task</th><th>Assignee</th><th>Due</th><th /></tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => {
                      const due = dueInfo(task);
                      return (
                        <tr key={task.id} className={due?.overdue ? "row-overdue" : undefined}>
                          {editingTaskId === task.id ? (
                            <td colSpan={5}>
                              <TaskEditForm
                                task={task}
                                team={team}
                                onDone={async (saved) => { setEditingTaskId(null); if (saved) await onTaskSaved(); }}
                              />
                            </td>
                          ) : (
                            <>
                              <td>
                                <button
                                  className={`deliverable-task-check ${task.is_done ? "done" : ""}`}
                                  onClick={() => onToggleTask(task)}
                                  aria-label={task.is_done ? "Mark not done" : "Mark done"}
                                >
                                  {task.is_done && <Check size={12} />}
                                </button>
                              </td>
                              <td className="wrap"><span className={task.is_done ? "done" : ""}>{task.title}</span></td>
                              <td className="admin-muted">{assigneeLabel(task, team)}</td>
                              <td className={due?.overdue ? "admin-danger" : "admin-muted"}>{task.due_at ? formatDate(task.due_at) : "—"}</td>
                              <td className="num">
                                <RowMenu
                                  label={`Actions for ${task.title}`}
                                  items={[
                                    { label: "Edit", onClick: () => setEditingTaskId(task.id) },
                                    { label: task.is_done ? "Mark not done" : "Mark done", onClick: () => void onToggleTask(task) },
                                    { label: "Remove", danger: true, onClick: () => void onDeleteTask(task) }
                                  ]}
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="deliverable-task-add">
              <input
                className="console-input"
                placeholder="Add a checklist item…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addTask();
                }}
              />
              <button className="dash-tab-btn" disabled={!newTask.trim()} onClick={addTask} aria-label="Add checklist item">
                <Plus size={13} />
              </button>
            </div>
          </div>

          <div className="lead-activity-section">
            <button type="button" className="card-kicker" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }} onClick={() => setShowActivity((v) => !v)} aria-expanded={showActivity}>
              ACTIVITY (INTERNAL){activities.length > 0 && ` · ${activities.length}`} {showActivity ? "▾" : "▸"}
            </button>
            {showActivity && (
              <>
                <ActivityTimeline activities={activities} loading={detailsLoading} onApprove={onApprove} onReject={onReject} />
                <div className="lead-note-form">
                  <textarea placeholder="Add a note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} />
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NewMilestoneForm({
  nextOrder,
  onCreate,
  onCancel
}: {
  nextOrder: number;
  onCreate: (row: Pick<Deliverable, "title" | "description" | "status" | "due_at" | "meta" | "sort_order">) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Deliverable["status"]>("not-started");
  const [dueAt, setDueAt] = useState("");
  const [meta, setMeta] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        status,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        meta: meta.trim() || null,
        sort_order: nextOrder
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="console-card mb-4" onSubmit={submit}>
      <div className="card-top-header">
        <span className="card-kicker">NEW MILESTONE</span>
        <button type="button" className="deliverable-task-remove" onClick={onCancel} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="admin-new-form">
        <input className="console-input wide" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <textarea
          className="wide"
          placeholder="What this milestone delivers (the client sees this)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select className="console-select" value={status} onChange={(e) => setStatus(e.target.value as Deliverable["status"])} aria-label="Status">
          {STATUS_CYCLE.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s].toLowerCase()}</option>
          ))}
        </select>
        <input className="console-input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label="Due date" />
        <input className="console-input wide" placeholder="Meta line, e.g. Sprint 3 · Week of 6 Oct (optional)" value={meta} onChange={(e) => setMeta(e.target.value)} />
        <div className="admin-form-actions">
          <button type="button" className="console-btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="dash-action-btn" disabled={saving || !title.trim()}>
            <Plus size={13} />
            <span>Create milestone</span>
          </button>
        </div>
      </div>
    </form>
  );
}

export function MilestoneEditor({ workspaceId, engagement, onChanged }: { workspaceId: string; engagement?: string | null; onChanged?: () => void }) {
  const { user } = useAuth();
  const [tasksByDeliverable, setTasksByDeliverable] = useState<Record<string, DeliverableTask[]>>({});
  const [activitiesByDeliverable, setActivitiesByDeliverable] = useState<Record<string, DeliverableActivity[]>>({});
  const [detailsLoading, setDetailsLoading] = useState(true);
  const team = useAsyncResource(() => loadTeamMembers(), []);
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateKey, setTemplateKey] = useState(() => (templateFor(engagement) ? (engagement as string) : "build"));
  const [applying, setApplying] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Deliverable | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDetails = async (ids: string[]) => {
    if (ids.length === 0) {
      setTasksByDeliverable({});
      setActivitiesByDeliverable({});
      setDetailsLoading(false);
      return;
    }
    setDetailsLoading(true);
    const [tasksRes, activitiesRes] = await Promise.all([
      consoleSchema().from("deliverable_tasks").select("*").in("deliverable_id", ids).order("sort_order"),
      consoleSchema().from("deliverable_activities").select("*").in("deliverable_id", ids).order("created_at", { ascending: true })
    ]);
    const tasksMap: Record<string, DeliverableTask[]> = {};
    const activitiesMap: Record<string, DeliverableActivity[]> = {};
    for (const id of ids) {
      tasksMap[id] = [];
      activitiesMap[id] = [];
    }
    for (const t of tasksRes.data ?? []) (tasksMap[t.deliverable_id] ??= []).push(t);
    for (const a of activitiesRes.data ?? []) (activitiesMap[a.deliverable_id] ??= []).push(a);
    setTasksByDeliverable(tasksMap);
    setActivitiesByDeliverable(activitiesMap);
    setDetailsLoading(false);
  };

  const {
    data: deliverableData,
    loading,
    error,
    retry,
    refresh
  } = useAsyncResource<Deliverable[]>(
    async (signal) => {
      if (!workspaceId) return [];
      const { data, error: dbError } = await consoleSchema()
        .from("deliverables")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true });
      if (signal.aborted) return [];
      if (dbError) throw dbError;
      const rows: Deliverable[] = data ?? [];
      await loadDetails(rows.map((d) => d.id));
      return rows;
    },
    [workspaceId],
    { enabled: Boolean(workspaceId), errorMessage: "Failed to load milestones" }
  );
  const deliverables = deliverableData ?? [];
  const reloadDetails = () => loadDetails(deliverables.map((d) => d.id));

  const report = (err: { message: string } | null, fallback: string) => {
    if (err) toast.error(err.message || fallback);
    return !err;
  };

  const handleCreate = async (row: Pick<Deliverable, "title" | "description" | "status" | "due_at" | "meta" | "sort_order">) => {
    if (!workspaceId) return;
    const { error: insertError } = await consoleSchema().from("deliverables").insert({ ...row, workspace_id: workspaceId });
    if (report(insertError, "Failed to create milestone")) {
      toast.success("Milestone created");
      setShowNew(false);
      await refresh();
      onChanged?.();
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error: deleteError } = await consoleSchema().from("deliverables").delete().eq("id", pendingDelete.id);
    setDeleting(false);
    if (report(deleteError, "Failed to delete milestone")) {
      toast.success("Milestone deleted");
      setPendingDelete(null);
      await refresh();
      onChanged?.();
    }
  };

  const handleUpdate = async (id: string, patch: MilestonePatch) => {
    const { error: updateError } = await consoleSchema().from("deliverables").update(patch).eq("id", id);
    if (report(updateError, "Failed to save milestone")) {
      toast.success("Milestone updated");
      await refresh();
      onChanged?.();
    }
  };

  const handleApplyTemplate = async () => {
    const template = PROJECT_TEMPLATES[templateKey];
    if (!template || !workspaceId) return;
    setApplying(true);
    try {
      const added = await applyTemplate(workspaceId, template, { existingCount: deliverables.length, hasActive: deliverables.some((d) => d.status === "in-progress") });
      toast.success(`Added ${added} ${template.name} milestones`);
      setShowTemplates(false);
      await refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the template");
    } finally {
      setApplying(false);
    }
  };

  const handleStatusChange = async (id: string, status: Deliverable["status"]) => {
    const { error: updateError } = await consoleSchema().from("deliverables").update({ status }).eq("id", id);
    if (report(updateError, "Failed to update status")) await refresh();
      onChanged?.();
  };

  const handleAddTask = async (deliverableId: string, title: string) => {
    const { error: insertError } = await consoleSchema()
      .from("deliverable_tasks")
      .insert({ deliverable_id: deliverableId, title, sort_order: (tasksByDeliverable[deliverableId] ?? []).length });
    if (report(insertError, "Failed to add item")) { await reloadDetails(); onChanged?.(); }
  };

  const handleToggleTask = async (task: DeliverableTask) => {
    const { error: updateError } = await consoleSchema().from("deliverable_tasks").update({ is_done: !task.is_done }).eq("id", task.id);
    if (report(updateError, "Failed to update item")) { await reloadDetails(); onChanged?.(); }
  };

  const handleDeleteTask = async (task: DeliverableTask) => {
    const { error: deleteError } = await consoleSchema().from("deliverable_tasks").delete().eq("id", task.id);
    if (report(deleteError, "Failed to remove item")) { await reloadDetails(); onChanged?.(); }
  };

  const handleAddNote = async (deliverableId: string, body: string) => {
    if (!user) return;
    const { error: insertError } = await consoleSchema()
      .from("deliverable_activities")
      .insert({ deliverable_id: deliverableId, actor: "admin", actor_user_id: user.id, activity_type: "note", body });
    if (report(insertError, "Failed to add note")) { await reloadDetails(); onChanged?.(); }
  };

  const handleApproveProposal = async (activity: AgentActivity, subject: string, body: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("console-deliverable-send", {
        body: { activity_id: activity.id, subject, body }
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast.success("Client update sent");
      { await reloadDetails(); onChanged?.(); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send client update");
    }
  };

  const handleRejectProposal = async (activity: AgentActivity) => {
    if (!user) return;
    const { error: updateError } = await consoleSchema()
      .from("deliverable_activities")
      .update({ status: "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
      .eq("id", activity.id);
    if (report(updateError, "Failed to reject proposal")) { await reloadDetails(); onChanged?.(); }
  };

  const completed = deliverables.filter((d) => d.status === "completed").length;
  const allTasks = Object.values(tasksByDeliverable).flat();

  return (
    <>
      <div className="admin-toolbar">
        <span className="admin-muted">
          {deliverables.length === 0
            ? "No milestones yet"
            : `${completed}/${deliverables.length} milestones complete · ${allTasks.filter((t) => t.is_done).length}/${allTasks.length} checklist items done`}
        </span>
        <span className="admin-toolbar-spacer" />
        <button className="dash-tab-btn" onClick={() => setShowTemplates((v) => !v)} aria-expanded={showTemplates}>Add from template</button>
        <button className="dash-action-btn" onClick={() => setShowNew((v) => !v)}>
          <Plus size={14} />
          <span>New milestone</span>
        </button>
      </div>

      {showTemplates && (
        <div className="console-card mb-4" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: 14 }}>
          <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} aria-label="Template">
            {Object.entries(PROJECT_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name} ({t.milestones.length} milestones)</option>)}
          </select>
          <button className="dash-action-btn" onClick={() => void handleApplyTemplate()} disabled={applying}>{applying ? "Adding…" : "Add milestones"}</button>
          <button className="dash-tab-btn" onClick={() => setShowTemplates(false)} disabled={applying}>Cancel</button>
          <span className="admin-muted" style={{ flexBasis: "100%" }}>
            {PROJECT_TEMPLATES[templateKey]?.milestones.map((m) => m.title).join(" → ")}. Added after any milestones already here. Nothing is removed, and every item can be edited.
          </span>
        </div>
      )}

      {showNew && workspaceId && (
        <NewMilestoneForm nextOrder={deliverables.length} onCreate={handleCreate} onCancel={() => setShowNew(false)} />
      )}

      {loading ? (
        <LoadingState label="Loading milestones…" />
      ) : error ? (
        <ErrorAlert message={`Couldn't load milestones: ${error}`} onRetry={retry} retryLabel="Reload milestones" />
      ) : deliverables.length === 0 ? (
        <EmptyState
          title="No milestones for this project yet"
          hint="Create the first milestone -- the client sees its title, description, status, and checklist on their Delivery tab."
        />
      ) : (
        <div className="dash-sprints-view">
          {deliverables.map((milestone, idx) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              order={idx + 1}
              tasks={tasksByDeliverable[milestone.id] ?? []}
              activities={activitiesByDeliverable[milestone.id] ?? []}
              detailsLoading={detailsLoading}
              team={team.data ?? []}
              onTaskSaved={reloadDetails}
              onStatusChange={handleStatusChange}
              onUpdate={handleUpdate}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onAddNote={handleAddNote}
              onApprove={handleApproveProposal}
              onReject={handleRejectProposal}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this milestone?"
        description={
          <>
            <strong>{pendingDelete?.title}</strong> and its checklist and activity thread are removed for good, and it
            disappears from the client's Delivery tab.
          </>
        }
        confirmLabel="Delete milestone"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
