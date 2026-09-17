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

export function getCurrentDeliverable(deliverables: Deliverable[]): Deliverable | undefined {
  return deliverables.find((d) => d.status === "in-progress");
}
