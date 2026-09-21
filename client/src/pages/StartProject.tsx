import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronRight, Cpu, Database, Loader2, Network, Send, Server, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

export const objectives = [
  { id: "platform", label: "Build a new product or platform" },
  { id: "scale", label: "Rework or scale an existing system" },
  { id: "migration", label: "Migrate infrastructure or operational data" },
  { id: "ai", label: "Add a reliable AI capability" },
  { id: "commerce", label: "Improve commerce operations" },
  { id: "architecture", label: "Review the architecture before making a major decision" },
  { id: "leadership", label: "Add senior technical leadership to an existing team" },
  { id: "unsure", label: "I'm not sure yet — I need help defining the next move" },
];

const objectiveKeywords: Record<string, string[]> = {
  platform: ["saas", "platform", "mvp", "product"],
  migration: ["cloud", "migrat", "bare-metal", "infrastructure"],
  ai: ["ai", "agentic", "mcp", "rag"],
  commerce: ["medusa", "commerce", "shopify"],
  architecture: ["architecture", "audit"],
  leadership: ["turnkey", "leadership", "pod", "dedicated", "fractional"],
  scale: ["scale", "scaling", "rework"],
};

export const systemStages = [
  "It's an idea or early concept",
  "We have a prototype or first version",
  "It's live with early users or customers",
  "It's live and experiencing operational or technical pressure",
  "It's established and needs a significant change or migration",
  "We're evaluating options before building",
];

export const constraints = [
  "Reliability or downtime risk",
  "Slow performance or scaling limits",
  "Manual or fragmented workflows",
  "Rising infrastructure or software costs",
  "AI quality, latency, or cost control",
  "Data, integration, or migration risk",
  "Lack of senior technical direction",
  "A product or feature is taking too long to ship",
  "We haven't identified the constraint yet",
];

export const outcomeOptions = [
  "Reduce operating cost",
  "Improve uptime or response time",
  "Remove manual work",
  "Increase throughput or capacity",
  "Improve AI accuracy, latency, or cost",
  "Launch a product or feature",
  "Reduce technical risk before scaling",
  "Give the internal team clearer ownership",
];

export const urgencyOptions = [
  "It's inconvenient but not urgent",
  "It's slowing the team or delaying delivery",
  "It's increasing cost or operational workload",
  "It's putting revenue, customers, or data at risk",
  "It's blocking a strategic launch or transaction",
  "We're still exploring the impact",
];

export const timelines = [
  "Need a decision or audit within 1–2 weeks",
  "Want to start within 30 days",
  "Targeting the next quarter",
  "Planning ahead",
  "Exploring architecture options",
];

export const budgetRanges = [
  "$10,000–$25,000 — focused sprint or architecture audit",
  "$25,000–$50,000 — targeted build or infrastructure project",
  "$50,000–$100,000 — full platform, AI, or commerce system",
  "$100,000+ — enterprise transformation or dedicated engineering pod",
  "We haven't set a range yet",
];

export const roles = [
  "Founder or owner",
  "Business or operations leader",
  "Product leader",
  "Engineering or technology leader",
  "Advisor or consultant",
  "Researching on behalf of the team",
];

export default function StartProject() {
  useEffect(() => {
    applyPageSeo({
      title: "Start a Project",
      description: "Scope your build with Restart Inc. — tell us what you're building, where the constraint sits, and what decision you need to make next.",
      path: "/start-project",
    });
    return () => resetSeoToDefault();
  }, []);

  const [selectedObjective, setSelectedObjective] = useState(objectives[0].label);
  const [selectedSystemStage, setSelectedSystemStage] = useState(systemStages[0]);
  const [selectedConstraint, setSelectedConstraint] = useState(constraints[0]);
  const [projectBrief, setProjectBrief] = useState("");
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [impactMetric, setImpactMetric] = useState("");
  const [selectedUrgency, setSelectedUrgency] = useState(urgencyOptions[0]);
  const [selectedTimeline, setSelectedTimeline] = useState(timelines[0]);
  const [selectedBudget, setSelectedBudget] = useState(budgetRanges[1]);
  const [selectedRole, setSelectedRole] = useState(roles[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get("tier");
      if (tierParam) {
        const query = tierParam.toLowerCase();
        const matched = objectives.find(
          (o) => o.id !== "unsure" && (objectiveKeywords[o.id] ?? []).some((kw) => query.includes(kw))
        );
        if (matched) {
          setSelectedObjective(matched.label);
        }
      }
    } catch {}
  }, []);

  const toggleOutcome = (option: string) => {
    setSelectedOutcomes((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleFillTestData = () => {
    setName("Alex Vance");
    setEmail("alex.vance@acmelogistics.com");
    setCompany("Acme Global Logistics");
    setWebsite("acmelogistics.com");
    setSelectedObjective(objectives[2].label);
    setSelectedSystemStage(systemStages[3]);
    setSelectedConstraint(constraints[0]);
    setSelectedOutcomes([outcomeOptions[0], outcomeOptions[1]]);
    setImpactMetric("Zero unplanned downtime during peak order volume, and a 30% reduction in infrastructure spend.");
    setSelectedUrgency(urgencyOptions[3]);
    setSelectedTimeline(timelines[1]);
    setSelectedBudget(budgetRanges[1]);
    setSelectedRole(roles[3]);
    setProjectBrief(
      "We run a multi-tenant PostgreSQL warehouse and order queue on a legacy SaaS platform. It's reliable most days but throttles hard during peak volume, and we've had two unplanned outages this quarter. We need to migrate to dedicated bare-metal infrastructure with a zero-downtime cutover."
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedOutcomes.length === 0) {
      setError("Please select at least one outcome you're hoping for.");
      return;
    }

    setStatus("submitting");

    if (!isSupabaseConfigured) {
      setError("Submissions aren't configured on this deployment yet. Please email hello@restart.ng directly.");
      setStatus("idle");
      return;
    }

    const generatedRef = `RST-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;

    const composedBrief = [
      `Constraint: ${selectedConstraint}`,
      `Decision role: ${selectedRole}`,
      website ? `Website: ${website}` : null,
      "",
      "What needs to change:",
      projectBrief,
      "",
      `Desired outcomes: ${selectedOutcomes.join(", ")}`,
      `Measurable in 3–12 months: ${impactMetric}`,
      `Cost of inaction: ${selectedUrgency}`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const { error: insertError } = await supabase
      .schema("console")
      .from("inquiries")
      .insert({
        reference_id: generatedRef,
        source: "start_project_page",
        name,
        email,
        company: company || null,
        service_tier: selectedObjective,
        budget_range: selectedBudget,
        project_stage: selectedSystemStage,
        target_timeline: selectedTimeline,
        project_brief: composedBrief.slice(0, 5000),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      });

    if (insertError) {
      setError("We couldn't submit your inquiry — please try again, or email hello@restart.ng directly.");
      setStatus("idle");
      return;
    }

    setReferenceId(generatedRef);
    setStatus("success");
  };

  return (
    <div className="squeeze-page-shell">
      {/* Distraction-Free Header */}
      <header className="squeeze-header container">
        <Link href="/" className="logo-link">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <div className="squeeze-trust-pill">
          <ShieldCheck size={13} className="text-teal" />
          <span>Senior Engineering Pod · Production Reliability Targets</span>
        </div>
        <Link href="/" className="squeeze-back-link">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </header>

      <main className="squeeze-main container">
        <div className="squeeze-grid">
          {/* Left Column: Authority, Value Proposition & Track Record */}
          <div className="squeeze-pitch">
            <span className="section-label teal">START A PROJECT</span>
            <h1>Build the system <span>your next stage depends on.</span></h1>
            <p className="squeeze-subheading">
              Tell us what you're building, where it's under pressure, and what needs to change. We'll help you identify the clearest next move.
            </p>

            {/* 3 Core Commitments */}
            <div className="squeeze-commitments">
              <div className="commitment-card">
                <span className="commitment-num">01</span>
                <div>
                  <h4>Senior Technical Ownership</h4>
                  <p>Lead architects and veteran systems engineers write and review your core infrastructure—never outsourced or passed to juniors.</p>
                </div>
              </div>
              <div className="commitment-card">
                <span className="commitment-num">02</span>
                <div>
                  <h4>Zero-Downtime Migration Practices</h4>
                  <p>Idempotent migrations, parallel replication, and health probes ensure your business operations never miss a beat.</p>
                </div>
              </div>
              <div className="commitment-card">
                <span className="commitment-num">03</span>
                <div>
                  <h4>Clear Time-Boxed Deliverables</h4>
                  <p>Scoped 2-week to 12-week milestones with transparent commercial terms and weekly verifiable production releases.</p>
                </div>
              </div>
            </div>

            {/* Reassurance Footer */}
            <div className="squeeze-reassurance-box">
              <div className="reassurance-row">
                <Check size={14} className="text-teal" />
                <span>Privacy-Conscious Engineering Standards (NDPA &amp; GDPR Aligned)</span>
              </div>
              <div className="reassurance-row">
                <Check size={14} className="text-teal" />
                <span>Standard Mutual NDA Executed Prior to Deep Architectural Disclosure</span>
              </div>
              <div className="reassurance-row">
                <Check size={14} className="text-teal" />
                <span>Direct Response from Technical Leadership within 24 Hours</span>
              </div>
            </div>
          </div>

          {/* Right Column: Project Intake Form */}
          <div className="squeeze-form-card">
            {status === "success" ? (
              <div className="squeeze-success-state">
                <div className="success-icon-badge">
                  <CheckCircle2 size={38} className="text-teal" />
                </div>
                <h2>We've got it.</h2>
                <p>
                  Your information will be reviewed by senior engineering leadership. We'll respond with whether there's a fit and the clearest next step — not a generic sales sequence.
                </p>

                <div className="success-ref-card">
                  <span className="ref-label">SYSTEM REFERENCE ID</span>
                  <span className="ref-code">{referenceId}</span>
                  <span className="ref-sub">Keep this code for direct communication</span>
                </div>

                <div className="success-summary">
                  <div>
                    <small>FOCUS AREA</small>
                    <strong>{selectedObjective.split(" — ")[0]}</strong>
                  </div>
                  <div>
                    <small>BUDGET RANGE</small>
                    <strong>{selectedBudget.split(" — ")[0]}</strong>
                  </div>
                  <div>
                    <small>TARGET TIMELINE</small>
                    <strong>{selectedTimeline}</strong>
                  </div>
                  <div>
                    <small>DELIVERY SLA</small>
                    <strong>24h Review Guarantee</strong>
                  </div>
                </div>

                <div className="success-next-steps">
                  <h4>WHAT HAPPENS NEXT</h4>
                  <ul>
                    <li>
                      <Check size={13} />
                      <span><strong>24-Hour Technical Assessment:</strong> A senior partner reviews your stack requirements and bottlenecks.</span>
                    </li>
                    <li>
                      <Check size={13} />
                      <span><strong>Architecture Discovery Call:</strong> 30-minute focused working session to scope boundaries and milestones.</span>
                    </li>
                    <li>
                      <Check size={13} />
                      <span><strong>Fixed-Scope Proposal:</strong> Clear milestone timeline, technical architecture specification, and commercial terms.</span>
                    </li>
                  </ul>
                </div>

                <div className="success-actions">
                  <button className="button solid" onClick={() => setStatus("idle")}>
                    Submit Another Project
                  </button>
                  <Link href="/" className="button outline">
                    Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="squeeze-form">
                <div className="squeeze-form-header form-header">
                  <h3>Tell us what you're building</h3>
                  <p>The more context you give us, the clearer the next move will be.</p>
                  <button
                    type="button"
                    className="squeeze-autofill-btn"
                    onClick={handleFillTestData}
                    title="Pre-fill sample lead data"
                  >
                    <Sparkles size={11} /> Quick Test Auto-Fill
                  </button>
                </div>

                <span className="section-label teal form-section-label">01 · SITUATION</span>

                {/* What are you trying to accomplish */}
                <div className="form-group">
                  <label>What are you trying to accomplish? *</label>
                  <select
                    value={selectedObjective}
                    onChange={(e) => setSelectedObjective(e.target.value)}
                    className="form-select"
                  >
                    {objectives.map((o) => (
                      <option key={o.id} value={o.label}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* System stage & main constraint */}
                <div className="form-row-two">
                  <div className="form-group">
                    <label>Which describes the system today? *</label>
                    <select
                      value={selectedSystemStage}
                      onChange={(e) => setSelectedSystemStage(e.target.value)}
                      className="form-select"
                    >
                      {systemStages.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>What's the main constraint right now? *</label>
                    <select
                      value={selectedConstraint}
                      onChange={(e) => setSelectedConstraint(e.target.value)}
                      className="form-select"
                    >
                      {constraints.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <span className="section-label teal form-section-label">02 · THE PROBLEM</span>

                {/* Project Brief */}
                <div className="form-group">
                  <label>Describe the workflow, product, or system you want to change. *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="What does the system do today, who relies on it, and where does the current approach break down? Include the part that's hardest to operate, change, or trust."
                    value={projectBrief}
                    onChange={(e) => setProjectBrief(e.target.value)}
                    className="form-textarea"
                  />
                </div>

                {/* Outcomes multi-select */}
                <div className="form-group">
                  <label>What would a successful engagement change? *</label>
                  <div className="form-chip-group">
                    {outcomeOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        className={`form-chip ${selectedOutcomes.includes(opt) ? "active" : ""}`}
                        onClick={() => toggleOutcome(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>If this works, what will be measurably different in 3–12 months? *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zero unplanned downtime during peak volume, 30% lower infrastructure spend"
                    value={impactMetric}
                    onChange={(e) => setImpactMetric(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>What's the cost of leaving this unresolved? *</label>
                  <select
                    value={selectedUrgency}
                    onChange={(e) => setSelectedUrgency(e.target.value)}
                    className="form-select"
                  >
                    {urgencyOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="section-label teal form-section-label">03 · FIT &amp; NEXT MOVE</span>

                {/* Timeline & Budget */}
                <div className="form-row-two">
                  <div className="form-group">
                    <label>Desired timing *</label>
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
                  <div className="form-group">
                    <label>Investment range set aside *</label>
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
                </div>

                {/* Role */}
                <div className="form-group">
                  <label>What's your role in the decision? *</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="form-select"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name & Work Email */}
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

                {/* Company & Website */}
                <div className="form-row-two">
                  <div className="form-group">
                    <label>Company / Organization</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Global Logistics or Stealth SaaS"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Company Website (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. acmelogistics.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {error && <div className="form-error-banner">{error}</div>}

                <div className="form-footer-stacked">
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="button solid submit-btn-full"
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Sending project context...</span>
                      </>
                    ) : (
                      <>
                        <span>Send project context</span>
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
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>
    </div>
  );
}
