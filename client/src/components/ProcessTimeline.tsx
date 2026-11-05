import type { ComponentType, CSSProperties, ReactNode } from "react";

export interface ProcessStep {
  icon: ComponentType<{ size?: number }>;
  title: string;
  text: string;
  phase: string;
}

/**
 * Connected timeline: numbered nodes on a line that draws itself as the
 * section scrolls in, with a card per step. Horizontal on desktop, vertical on
 * small screens. Styles are the .pt-* rules in styles/solutions.css.
 */
export default function ProcessTimeline({ id, eyebrow, heading, lede, steps }: {
  id?: string;
  eyebrow: string;
  heading: ReactNode;
  lede: string;
  steps: ProcessStep[];
}) {
  return (
    <section className="sol-section sol-wrap" id={id}>
      <div className="sol-head sol-reveal">
        <span className="sol-eyebrow">{eyebrow}</span>
        <h2 className="sol-h2">{heading}</h2>
        <p className="sol-lede">{lede}</p>
      </div>
      <ol className="pt sol-reveal" style={{ "--n": steps.length } as CSSProperties}>
        <span className="pt-line" aria-hidden="true"><i /></span>
        {steps.map(({ icon: Icon, title, text, phase }, i) => (
          <li className="pt-step" style={{ "--i": i } as CSSProperties} key={title}>
            <span className="pt-node" aria-hidden="true">
              <Icon size={20} />
              <b>{String(i + 1).padStart(2, "0")}</b>
            </span>
            <div className="pt-card">
              <span className="pt-phase">{phase}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
