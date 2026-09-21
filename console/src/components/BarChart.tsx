type Tone = "healthy" | "warning" | "down";

export interface BarChartColumn {
  label: string;
  segments: { tone: Tone; value: number }[];
}

export function BarChart({ columns, height = 72 }: { columns: BarChartColumn[]; height?: number }) {
  const totals = columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0));
  const max = Math.max(1, ...totals);

  return (
    <div className="bar-chart-bars" style={{ height: `${height + 20}px` }}>
      {columns.map((col, i) => {
        const total = totals[i];
        return (
          <div className="bar-chart-col" key={i}>
            <div
              className="bar-chart-bar"
              style={{ height: `${total === 0 ? 0 : Math.max((total / max) * height, 4)}px` }}
            >
              {col.segments
                .filter((s) => s.value > 0)
                .map((s, j) => (
                  <div key={j} className={`bar-chart-segment ${s.tone}`} style={{ height: `${(s.value / total) * 100}%` }} />
                ))}
            </div>
            <span className="bar-chart-label">{col.label}</span>
          </div>
        );
      })}
    </div>
  );
}
