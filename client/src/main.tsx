import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { disableAnalytics, initAnalytics, trackPageView } from "./lib/analytics";
import { getConsent, onConsentChange } from "./lib/consent";

// GA4 loads only after analytics consent (see lib/consent.ts). A returning
// visitor who already allowed it is measured from first paint; a new visitor
// is measured from the moment they accept, starting with the current page.
let lastPath = window.location.pathname + window.location.search;

let analyticsOn = false;

function startAnalytics() {
  if (analyticsOn) return;
  analyticsOn = true;
  initAnalytics();
  trackPageView(lastPath);
}

if (getConsent()?.analytics) startAnalytics();
onConsentChange((c) => {
  if (c.analytics) startAnalytics();
  else if (analyticsOn) {
    analyticsOn = false;
    disableAnalytics();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

// Report SPA navigations as page views. history.pushState/replaceState are
// patched directly rather than hooking wouter, because the console app and
// any future router would otherwise need their own integration. popstate
// covers browser back/forward. trackPageView is a no-op until GA4 is loaded.
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
