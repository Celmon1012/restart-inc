// Bars over time for the admin Overview: one or two series per bucket (a day, or a week on the 90d
// range). Same conventions as FinanceCharts: colour follows the series (--series-1, --series-2),
// hovering or focusing a bucket shows its figures, and the whole chart carries an aria-label with
// every value so nothing depends on hover or colour.

import { useState } from "react";
import type { Bucket } from "@/lib/platformStats";

export interface TrendSeries {
  name: string;
  color: string;
  values: number[];
}

/** A round upper bound for the axis, so the gridlines land on tidy figures. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

export function TrendBars({ buckets, series, format, empty, whole }: { buckets: Bucket[]; series: TrendSeries[]; format: (v: number) => string; empty: string; /** Counts: keep every gridline on a whole number. */ whole?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  if (series.every((s) => s.values.every((v) => v === 0))) return <div className="dash-empty-state">{empty}</div>;

  const peak = Math.max(...series.flatMap((s) => s.values));
  const max = whole ? Math.max(2, Math.ceil(peak / 2) * 2) : niceMax(peak);
  const W = 560;
  const H = 200;
  const left = 48;
  const right = 6;
  const top = 10;
  const bottom = 26;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const slot = plotW / buckets.length;
  const barW = Math.max(2, Math.min(22, (slot * 0.7) / series.length));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  // Label every bucket for a week, otherwise about six evenly spaced ones.
  const every = Math.max(1, Math.ceil(buckets.length / 6));
  const axisLabel = (b: Bucket) => b.label.split(" – ")[0];
  const readoutOnLeft = active !== null && active >= buckets.length / 2;

  return (
    <div className="viz-root">
      {series.length > 1 && (
        <div className="viz-legend-inline" aria-hidden="true">
          {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="viz-bars-svg"
          role="img"
          aria-label={buckets.map((b, i) => `${b.label}: ${series.map((s) => `${s.name} ${format(s.values[i])}`).join(", ")}`).join("; ")}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={left} x2={W - right} y1={y(f * max)} y2={y(f * max)} stroke="rgba(255,255,255,.08)" strokeWidth="1" />
              <text x={left - 8} y={y(f * max) + 3} textAnchor="end" className="viz-axis">{format(f * max)}</text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const cx = left + slot * i + slot / 2;
            const groupW = barW * series.length + (series.length - 1);
            return (
              <g key={b.start} opacity={active !== null && active !== i ? 0.55 : 1}>
                {series.map((s, j) => {
                  const h = s.values[i] > 0 ? Math.max(2, (s.values[i] / max) * plotH) : 0;
                  return h === 0 ? null : (
                    <rect key={s.name} x={cx - groupW / 2 + j * (barW + 1)} y={top + plotH - h} width={barW} height={h} rx={Math.min(3, barW / 2)} fill={s.color} />
                  );
                })}
                {i % every === 0 && <text x={cx} y={H - 8} textAnchor="middle" className="viz-axis">{axisLabel(b)}</text>}
                <rect
                  x={left + slot * i}
                  y={top}
                  width={slot}
                  height={plotH + bottom}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${b.label}: ${series.map((s) => `${s.name} ${format(s.values[i])}`).join(", ")}`}
                  style={{ outline: "none", cursor: "default" }}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <div className="viz-readout" role="status" style={readoutOnLeft ? { left: 56, right: "auto" } : undefined}>
            <strong>{buckets[active].label}</strong>
            {series.map((s) => (
              <span key={s.name}><i style={{ background: s.color }} />{s.name} <b>{format(s.values[active])}</b></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
