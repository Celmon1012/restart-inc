import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
 * Backdrop for the sign-in, reset and onboarding screens: the same
 * dot field, grid and glow as the marketing homepage hero
 * (client/src/components/HeroBackdrop.tsx). Keep the two in sync.
 * Decorative only (aria-hidden); stills under prefers-reduced-motion.
 * ------------------------------------------------------------------ */

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

function Dots() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gap = 9;
    let dots: { x: number; y: number; a: number; tw: number; c: string; phase: number }[] = [];
    let raf = 0;

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
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    build();
    draw(0);
    if (!reduce) raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => { build(); draw(0); });
    ro.observe(canvas);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="auth-dots" aria-hidden="true" />;
}

export default function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <div className="auth-grid" />
      <div className="auth-glow" />
      <Dots />
    </div>
  );
}
