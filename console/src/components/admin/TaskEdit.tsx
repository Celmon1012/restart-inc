// Edit one checklist item: title, who it's for, and its deadline. Used on the Tasks
// page and inside a project's milestone checklist. Writes straight to
// console.deliverable_tasks under the admin's own JWT (RLS is the boundary).

import { useState } from "react";
import { toast } from "sonner";
import { consoleSchema } from "@/lib/supabase";
import { formatDate } from "@/lib/format";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL, priorityOfTask, statusOfTask } from "@/lib/tasks";

export interface EditableTask {
  id: string;
  title: string;
  is_done: boolean;
  owner?: "team" | "client";
  assignee_id?: string | null;
  due_at?: string | null;
  status?: string | null;
  priority?: string | null;
  start_at?: string | null;
}

export interface TeamMember {
  user_id: string;
  email: string;
}

/** "Client to do", a team member's name, or "Unassigned". */
export function assigneeLabel(task: Pick<EditableTask, "owner" | "assignee_id">, team: TeamMember[]): string {
  if (task.owner === "client") return "Client to do";
  if (!task.assignee_id) return "Unassigned";
  return (team.find((m) => m.user_id === task.assignee_id)?.email ?? "Assigned").split("@")[0];
}

/** Deadline text plus whether it has passed (and the task is still open). */
export function dueInfo(task: Pick<EditableTask, "due_at" | "is_done">): { text: string; overdue: boolean } | null {
  if (!task.due_at) return null;
  const overdue = !task.is_done && task.due_at < new Date().toISOString().slice(0, 10);
  return { text: `${overdue ? "overdue · " : "due "}${formatDate(task.due_at)}`, overdue };
}

export function TaskEditForm({
  task,
  team,
  onDone
}: {
  task: EditableTask;
  team: TeamMember[];
  /** Called after a save or a cancel; `saved` is true only when something was written. */
  onDone: (saved: boolean) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [assignTo, setAssignTo] = useState(task.owner === "client" ? "client" : task.assignee_id ?? "");
  const [due, setDue] = useState(task.due_at ?? "");
  const [start, setStart] = useState(task.start_at ?? "");
  const [status, setStatus] = useState(statusOfTask(task));
  const [priority, setPriority] = useState(priorityOfTask(task));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await consoleSchema()
      .from("deliverable_tasks")
      .update({
        title: title.trim(),
        owner: assignTo === "client" ? "client" : "team",
        assignee_id: assignTo && assignTo !== "client" ? assignTo : null,
        due_at: due || null,
        // Only written when changed, so editing a title still works before the status/priority migration is applied.
        ...(status !== statusOfTask(task) ? { status } : {}),
        ...(priority !== priorityOfTask(task) ? { priority } : {}),
        ...(start !== (task.start_at ?? "") ? { start_at: start || null } : {})
      })
      .eq("id", task.id);
    setBusy(false);
    if (err) return setError(err.message);
    toast.success("Task updated");
    await onDone(true);
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void save(); }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "8px 0" }}
    >
      <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task" style={{ minWidth: 240, flex: 1 }} autoFocus />
      <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Assigned to">
        <option value="">Team (unassigned)</option>
        {team.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
        <option value="client">Client to do</option>
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
      </select>
      <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} aria-label="Priority">
        {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>)}
      </select>
      <label className="admin-muted">Start <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start date" /></label>
      <label className="admin-muted">Due <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Deadline" /></label>
      <button type="submit" className="dash-tab-btn active" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save"}</button>
      <button type="button" className="dash-tab-btn" onClick={() => void onDone(false)} disabled={busy}>Cancel</button>
      {error && <span className="admin-warn" role="alert">{error}</span>}
    </form>
  );
}

/**
 * Who a task is for and when it's due, as controls you change in place: pick a different
 * assignee or date and it saves at once. The title (and everything else) still goes through
 * the Edit form. A task is "for the client" or for a team member, never both.
 */
export function TaskInlineMeta({ task, team, onSaved }: { task: EditableTask; team: TeamMember[]; onSaved: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const current = task.owner === "client" ? "client" : task.assignee_id ?? "";
  const overdue = dueInfo(task)?.overdue ?? false;

  const save = async (patch: { owner?: "team" | "client"; assignee_id?: string | null; due_at?: string | null }) => {
    setBusy(true);
    const { error } = await consoleSchema().from("deliverable_tasks").update(patch).eq("id", task.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await onSaved();
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input
        type="date"
        className={`inline-edit ${overdue ? "overdue" : ""}`}
        value={task.due_at ?? ""}
        disabled={busy}
        aria-label={`Deadline for ${task.title}`}
        title={task.due_at ? (overdue ? "Overdue" : "Deadline") : "Set a deadline"}
        onChange={(e) => void save({ due_at: e.target.value || null })}
      />
      <select
        className={`inline-edit ${task.owner === "client" ? "client" : ""}`}
        value={current}
        disabled={busy}
        aria-label={`Assigned to for ${task.title}`}
        onChange={(e) => {
          const v = e.target.value;
          void save(v === "client" ? { owner: "client", assignee_id: null } : { owner: "team", assignee_id: v || null });
        }}
      >
        <option value="">Unassigned</option>
        {team.map((m) => <option key={m.user_id} value={m.user_id}>{m.email.split("@")[0]}</option>)}
        <option value="client">Client to do</option>
      </select>
    </span>
  );
}
