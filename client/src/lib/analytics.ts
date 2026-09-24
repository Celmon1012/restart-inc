/**
 * Lightweight, provider-agnostic analytics for the marketing site.
 *
 * Why this exists: the site had no measurement of any kind, so the console
 * could tell you *who* converted (console.inquiries stores source/referrer)
 * but never *what* converted them, and never how many people started the
 * intake form and abandoned it. Funnel drop-off is invisible without the
 * denominator, so the multi-step form now reports both sides.
 *
 * Design rules, in order of importance:
 *   1. Never break the page. Every call is guarded and swallows its own
 *      errors -- analytics must not be able to take down a lead form.
 *   2. Never send personal data. No names, emails, company names, or free
 *      text ever leave the browser. Only categorical answers and counts.
 *      This matters: the site carries an NDPA/GDPR-aligned privacy policy.
 *   3. Degrade to a no-op. With no measurement ID configured, track() only
 *      logs in development and does nothing in production.
 *
 * GA4 is the primary sink. The Umami endpoint provisioned for this project
 * is also dispatched to when present, since some Manus-preview traffic is
 * only visible there.
 */

/**
 * Set this to your GA4 measurement ID ("G-XXXXXXXXXX") to switch tracking
 * on. It can also arrive via VITE_GA4_MEASUREMENT_ID at build time, which
 * wins when both are present.
 *
 * This is deliberately a build-time constant rather than a runtime fetch:
 * production is built by Coolify from the restart-web repository, not by
 * the Manus webdev platform, so platform-injected VITE_* variables are not
 * available at production build time.
 */
export const GA4_MEASUREMENT_ID: string =
  (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined) || "";

/** Optional secondary sink. Leave empty to disable. */
export const UMAMI_WEBSITE_ID: string =
  (import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined) || "";
export const UMAMI_ENDPOINT: string =
  (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined) || "";

const DEBUG = Boolean(import.meta.env.DEV);

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

let initialised = false;

export function initAnalytics(): void {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  if (!GA4_MEASUREMENT_ID) {
    if (DEBUG) {
      console.info(
        "[analytics] No GA4 measurement ID configured. Events are logged but not sent. " +
          "Set GA4_MEASUREMENT_ID in client/src/lib/analytics.ts or VITE_GA4_MEASUREMENT_ID."
      );
    }
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  // send_page_view: false -- this is a SPA, so page views are reported
  // explicitly by trackPageView() on route change instead of on script load.
  window.gtag("config", GA4_MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/**
 * Report one event. Safe to call from anywhere, including before init.
 *
 * `undefined` params are dropped rather than sent as empty strings, so a
 * missing value never pollutes a GA4 report as the literal text "undefined".
 */
export function track(event: string, params: EventParams = {}): void {
  if (typeof window === "undefined") return;

  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") clean[key] = value;
  }

  try {
    if (typeof window.gtag === "function") window.gtag("event", event, clean);
    if (window.umami && typeof window.umami.track === "function") {
      window.umami.track(event, clean);
    }
  } catch {
    // A tracking failure must never surface to the user or interrupt a
    // form submission. Swallow deliberately.
  }

  if (DEBUG) console.info(`[analytics] ${event}`, clean);
}

/** Report a SPA route change as a GA4 page_view. */
export function trackPageView(path: string, title?: string): void {
  track("page_view", {
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_title: title ?? (typeof document !== "undefined" ? document.title : undefined),
  });
}

/* ------------------------------------------------------------------ *
 * Intake funnel vocabulary
 *
 * These names are the contract with whatever dashboard gets built later.
 * Changing one silently breaks the drop-off report, so keep them stable
 * and add rather than rename.
 * ------------------------------------------------------------------ */

export const FUNNEL = {
  /** A step became visible. Denominator for that step's drop-off. */
  STEP_VIEW: "intake_step_view",
  /** Validation passed and the visitor advanced. */
  STEP_COMPLETE: "intake_step_complete",
  /** Visitor stepped backwards -- a friction signal, not a failure. */
  STEP_BACK: "intake_step_back",
  /** Validation blocked advancement. Includes which field failed. */
  STEP_BLOCKED: "intake_step_blocked",
  /** Form opened at all. Denominator for the whole funnel. */
  STARTED: "intake_started",
  /** GA4's recommended conversion event name for a lead. */
  LEAD: "generate_lead",
} as const;

export const STEP_NAMES: Record<number, string> = {
  1: "situation",
  2: "stakes",
  3: "scope_and_contact",
};
