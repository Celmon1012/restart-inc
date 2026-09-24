import { supabase } from "@/lib/supabase";
import type { Workspace } from "@/lib/resources";
import { getResources, statusMeta } from "@/lib/resources";
import { formatDate } from "@/lib/format";

/**
 * Per-workspace activity timeline.
 *
 * The console was strong at showing *current state* and weak at showing history:
 * an operator returning after two days saw today's numbers and a 24-hour deploy
 * count, but could not answer "what changed, and when?" — the first question
 * anyone asks when a system misbehaves.
 *
 * This aggregates events the platform ALREADY records, rather than adding new
 * instrumentation. Sources, and what each contributes:
 *
 *   deliverables + deliverable_tasks      milestone and task movement (Delivery)
 *   deliverable_activities                agent/admin notes and proposals
 *   inquiry_activities                    lead pipeline movements (shared shape)
 *   activeWorkspace.deployments           Coolify deploy records
 *   resources status (current snapshot)   present-day health, marked as such
 *
 * IMPORTANT LIMITATION, stated rather than hidden: resource STATUS TRANSITIONS are
 * NOT available historically. `console-data` returns each resource's current status
 * only, with no transition log, so the timeline can show "this is down now" but
 * cannot claim "this went down at 14:02". Present-tense health is therefore
 * emitted as a single synthetic event marked `synthetic: true`, and the UI labels
 * it. See the schema audit for what would be required to make it historical.
 */

export type TimelineKind =
  | "deploy"
  | "delivery"
  | "task"
  | "agent"
  | "lead"
  | "health"
  | "key";

export type TimelineTone = "healthy" | "warning" | "down" | "neutral";

export interface TimelineEvent {
  id: string;
  at: string;                 // ISO timestamp
  kind: TimelineKind;
  tone: TimelineTone;
  title: string;
  detail?: string;
  actor?: string;
  /** True when derived from current state rather than a recorded event. */
  synthetic?: boolean;
}

export const KIND_LABEL: Record<TimelineKind, string> = {
  deploy: "Deploy",
  delivery: "Delivery",
  task: "Task",
  agent: "Agent",
  lead: "Lead",
  health: "Health",
  key: "Access",
};

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Sort ascending-safe: newest first, dropping anything without a valid date. */
function finish(events: TimelineEvent[]): TimelineEvent[] {
  return events
    .filter((e) => e.at && !Number.isNaN(new Date(e.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/**
 * Load timeline events for a workspace. Every query is individually guarded: one
 * table failing (or not existing in an older deployment) degrades that source
 * only, instead of blanking the whole timeline. Partial data with an honest gap
 * is more useful to an operator than an error page.
 */
export async function loadTimeline(
  workspace: Workspace,
  signal?: AbortSignal
): Promise<{ events: TimelineEvent[]; degradedSources: string[] }> {
  const events: TimelineEvent[] = [];
  const degraded: string[] = [];
  const wsId = workspace.id;

  const guarded = async (
    name: string,
    fn: () => PromiseLike<{ data: unknown; error: unknown }>
  ): Promise<Record<string, unknown>[]> => {
    try {
      const { data, error } = await fn();
      if (error) throw error;
      if (signal?.aborted) return [];
      return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    } catch {
      degraded.push(name);
      return [];
    }
  };

  // --- deploys (already present on the workspace payload) ---
  for (const d of workspace.deployments ?? []) {
    events.push({
      id: `deploy-${d.uuid}`,
      at: d.createdAt,
      kind: "deploy",
      tone: d.status === "success" ? "healthy" : d.status === "failed" ? "down" : "warning",
      title: `${d.applicationName} ${str(d.status, "deployed")}`,
      detail: d.commitSha ? `Commit ${d.commitSha.slice(0, 7)}` : undefined,
      actor: `Coolify · ${str(d.trigger, "api")}`,
    });
  }

  // --- deliverables ---
  const deliverables = await guarded("deliverables", () =>
    supabase.schema("console").from("deliverables").select("*").eq("workspace_id", wsId)
  );
  for (const d of deliverables) {
    // Only completed milestones are a dated event; an in-progress one has no
    // meaningful timestamp of its own.
    const done = str(d.completed_at) || str(d.updated_at) || str(d.created_at);
    const status = str(d.status, "in-progress");
    if (status === "completed") {
      events.push({
        id: `deliverable-${String(d.id)}`,
        at: done,
        kind: "delivery",
        tone: "healthy",
        title: `Milestone completed — ${str(d.title, "Untitled milestone")}`,
        detail: str(d.summary) || undefined,
        actor: "Delivery",
      });
    } else {
      events.push({
        id: `deliverable-open-${String(d.id)}`,
        at: str(d.created_at),
        kind: "delivery",
        tone: status === "blocked" ? "down" : "warning",
        title: `Milestone ${status} — ${str(d.title, "Untitled milestone")}`,
        actor: "Delivery",
      });
    }
  }

  // --- deliverable tasks ---
  const tasks = await guarded("deliverable_tasks", () =>
    supabase.schema("console").from("deliverable_tasks").select("*").eq("workspace_id", wsId)
  );
  for (const t of tasks) {
    const status = str(t.status, "pending");
    const at = str(t.completed_at) || str(t.updated_at) || str(t.created_at);
    if (status === "done" || status === "complete" || status === "completed") {
      events.push({
        id: `task-${String(t.id)}`,
        at,
        kind: "task",
        tone: "healthy",
        title: `Task completed — ${str(t.title, "Untitled task")}`,
        actor: "Delivery",
      });
    }
  }

  // --- deliverable activity (agent + admin notes, proposals, stage changes) ---
  const dActs = await guarded("deliverable_activities", () =>
    supabase.schema("console").from("deliverable_activities").select("*").eq("workspace_id", wsId)
  );
  for (const a of dActs) {
    const type = str(a.activity_type, "note");
    const isAgent = str(a.actor) === "agent";
    events.push({
      id: `dact-${String(a.id)}`,
      at: str(a.created_at),
      kind: "agent",
      tone: type === "agent_proposal" && str(a.status) === "proposed" ? "warning" : "neutral",
      title:
        type === "stage_change"
          ? "Stage changed"
          : type === "agent_proposal"
            ? `Agent proposed ${str(a.status, "an update")}`
            : type === "email_sent"
              ? "Email sent"
              : isAgent
                ? "Agent note"
                : "Note added",
      detail: str(a.body) || undefined,
      actor: isAgent ? "Agent" : "Admin",
    });
  }

  // --- inquiry activity (lead pipeline; same activity shape) ---
  const iActs = await guarded("inquiry_activities", () =>
    supabase.schema("console").from("inquiry_activities").select("*").eq("workspace_id", wsId)
  );
  for (const a of iActs) {
    const type = str(a.activity_type, "note");
    events.push({
      id: `iact-${String(a.id)}`,
      at: str(a.created_at),
      kind: "lead",
      tone: type === "stage_change" ? "warning" : "neutral",
      title: type === "stage_change" ? "Lead moved stage" : "Lead activity",
      detail: str(a.body) || undefined,
      actor: str(a.actor) === "agent" ? "Agent" : "Admin",
    });
  }

  // --- current health snapshot (NOT historical -- label it) ---
  const resources = getResources(workspace);
  const unhealthy = resources.filter((r) => statusMeta(r.status).tone !== "healthy");
  for (const r of unhealthy) {
    const { label, tone } = statusMeta(r.status);
    events.push({
      id: `health-${r.uuid}`,
      at: r.lastOnlineAt ?? new Date().toISOString(),
      kind: "health",
      tone: tone === "down" ? "down" : "warning",
      title: `${r.name} is ${label.toLowerCase()}`,
      detail: "Current status — transition history is not recorded, so the time shown is its last check.",
      actor: "Coolify",
      synthetic: true,
    });
  }

  return { events: finish(events), degradedSources: degraded };
}

/** Group events by calendar day for the day-labelled timeline sections. */
export function groupByDay(events: TimelineEvent[]): { day: string; label: string; events: TimelineEvent[] }[] {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const d = new Date(e.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return Array.from(map.keys())
    .sort((a, b) => (a < b ? 1 : -1))
    .map((day) => ({
      day,
      label: formatDate(map.get(day)![0].at),
      events: map.get(day)!,
    }));
}
