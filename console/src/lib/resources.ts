// Data shapes here mirror Coolify's own resource model (server -> project ->
// environment -> application/database/service) rather than inventing a new
// one, since every workspace's resources here are, in production, backed
// 1:1 by a real Coolify server. See restart-inc's operating convention:
// each client project gets its own dedicated Coolify server for isolation
// (Coolify itself allows resources to share servers; we don't).

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
  region: string;
  isReachable: boolean;
  cpus: number;
  memoryGb: number;
  diskGb: number;
  dockerVersion: string;
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
  uuid: string;
  name: string;
  resources: Resource[];
}

export interface Workspace {
  id: string;
  name: string;
  tier: string;
  server: DedicatedServer;
  environments: Environment[];
}

export function getResources(workspace: Workspace): Resource[] {
  return workspace.environments.flatMap((env) => env.resources);
}

export function getPrimaryApplication(workspace: Workspace): ApplicationResource | undefined {
  return getResources(workspace).find((r): r is ApplicationResource => r.kind === "application");
}

export const workspaces: Workspace[] = [
  {
    id: "acme-global-logistics",
    name: "Acme Global Logistics",
    tier: "Project #04 · Senior Dedicated",
    server: {
      uuid: "srv-acme-04",
      name: "cp.restart.ng/worker-04",
      ip: "138.201.44.12",
      region: "Ashburn, US-East · Hetzner CX52",
      isReachable: true,
      cpus: 16,
      memoryGb: 128,
      diskGb: 960,
      dockerVersion: "27.3.1"
    },
    environments: [
      {
        uuid: "env-acme-prod",
        name: "production",
        resources: [
          {
            kind: "application",
            uuid: "app-c84d9f10-91a2",
            name: "acme-logistics-checkout",
            status: "running:healthy",
            fqdn: "checkout.acmeglobal.ng",
            gitRepository: "acme-global/checkout-service",
            gitBranch: "main",
            gitCommitSha: "9f4e21a",
            buildPack: "nixpacks"
          },
          {
            kind: "database",
            uuid: "db-acme-pg-01",
            name: "acme-logistics-pg",
            status: "running:healthy",
            databaseType: "standalone-postgresql",
            isPublic: false
          },
          {
            kind: "service",
            uuid: "svc-acme-redis",
            name: "acme-redis-cache",
            status: "running:healthy",
            serviceType: "redis"
          }
        ]
      }
    ]
  },
  {
    id: "lubcon-international",
    name: "Lubcon International",
    tier: "Project #02 · Standard",
    server: {
      uuid: "srv-lubcon-02",
      name: "cp.restart.ng/worker-02",
      ip: "95.216.12.88",
      region: "Falkenstein, EU-Central · Hetzner CX32",
      isReachable: true,
      cpus: 8,
      memoryGb: 32,
      diskGb: 320,
      dockerVersion: "27.3.1"
    },
    environments: [
      {
        uuid: "env-lubcon-prod",
        name: "production",
        resources: [
          {
            kind: "application",
            uuid: "app-lubcon-portal",
            name: "lubcon-b2b-portal",
            status: "running:healthy",
            fqdn: "portal.lubcon.com",
            gitRepository: "lubcon/b2b-portal",
            gitBranch: "main",
            gitCommitSha: "3c990ef",
            buildPack: "dockerfile"
          },
          {
            kind: "database",
            uuid: "db-lubcon-pg-01",
            name: "lubcon-orders-pg",
            status: "running:healthy",
            databaseType: "standalone-postgresql",
            isPublic: false
          }
        ]
      }
    ]
  },
  {
    id: "breadmaker-systems",
    name: "Breadmaker Systems",
    tier: "Project #07 · Senior Dedicated",
    server: {
      uuid: "srv-breadmaker-07",
      name: "cp.restart.ng/worker-07",
      ip: "65.109.20.140",
      region: "Helsinki, EU-North · Hetzner CCX33",
      isReachable: true,
      cpus: 16,
      memoryGb: 64,
      diskGb: 640,
      dockerVersion: "27.3.1"
    },
    environments: [
      {
        uuid: "env-breadmaker-prod",
        name: "production",
        resources: [
          {
            kind: "application",
            uuid: "app-breadmaker-mcp",
            name: "breadmaker-wp-mcp",
            status: "running:healthy",
            fqdn: "mcp.breadmaker.dev",
            gitRepository: "breadmaker/wp-mcp-bridge",
            gitBranch: "main",
            gitCommitSha: "7a18bc0",
            buildPack: "nixpacks"
          },
          {
            kind: "service",
            uuid: "svc-breadmaker-wp",
            name: "breadmaker-wordpress",
            status: "exited:unhealthy",
            serviceType: "wordpress"
          },
          {
            kind: "database",
            uuid: "db-breadmaker-mysql",
            name: "breadmaker-mysql",
            status: "running:healthy",
            databaseType: "mysql"
          }
        ]
      }
    ]
  }
];
