import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics, trackPageView, updateAnalyticsConsent } from "./lib/analytics";
import { getConsent, onConsentChange } from "./lib/consent";

// GA4 runs in Consent Mode v2 (see lib/analytics.ts): it loads for every
// visitor with analytics storage denied, and a stored or newly given
// consent upgrades it to full, cookie-based measurement.
let lastPath = window.location.pathname + window.location.search;

initAnalytics(Boolean(getConsent()?.analytics));
trackPageView(lastPath);
onConsentChange((c) => updateAnalyticsConsent(c.analytics));

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
