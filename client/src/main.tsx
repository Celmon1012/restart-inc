import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics, trackPageView } from "./lib/analytics";

// Start measurement before first paint so the first route change is
// captured. Safe no-op when no measurement ID is configured.
initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);

// Report SPA navigations as page views. history.pushState/replaceState are
// patched directly rather than hooking wouter, because the console app and
// any future router would otherwise need their own integration. popstate
// covers browser back/forward.
let lastPath = window.location.pathname + window.location.search;
trackPageView(lastPath);

function reportIfChanged() {
  const next = window.location.pathname + window.location.search;
  if (next !== lastPath) {
    lastPath = next;
    trackPageView(next);
  }
}

for (const method of ["pushState", "replaceState"] as const) {
  const original = history[method];
  history[method] = function patched(this: History, ...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    // Defer so the router has committed the new tree before we read the URL.
    setTimeout(reportIfChanged, 0);
    return result;
  } as typeof original;
}

window.addEventListener("popstate", () => setTimeout(reportIfChanged, 0));
