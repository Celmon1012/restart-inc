// Design: Operator's Field Notes — keep the report single-route, readable, and source-led.
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieConsent from "./components/CookieConsent";
import TopBar from "./components/TopBar";
import Scorecard from "./pages/Scorecard";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import About from "./pages/About";
import CaseStudies from "./pages/CaseStudies";
import CaseStudyDetail from "./pages/CaseStudyDetail";
import Insights from "./pages/Insights";
import InsightDetail from "./pages/InsightDetail";
import StartProject from "./pages/StartProject";
import InquirySubmitted from "./pages/InquirySubmitted";
import Contact from "./pages/Contact";
import Solutions from "./pages/Solutions";
import SolutionDetail from "./pages/SolutionDetail";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Careers from "./pages/Careers";
import Platform from "./pages/Platform";
import NotFound from "./pages/NotFound";

function Router() {
  const [location] = useLocation();

  // Header and footer links navigate between pages, so land each one at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/platform" component={Platform} />
      <Route path="/about" component={About} />
      <Route path="/case-studies" component={CaseStudies} />
      <Route path="/case-studies/:id" component={CaseStudyDetail} />
      <Route path="/insights" component={Insights} />
      <Route path="/insights/:slug" component={InsightDetail} />
      <Route path="/solutions" component={Solutions} />
      <Route path="/solutions/:slug" component={SolutionDetail} />
      <Route path="/contact" component={Contact} />
      <Route path="/start-project" component={StartProject} />
      <Route path="/thank-you" component={InquirySubmitted} />
      <Route path="/onboarding" component={StartProject} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/careers" component={Careers} />
      <Route path="/scorecard" component={Scorecard} />
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
          <TopBar />
          <Router />
          <CookieConsent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
