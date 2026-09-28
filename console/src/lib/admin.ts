// Shared reads for the admin area. Every query here runs as the signed-in
// admin's own JWT -- console.is_admin() in RLS is what lets these return rows
// across every workspace, not anything in this file.

import { consoleSchema } from "./supabase";
import { invokeFunction } from "./functions";

export interface AdminWorkspace {
  id: string;
  name: string;
  tier_label: string | null;
  created_at: string;
  coolify_project_uuid: string | null;
  lago_customer_id: string | null;
  contact_email: string | null;
  client_type: string | null;
  engagement_type: string | null;
  qualification: string | null;
  created_by: string | null;
  // Set by complete_onboarding (full_name, role, website, timeline, budget) or
  // create_project (source, timeline, budget, brief).
  onboarding: {
    full_name?: string;
    role?: string;
    website?: string | null;
    timeline?: string;
    budget?: string;
    brief?: string | null;
    source?: string;
  } | null;
}

export async function loadAdminWorkspaces(): Promise<AdminWorkspace[]> {
  const { data, error } = await consoleSchema()
    .from("workspaces")
    .select(
      "id,name,tier_label,created_at,coolify_project_uuid,lago_customer_id,contact_email,client_type,engagement_type,qualification,created_by,onboarding"
    )
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * id -> name for every workspace. Admin pages join client names in the browser
 * rather than with PostgREST resource embedding (workspace:workspaces(...)),
 * which failed in production against this self-hosted instance.
 */
export async function loadWorkspaceNames(): Promise<Map<string, string>> {
  const { data, error } = await consoleSchema().from("workspaces").select("id,name");
  if (error) throw error;
  return new Map((data ?? []).map((w) => [w.id as string, w.name as string]));
}

// Pipeline stages in funnel order, shared by the Leads board and the overview.
export const PIPELINE_STAGES = ["new", "contacted", "qualified", "won", "lost", "archived"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export const OPEN_STAGES: PipelineStage[] = ["new", "contacted", "qualified"];

/** ?key= from the current URL -- admin pages deep-link by query string. */
export function queryParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export const ENGAGEMENT_LABEL: Record<string, string> = {
  build: "Build",
  scale: "Fix / scale",
  operate: "Operate",
  ai: "AI",
  advisory: "Advisory",
  exploring: "Exploring"
};

export const CLIENT_TYPE_LABEL: Record<string, string> = {
  startup: "Startup",
  sme: "SME",
  enterprise: "Enterprise",
  agency: "Agency",
  individual: "Individual"
};

/* ------------------------------------------------------------------
 * Portfolio: every project (a console workspace) with its delivery and
 * request aggregates, and the clients those projects roll up to.
 *
 * There is no clients table: a client is the account behind one or more
 * workspaces. The first workspace comes from onboarding (named after the
 * organisation, with the contact's name in onboarding.full_name); later ones
 * come from "Start a Project". So projects are grouped by contact email, and
 * the client's display name is its onboarding workspace's name.
 * ------------------------------------------------------------------ */

// "live": no milestones being tracked, but the project already runs on our
// infrastructure (linked Coolify project) or is billed (Lago customer) -- an
// operated system, not one still being scoped.
export type ProjectStatus = "active" | "blocked" | "completed" | "not-started" | "live" | "onboarding";

export interface ProjectSummary extends AdminWorkspace {
  clientKey: string;
  milestones: number;
  completed: number;
  blocked: number;
  currentMilestone: string | null;
  nextDue: string | null;
  tasksOpen: number;
  tasksTotal: number;
  openRequests: number;
  status: ProjectStatus;
}

export interface ClientSummary {
  key: string;
  name: string;
  contactName: string | null;
  email: string | null;
  role: string | null;
  website: string | null;
  clientType: string | null;
  since: string;
  projects: ProjectSummary[];
}

const OPEN_REQUEST_STATUSES = ["pending_review", "awaiting_payment", "paid", "in_progress"];

export function clientKeyFor(w: Pick<AdminWorkspace, "id" | "contact_email" | "created_by">): string {
  if (w.contact_email) return w.contact_email.trim().toLowerCase();
  if (w.created_by) return `user:${w.created_by}`;
  return `ws:${w.id}`;
}

export async function loadPortfolio(): Promise<{ projects: ProjectSummary[]; clients: ClientSummary[] }> {
  const [workspaces, deliverablesRes, tasksRes, requestsRes] = await Promise.all([
    loadAdminWorkspaces(),
    consoleSchema().from("deliverables").select("id,workspace_id,title,status,due_at,sort_order").order("sort_order"),
    consoleSchema().from("deliverable_tasks").select("deliverable_id,is_done"),
    consoleSchema().from("server_requests").select("workspace_id,status")
  ]);
  if (deliverablesRes.error) throw deliverablesRes.error;
  // Tasks and requests are enrichment; a missing grant or table there must
  // not take the whole portfolio down.
  const deliverables = deliverablesRes.data ?? [];
  const tasks = tasksRes.error ? [] : tasksRes.data ?? [];
  const requests = requestsRes.error ? [] : requestsRes.data ?? [];
  const workspaceOfDeliverable = new Map(deliverables.map((d) => [d.id as string, d.workspace_id as string]));

  const projects: ProjectSummary[] = workspaces.map((w) => {
    const mine = deliverables.filter((d) => d.workspace_id === w.id);
    const myTasks = tasks.filter((t) => workspaceOfDeliverable.get(t.deliverable_id) === w.id);
    const completed = mine.filter((d) => d.status === "completed").length;
    const blocked = mine.filter((d) => d.status === "blocked").length;
    const current = mine.find((d) => d.status === "in-progress");
    const nextDue = mine
      .filter((d) => d.status !== "completed" && d.due_at)
      .map((d) => d.due_at as string)
      .sort()[0] ?? null;
    const status: ProjectStatus =
      mine.length === 0
        ? w.coolify_project_uuid || w.lago_customer_id
          ? "live"
          : "onboarding"
        : blocked > 0
          ? "blocked"
          : completed === mine.length
            ? "completed"
            : current
              ? "active"
              : "not-started";
    return {
      ...w,
      clientKey: clientKeyFor(w),
      milestones: mine.length,
      completed,
      blocked,
      currentMilestone: current?.title ?? null,
      nextDue,
      tasksOpen: myTasks.filter((t) => !t.is_done).length,
      tasksTotal: myTasks.length,
      openRequests: requests.filter((r) => r.workspace_id === w.id && OPEN_REQUEST_STATUSES.includes(r.status)).length,
      status
    };
  });

  const groups = new Map<string, ProjectSummary[]>();
  for (const p of projects) groups.set(p.clientKey, [...(groups.get(p.clientKey) ?? []), p]);

  const clients: ClientSummary[] = Array.from(groups.entries()).map(([key, list]) => {
    const byAge = list.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    const onboarded = byAge.find((p) => p.onboarding?.full_name) ?? null;
    const primary = onboarded ?? byAge[0];
    return {
      key,
      name: primary.name,
      contactName: onboarded?.onboarding?.full_name ?? null,
      email: primary.contact_email,
      role: onboarded?.onboarding?.role ?? null,
      website: onboarded?.onboarding?.website ?? null,
      clientType: byAge.find((p) => p.client_type)?.client_type ?? null,
      since: byAge[0].created_at,
      projects: byAge
    };
  });
  clients.sort((a, b) => a.name.localeCompare(b.name));

  return { projects, clients };
}

/* ------------------------------------------------------------------
 * Infrastructure: Coolify projects and which console project each one
 * backs. Coolify is only reachable through console-admin-infra (the API
 * token never reaches the browser). Policy: one console project = one
 * Coolify project = its own server, so servers.sharedWith should be empty.
 * ------------------------------------------------------------------ */

export interface CoolifyProject {
  uuid: string;
  name: string;
  description: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  servers: Array<{ uuid: string; name: string; sharedWith: string[] }>;
}

export async function loadCoolifyProjects(): Promise<CoolifyProject[]> {
  const res = await invokeFunction<{ projects: CoolifyProject[] }>("console-admin-infra");
  return res.projects ?? [];
}

export type InfraAction =
  | { action: "link"; workspace_id: string; coolify_project_uuid: string }
  | { action: "create"; workspace_id: string }
  | { action: "unlink"; workspace_id: string }
  | { action: "import"; coolify_project_uuid: string; name: string; contact_email: string };

export function runInfraAction<T = unknown>(body: InfraAction): Promise<T> {
  return invokeFunction<T>("console-admin-infra", { body });
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  "not-started": "Not started",
  live: "Live",
  onboarding: "Scoping"
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, "healthy" | "warning" | "down" | "neutral"> = {
  active: "healthy",
  blocked: "down",
  completed: "healthy",
  "not-started": "neutral",
  live: "healthy",
  onboarding: "warning"
};
