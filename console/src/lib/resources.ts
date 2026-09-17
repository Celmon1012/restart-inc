// Data shapes here mirror Coolify's own resource model (server -> project ->
// environment -> application/database/service) rather than inventing a new
// one, since every workspace's resources here are, in production, backed
// 1:1 by a real Coolify server. See restart-inc's operating convention:
// each client project gets its own dedicated Coolify server for isolation
// (Coolify itself allows resources to share servers; we don't).
//
// Populated live from Coolify by the `console-data` Supabase Edge Function
// (see supabase/functions/console-data) — nothing here is mocked. Fields
// are nullable wherever Coolify doesn't reliably report them (e.g. it has
// no concept of physical region at all).

// Coolify's actual status vocabulary is broader than this list (confirmed:
// a service came back "degraded:unhealthy", which isn't documented) -- this
// is a hint for the common cases, not a guarantee, so statusMeta() below
// must handle values outside it instead of assuming exhaustiveness.
export type ResourceStatus =
  | "running:healthy"
  | "running:unhealthy"
  | "running:unknown"
  | "exited:unhealthy"
  | "degraded:unhealthy"
  | "stopped"
  | string;

export interface DedicatedServer {
  uuid: string;
  name: string;
  ip: string;
  isReachable: boolean;
  cpus: number | null;
  memoryGb: number | null;
  dockerVersion: string | null;
}

interface BaseResource {
  uuid: string;
  name: string;
  status: ResourceStatus;
}

export interface ApplicationResource extends BaseResource {
  kind: "application";
  fqdn: string;
  gitRepository: string;
  gitBranch: string;
  gitCommitSha: string;
  buildPack: string;
}

export interface DatabaseResource extends BaseResource {
  kind: "database";
  databaseType: string;
  isPublic: boolean;
}

export interface ServiceResource extends BaseResource {
  kind: "service";
  serviceType: string | null;
}

export type Resource = ApplicationResource | DatabaseResource | ServiceResource;

export interface Environment {
  name: string;
  resources: Resource[];
}

export interface Deployment {
  uuid: string;
  applicationName: string;
  status: string;
  commitSha: string | null;
  createdAt: string;
  trigger: "webhook" | "api" | "manual";
}

export interface Workspace {
  id: string;
  name: string;
  tier: string | null;
  server: DedicatedServer | null;
  environments: Environment[];
  deployments: Deployment[];
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  tier: string | null;
}

export function getResources(workspace: Workspace): Resource[] {
  return workspace.environments.flatMap((env) => env.resources);
}

export function getPrimaryApplication(workspace: Workspace): ApplicationResource | undefined {
  return getResources(workspace).find((r): r is ApplicationResource => r.kind === "application");
}

export const RESOURCE_KIND_LABEL: Record<Resource["kind"], string> = {
  application: "APPLICATION",
  database: "DATABASE",
  service: "SERVICE"
};

export function statusMeta(status: ResourceStatus): { label: string; tone: "healthy" | "warning" | "down" } {
  switch (status) {
    case "running:healthy":
      return { label: "Healthy", tone: "healthy" };
    case "running:unknown":
      return { label: "Running", tone: "healthy" };
    case "running:unhealthy":
      return { label: "Degraded", tone: "warning" };
    case "degraded:unhealthy":
      return { label: "Degraded", tone: "warning" };
    case "exited:unhealthy":
      return { label: "Exited", tone: "down" };
    case "stopped":
      return { label: "Stopped", tone: "down" };
    default:
      // An unrecognized status is a sign something changed on Coolify's
      // side, not proof the resource is unhealthy -- show it plainly rather
      // than guessing "healthy" (hides a real problem) or crashing (this
      // exact bug, from "degraded:unhealthy" before it was added above).
      return { label: status, tone: "warning" };
  }
}

const DEPLOYMENT_STATUS_LABEL: Record<string, string> = {
  finished: "Deployed successfully",
  failed: "Deployment failed",
  "in_progress": "Deploying",
  running: "Deploying",
  queued: "Queued to deploy",
  "cancelled-by-user": "Deployment cancelled"
};

export function deploymentStatusLabel(status: string): string {
  return DEPLOYMENT_STATUS_LABEL[status] ?? status;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function resourceSubtitle(resource: Resource): string {
  if (resource.kind === "application") {
    return `${resource.fqdn} · ${resource.gitRepository}@${resource.gitBranch} (${resource.gitCommitSha}) · ${resource.buildPack}`;
  }
  if (resource.kind === "database") {
    return `${resource.databaseType} · ${resource.isPublic ? "Publicly reachable" : "Private network only"}`;
  }
  return resource.serviceType ? `${resource.serviceType} service` : "Custom service";
}
