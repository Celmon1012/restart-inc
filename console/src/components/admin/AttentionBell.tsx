// Admin top-bar bell: count of things that need us, with a dropdown of the
// first few (each clickable) and a link to the full list on /admin/attention.

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Bell } from "lucide-react";
import { ATTENTION_CATEGORY_LABEL, useAdminAttention } from "@/lib/adminAttention";

const DROPDOWN_LIMIT = 8;

export function AttentionBell() {
  const { items, loading, failed } = useAdminAttention();
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

  const count = items.length;
  const label = loading && count === 0 ? "Checking what needs attention" : count > 0 ? `${count} item${count === 1 ? "" : "s"} need attention` : "Nothing needs attention";

  return (
    <div className="dash-user-menu-wrapper" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="dash-icon-btn dash-notif-btn"
        title={label}
        aria-label={label}
        aria-expanded={open}
      >
        <Bell size={15} />
        {count > 0 && (
          <span className="dash-notif-badge" aria-hidden="true">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="dash-dropdown-menu attention-dropdown">
          <div className="dash-dropdown-header">
            <span className="dropdown-user-name">Needs attention</span>
            <span className="dropdown-user-email">
              {loading && count === 0 ? "Checking…" : count === 0 ? "Nothing right now" : `${count} item${count === 1 ? "" : "s"}`}
              {failed.length > 0 && ` · couldn't reach ${failed.join(", ")}`}
            </span>
          </div>
          {items.slice(0, DROPDOWN_LIMIT).map((a) => (
            <Link key={a.key} href={a.href} className="dash-dropdown-item attention-dropdown-item">
              <small>{ATTENTION_CATEGORY_LABEL[a.category]}</small>
              <span>{a.text}</span>
            </Link>
          ))}
          <Link href="/admin/attention" className="dash-dropdown-item attention-dropdown-all">
            <span>{count > DROPDOWN_LIMIT ? `View all ${count}` : "Open the list"}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
