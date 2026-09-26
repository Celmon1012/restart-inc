import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Minus, Plus } from "lucide-react";
import { getConsent, OPEN_SETTINGS_EVENT, setConsent } from "@/lib/consent";

/* ------------------------------------------------------------------
 * Cookie banner (first visit) and settings dialog (from the banner or
 * any "Cookie settings" footer link). Categories mirror the Privacy
 * Policy; see lib/consent.ts for why there is no marketing toggle.
 * ------------------------------------------------------------------ */

const CATEGORIES = [
  {
    id: "necessary" as const,
    title: "Strictly necessary",
    locked: true,
    body: "Keep the site and client console working: sign-in sessions, security, remembering this choice, and the support chat. These can't be switched off.",
  },
  {
    id: "analytics" as const,
    title: "Analytics",
    locked: false,
    body: "Google Analytics 4, with IP anonymisation, to count visits and see which pages and steps of the project intake people use. No advertising or cross-site tracking. Until you allow it, no analytics cookies are set and only anonymous, cookieless page counts are sent.",
  },
];

export default function CookieConsent() {
  const [bannerOpen, setBannerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const existing = getConsent();
    if (!existing) setBannerOpen(true);
    else setAnalytics(existing.analytics);

    const open = () => {
      setAnalytics(getConsent()?.analytics ?? false);
      setDialogOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (dialogOpen && !d.open) d.showModal();
    if (!dialogOpen && d.open) d.close();
  }, [dialogOpen]);

  const decide = (allowAnalytics: boolean) => {
    setConsent(allowAnalytics);
    setAnalytics(allowAnalytics);
    setBannerOpen(false);
    setDialogOpen(false);
  };

  return (
    <>
      {bannerOpen && !dialogOpen && (
        <section className="cc-banner" role="region" aria-label="Cookie consent">
          <h2>We value your privacy</h2>
          <p>
            We use strictly necessary cookies to run the site, and analytics cookies only if you allow them. No advertising
            or cross-site tracking. <Link href="/privacy#cookies">Privacy Policy</Link>
          </p>
          <div className="cc-actions">
            <button type="button" className="cc-btn" onClick={() => decide(false)}>Reject all</button>
            <button type="button" className="cc-btn cc-primary" onClick={() => decide(true)}>Accept all</button>
            <button type="button" className="cc-btn cc-push" onClick={() => setDialogOpen(true)}>Customize</button>
          </div>
        </section>
      )}

      <dialog
        ref={dialogRef}
        className="cc-dialog"
        aria-labelledby="cc-title"
        onClose={() => setDialogOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setDialogOpen(false); }}
      >
        <div className="cc-dialog-body">
          <h2 id="cc-title">Privacy settings</h2>
          <p>Choose which cookies and tracking technologies you allow. You can change this any time from "Cookie settings" in the footer.</p>

          <div className="cc-list">
            {CATEGORIES.map((c) => {
              const on = c.locked || analytics;
              const open = expanded === c.id;
              return (
                <div key={c.id} className="cc-item">
                  <div className="cc-item-row">
                    <button
                      type="button"
                      className="cc-expand"
                      aria-expanded={open}
                      aria-controls={`cc-desc-${c.id}`}
                      onClick={() => setExpanded(open ? null : c.id)}
                    >
                      {open ? <Minus size={14} /> : <Plus size={14} />}
                      {c.title}
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${c.title} cookies`}
                      disabled={c.locked}
                      className="cc-switch"
                      onClick={() => setAnalytics((v) => !v)}
                    >
                      <span />
                    </button>
                  </div>
                  {open && <p id={`cc-desc-${c.id}`} className="cc-desc">{c.body}</p>}
                </div>
              );
            })}
          </div>

          <div className="cc-actions">
            <button type="button" className="cc-btn" onClick={() => decide(false)}>Reject all</button>
            <button type="button" className="cc-btn" onClick={() => decide(true)}>Accept all</button>
            <button type="button" className="cc-btn cc-primary cc-push" onClick={() => decide(analytics)}>Save settings</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
