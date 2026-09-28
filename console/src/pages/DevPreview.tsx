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
import BillingSla from "./console/BillingSla";
import AdminOverview from "./admin/Overview";
import AdminFinance from "./admin/Finance";
import AdminLeads from "./admin/Leads";
import AdminTasks from "./admin/Tasks";
import AdminProjects from "./admin/Projects";
import AdminProjectDetail from "./admin/ProjectDetail";
import AdminClients from "./admin/Clients";
import AdminClientDetail from "./admin/ClientDetail";
import AdminAttention from "./admin/Attention";

// Portfolio fixtures for the admin Projects/Clients pages (dev only): answer
// PostgREST reads on these tables and the support-data function locally.
const d = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const tableFixtures: Record<string, unknown[]> = {
  workspaces: [
    { id: "ws-steadfast", name: "Steadfast Life", tier_label: null, created_at: d(4), coolify_project_uuid: null, lago_customer_id: null, contact_email: "ops@steadfast.test", client_type: "sme", engagement_type: "build", qualification: "nurture", created_by: "u1", onboarding: { full_name: "Tolu Ade", role: "COO", website: "steadfast.test", budget: "10-25k", timeline: "30d" } },
    { id: "ws-steadfast-2", name: "Claims portal", tier_label: null, created_at: d(2), coolify_project_uuid: null, lago_customer_id: null, contact_email: "ops@steadfast.test", client_type: null, engagement_type: "ai", qualification: "qualified", created_by: "u1", onboarding: { source: "console_new_project", budget: "25-50k", timeline: "now", brief: "Automate first-pass claims triage with an LLM, with a human approving every decision." } },
    { id: "dev-ws", name: "Acme Operations", tier_label: "Pro", created_at: d(40), coolify_project_uuid: "c1", lago_customer_id: "c1", contact_email: "dev@acme.test", client_type: "enterprise", engagement_type: "scale", qualification: "priority", created_by: "u2", onboarding: { full_name: "Dana Okafor", role: "CTO", website: "acme.test" } },
  ],
  deliverables: [
    { id: "m1", workspace_id: "dev-ws", title: "Discovery & audit", status: "completed", due_at: d(20), sort_order: 0 },
    { id: "m2", workspace_id: "dev-ws", title: "Database migration", status: "in-progress", due_at: d(-5), sort_order: 1 },
    { id: "m3", workspace_id: "dev-ws", title: "Cutover", status: "not-started", due_at: d(-20), sort_order: 2 },
    { id: "m4", workspace_id: "ws-steadfast", title: "MVP build", status: "blocked", due_at: d(1), sort_order: 0 },
  ],
  deliverable_tasks: [
    { deliverable_id: "m2", is_done: true }, { deliverable_id: "m2", is_done: false }, { deliverable_id: "m2", is_done: false }, { deliverable_id: "m4", is_done: false },
  ],
  server_requests: [{ workspace_id: "dev-ws", status: "pending_review" }],
  inquiries: [],
};


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
    const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1];
    if (table && tableFixtures[table]) {
      return Promise.resolve(new Response(JSON.stringify(tableFixtures[table]), { headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("console-support-data")) {
      const conversations = [{ id: "t1", workspaceId: "dev-ws", workspaceName: "Acme Operations", status: "open", lastMessage: "Staging is slow since Tuesday", lastActivityAt: Date.now() - 3_600_000 }];
      return Promise.resolve(new Response(JSON.stringify({ conversations }), { headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("console-billing")) {
      const invoices = [
        { number: "RES-E119-004-002", issuingDate: "2026-09-17", status: "finalized", paymentStatus: "pending", totalAmountCents: 17333333, currency: "NGN", paymentUrl: "https://example.test/pay", fileUrl: null },
        { number: "RES-E119-004-001", issuingDate: "2026-08-17", status: "finalized", paymentStatus: "succeeded", totalAmountCents: 17333333, currency: "NGN", paymentUrl: null, fileUrl: null },
      ];
      const subscriptions = [
        { planCode: "devops-retainer-standard-ngn", planName: "DevOps Retainer — Standard (NGN)", status: "active", startedAt: "2026-09-17", amountCents: 150000000, currency: "NGN", interval: "monthly" },
        { planCode: "dedicated-server-vps10-ngn", planName: "Dedicated Server — VPS 10 (NGN)", status: "active", startedAt: "2026-09-07", amountCents: 4500000, currency: "NGN", interval: "monthly" },
      ];
      const appliedCoupons = [
        { name: "DevOps (6 months Free)", code: "DEVOPS6", status: "active", frequency: "recurring", durationTotal: 6, durationRemaining: 5, percentageRate: "100.0", amountCents: null, amountCurrency: null },
      ];
      const customer = { externalId: "dev-ws", name: "Acme Operations", paymentProvider: null };
      return Promise.resolve(new Response(JSON.stringify({ billingConfigured: true, customer, subscriptions, appliedCoupons, invoices }), { headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("console-admin-infra")) {
      const projects = [
        { uuid: "c1", name: "ACME OPERATIONS", description: null, workspaceId: "dev-ws", workspaceName: "Acme Operations", servers: [{ uuid: "s1", name: "acme-01", sharedWith: [] }] },
        { uuid: "c2", name: "TAXIQ", description: null, workspaceId: null, workspaceName: null, servers: [{ uuid: "s2", name: "taxiq-01", sharedWith: [] }] },
        { uuid: "c3", name: "LUBCON", description: null, workspaceId: null, workspaceName: null, servers: [{ uuid: "s3", name: "shared-01", sharedWith: ["PROF.SHERLEY"] }] },
        { uuid: "c4", name: "PROF.SHERLEY", description: null, workspaceId: null, workspaceName: null, servers: [{ uuid: "s3", name: "shared-01", sharedWith: ["LUBCON"] }] },
      ];
      const action = typeof init?.body === "string" ? JSON.parse(init.body)?.action : null;
      const body = action ? { ok: true } : { projects };
      return Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
    }
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
        {page === "new-project" ? <NewProject /> : page === "systems" ? <Systems /> : page === "billing" ? <BillingSla /> : page === "admin" ? <AdminOverview /> : page === "admin-finance" ? <AdminFinance /> : page === "admin-leads" ? <AdminLeads /> : page === "admin-tasks" ? <AdminTasks /> : page === "admin-projects" ? <AdminProjects /> : page === "admin-project" ? <AdminProjectDetail id="dev-ws" /> : page === "admin-attention" ? <AdminAttention /> : page === "admin-clients" ? <AdminClients /> : page === "admin-client" ? <AdminClientDetail clientKey="dev@acme.test" /> : <Overview />}
      </WorkspaceContext.Provider>
    </AuthContext.Provider>
  );
}
