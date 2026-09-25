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
import Leads from "./pages/console/Leads";
import Support from "./pages/console/Support";
import ProfileSecurity from "./pages/console/ProfileSecurity";
import ConsoleSettings from "./pages/console/ConsoleSettings";
import ApiKeyVault from "./pages/console/ApiKeyVault";
import BillingSla from "./pages/console/BillingSla";
import NewProject from "./pages/NewProject";
import { lazy, Suspense } from "react";

// Dev-only fixture page (see pages/DevPreview.tsx); tree-shaken from production.
const DevPreview = import.meta.env.DEV ? lazy(() => import("./pages/DevPreview")) : null;

// UX-only gate -- console.inquiries/inquiry_activities RLS (console.is_admin())
// is the real boundary. This just avoids flashing the page at a non-admin
// before bouncing them, same spirit as ProtectedRoute's own session check.
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useWorkspace();
  if (loading) return null;
  if (!isAdmin) return <Redirect to="/console/overview" />;
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
        <Redirect to="/console/overview" />
      </Route>
      <Route path="/console/new-project">
        <ProtectedRoute>
          <NewProject />
        </ProtectedRoute>
      </Route>
      <Route path="/console/systems">
        <ProtectedRoute>
          <Systems />
        </ProtectedRoute>
      </Route>
      <Route path="/console/delivery">
        <ProtectedRoute>
          <Delivery />
        </ProtectedRoute>
      </Route>
      <Route path="/console/activity">
        <ProtectedRoute>
          <Activity />
        </ProtectedRoute>
      </Route>
      <Route path="/console/timeline">
        <ProtectedRoute>
          <Timeline />
        </ProtectedRoute>
      </Route>
      <Route path="/console/leads">
        <ProtectedRoute>
          <AdminRoute>
            <Leads />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/console/support">
        <ProtectedRoute>
          <Support />
        </ProtectedRoute>
      </Route>
      <Route path="/console/profile">
        <ProtectedRoute>
          <ProfileSecurity />
        </ProtectedRoute>
      </Route>
      <Route path="/console/settings">
        <ProtectedRoute>
          <ConsoleSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/console/keys">
        <ProtectedRoute>
          <ApiKeyVault />
        </ProtectedRoute>
      </Route>
      <Route path="/console/billing">
        <ProtectedRoute>
          <BillingSla />
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
