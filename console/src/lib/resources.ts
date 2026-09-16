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

export type ResourceStatus =
  | "running:healthy"
  | "running:unhealthy"
  | "running:unknown"
  | "exited:unhealthy"
  | "stopped";

export interface DedicatedServer {
  uuid: string;
  name: string;
  ip: string;
  region: string | null;
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
  serviceType: string;
}

export type Resource = ApplicationResource | DatabaseResource | ServiceResource;

export interface Environment {
  name: string;
  resources: Resource[];
}

export interface Workspace {
  id: string;
  name: string;
  tier: string | null;
  server: DedicatedServer | null;
  environments: Environment[];
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
