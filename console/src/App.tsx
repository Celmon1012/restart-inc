import { Toaster } from "sonner";
import { Switch, Route, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Overview from "./pages/console/Overview";
import Systems from "./pages/console/Systems";
import Delivery from "./pages/console/Delivery";
import Activity from "./pages/console/Activity";
import ProfileSecurity from "./pages/console/ProfileSecurity";
import ConsoleSettings from "./pages/console/ConsoleSettings";
import ApiKeyVault from "./pages/console/ApiKeyVault";
import BillingSla from "./pages/console/BillingSla";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      {/* Kept as a compatibility redirect -- bookmarks and any external
          links still pointing at the old dashboard route land on the page
          that replaced it, instead of a dead end. */}
      <Route path="/dashboard">
        <Redirect to="/console/overview" />
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
