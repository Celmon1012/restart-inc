import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface ProcessStep {
  icon: ComponentType<{ size?: number }>;
  title: string;
  text: string;
  phase: string;
  /** Optional line under the text, e.g. what the client receives. */
  note?: string;
}

/**
 * "From idea to production": heading and arrows on the left, a snap-scrolling
 * row of step cards on the right that runs off the edge (1.78 cards in view).
 * Geometry follows the Aigocy process section; colours are the Restart dark
 * theme. Styles are the .ps-* rules in styles/solutions.css.
 */
export default function ProcessSlider({ id, label, heading, steps }: {
  id?: string;
  label: string;
  heading: ReactNode;
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
    const card = el.querySelector<HTMLElement>(".ps-card");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 400) + 24), behavior: "smooth" });
  };
  useEffect(() => {
    syncEdge();
    window.addEventListener("resize", syncEdge);
    return () => window.removeEventListener("resize", syncEdge);
  }, []);

  const total = String(steps.length).padStart(2, "0");

  return (
    <section className="ps-box sol-reveal" id={id}>
      <div className="ps-inner">
        <div className="ps-heading">
          <span className="ps-sub">{label}</span>
          <h2 className="ps-title">{heading}</h2>
          <div className="ps-arrows">
            <button type="button" className="ps-arrow" aria-label="Previous step" disabled={edge.start} onClick={() => slide(-1)}><ArrowLeft size={24} /></button>
            <button type="button" className="ps-arrow" aria-label="Next step" disabled={edge.end} onClick={() => slide(1)}><ArrowRight size={24} /></button>
          </div>
        </div>
        <div className="ps-slide">
          <div className="ps-track" ref={trackRef} onScroll={syncEdge} tabIndex={0} aria-label="Process steps">
            {steps.map(({ icon: Icon, title, text, phase, note }, i) => (
              <article className="ps-card" key={title}>
                <span className="ps-icon" aria-hidden="true"><Icon size={32} /></span>
                <div className="ps-content">
                  <h3>{title}</h3>
                  <p>{text}</p>
                  {note && <p className="ps-note"><b>YOU RECEIVE</b>{note}</p>}
                </div>
                <div className="ps-bot">
                  <span className="ps-time">{phase}</span>
                  <span className="ps-number" aria-hidden="true">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span>/{total}</span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
