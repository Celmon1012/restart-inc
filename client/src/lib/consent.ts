/**
 * Cookie consent state for the marketing site.
 *
 * Only two categories exist because only two are in use (see the Cookies
 * section of the Privacy Policy): strictly necessary (console session,
 * security, support chat) is always on; analytics (GA4) is opt-in and is
 * not loaded at all until a visitor allows it. There is deliberately no
 * "marketing" category -- the site runs no advertising or cross-site
 * tracking, so a toggle for it would control nothing.
 *
 * Stored in localStorage; bump STORAGE_KEY when categories change so every
 * visitor is asked again.
 */

export interface Consent {
  analytics: boolean;
  decidedAt: string;
}

const STORAGE_KEY = "restart.consent.v1";
const EVENT = "restart:consent-change";
export const OPEN_SETTINGS_EVENT = "restart:open-cookie-settings";

export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

export function setConsent(analytics: boolean): Consent {
  const consent = { analytics, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Private mode / blocked storage: the choice still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent<Consent>(EVENT, { detail: consent }));
  return consent;
}

export function onConsentChange(fn: (c: Consent) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<Consent>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Reopen the settings dialog, e.g. from a "Cookie settings" footer link. */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
