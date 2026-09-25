// DEV ONLY (mounted behind import.meta.env.DEV in App.tsx): renders the real
// Overview page against fixture auth/workspace data so the layout can be
// checked without a Supabase session. Never bundled into production.
import type { User } from "@supabase/supabase-js";
import { AuthContext, type AuthContextType } from "@/contexts/AuthContext";
import { WorkspaceContext, type WorkspaceContextType } from "@/contexts/WorkspaceContext";
import type { Workspace } from "@/lib/resources";
import Overview from "./console/Overview";

const now = Date.now();
const ago = (m: number) => new Date(now - m * 60_000).toISOString();
const app = (uuid: string, name: string, status: Workspace["environments"][0]["resources"][0]["status"] = "running:healthy") => ({
  uuid, name, status, lastOnlineAt: ago(1), kind: "application" as const,
  fqdn: `https://${name}.example.com`, gitRepository: "acme/app", gitBranch: "main", gitCommitSha: "abc123", buildPack: "nixpacks",
});

const workspace: Workspace = {
  id: "dev-ws",
  name: "Acme Operations",
  tier: "Pro",
  server: { uuid: "s1", name: "acme-01", ip: "10.0.0.1", isReachable: true, cpus: 8, memoryGb: 32, dockerVersion: "27", os: "Ubuntu", arch: "x86_64", kernel: "6.8", composeVersion: "2", upSince: ago(60 * 24 * 40) },
  environments: [{
    name: "production",
    resources: [
      app("r1", "api-gateway"),
      app("r2", "storefront"),
      { uuid: "r3", name: "billing-worker", status: "running:healthy", lastOnlineAt: ago(2), kind: "service", serviceType: "worker" },
      { uuid: "r4", name: "postgres-primary", status: "running:healthy", lastOnlineAt: ago(2), kind: "database", databaseType: "postgresql", isPublic: false },
      { uuid: "r5", name: "search-index", status: "running:healthy", lastOnlineAt: ago(3), kind: "service", serviceType: "search" },
      app("r6", "admin"), app("r7", "webhooks"), app("r8", "docs"),
    ],
  }],
  deployments: Array.from({ length: 10 }, (_, i) => ({
    uuid: `d${i}`, applicationName: ["api-gateway", "storefront", "admin"][i % 3],
    status: i === 4 ? "failed" : "finished", commitSha: null, createdAt: ago(i * 60 * 14), trigger: "webhook" as const,
  })),
};

const auth = {
  session: null,
  user: { id: "dev", email: "dev@acme.test", user_metadata: { full_name: "Dev Preview" } } as unknown as User,
  loading: false,
  signInWithPassword: async () => ({ error: null }),
  signInWithOAuth: async () => ({ error: null }),
  signOut: async () => {},
  requestPasswordReset: async () => ({ error: null }),
} satisfies AuthContextType;

const ws: WorkspaceContextType = {
  workspaces: [{ id: workspace.id, name: workspace.name, tier: workspace.tier }],
  activeWorkspace: workspace,
  isAdmin: false,
  needsOnboarding: false,
  loaded: true,
  loading: false,
  error: null,
  setActiveWorkspaceId: () => {},
  refresh: async () => {},
};

export default function DevPreview() {
  return (
    <AuthContext.Provider value={auth}>
      <WorkspaceContext.Provider value={ws}>
        <Overview />
      </WorkspaceContext.Provider>
    </AuthContext.Provider>
  );
}
