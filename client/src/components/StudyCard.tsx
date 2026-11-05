import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import type { CaseStudy } from "@/data/caseStudies";

/**
 * Featured case study card: a visual panel showing one measured result at a
 * time (the dots step through the study's metrics), with the brief beneath.
 * On a mouse pointer a "View case study" label follows the cursor.
 */
export default function StudyCard({ study, index, onOpen }: { study: CaseStudy; index: number; onOpen: () => void }) {
  const [active, setActive] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const metric = study.metrics[active] ?? study.metrics[0];

  const track = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <article className={`cs-card ${study.tone} sol-reveal`}>
      <div
        className="cs-visual"
        role="button"
        tabIndex={0}
        aria-label={`View case study: ${study.title}`}
        onClick={onOpen}
        onKeyDown={onKey}
        onPointerMove={track}
        onPointerLeave={() => setCursor(null)}
      >
        <span className="cs-rings" aria-hidden="true" />
        <span className="cs-type">{study.type}</span>
        <span className="cs-index" aria-hidden="true">0{index + 1}</span>
        <div className="cs-metric" key={active} aria-live="polite">
          <strong>{metric.value}</strong>
          <small>{metric.label}</small>
        </div>
        {cursor && (
          <span className="cs-cursor" style={{ left: cursor.x, top: cursor.y } as CSSProperties} aria-hidden="true">
            View case study <ArrowUpRight size={14} />
          </span>
        )}
      </div>
      <div className="cs-body">
        <div className="cs-dots" role="group" aria-label="Measured results">
          {study.metrics.map((m, i) => (
            <button
              type="button"
              key={m.label}
              className={i === active ? "active" : ""}
              aria-label={`Show ${m.label}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
        <div className="cs-bot">
          <h3>{study.title}</h3>
          <div className="cs-meta">
            <div><small>DESCRIPTION</small><p>{study.summary}</p></div>
            <div><small>DELIVERABLES</small><p>{study.tags.join(", ")}</p></div>
            <div><small>INDUSTRY</small><p>{study.type.split("/")[0].trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</p></div>
          </div>
        </div>
      </div>
    </article>
  );
}
