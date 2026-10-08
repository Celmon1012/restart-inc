// Per-workspace delivery milestones, backed by console.deliverables --
// replaces the old hand-authored static list (see git history on this file
// and the console_deliverables migration for why: each row is still
// Restart's own curated status update for the client, just stored per
// workspace instead of hardcoded globally).

export interface Deliverable {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: "not-started" | "in-progress" | "completed" | "blocked";
  sort_order: number;
  due_at: string | null;
  meta: string | null;
  created_at: string;
}

export type DeliveryHealth = "overdue" | "due-soon" | "on-track" | "completed";

export const DUE_SOON_DAYS = 7;

export const HEALTH_LABEL: Record<DeliveryHealth, string> = {
  overdue: "OVERDUE",
  "due-soon": "DUE SOON",
  "on-track": "ON TRACK",
  completed: "COMPLETED"
};

// Completed always wins; otherwise it's driven by the due date. No due date
// means there is nothing to be late against, so no badge.
export function deliveryHealth(status: Deliverable["status"] | string, dueAt: string | null | undefined, now = new Date()): DeliveryHealth | null {
  if (status === "completed") return "completed";
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const t = now.getTime();
  if (due < t) return "overdue";
  if (due - t <= DUE_SOON_DAYS * 86_400_000) return "due-soon";
  return "on-track";
}

export function getCurrentDeliverable(deliverables: Deliverable[]): Deliverable | undefined {
  return deliverables.find((d) => d.status === "in-progress");
}
