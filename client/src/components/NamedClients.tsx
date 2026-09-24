import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, ShieldCheck } from "lucide-react";
import { namedClients, type NamedClient } from "@/data/namedClients";
import { track } from "@/lib/analytics";

/**
 * Named, checkable client engagements for the homepage.
 *
 * Browser-only content: this is a pure client component with no data
 * fetching, so every claim renders identically for JS and non-JS
 * crawlers once the page is prerendered.
 */

const MODULE_LABEL = "WHAT WE BUILT";

function ClientCard({
  client,
  index,
  expanded,
  onToggle,
}: {
  client: NamedClient;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`nc-card ${client.tone} ${expanded ? "expanded" : ""}`}>
      <header className="nc-card-head">
        <div className="nc-identity">
          <span className="nc-badge">{client.badge}</span>
          <h3>{client.client}</h3>
          <p className="nc-fullname">{client.fullName}</p>
        </div>
        <span className="nc-index">0{index + 1}</span>
      </header>

      <div className="nc-live-row">
        <span className="nc-sector">{client.sector}</span>
        <a
          className="nc-live-link"
          href={client.liveUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            track("client_site_click", { client: client.id, location: "homepage_case_study" })
          }
        >
          {client.liveLabel}
          <ArrowUpRight size={12} />
        </a>
      </div>

      <h4 className="nc-headline">{client.headline}</h4>

      {/* Three structural facts, not invented percentages */}
      <div className="nc-metrics">
        {client.metrics.map((m) => (
          <div key={m.label}>
            <small>{m.label.toUpperCase()}</small>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>

      <p className="nc-constraint">{client.constraint}</p>

      <div className="nc-stack">
        {client.stack.map((tech) => (
          <span key={tech}>{tech}</span>
        ))}
      </div>

      <button
        type="button"
        className="nc-toggle"
        aria-expanded={expanded}
        onClick={() => {
          onToggle();
          if (!expanded) track("case_study_expand", { client: client.id, surface: "homepage" });
        }}
      >
        <span>{expanded ? "Hide the build" : `See ${MODULE_LABEL.toLowerCase()}`}</span>
        <ChevronDown size={15} className={expanded ? "rotated" : ""} />
      </button>

      {expanded && (
        <div className="nc-detail">
          <div className="nc-detail-col">
            <span className="nc-detail-label">{MODULE_LABEL}</span>
            <ul>
              {client.built.map((item) => (
                <li key={item}>
                  <Check size={13} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="nc-detail-col">
            <span className="nc-detail-label">WHAT IT MEANS OPERATIONALLY</span>
            <ul>
              {client.outcomes.map((item) => (
                <li key={item}>
                  <Check size={13} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="nc-verified">
            <ShieldCheck size={13} />
            <span>
              <strong>How this is verified.</strong> {client.verifiedBy}
            </span>
          </p>
        </div>
      )}
    </article>
  );
}

export default function NamedClients() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="nc-section container" id="named-clients">
      {/* Header copy now lives in the parent proof-stage so the two proof
          sets read as one sequence rather than two competing sections. */}

      <div className="nc-grid">
        {namedClients.map((client, i) => (
          <ClientCard
            key={client.id}
            client={client}
            index={i}
            expanded={openId === client.id}
            onToggle={() => setOpenId((prev) => (prev === client.id ? null : client.id))}
          />
        ))}
      </div>
    </section>
  );
}
