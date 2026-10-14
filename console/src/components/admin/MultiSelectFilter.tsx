// A filter dropdown you tick: open it, check or uncheck as many options as you like, and the list
// behind it follows. Closes on an outside click or Escape. "All" and "None" are one click.
//
// `selected` is the list of ticked values; the caller decides what "nothing ticked" means. Each option
// can carry a colour swatch (so the dropdown doubles as the key to a chart) and a short detail on the
// right (such as that option's total).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
  /** CSS colour for a small square beside the label. */
  swatch?: string;
  /** Shown at the right, e.g. a total. */
  detail?: ReactNode;
}

export function MultiSelectFilter({
  label,
  allLabel,
  options,
  selected,
  onChange
}: {
  /** What the filter is about, e.g. "Categories". */
  label: string;
  /** Button text when every option is ticked, e.g. "All categories". */
  allLabel: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
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

  const chosen = options.filter((o) => selected.includes(o.value));
  const buttonText =
    chosen.length === options.length ? allLabel : chosen.length === 0 ? `No ${label.toLowerCase()}` : chosen.length <= 2 ? chosen.map((o) => o.label).join(", ") : `${chosen.length} of ${options.length} ${label.toLowerCase()}`;

  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className="msf" ref={ref}>
      <button type="button" className="msf-button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Filter by ${label.toLowerCase()}`}>
        <span>{buttonText}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="msf-menu" role="listbox" aria-multiselectable="true" aria-label={label}>
          <div className="msf-actions">
            <button type="button" onClick={() => onChange(options.map((o) => o.value))}>All</button>
            <button type="button" onClick={() => onChange([])}>None</button>
          </div>
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} type="button" role="option" aria-selected={on} className="msf-option" onClick={() => toggle(o.value)}>
                <span className={`msf-box ${on ? "on" : ""}`} aria-hidden="true">{on && <Check size={11} />}</span>
                {o.swatch && <span className="msf-swatch" style={{ background: o.swatch }} aria-hidden="true" />}
                <span className="msf-label">{o.label}</span>
                {o.detail !== undefined && <span className="msf-detail">{o.detail}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
