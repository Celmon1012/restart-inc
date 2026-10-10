import { Toaster } from "sonner";
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
import AdminAttention from "./pages/admin/Attention";
import { lazy, Suspense } from "react";

// Dev-only fixture page (see pages/DevPreview.tsx); tree-shaken from production.
const DevPreview = import.meta.env.DEV ? lazy(() => import("./pages/DevPreview")) : null;

// UX-only gate for the /admin area -- RLS (console.is_admin()) on every
// console.* table, and the is_admin check in the admin edge functions, are the
// real boundary. This just avoids flashing the page at a non-admin
// before bouncing them, same spirit as ProtectedRoute's own session check.
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useWorkspace();
  if (loading) return null;
  if (!isAdmin) return <Redirect to="/overview" />;
  return <>{children}</>;
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
          <AdminRoute>
            <AdminLeads />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/outreach">
        <ProtectedRoute>
          <AdminRoute>
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
      {/* Root and any unmatched path land on the overview, which bounces to
          /login when signed out. This app has nothing else to serve. */}
      <Route>
        <ProtectedRoute>
          <Overview />
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
          <Router />
        </WorkspaceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
