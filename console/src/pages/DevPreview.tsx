// DEV ONLY (mounted behind import.meta.env.DEV in App.tsx): renders the real
// Overview page against fixture auth/workspace data so the layout can be
// checked without a Supabase session. Never bundled into production.
import type { User } from "@supabase/supabase-js";
import { AuthContext, type AuthContextType } from "@/contexts/AuthContext";
import { WorkspaceContext, type WorkspaceContextType } from "@/contexts/WorkspaceContext";
import type { Workspace } from "@/lib/resources";
import Overview from "./console/Overview";
import NewProject from "./NewProject";
import Systems from "./console/Systems";
import AdminOverview from "./admin/Overview";
import AdminFinance from "./admin/Finance";
import AdminLeads from "./admin/Leads";
import AdminTasks from "./admin/Tasks";

// Finance fixture: answer console-admin-finance locally so the tiles and tables
// can be checked with realistic multi-currency figures (dev only).
const financeFixture = {
  generatedAt: new Date().toISOString(),
  totals: {
    collected: { NGN: 1953226 },
    collectedThisMonth: {},
    outstanding: { NGN: 162919355, USD: 14900 },
    overdue: { NGN: 162919355, USD: 14900 },
    mrr: { NGN: 17333333 },
  },
  activeSubscriptions: 2,
  billedClients: 2,
  unbilledClients: 1,
  invoiceCount: 15,
  invoicesTruncated: false,
  monthly: Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 11 + i);
    return { month: d.toISOString().slice(0, 7), collected: i === 9 ? { NGN: 1953226 } : {} };
  }),
  clients: [
    { workspaceId: "dev-ws", name: "Acme Operations", customerId: "c1", collected: { NGN: 1953226 }, outstanding: { NGN: 162919355 }, overdue: { NGN: 162919355 }, mrr: { NGN: 17333333 }, invoiceCount: 13, lastInvoiceAt: "2026-07-17" },
    { workspaceId: null, name: "Northwind Commerce", customerId: "c2", collected: {}, outstanding: { USD: 14900 }, overdue: { USD: 14900 }, mrr: {}, invoiceCount: 2, lastInvoiceAt: "2026-08-01" },
  ],
  openInvoices: [
    { number: "RES-E119-004-001", client: "Acme Operations", workspaceId: "dev-ws", issuingDate: "2026-07-17", dueDate: "2026-07-17", paymentStatus: "pending", overdue: true, totalAmountCents: 169355, currency: "NGN", fileUrl: null },
    { number: "RES-E120-001-002", client: "Northwind Commerce", workspaceId: null, issuingDate: "2026-08-01", dueDate: "2026-08-15", paymentStatus: "failed", overdue: true, totalAmountCents: 14900, currency: "USD", fileUrl: null },
  ],
};
if (import.meta.env.DEV && typeof window !== "undefined" && !(window as { __financeFixture?: boolean }).__financeFixture) {
  (window as { __financeFixture?: boolean }).__financeFixture = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("console-admin-finance")) {
      return Promise.resolve(new Response(JSON.stringify(financeFixture), { headers: { "Content-Type": "application/json" } }));
    }
    return realFetch(input, init);
  };
}

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
  workspaces: [
    { id: workspace.id, name: workspace.name, tier: workspace.tier },
    { id: "ws-2", name: "Northwind Commerce", tier: "Scale" },
    { id: "ws-3", name: "Kestrel Health", tier: null },
  ],
  activeWorkspace: workspace,
  // ?admin=1 previews the console as an admin (shows the Admin area button).
  isAdmin: new URLSearchParams(window.location.search).get("admin") === "1",
  needsOnboarding: false,
  loaded: true,
  loading: false,
  error: null,
  setActiveWorkspaceId: () => {},
  refresh: async () => {},
};

export default function DevPreview() {
  const page = new URLSearchParams(window.location.search).get("page");
  return (
    <AuthContext.Provider value={auth}>
      <WorkspaceContext.Provider value={ws}>
        {page === "new-project" ? <NewProject /> : page === "systems" ? <Systems /> : page === "admin" ? <AdminOverview /> : page === "admin-finance" ? <AdminFinance /> : page === "admin-leads" ? <AdminLeads /> : page === "admin-tasks" ? <AdminTasks /> : <Overview />}
      </WorkspaceContext.Provider>
    </AuthContext.Provider>
  );
}
