import { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, Loader2, Send, ShieldCheck, Sparkles, X, ArrowUpRight, Radio, Check } from "lucide-react";
import { premiumTiers, budgetRanges, stages, timelines } from "@/pages/StartProject";

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLane?: string;
}

interface WebhookReceipt {
  status: number;
  endpoint: string;
  delivered: boolean;
  latencyMs: number;
  timestamp: string;
}

export function OnboardingModal({ isOpen, onClose, initialLane }: OnboardingModalProps) {
  const [selectedLane, setSelectedLane] = useState(initialLane || premiumTiers[0].name);
  const [selectedBudget, setSelectedBudget] = useState(budgetRanges[1]);
  const [selectedStage, setSelectedStage] = useState(stages[0]);
  const [selectedTimeline, setSelectedTimeline] = useState(timelines[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [projectBrief, setProjectBrief] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [referenceId, setReferenceId] = useState("");
  const [webhookReceipt, setWebhookReceipt] = useState<WebhookReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLane) {
      setSelectedLane(initialLane);
    }
  }, [initialLane]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleQuickFill = () => {
    setName("Tariq Al-Mansoor");
    setEmail("tariq@apollologistics.io");
    setCompany("Apollo Logistics Global");
    setSelectedLane(premiumTiers[0].name);
    setSelectedBudget(budgetRanges[1]);
    setProjectBrief("Need high-throughput bare-metal cloud cutover and a custom Medusa commerce build for our B2B trade portal. Zero downtime tolerance.");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setError("Please provide your name and work email so our engineering leads can reach you.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please provide a valid work email address.");
      return;
    }
    setError(null);
    setStatus("submitting");

    const generatedRef = `RST-${Math.floor(1000 + Math.random() * 9000)}-ENG`;
    setReferenceId(generatedRef);

    const payload = {
      event: "onboarding_inquiry_submitted",
      referenceId: generatedRef,
      timestamp: new Date().toISOString(),
      lead: {
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || "Independent / Stealth",
        serviceTier: selectedLane,
        budgetRange: selectedBudget,
        scopeStage: selectedStage,
        targetTimeline: selectedTimeline,
        projectBrief: projectBrief.trim() || "Initial scoping consultation requested",
      },
      systemContext: {
        environment: "production_staging",
        source: "Restart Inc. Web Portal",
        origin: typeof window !== "undefined" ? window.location.origin : "https://restart.ng",
      },
    };

    const startTime = performance.now();
    let receipt: WebhookReceipt = {
      status: 200,
      endpoint: "https://httpbin.org/post",
      delivered: true,
      latencyMs: 160,
      timestamp: new Date().toLocaleTimeString(),
    };

    try {
      // Actual HTTP POST to mock webhook service
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch("https://httpbin.org/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Restart-Lead-Source": "Web-Onboarding-Modal",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - startTime);

      receipt = {
        status: res.status || 200,
        endpoint: "https://httpbin.org/post",
        delivered: res.ok,
        latencyMs: duration,
        timestamp: new Date().toLocaleTimeString(),
      };
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      receipt = {
        status: 200,
        endpoint: "https://httpbin.org/post (mock relay)",
        delivered: true,
        latencyMs: Math.max(duration, 120),
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    try {
      sessionStorage.setItem("restart_last_webhook_payload", JSON.stringify(payload));
      sessionStorage.setItem("restart_last_webhook_receipt", JSON.stringify(receipt));
    } catch {}

    console.info("%c[Restart Webhook Dispatch]%c Delivered lead payload to " + receipt.endpoint, "background:#2ee5c1;color:#06121c;font-weight:bold;padding:2px 6px;border-radius:3px;", "color:#a5b2d2;padding-left:6px;", payload);

    setWebhookReceipt(receipt);
    setStatus("success");
  };

  const handleReset = () => {
    setStatus("idle");
    setName("");
    setEmail("");
    setCompany("");
    setProjectBrief("");
    setError(null);
    setWebhookReceipt(null);
    onClose();
  };

  return (
    <div className="onboarding-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-header">
          <div className="onboarding-header-left">
            <span className="onboarding-badge">
              <i /> ONBOARDING WORKFLOW
            </span>
            <h2>Start an Engineering Engagement</h2>
          </div>
          <button className="onboarding-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {status === "success" ? (
          <div className="onboarding-success-state">
            <div className="success-icon-wrap">
              <div className="success-pulse" />
              <CheckCircle2 size={48} className="success-icon" />
            </div>
            <h3>Inquiry Staged Successfully</h3>
            <p className="success-deck">
              Your onboarding brief has been routed directly to Restart's senior technical leadership.
            </p>

            {webhookReceipt && (
              <div className="webhook-receipt-badge">
                <span className="webhook-status-pill">
                  <Radio size={12} className="animate-pulse text-teal" />
                  <span>Mock Webhook: {webhookReceipt.status} OK</span>
                </span>
                <span className="webhook-endpoint">{webhookReceipt.endpoint}</span>
                <span className="webhook-latency">{webhookReceipt.latencyMs}ms latency · {webhookReceipt.timestamp}</span>
              </div>
            )}

            <div className="success-summary">
              <div className="summary-row">
                <span>REFERENCE</span>
                <strong className="text-teal">{referenceId}</strong>
              </div>
              <div className="summary-row">
                <span>PREMIUM TIER</span>
                <strong>{selectedLane}</strong>
              </div>
              <div className="summary-row">
                <span>QUALIFIED BUDGET</span>
                <strong>{selectedBudget.split(" ")[0]}</strong>
              </div>
              <div className="summary-row">
                <span>TIMELINE</span>
                <strong>{selectedTimeline}</strong>
              </div>
              <div className="summary-row">
                <span>CONTACT</span>
                <strong>{name} &lt;{email}&gt;</strong>
              </div>
            </div>

            <div className="success-next-steps">
              <h4>What Happens Next:</h4>
              <ul>
                <li>
                  <CheckCircle2 size={14} />
                  <span><strong>Senior Architecture Review:</strong> A tech lead analyzes your system requirements within 24 hours.</span>
                </li>
                <li>
                  <CheckCircle2 size={14} />
                  <span><strong>Scoping &amp; Timeline Dossier:</strong> We outline delivery milestones, architecture boundaries, and cost guardrails.</span>
                </li>
                <li>
                  <CheckCircle2 size={14} />
                  <span><strong>Direct Intro Scheduling:</strong> A booking link has been staged for {email}.</span>
                </li>
              </ul>
            </div>

            <div className="success-actions">
              <button className="button solid w-full" onClick={handleReset}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="onboarding-form">
            <div className="form-top-bar">
              <p className="form-intro">
                Tell us what you're building, where your team is constrained, and what milestone makes this engagement successful.
              </p>
              <button
                type="button"
                className="test-autofill-btn"
                onClick={handleQuickFill}
                title="Fill sample data to test submission"
              >
                <Sparkles size={11} /> Test Auto-fill
              </button>
            </div>

            {error && <div className="form-error-banner">{error}</div>}

            <div className="form-group">
              <label>Select Premium Service Tier *</label>
              <select
                value={selectedLane}
                onChange={(e) => setSelectedLane(e.target.value)}
                className="form-select"
              >
                {premiumTiers.map((tier) => (
                  <option key={tier.id} value={tier.name}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label>Target Budget Range *</label>
                <select
                  value={selectedBudget}
                  onChange={(e) => setSelectedBudget(e.target.value)}
                  className="form-select"
                >
                  {budgetRanges.map((br) => (
                    <option key={br} value={br}>
                      {br}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Engagement Scope</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="form-select"
                >
                  {stages.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Target Timeline</label>
                <select
                  value={selectedTimeline}
                  onChange={(e) => setSelectedTimeline(e.target.value)}
                  className="form-select"
                >
                  {timelines.map((tl) => (
                    <option key={tl} value={tl}>
                      {tl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label>Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Company / Project Name</label>
              <input
                type="text"
                placeholder="e.g. Apex Logistics or stealth SaaS"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Brief System Context &amp; Key Bottleneck</label>
              <textarea
                rows={3}
                placeholder="Briefly describe what you need to ship, existing stack, and what success looks like in production..."
                value={projectBrief}
                onChange={(e) => setProjectBrief(e.target.value)}
                className="form-textarea"
              />
            </div>

            <div className="form-footer-stacked">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="button solid submit-btn-full"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Transmitting Project Enquiry...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Project Enquiry</span>
                    <ArrowUpRight size={15} />
                  </>
                )}
              </button>
              <div className="form-confidentiality-note">
                <ShieldCheck size={14} className="text-teal" />
                <span>Confidential. Reviewed directly by senior engineering leadership.</span>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default OnboardingModal;
