import React, { useEffect } from "react";
import { X, Check, ArrowUpRight, ExternalLink, ShieldCheck, Cpu, Database } from "lucide-react";
import { CaseStudy } from "@/data/caseStudies";

interface CaseStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseStudy: CaseStudy | null;
  onDiscuss: (title: string) => void;
}

export default function CaseStudyModal({ isOpen, onClose, caseStudy, onDiscuss }: CaseStudyModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !caseStudy) return null;

  return (
    <div className="case-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-case-title">
      <div className="case-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={`case-modal-header ${caseStudy.tone}`}>
          <div className="case-modal-header-info">
            <div className="case-modal-tags">
              <span className={`section-label ${caseStudy.tone}`}>{caseStudy.type}</span>
              {caseStudy.verified && (
                <span className="case-modal-verified-badge">
                  <ShieldCheck size={12} />
                  <span>Verified Outcome Record</span>
                </span>
              )}
            </div>
            <h2 id="modal-case-title">{caseStudy.title}</h2>
            <p className="case-modal-client">CLIENT: <strong>{caseStudy.client}</strong></p>
          </div>
          <button className="case-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="case-modal-body">
          {/* Verified Outcome Highlights */}
          <div className="case-modal-metrics-grid">
            {caseStudy.metrics.map((metric, i) => (
              <div className={`case-modal-metric-box ${caseStudy.tone}`} key={i}>
                <span className="case-metric-value">{metric.value}</span>
                <span className="case-metric-label">{metric.label}</span>
              </div>
            ))}
          </div>

          {/* Executive Overview */}
          <div className="case-modal-section">
            <div className="case-section-kicker">EXECUTIVE OVERVIEW</div>
            <p className="case-overview-text">{caseStudy.summary}</p>
          </div>

          {/* Detailed Problem & Constraint */}
          <div className="case-modal-section">
            <div className="case-section-kicker">THE CHALLENGE & PRODUCTION CONSTRAINTS</div>
            <p>{caseStudy.challenge}</p>
          </div>

          {/* Architecture Intervention */}
          <div className="case-modal-section">
            <div className="case-section-kicker">RESTART ENGINEERING INTERVENTION</div>
            <p>{caseStudy.solution}</p>
          </div>

          {/* Key Measured Results */}
          <div className="case-modal-section">
            <div className="case-section-kicker">VERIFIED MEASURABLE OUTCOMES</div>
            <ul className="case-results-list">
              {caseStudy.results.map((result, idx) => (
                <li key={idx}>
                  <Check size={14} className="text-teal" />
                  <span>{result}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Technology & Stack */}
          <div className="case-modal-section">
            <div className="case-section-kicker">TECHNOLOGY & INFRASTRUCTURE STACK</div>
            <div className="case-stack-pills">
              {caseStudy.stack.map((item) => (
                <span key={item} className="stack-pill">
                  <Cpu size={11} />
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="case-modal-footer">
          <div className="case-modal-footer-left">
            {caseStudy.href && (
              <a href={caseStudy.href} target="_blank" rel="noreferrer" className="case-external-link">
                <span>Read original published resource</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          <div className="case-modal-footer-actions">
            <button className="button outline small" onClick={onClose}>Close</button>
            <button
              className="button solid small"
              onClick={() => onDiscuss(`Case Inquiry: ${caseStudy.title}`)}
            >
              Discuss a Similar System <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
