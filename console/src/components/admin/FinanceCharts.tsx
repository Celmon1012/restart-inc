// Charts for the Finance overview: revenue against costs by month, and three plain meters.
//
// Revenue vs costs is a grouped vertical bar chart, two bars per month, because the question is a
// comparison of two amounts month by month. Colour follows the entity, not its rank: collected is
// always --series-1 and costs always --series-2 (the validated categorical palette from index.css).
// Hovering or focusing a month shows collected, costs and net; every figure also sits in the table
// beside the chart, so nothing depends on hovering or on colour.

import { useState } from "react";
import { formatNairaCompact, formatNairaWhole } from "@/lib/format";
import type { MonthRow } from "@/lib/financeSummary";

const monthShort = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const monthLong = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** A round upper bound for the axis, so the gridlines land on tidy figures. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

export function RevenueCostsChart({ months }: { months: MonthRow[] }) {
  const [active, setActive] = useState<string | null>(null);
  const max = niceMax(Math.max(...months.flatMap((m) => [m.collected, m.cost]), 0));
  if (months.every((m) => m.collected === 0 && m.cost === 0)) return <div className="dash-empty-state">No revenue or costs recorded in the last six months.</div>;

  const W = 560;
  const H = 240;
  const left = 54;
  const right = 8;
  const top = 12;
  const bottom = 28;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const slot = plotW / months.length;
  const barW = Math.min(26, slot * 0.3);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const current = months.find((m) => m.key === active);
  // Keep the readout off the bars being read: later months get it on the left, earlier ones on the right.
  const readoutOnLeft = current ? months.indexOf(current) >= months.length / 2 : false;

  const bar = (x: number, v: number, color: string) => {
    const h = Math.max(v > 0 ? 2 : 0, (v / max) * plotH);
    // round only the top corners (4px), the base sits on the axis
    const r = Math.min(4, barW / 2, h);
    return h === 0 ? null : <path d={`M${x},${top + plotH} V${top + plotH - h + r} Q${x},${top + plotH - h} ${x + r},${top + plotH - h} H${x + barW - r} Q${x + barW},${top + plotH - h} ${x + barW},${top + plotH - h + r} V${top + plotH} Z`} fill={color} />;
  };

  return (
    <div className="viz-root">
      <div className="viz-legend-inline" aria-hidden="true">
        <span><i style={{ background: "var(--series-1)" }} />Collected</span>
        <span><i style={{ background: "var(--series-2)" }} />Costs</span>
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="viz-bars-svg" role="img" aria-label={`Collected revenue against costs, ${months.map((m) => `${monthShort(m.key)}: collected ${formatNairaWhole(m.collected)}, costs ${formatNairaWhole(m.cost)}`).join("; ")}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.08)" strokeWidth="1" />
              <text x={left - 8} y={y(t) + 3} textAnchor="end" className="viz-axis">{t === 0 ? "₦0" : formatNairaCompact(t)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = left + slot * i + slot / 2;
            const on = active === m.key;
            return (
              <g key={m.key} opacity={active && !on ? 0.55 : 1}>
                {bar(cx - barW - 1, m.collected, "var(--series-1)")}
                {bar(cx + 1, m.cost, "var(--series-2)")}
                <text x={cx} y={H - 8} textAnchor="middle" className="viz-axis" style={on ? { fill: "#f2f5ff" } : undefined}>{monthShort(m.key)}</text>
                {/* the hit target is the whole month column, far bigger than the bars */}
                <rect
                  x={left + slot * i}
                  y={top}
                  width={slot}
                  height={plotH + bottom}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${monthLong(m.key)}: collected ${formatNairaWhole(m.collected)}, costs ${formatNairaWhole(m.cost)}, net ${formatNairaWhole(m.net)}`}
                  style={{ outline: "none", cursor: "default" }}
                  onPointerEnter={() => setActive(m.key)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(m.key)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {current && (
          <div className="viz-readout" role="status" style={readoutOnLeft ? { left: 62, right: "auto" } : undefined}>
            <strong>{monthLong(current.key)}</strong>
            <span><i style={{ background: "var(--series-1)" }} />Collected <b>{formatNairaWhole(current.collected)}</b></span>
            <span><i style={{ background: "var(--series-2)" }} />Costs <b>{formatNairaWhole(current.cost)}</b></span>
            <span className={current.net < 0 ? "viz-neg" : undefined}>Net <b>{formatNairaWhole(current.net)}</b></span>
          </div>
        )}
      </div>
    </div>
  );
}

/** One plain meter: a label, the headline figure, a bar filled to a share of its limit, and a line of explanation. */
export function Meter({ label, value, fill, note, tone }: { label: string; value: string; fill: number | null; note: string; tone?: "warn" }) {
  const pct = fill === null ? 0 : Math.max(0, Math.min(1, fill));
  return (
    <div className="viz-meter">
      <div className="viz-meter-head">
        <span>{label}</span>
        <strong className={tone === "warn" ? "warn" : undefined}>{value}</strong>
      </div>
      <div className="viz-meter-track" role="img" aria-label={`${label}: ${value}`}>
        <span className="viz-meter-fill" style={{ width: `${pct * 100}%`, background: "var(--series-1)" }} />
      </div>
      <div className="viz-meter-note">{note}</div>
    </div>
  );
}
