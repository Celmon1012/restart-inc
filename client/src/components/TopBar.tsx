import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Gauge, X } from "lucide-react";
import { track } from "@/lib/analytics";

// Site-wide announcement strip. Bump DISMISS_KEY when the announcement
// changes so visitors who closed the previous one see the new one.
const DISMISS_KEY = "restart.topbar.dismissed.scorecard-v1";
const HIDDEN_ON = ["/scorecard", "/start-project", "/thank-you"];

export default function TopBar() {
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed || HIDDEN_ON.includes(location)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <div className="topbar" role="region" aria-label="Announcement">
      <Link href="/scorecard" className="topbar-link" onClick={() => track("topbar_click", { target: "scorecard" })}>
        <span className="topbar-tag"><Gauge size={13} /> Free assessment</span>
        <span className="topbar-title">Production Readiness Scorecard</span>
        <span className="topbar-cta">Score your system in 5 minutes <ChevronRight size={14} /></span>
      </Link>
      <button type="button" className="topbar-close" aria-label="Dismiss announcement" onClick={dismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
