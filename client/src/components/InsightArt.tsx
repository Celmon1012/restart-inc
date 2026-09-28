// Generated cover art for insight cards and article headers, in place of
// stock photos: a translucent "glass" isometric illustration in the brand
// teal over a faint grid. Each category has two motifs; the slug picks one,
// so the same article always gets the same art.
import type { Insight } from "@/data/insights";

type Motif = "blocks" | "layers" | "terminal" | "network" | "bars" | "stairs";

const MOTIFS: Record<Insight["category"], [Motif, Motif]> = {
  architecture: ["blocks", "layers"],
  engineering: ["terminal", "network"],
  operations: ["stairs", "bars"],
};

function slugHash(slug: string) {
  let h = 7;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

export function motifFor(insight: Pick<Insight, "id" | "category">): Motif {
  // Any stable bit of the hash works; bit 1 happens to give the six launch
  // articles different motifs within each category.
  return MOTIFS[insight.category][(slugHash(insight.id) >>> 1) & 1];
}

// Isometric projection: x runs down-right, y runs down-left, z runs up.
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const S = 22;
const iso = (x: number, y: number, z: number) => `${((x - y) * COS * S).toFixed(1)},${((x + y) * SIN * S - z * S).toFixed(1)}`;
const poly = (pts: [number, number, number][]) => pts.map((p) => iso(...p)).join(" ");

type Box = { x: number; y: number; z: number; w: number; d: number; h: number; glow?: boolean };

function Cube({ x, y, z, w, d, h, glow }: Box) {
  const top = poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]);
  const left = poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]);
  const right = poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]);
  return (
    <g className={glow ? "ia-cube ia-glow" : "ia-cube"}>
      <polygon points={left} className="ia-face-l" />
      <polygon points={right} className="ia-face-r" />
      <polygon points={top} className="ia-face-t" />
    </g>
  );
}

const byDepth = (a: Box, b: Box) => a.x + a.y + a.z - (b.x + b.y + b.z);

function Blocks() {
  const boxes: Box[] = [
    { x: 0, y: 0, z: 0, w: 1, d: 1, h: 1 },
    { x: 1.2, y: 0, z: 0, w: 1, d: 1, h: 1 },
    { x: 0, y: 1.2, z: 0, w: 1, d: 1, h: 1 },
    { x: 1.2, y: 1.2, z: 0, w: 1, d: 1, h: 1 },
    { x: 0.6, y: 0.6, z: 1.25, w: 1, d: 1, h: 1, glow: true },
    { x: 2.9, y: -0.9, z: 1.6, w: 0.45, d: 0.45, h: 0.45 },
  ];
  return <g transform="translate(-20 -6)">{boxes.sort(byDepth).map((b, i) => <Cube key={i} {...b} />)}</g>;
}

function Layers() {
  return (
    <g transform="translate(0 -8)">
      {[0, 0.85, 1.7].map((z, i) => (
        <Cube key={z} x={0} y={0} z={z} w={2.6} d={2.6} h={0.22} glow={i === 2} />
      ))}
      <polyline points={poly([[1.3, 0.4, 1.92], [1.3, 1.3, 1.92], [2.2, 1.3, 1.92]])} className="ia-line" />
    </g>
  );
}

function Terminal() {
  const pane = (x0: number, y0: number, z0: number, glow = false) => (
    <g className={glow ? "ia-glow" : undefined}>
      <polygon points={poly([[x0, y0, z0], [x0 + 3, y0, z0], [x0 + 3, y0, z0 + 2.1], [x0, y0, z0 + 2.1]])} className="ia-face-r" />
      <polyline points={poly([[x0, y0, z0 + 1.75], [x0 + 3, y0, z0 + 1.75]])} className="ia-line" />
      {[0.25, 0.45, 0.65].map((dx) => (
        <circle key={dx} cx={iso(x0 + dx, y0, z0 + 1.93).split(",")[0]} cy={iso(x0 + dx, y0, z0 + 1.93).split(",")[1]} r="1.6" className="ia-dot" />
      ))}
    </g>
  );
  return (
    <g transform="translate(-38 20) scale(1.1)">
      {pane(-0.3, -0.9, 0.5)}
      {pane(0, 0, 0, true)}
      <polyline points={poly([[0.35, 0, 1.2], [0.7, 0, 1.0], [0.35, 0, 0.8]])} className="ia-line ia-strong" />
      <polyline points={poly([[0.9, 0, 0.72], [1.5, 0, 0.72]])} className="ia-line ia-strong" />
    </g>
  );
}

function Network() {
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return [1.5 + Math.cos(a) * 1.55, 1.5 + Math.sin(a) * 1.55] as const;
  });
  const nodes: Box[] = [...ring.map(([x, y]) => ({ x: x - 0.2, y: y - 0.2, z: 0, w: 0.4, d: 0.4, h: 0.4 })), { x: 1.25, y: 1.25, z: 0, w: 0.5, d: 0.5, h: 0.9, glow: true }];
  return (
    <g transform="translate(0 -29)">
      {ring.map(([x, y], i) => {
        const [nx, ny] = ring[(i + 1) % ring.length];
        return (
          <g key={i}>
            <polyline points={poly([[x, y, 0.2], [nx, ny, 0.2]])} className="ia-line" />
            <polyline points={poly([[x, y, 0.2], [1.5, 1.5, 0.45]])} className="ia-line" />
          </g>
        );
      })}
      {nodes.sort(byDepth).map((b, i) => <Cube key={i} {...b} />)}
    </g>
  );
}

function Bars() {
  const heights = [0.7, 1.2, 0.95, 1.8, 2.6];
  return (
    <g transform="translate(-30 -13)">
      {heights.map((h, i) => (
        <Cube key={i} x={i * 0.8} y={0} z={0} w={0.6} d={0.6} h={h} glow={i === heights.length - 1} />
      ))}
    </g>
  );
}

// Dot-matrix staircase rising left to right, full bleed.
function Stairs() {
  const dots = [];
  const cols = 40;
  const rows = 18;
  for (let c = 0; c < cols; c++) {
    const edge = rows - 3 - Math.floor(c / 3);
    for (let r = 0; r < rows; r++) {
      const depth = r - edge;
      if (depth >= 0 && depth < 5) dots.push({ c, r, cls: depth === 0 ? "ia-px ia-px-hi" : "ia-px" });
      else if (depth < 0 && depth > -4 && c > 18) dots.push({ c, r, cls: "ia-px ia-px-lo" });
    }
  }
  return (
    <g transform="translate(-160 -80)">
      {dots.map(({ c, r, cls }) => (
        <rect key={`${c}-${r}`} x={c * 8 + 2} y={r * 9 + 2} width="3" height="3" className={cls} />
      ))}
    </g>
  );
}

const ART: Record<Motif, () => React.JSX.Element> = { blocks: Blocks, layers: Layers, terminal: Terminal, network: Network, bars: Bars, stairs: Stairs };

export default function InsightArt({ insight, className = "" }: { insight: Pick<Insight, "id" | "category">; className?: string }) {
  const motif = motifFor(insight);
  const Art = ART[motif];
  return (
    <div className={`insight-image insight-art ${className}`.trim()} data-motif={motif} aria-hidden="true">
      <svg viewBox={motif === "stairs" ? "-160 -80 320 160" : "-110 -60 220 120"} preserveAspectRatio={motif === "stairs" ? "xMidYMid slice" : "xMidYMid meet"}>
        <Art />
      </svg>
    </div>
  );
}
