import { useEffect, useRef, useState, type ComponentType } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface ProcessStep {
  icon: ComponentType<{ size?: number }>;
  title: string;
  text: string;
  phase: string;
}

/**
 * Horizontal, snap-scrolling process steps with prev/next buttons. Styles are
 * the .sol-process / .sol-card rules in styles/solutions.css.
 */
export default function ProcessCarousel({ id, eyebrow, heading, lede, steps }: {
  id?: string;
  eyebrow: string;
  heading: React.ReactNode;
  lede: string;
  steps: ProcessStep[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const syncEdge = () => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  const slide = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".sol-card");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 320) + 16), behavior: "smooth" });
  };
  useEffect(() => {
    syncEdge();
    window.addEventListener("resize", syncEdge);
    return () => window.removeEventListener("resize", syncEdge);
  }, []);

  const total = String(steps.length).padStart(2, "0");

  return (
    <section className="sol-section sol-wrap" id={id}>
      <div className="sol-process sol-reveal" style={{ marginTop: 0 }}>
        <div className="sol-process-copy">
          <span className="sol-eyebrow">{eyebrow}</span>
          <h2 className="sol-h2">{heading}</h2>
          <p className="sol-lede">{lede}</p>
          <div className="sol-arrows">
            <button type="button" className="sol-arrow-btn" aria-label="Previous step" disabled={edge.start} onClick={() => slide(-1)}><ArrowLeft size={18} /></button>
            <button type="button" className="sol-arrow-btn" aria-label="Next step" disabled={edge.end} onClick={() => slide(1)}><ArrowRight size={18} /></button>
          </div>
        </div>
        <div className="sol-track" ref={trackRef} onScroll={syncEdge} tabIndex={0} aria-label="Process steps">
          {steps.map(({ icon: Icon, title, text, phase }, i) => (
            <article className={`sol-card ${i % 2 ? "violet" : "teal"}`} key={title}>
              <span className="sol-card-icon" aria-hidden="true"><Icon size={20} /></span>
              <span className="sol-card-kicker">STEP {String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="sol-card-foot">
                <div><small>PHASE</small><strong>{phase}</strong></div>
                <span className="sol-card-count" aria-hidden="true"><b>{String(i + 1).padStart(2, "0")}</b>/{total}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
