// Admin-only top-bar control for moving between the client console and the
// admin area. One icon in both places; the dropdown names the two dashboards
// and marks the current one. Rendered only for admins (the area itself is still
// enforced by AdminRoute + RLS, not by this control).

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, ShieldCheck, Wallet } from "lucide-react";

type Dashboard = "console" | "admin" | "finance";

const DASHBOARDS: Array<{ key: Dashboard; label: string; href: string; icon: typeof LayoutGrid }> = [
  { key: "console", label: "Client console", href: "/overview", icon: LayoutGrid },
  { key: "admin", label: "Ops", href: "/admin", icon: ShieldCheck },
  { key: "finance", label: "Finance", href: "/finance", icon: Wallet }
];

export function DashboardSwitcher({ current }: { current: Dashboard }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dash-user-menu-wrapper" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dash-admin-btn dash-admin-btn-icon"
        title="Switch dashboard"
        aria-label="Switch dashboard"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <LayoutGrid size={15} />
      </button>

      {open && (
        <div className="dash-dropdown-menu" role="menu">
          <div className="dash-dropdown-header">
            <span className="dropdown-user-name">Switch dashboard</span>
          </div>
          {DASHBOARDS.map(({ key, label, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              role="menuitem"
              className={`dash-dropdown-item ${key === current ? "active-link" : ""}`}
              aria-current={key === current ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={14} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
