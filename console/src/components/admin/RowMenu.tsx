// A "more actions" menu for a table row: one "…" button that opens a short list. Closes on an
// outside click, Escape, scroll or resize. Used wherever a row would otherwise carry several buttons.
//
// The list is drawn in a portal at the page level with fixed positioning, not inside the table:
// a table sits in a scroll box (overflow: auto) that would clip a menu opening below the last
// rows and grow a scrollbar around it. Placed from the button's on-screen position, it opens
// downwards and flips above the button when there isn't room below.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export interface RowMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Styles the item as destructive (red). */
  danger?: boolean;
}

const MENU_WIDTH = 200;
const GAP = 6;
const EDGE = 8;

export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Place the menu once it has rendered, so its real height decides whether it flips upwards.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const button = buttonRef.current?.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    if (!button) return;
    const roomBelow = window.innerHeight - button.bottom - EDGE;
    const top = roomBelow >= height + GAP || button.top < height + GAP + EDGE ? button.bottom + GAP : button.top - height - GAP;
    const left = Math.min(Math.max(EDGE, button.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - EDGE);
    setPos({ top, left });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // A scrolling page or table would leave a fixed menu floating away from its row.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="dash-tab-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="dash-dropdown-menu"
            role="menu"
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              right: "auto",
              bottom: "auto",
              width: MENU_WIDTH,
              zIndex: 1000,
              // Measured first, shown once placed, so it never flashes in the wrong spot.
              visibility: pos ? "visible" : "hidden"
            }}
          >
            {items.map((i) => (
              <button
                key={i.label}
                type="button"
                role="menuitem"
                className={`dash-dropdown-item ${i.danger ? "danger" : ""}`}
                disabled={i.disabled}
                onClick={() => {
                  setOpen(false);
                  i.onClick();
                }}
              >
                <span>{i.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
