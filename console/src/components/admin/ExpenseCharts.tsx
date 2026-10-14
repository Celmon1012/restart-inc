// Where the money goes: a donut of the share by category and bars of the biggest single costs.
//
// Form: a donut is only for part-to-whole at a glance, so it is drawn from three to six slices
// (a seventh onward folds into "Other categories") and a donut of one or two parts is replaced by
// the plain total. Exact comparison belongs to the bars, which are sorted and labelled with their
// values, and to the table beside them. Colour follows the category, never its rank, so ticking a
// category on or off never repaints the others. The palette is the validated categorical one
// (--series-N in index.css); the two categories with no hue of their own share the neutral grey and
// are told apart by their labels.
//
// Everything here is HTML and SVG: hover and keyboard focus show the same readout, labels go in as
// text (never as markup), and the legend lists every value so nothing depends on the colour.

import { useState } from "react";
import { formatNairaCompact, formatNairaWhole } from "@/lib/format";

export interface ChartItem {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  /** This month's cost in kobo. */
  monthly: number;
}

// One hue per category, fixed. Categories past the eighth share the neutral.
const CATEGORY_COLOR: Record<string, string> = {
  infrastructure: "var(--series-1)",
  software: "var(--series-2)",
  utilities: "var(--series-3)",
  people: "var(--series-4)",
  marketing: "var(--series-5)",
  travel: "var(--series-6)",
  equipment: "var(--series-7)",
  legal_tax: "var(--series-8)"
};
export const categoryColor = (category: string) => CATEGORY_COLOR[category] ?? "var(--series-neutral)";

const MAX_SLICES = 6;
const MAX_BARS = 8;

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

function slicesOf(items: ChartItem[]): Slice[] {
  const byCategory = new Map<string, Slice>();
  for (const it of items) {
    const s = byCategory.get(it.category) ?? { key: it.category, label: it.categoryLabel, value: 0, color: categoryColor(it.category) };
    s.value += it.monthly;
    byCategory.set(it.category, s);
  }
  const sorted = Array.from(byCategory.values()).sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES) return sorted;
  const head = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  return [...head, { key: "__other", label: `Other categories (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0), color: "var(--series-neutral)" }];
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%");

export function ExpenseCharts({ items, variant = "full", title = "Share by category" }: { items: ChartItem[]; /** "donut" leaves out the bars of single costs. */ variant?: "full" | "donut"; title?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; detail: string; value: string } | null>(null);

  const live = items.filter((i) => i.monthly > 0);
  const total = live.reduce((s, i) => s + i.monthly, 0);
  if (live.length === 0) return <div className="dash-empty-state">Nothing to chart for this selection this month.</div>;

  const slices = slicesOf(live);
  const showDonut = slices.length >= 3;

  // donut geometry
  const R = 70;
  const C = 2 * Math.PI * R;
  const GAP = 2.5;
  let offset = 0;
  const arcs = slices.map((s) => {
    const len = (s.value / total) * C;
    const arc = { slice: s, dash: Math.max(0, len - GAP), offset };
    offset += len;
    return arc;
  });
  const active = hover ? slices.find((s) => s.key === hover) : undefined;

  // bars: the biggest single costs, the rest folded
  const ranked = [...live].sort((a, b) => b.monthly - a.monthly);
  const shown = ranked.slice(0, MAX_BARS);
  const rest = ranked.slice(MAX_BARS);
  // One cost far bigger than the rest (a salary, say) would squash every other bar to a sliver. Then the
  // longest bar is drawn cut off, marked as such, and the rest are scaled against the second largest.
  const cut = shown.length > 1 && shown[0].monthly > shown[1].monthly * 4;
  const max = cut ? shown[1].monthly * 1.1 : shown[0]?.monthly ?? 1;

  const move = (e: React.PointerEvent, name: string, detail: string, value: string) => setTip({ x: e.clientX, y: e.clientY, name, detail, value });

  return (
    <div className="viz-root">
      <div className="viz-title">{title}</div>
      {showDonut ? (
        <div className="viz-donut-wrap">
          <svg viewBox="0 0 200 200" className="viz-donut" role="img" aria-label={`This month's cost by category: ${slices.map((s) => `${s.label} ${pct(s.value, total)}`).join(", ")}`}>
            <g transform="rotate(-90 100 100)">
              {arcs.map(({ slice, dash, offset: off }) => (
                <circle
                  key={slice.key}
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={hover === slice.key ? 32 : 28}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-(off + GAP / 2)}
                  tabIndex={0}
                  aria-label={`${slice.label}: ${formatNairaWhole(slice.value)}, ${pct(slice.value, total)}`}
                  style={{ cursor: "default", outline: "none", transition: "stroke-width .12s" }}
                  onPointerEnter={() => setHover(slice.key)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(slice.key)}
                  onBlur={() => setHover(null)}
                />
              ))}
            </g>
            <text x="100" y={active ? 90 : 96} textAnchor="middle" className="viz-center-main">{formatNairaCompact(active ? active.value : total)}</text>
            <text x="100" y={active ? 108 : 114} textAnchor="middle" className="viz-center-sub">{active ? active.label : "per month"}</text>
            {active && <text x="100" y="124" textAnchor="middle" className="viz-center-sub">{pct(active.value, total)} of total</text>}
          </svg>
        </div>
      ) : (
        <div className="viz-total">
          <strong title={formatNairaWhole(total)}>{formatNairaCompact(total)}</strong>
          <span>per month{slices.length === 1 ? `, all ${slices[0].label}` : ""}. Tick three or more categories to compare their shares.</span>
        </div>
      )}

      <ul className="viz-legend" aria-label="Category totals">
        {slices.map((s) => (
          <li key={s.key} onPointerEnter={() => setHover(s.key)} onPointerLeave={() => setHover(null)} className={hover === s.key ? "on" : undefined}>
            <span className="viz-key" style={{ background: s.color }} aria-hidden="true" />
            <span className="viz-legend-name">{s.label}</span>
            <span className="viz-legend-value">{formatNairaWhole(s.value)}</span>
            <span className="viz-legend-pct">{pct(s.value, total)}</span>
          </li>
        ))}
      </ul>

      {variant === "full" && (
        <>
        <div className="viz-title" style={{ marginTop: 22 }}>Biggest costs this month</div>
        <div className="viz-bars" role="list">
          {shown.map((it) => (
            <div
              key={it.id}
              role="listitem"
              className="viz-bar-row"
              tabIndex={0}
              aria-label={`${it.name}, ${it.categoryLabel}: ${formatNairaWhole(it.monthly)}, ${pct(it.monthly, total)} of the total`}
              onPointerMove={(e) => move(e, it.name, it.categoryLabel, formatNairaWhole(it.monthly))}
              onPointerLeave={() => setTip(null)}
              onFocus={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setTip({ x: r.left + r.width / 2, y: r.top, name: it.name, detail: it.categoryLabel, value: formatNairaWhole(it.monthly) });
              }}
              onBlur={() => setTip(null)}
            >
              <span className="viz-bar-name">{it.name}</span>
              <span className="viz-bar-track">
                <span className="viz-bar" style={{ width: `${Math.min(100, Math.max(2, (it.monthly / max) * 100))}%`, background: categoryColor(it.category) }} />
                {cut && it.id === shown[0].id && <span className="viz-bar-cut" aria-hidden="true" />}
              </span>
              <span className="viz-bar-value">{formatNairaCompact(it.monthly)}</span>
            </div>
          ))}
          {rest.length > 0 && (
            <div role="listitem" className="viz-bar-row viz-bar-rest">
              <span className="viz-bar-name">{rest.length} smaller cost{rest.length === 1 ? "" : "s"}</span>
              <span className="viz-bar-track" />
              <span className="viz-bar-value">{formatNairaCompact(rest.reduce((s, r) => s + r.monthly, 0))}</span>
            </div>
          )}
        </div>
  
        {cut && <p className="viz-note">The longest bar is cut off so the others stay readable. Its value is at the right.</p>}
  
          </>
      )}

      {tip && (
        <div className="viz-tip" style={{ left: tip.x + 14, top: tip.y + 14 }} role="status">
          <strong>{tip.value}</strong>
          <span>{tip.name}</span>
          <span className="viz-tip-sub">{tip.detail}</span>
        </div>
      )}
    </div>
  );
}
