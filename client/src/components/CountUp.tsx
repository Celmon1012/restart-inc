import { useEffect, useRef, useState } from "react";

/**
 * Counts the number inside a value like "−70%", "99.4%" or "<150ms" up from
 * zero when it scrolls into view. The final text is rendered first, so the
 * value is correct without JavaScript, with reduced motion, or if the observer
 * never fires.
 */
export default function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const match = value.match(/^(\D*)(\d[\d,]*\.?\d*)(.*)$/);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !match) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const target = parseFloat(match[2].replace(/,/g, ""));
    const decimals = match[2].includes(".") ? match[2].split(".")[1].length : 0;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown((target * eased).toFixed(decimals));
        if (t < 1) raf = requestAnimationFrame(tick);
        else setShown(null);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!match) return <span ref={ref}>{value}</span>;
  return <span ref={ref}>{shown === null ? value : `${match[1]}${shown}${match[3]}`}</span>;
}
