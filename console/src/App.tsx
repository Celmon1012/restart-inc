import { Toaster } from "sonner";
import { ConfirmHost } from "@/components/confirmAction";
import { Switch, Route, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { WorkspaceProvider, useWorkspace } from "./contexts/WorkspaceContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Overview from "./pages/console/Overview";
import Systems from "./pages/console/Systems";
import Delivery from "./pages/console/Delivery";
import ClientTasks from "./pages/console/Tasks";
import Activity from "./pages/console/Activity";
import Timeline from "./pages/console/Timeline";
import Support from "./pages/console/Support";
import ProfileSecurity from "./pages/console/ProfileSecurity";
import ConsoleSettings from "./pages/console/ConsoleSettings";
import BillingSla from "./pages/console/BillingSla";
import NewProject from "./pages/NewProject";
import AdminOverview from "./pages/admin/Overview";
import AdminClients from "./pages/admin/Clients";
import AdminLeads from "./pages/admin/Leads";
import AdminProspects from "./pages/admin/Prospects";
import AdminProjects from "./pages/admin/Projects";
import AdminProjectDetail from "./pages/admin/ProjectDetail";
import AdminClientDetail from "./pages/admin/ClientDetail";
import AdminTasks from "./pages/admin/Tasks";
import AdminServerRequests from "./pages/admin/ServerRequests";
import AdminSupport from "./pages/admin/Support";
import AdminFinance from "./pages/admin/Finance";
import FinanceInvoices from "./pages/finance/Invoices";
import FinanceHosting from "./pages/finance/Hosting";
import FinanceDomains from "./pages/finance/Domains";
import FinanceReceived from "./pages/finance/Received";
import FinanceExpenses from "./pages/finance/Expenses";
import FinancePayments from "./pages/finance/Payments";
import FinanceAccounts from "./pages/finance/Accounts";
import FinanceVat from "./pages/finance/Vat";
import FinanceCashflow from "./pages/finance/Cashflow";
import FinanceReports from "./pages/finance/Reports";
import FinanceRates from "./pages/finance/Rates";
import AdminAttention from "./pages/admin/Attention";
import AdminTeam from "./pages/admin/Team";
import AdminEmail from "./pages/admin/Email";
import { StaffMfaGate } from "./components/StaffMfaGate";
import { lazy, Suspense } from "react";

// Dev-only fixture page (see pages/DevPreview.tsx); tree-shaken from production.
const DevPreview = import.meta.env.DEV ? lazy(() => import("./pages/DevPreview")) : null;

// UX-only gate for the /admin area -- RLS (console.is_admin()) on every
// console.* table, and the is_admin check in the admin edge functions, are the
// real boundary. This just avoids flashing the page at a non-admin
// before bouncing them, same spirit as ProtectedRoute's own session check.
// "ops" for the Ops area, "finance" for Finance, "owner" for owner-only pages (sales, the Team page).
// Staff who aren't owners must have two-factor sign-in set up before they get in.
function AdminRoute({ children, need = "ops" }: { children: React.ReactNode; need?: "ops" | "finance" | "owner" }) {
  const { rolesLoaded, loading, isStaff, isOwner, canOps, canFinance } = useWorkspace();
  // Wait for the role lookup (and, if it came back empty, the workspace call that can also report it).
  if (!rolesLoaded || (loading && !isStaff)) return null;
  const allowed = need === "owner" ? isOwner : need === "finance" ? canFinance : canOps;
  if (!allowed) return <Redirect to={canOps ? "/admin" : canFinance ? "/finance" : "/overview"} />;
  return <StaffMfaGate>{children}</StaffMfaGate>;
}

// Where someone with a staff role but no client project of their own lands from the root.
function Home() {
  const { rolesLoaded, loading, isOwner, canOps, canFinance, isStaff, workspaces } = useWorkspace();
  if (rolesLoaded && !loading && isStaff && !isOwner && workspaces.length === 0) return <Redirect to={canOps ? "/admin" : canFinance ? "/finance" : "/profile"} replace />;
  return <Overview />;
}

// A page in the Finance area: signed in, and an admin (RLS is the real boundary).
function FinanceRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminRoute need="finance">{children}</AdminRoute>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      {DevPreview && (
        <Route path="/__preview">
          <Suspense fallback={null}><DevPreview /></Suspense>
        </Route>
      )}
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/onboarding">
        <ProtectedRoute allowWithoutWorkspace>
          <Onboarding />
        </ProtectedRoute>
      </Route>
      {/* Kept as a compatibility redirect -- bookmarks and any external
          links still pointing at the old dashboard route land on the page
          that replaced it, instead of a dead end. */}
      <Route path="/dashboard">
        <Redirect to="/overview" />
      </Route>
      {/* Console routes used to live under /console/*; the subdomain already
          says "console", so they moved to the root. Old links keep working. */}
      <Route path="/console/*">
        {(params) => <Redirect to={`/${params["*"]}${window.location.search}`} replace />}
      </Route>
      <Route path="/console">
        <Redirect to="/overview" replace />
      </Route>
      <Route path="/new-project">
        <ProtectedRoute>
          <NewProject />
        </ProtectedRoute>
      </Route>
      <Route path="/systems">
        <ProtectedRoute>
          <Systems />
        </ProtectedRoute>
      </Route>
      <Route path="/delivery">
        <ProtectedRoute>
          <Delivery />
        </ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute>
          <ClientTasks />
        </ProtectedRoute>
      </Route>
      <Route path="/activity">
        <ProtectedRoute>
          <Activity />
        </ProtectedRoute>
      </Route>
      <Route path="/timeline">
        <ProtectedRoute>
          <Timeline />
        </ProtectedRoute>
      </Route>
      {/* Leads moved to the admin area; keep old links working. */}
      <Route path="/leads">
        <Redirect to="/admin/leads" />
      </Route>
      <Route path="/support">
        <ProtectedRoute>
          <Support />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <ProfileSecurity />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <ConsoleSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/billing">
        <ProtectedRoute>
          <BillingSla />
        </ProtectedRoute>
      </Route>
      {/* Admin area: Restart staff only. The console links here only for admins. */}
      <Route path="/admin">
        <ProtectedRoute>
          <AdminRoute>
            <AdminOverview />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/clients">
        <ProtectedRoute>
          <AdminRoute>
            <AdminClients />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/clients/:key">
        <ProtectedRoute>
          <AdminRoute>
            <AdminClientDetail />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/leads">
        <ProtectedRoute>
          <AdminRoute need="owner">
            <AdminLeads />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/outreach">
        <ProtectedRoute>
          <AdminRoute need="owner">
            <AdminProspects />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/projects">
        <ProtectedRoute>
          <AdminRoute>
            <AdminProjects />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/projects/:id">
        <ProtectedRoute>
          <AdminRoute>
            <AdminProjectDetail />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/tasks">
        <ProtectedRoute>
          <AdminRoute>
            <AdminTasks />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/requests">
        <ProtectedRoute>
          <AdminRoute>
            <AdminServerRequests />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support">
        <ProtectedRoute>
          <AdminRoute>
            <AdminSupport />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/team">
        <ProtectedRoute>
          <AdminRoute need="owner">
            <AdminTeam />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/email">
        <ProtectedRoute>
          <AdminRoute need="owner">
            <AdminEmail />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/attention">
        <ProtectedRoute>
          <AdminRoute>
            <AdminAttention />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/finance">
        <Redirect to="/finance" />
      </Route>
      <Route path="/finance">
        <ProtectedRoute>
          <AdminRoute>
            <AdminFinance />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/finance/invoices">
        <FinanceRoute>
          <FinanceInvoices />
        </FinanceRoute>
      </Route>
      <Route path="/finance/received">
        <FinanceRoute>
          <FinanceReceived />
        </FinanceRoute>
      </Route>
      <Route path="/finance/hosting">
        <FinanceRoute>
          <FinanceHosting />
        </FinanceRoute>
      </Route>
      <Route path="/finance/domains">
        <FinanceRoute>
          <FinanceDomains />
        </FinanceRoute>
      </Route>
      <Route path="/finance/deployments">
        <Redirect to="/finance/hosting" />
      </Route>
      <Route path="/finance/expenses">
        <FinanceRoute>
          <FinanceExpenses />
        </FinanceRoute>
      </Route>
      <Route path="/finance/costs">
        <Redirect to="/finance/expenses" />
      </Route>
      <Route path="/finance/payments">
        <FinanceRoute>
          <FinancePayments />
        </FinanceRoute>
      </Route>
      <Route path="/finance/reports">
        <FinanceRoute>
          <FinanceReports />
        </FinanceRoute>
      </Route>
      <Route path="/finance/cashflow">
        <FinanceRoute>
          <FinanceCashflow />
        </FinanceRoute>
      </Route>
      <Route path="/finance/accounts">
        <FinanceRoute>
          <FinanceAccounts />
        </FinanceRoute>
      </Route>
      <Route path="/finance/rates">
        <FinanceRoute>
          <FinanceRates />
        </FinanceRoute>
      </Route>
      <Route path="/finance/vat">
        <FinanceRoute>
          <FinanceVat />
        </FinanceRoute>
      </Route>
      {/* Root and any unmatched path land on the overview, which bounces to
          /login when signed out. This app has nothing else to serve. */}
      <Route>
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WorkspaceProvider>
          <Toaster theme="dark" />
          <ConfirmHost />
          <Router />
        </WorkspaceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
