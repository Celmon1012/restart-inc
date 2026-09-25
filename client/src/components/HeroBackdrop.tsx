import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
 * Hero backdrop: rising trend lines that draw in, comets that travel
 * along them, and a sparse twinkling dot field behind the right side.
 * Everything is decorative (aria-hidden) and stills under
 * prefers-reduced-motion.
 * ------------------------------------------------------------------ */

const LINES = [
  { d: "M120 548 C 520 522, 760 452, 960 322 S 1340 62, 1560 -20", color: "#2ee5c1" },
  { d: "M320 548 C 640 516, 880 424, 1100 302 S 1420 150, 1560 115", color: "#3fe6a4" },
  { d: "M520 552 C 800 502, 1000 432, 1200 352 S 1460 262, 1560 242", color: "#68e88a" },
  { d: "M680 552 C 900 512, 1150 452, 1320 416 S 1500 382, 1560 373", color: "#98ea70" },
  { d: "M950 548 C 1150 522, 1300 496, 1420 480 S 1520 466, 1560 462", color: "#c4ee5a" },
];

const COMETS = [
  { line: 0, color: "var(--amber)", dur: 7, delay: 0.6 },
  { line: 2, color: "var(--violet)", dur: 8.5, delay: 3.2 },
  { line: 1, color: "var(--blue)", dur: 6.5, delay: 5.4 },
];

export function HeroLines() {
  return (
    <svg className="hero-lines" viewBox="0 0 1400 534" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <defs>
        {LINES.map((l, i) => {
          const startX = Number(l.d.split(" ")[0].slice(1));
          return (
            <linearGradient key={i} id={`hero-line-${i}`} gradientUnits="userSpaceOnUse" x1={startX} y1="0" x2={startX + 260} y2="0">
              <stop offset="0" stopColor={l.color} stopOpacity="0" />
              <stop offset="1" stopColor={l.color} stopOpacity="1" />
            </linearGradient>
          );
        })}
      </defs>
      <g className="hero-lines-base">
        {LINES.map((l, i) => <path key={i} d={l.d} />)}
      </g>
      <g>
        {LINES.map((l, i) => (
          <path key={i} className="hero-line" d={l.d} pathLength={1} stroke={`url(#hero-line-${i})`} style={{ animationDelay: `${0.15 + i * 0.18}s` }} />
        ))}
      </g>
      <g>
        {COMETS.map((c, i) => (
          <path
            key={i}
            className="hero-comet"
            d={LINES[c.line].d}
            pathLength={1}
            stroke={c.color}
            style={{ color: c.color, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

// Cheap deterministic value noise so the dot field clusters like landmasses
// instead of reading as a uniform grid.
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const TWINKLE = ["46,229,193", "91,132,255", "229,176,97", "167,139,250"];

export function HeroDots() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gap = 9;
    let dots: { x: number; y: number; a: number; tw: number; c: string; phase: number }[] = [];
    let raf = 0;
    let visible = true;

    const build = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = gap; y < height; y += gap) {
        for (let x = gap; x < width; x += gap) {
          const n = noise(x / 90, y / 90) * 0.7 + noise(x / 28, y / 28) * 0.3;
          if (n < 0.56) continue;
          const h = hash(x, y);
          dots.push({
            x, y,
            a: 0.09 + (n - 0.56) * 0.6,
            tw: h > 0.985 ? 1 : 0,
            c: TWINKLE[Math.floor(h * 1000) % TWINKLE.length],
            phase: h * Math.PI * 2,
          });
        }
      }
    };

    const draw = (t: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      for (const d of dots) {
        if (d.tw) {
          const k = reduce ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 900 + d.phase));
          ctx.fillStyle = `rgba(${d.c},${k})`;
          ctx.fillRect(d.x, d.y, 2, 2);
        } else {
          ctx.fillStyle = `rgba(255,255,255,${d.a})`;
          ctx.fillRect(d.x, d.y, 1.5, 1.5);
        }
      }
    };

    const loop = (t: number) => {
      if (visible) draw(t);
      raf = requestAnimationFrame(loop);
    };

    build();
    draw(0);
    if (!reduce) raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => { build(); draw(0); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return <canvas ref={ref} className="hero-dots" aria-hidden="true" />;
}

/* ------------------------------------------------------------------
 * Stats marquee with odometer-style digits that roll into place the
 * first time the bar scrolls into view.
 * ------------------------------------------------------------------ */

function RollingValue({ value, active }: { value: string; active: boolean }) {
  return (
    <span className="roll" aria-hidden="true">
      {value.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="roll-digit">
            <span className="roll-track" style={{ transform: `translateY(-${active ? Number(ch) : 0}em)`, transitionDelay: `${i * 40}ms` }}>
              {"0123456789".split("").map((n) => <span key={n}>{n}</span>)}
            </span>
          </span>
        ) : (
          <span key={i} className="roll-char">{ch}</span>
        ),
      )}
    </span>
  );
}

export interface HeroStat {
  label: string;
  value: string;
  href: string;
  title: string;
  onSelect?: () => void;
}

export function HeroStats({ label, items }: { label: string; items: HeroStat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setActive(true); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const row = (hidden: boolean) => (
    <div className="stats-row" aria-hidden={hidden || undefined}>
      {items.map((s, i) => (
        <a
          key={i}
          className="stats-item"
          href={s.href}
          title={s.title}
          tabIndex={hidden ? -1 : undefined}
          onClick={(e) => {
            if (!s.onSelect || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            s.onSelect();
          }}
        >
          <span className="stats-label">{s.label}</span>
          <span className="stats-value">
            {!hidden && <span className="sr-only">{s.value}</span>}
            <RollingValue value={s.value} active={active} />
          </span>
        </a>
      ))}
    </div>
  );

  return (
    <div className="hero-stats" ref={ref}>
      <div className="container hero-stats-inner">
        <span className="hero-stats-title">{label}</span>
        <span className="hero-stats-divider" aria-hidden="true" />
        <div className="hero-stats-marquee" role="marquee" aria-label={`${label}, focus to pause`} tabIndex={0}>
          <div className="hero-stats-track">
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </div>
  );
}
