// Design: Operator's Field Notes — keep the report single-route, readable, and source-led.
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CaseStudies from "./pages/CaseStudies";
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
      <Route path="/start-project" component={StartProject} />
      <Route path="/onboarding" component={StartProject} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/console/profile" component={ProfileSecurity} />
      <Route path="/console/settings" component={ConsoleSettings} />
      <Route path="/console/keys" component={ApiKeyVault} />
      <Route path="/console/billing" component={BillingSla} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
