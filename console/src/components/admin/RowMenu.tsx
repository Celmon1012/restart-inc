// A "more actions" menu for a table row: one "…" button that opens a short list. Closes on an
// outside click or Escape. Used wherever a row would otherwise carry several buttons.

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export interface RowMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Styles the item as destructive (red). */
  danger?: boolean;
}

export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div className="dash-user-menu-wrapper" ref={ref} style={{ display: "inline-block" }}>
      <button type="button" className="dash-tab-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="dash-dropdown-menu" role="menu" style={{ right: 0, left: "auto", minWidth: 190, zIndex: 30 }}>
          {items.map((i) => (
            <button
              key={i.label}
              type="button"
              role="menuitem"
              className={`dash-dropdown-item ${i.danger ? "danger" : ""}`}
              disabled={i.disabled}
              onClick={() => { setOpen(false); i.onClick(); }}
            >
              <span>{i.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
