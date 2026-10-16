// Task status and priority: the values stored on console.deliverable_tasks and how they read.
// is_done is kept in step with status in the database (a trigger), so "complete" and "done" are one thing.

export const TASK_STATUSES = ["not_started", "in_progress", "testing", "awaiting_feedback", "complete"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  testing: "Testing",
  awaiting_feedback: "Awaiting feedback",
  complete: "Complete"
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
/** Higher sorts first. */
export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

/** A task's status, derived from is_done when the status column isn't there yet (before the migration). */
export function statusOfTask(t: { status?: string | null; is_done: boolean }): TaskStatus {
  const s = t.status as TaskStatus | undefined;
  if (s && (TASK_STATUSES as readonly string[]).includes(s)) return s;
  return t.is_done ? "complete" : "not_started";
}

export function priorityOfTask(t: { priority?: string | null }): TaskPriority {
  const p = t.priority as TaskPriority | undefined;
  return p && (TASK_PRIORITIES as readonly string[]).includes(p) ? p : "medium";
}
