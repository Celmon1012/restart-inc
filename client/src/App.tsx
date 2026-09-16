// Design: Operator's Field Notes — keep the report single-route, readable, and source-led.
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import CaseStudies from "./pages/CaseStudies";
import Insights from "./pages/Insights";
import StartProject from "./pages/StartProject";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ProfileSecurity from "./pages/console/ProfileSecurity";
import ConsoleSettings from "./pages/console/ConsoleSettings";
import ApiKeyVault from "./pages/console/ApiKeyVault";
import BillingSla from "./pages/console/BillingSla";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/case-studies" component={CaseStudies} />
      <Route path="/insights" component={Insights} />
      <Route path="/start-project" component={StartProject} />
      <Route path="/onboarding" component={StartProject} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
