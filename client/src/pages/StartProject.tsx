import React, { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

/* ------------------------------------------------------------------ *
 * Intake model
 *
 * Three steps, and the order is the qualification mechanism:
 *   1 The situation  -- effort gate. Requires a specific written problem.
 *   2 The stakes     -- urgency and decision authority.
 *   3 Scope & contact -- money and contact details, asked last on purpose.
 *
 * Budget is asked last so it reads as a formality after the prospect has
 * already invested three minutes. Asking spend first invites a price
 * conversation before a problem conversation.
 * ------------------------------------------------------------------ */

export const objectives = [
  { id: "platform", label: "Build a new product or platform" },
  { id: "scale", label: "Rework or scale an existing system" },
  { id: "migration", label: "Migrate infrastructure or operational data" },
  { id: "ai", label: "Add a reliable AI capability" },
  { id: "commerce", label: "Improve commerce operations" },
  { id: "architecture", label: "Review the architecture before a major decision" },
  { id: "operate", label: "Have Restart run our web assets and hosting" },
];

const objectiveKeywords: Record<string, string[]> = {
  platform: ["saas", "platform", "mvp", "product"],
  migration: ["cloud", "migrat", "bare-metal", "infrastructure"],
  ai: ["ai", "agentic", "mcp", "rag"],
  commerce: ["medusa", "commerce", "shopify"],
  architecture: ["architecture", "audit", "leadership"],
  scale: ["scale", "scaling", "rework"],
  operate: ["managed", "hosting", "operate", "websites"],
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

/**
 * Weighted by how decisive each answer is, not how good it sounds.
 * "Blocking a launch or transaction" is the strongest commercial signal
 * this form can collect; "exploring the impact" is the weakest.
 *
 * Note: the highest-intent option is listed FIRST. The previous order put
 * it fourth, which buried the answer that matters most.
 */
const urgencyOptions: Array<{ label: string; weight: number }> = [
  { label: "It's blocking a strategic launch or transaction", weight: 20 },
  { label: "It's putting revenue, customers, or data at risk", weight: 18 },
  { label: "It's increasing cost or operational workload", weight: 13 },
  { label: "It's slowing the team or delaying delivery", weight: 10 },
  { label: "It's inconvenient but not urgent", weight: 2 },
  { label: "We're still exploring the impact", weight: 0 },
];

const timelineOptions: Array<{ label: string; weight: number }> = [
  { label: "Need a decision or audit within 1–2 weeks", weight: 15 },
  { label: "Want to start within 30 days", weight: 12 },
  { label: "Targeting the next quarter", weight: 7 },
  { label: "Planning ahead", weight: 3 },
  { label: "Exploring architecture options", weight: 0 },
];

/**
 * The floor is real, and it is stated in the UI rather than hidden.
 *
 * The sub-$10k band was removed: an option that low invites exactly the
 * buyer this work is not priced for, and the negotiation costs more than
 * the enquiry is worth. "Not yet budgeted" is kept deliberately -- a
 * specific problem with an unclear budget is still a qualified lead,
 * unlike a specific budget with a vague problem.
 */
const budgetOptions: Array<{ label: string; weight: number; tier: string }> = [
  { label: "$25,000–$50,000 — focused engagement", weight: 14, tier: "$25k–$50k" },
  { label: "$50,000–$100,000 — platform or product build", weight: 19, tier: "$50k–$100k" },
  { label: "$100,000+ — multi-quarter programme or dedicated pod", weight: 22, tier: "$100k+" },
  { label: "Not yet budgeted — needs a scoping conversation first", weight: 6, tier: "Unbudgeted" },
];

/**
 * Reframed from "what's your role" to "who owns this decision". The only
 * thing this question is for is knowing whether the person writing to us
 * can actually authorise the work.
 */
const decisionRoles: Array<{ label: string; weight: number }> = [
  { label: "I own this decision", weight: 12 },
  { label: "I influence it, and can bring in the decision-maker", weight: 8 },
  { label: "I'm an advisor or consultant acting for a client", weight: 8 },
  { label: "I'm researching for someone else", weight: 2 },
];

/**
 * First-party attribution. This site has no analytics, so this field is
 * currently the only record of which channel produced a lead.
 */
export const referralSources = [
  "A client or someone you've worked with",
  "A colleague or peer recommendation",
  "Search (Google or similar)",
  "LinkedIn or social",
  "Something we published or presented",
  "Other",
];

const MIN_BRIEF_CHARS = 80;

const STEPS = [
  { id: 1, kicker: "01", title: "The situation" },
  { id: 2, kicker: "02", title: "The stakes" },
  { id: 3, kicker: "03", title: "Scope and contact" },
] as const;

/**
 * Scores an enquiry 0–100 so staff can triage by intent instead of by
 * arrival time. The band is written into the brief header (see below),
 * which means this works within the existing console.inquiries schema --
 * no migration required.
 */
function scoreLead(input: {
  brief: string;
  urgency: string;
  timeline: string;
  budget: string;
  role: string;
  outcomes: number;
}): { score: number; band: "priority" | "qualified" | "nurture" | "exploring" } {
  let score = 0;

  // Specificity: a precise account of the problem is the best available
  // predictor of a serious enquiry. Capped at 25 so length alone, or a
  // paste of filler, cannot carry a weak lead over the line.
  const words = input.brief.trim().split(/\s+/).filter(Boolean).length;
  score += Math.min(25, Math.round((words / 90) * 25));

  score += urgencyOptions.find((u) => u.label === input.urgency)?.weight ?? 0;
  score += timelineOptions.find((t) => t.label === input.timeline)?.weight ?? 0;
  score += budgetOptions.find((b) => b.label === input.budget)?.weight ?? 0;
  score += decisionRoles.find((r) => r.label === input.role)?.weight ?? 0;
  score += Math.min(8, input.outcomes * 3);

  const capped = Math.max(0, Math.min(100, score));
  const band =
    capped >= 72 ? "priority" : capped >= 50 ? "qualified" : capped >= 28 ? "nurture" : "exploring";
  return { score: capped, band };
}

export default function StartProject() {
  useEffect(() => {
    applyPageSeo({
      title: "Start a Project",
      description:
        "Scope your build with Restart Inc. — tell us what you're building, where the constraint sits, and what decision you need to make next.",
      path: "/start-project",
    });
    return () => resetSeoToDefault();
  }, []);

  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 1 — the situation
  const [selectedObjective, setSelectedObjective] = useState(objectives[0].label);
  const [selectedSystemStage, setSelectedSystemStage] = useState(systemStages[0]);
  const [selectedConstraint, setSelectedConstraint] = useState(constraints[0]);
  const [projectBrief, setProjectBrief] = useState("");

  // Step 2 — the stakes
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [impactMetric, setImpactMetric] = useState("");
  const [selectedUrgency, setSelectedUrgency] = useState(urgencyOptions[0].label);
  const [selectedRole, setSelectedRole] = useState(decisionRoles[0].label);

  // Step 3 — scope and contact
  const [selectedBudget, setSelectedBudget] = useState(budgetOptions[0].label);
  const [selectedTimeline, setSelectedTimeline] = useState(timelineOptions[0].label);
  const [referral, setReferral] = useState(referralSources[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  // Honeypot: never shown to a person, never focusable, never autofilled.
  const [trap, setTrap] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get("tier");
      if (tierParam) {
        const query = tierParam.toLowerCase();
        const matched = objectives.find((o) =>
          (objectiveKeywords[o.id] ?? []).some((kw) => query.includes(kw))
        );
        if (matched) setSelectedObjective(matched.label);
      }
      // QA affordance: ?test=1 pre-fills. Replaces the in-form auto-fill
      // button, which was visible to real prospects.
      if (params.get("test") === "1") {
        setName("Alex Vance");
        setEmail("alex.vance@acmelogistics.com");
        setCompany("Acme Global Logistics");
        setWebsite("acmelogistics.com");
        setSelectedObjective(objectives[2].label);
        setSelectedSystemStage(systemStages[3]);
        setSelectedConstraint(constraints[0]);
        setProjectBrief(
          "We run a multi-tenant PostgreSQL warehouse and order queue on a legacy SaaS platform. It is reliable most days but throttles hard during peak volume, and we have had two unplanned outages this quarter. We need to migrate to dedicated bare-metal infrastructure with a zero-downtime cutover, and we own the decision internally."
        );
        setSelectedOutcomes([outcomeOptions[0], outcomeOptions[1]]);
        setImpactMetric(
          "Zero unplanned downtime during peak order volume, and 30% lower infrastructure spend."
        );
        setSelectedUrgency(urgencyOptions[0].label);
        setSelectedRole(decisionRoles[0].label);
        setSelectedBudget(budgetOptions[1].label);
        setSelectedTimeline(timelineOptions[1].label);
      }
    } catch {}
  }, []);

  const toggleOutcome = (option: string) =>
    setSelectedOutcomes((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );

  const briefWords = projectBrief.trim().split(/\s+/).filter(Boolean).length;
  const briefReady = projectBrief.trim().length >= MIN_BRIEF_CHARS;

  const fit = useMemo(
    () =>
      scoreLead({
        brief: projectBrief,
        urgency: selectedUrgency,
        timeline: selectedTimeline,
        budget: selectedBudget,
        role: selectedRole,
        outcomes: selectedOutcomes.length,
      }),
    [projectBrief, selectedUrgency, selectedTimeline, selectedBudget, selectedRole, selectedOutcomes]
  );

  const emailLooksReal = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  function validateStep(current: number): string | null {
    if (current === 1) {
      if (!briefReady)
        return `Please describe what needs to change in at least ${MIN_BRIEF_CHARS} characters — the specifics are what let us give you a straight answer.`;
      return null;
    }
    if (current === 2) {
      if (selectedOutcomes.length === 0) return "Select at least one outcome you're hoping for.";
      if (!impactMetric.trim()) return "Tell us what would be measurably different if this worked.";
      return null;
    }
    if (!name.trim()) return "Please add your name.";
    if (!emailLooksReal) return "Please add a valid work email so we can reply.";
    return null;
  }

  const goNext = () => {
    const problem = validateStep(step);
    if (problem) {
      setStepError(problem);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step < 3) {
      goNext();
      return;
    }
    const problem = validateStep(3);
    if (problem) {
      setStepError(problem);
      return;
    }

    // Silent discard. A bot that fills the honeypot sees the normal
    // success screen; nothing reaches the database.
    if (trap.trim()) {
      setReferenceId(`RST-${Date.now().toString(36).toUpperCase()}`);
      setStatus("success");
      return;
    }

    setStatus("submitting");

    if (!isSupabaseConfigured) {
      setError(
        "Submissions aren't configured on this deployment yet. Please email hello@restart.ng directly."
      );
      setStatus("idle");
      return;
    }

    const generatedRef = `RST-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;

    // The header block carries the triage signals -- fit band, referral
    // channel, decision authority -- inside project_brief. That keeps this
    // change schema-compatible with console.inquiries as it stands today.
    const composedBrief = [
      `FIT: ${fit.band.toUpperCase()} (${fit.score}/100)`,
      `Referral: ${referral}`,
      `Decision authority: ${selectedRole}`,
      `Constraint: ${selectedConstraint}`,
      website ? `Website: ${website}` : null,
      "",
      "What needs to change:",
      projectBrief,
      "",
      `Desired outcomes: ${selectedOutcomes.join(", ")}`,
      `Measurable in 3-12 months: ${impactMetric}`,
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
      setError(
        "We couldn't submit your inquiry — please try again, or email hello@restart.ng directly."
      );
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
            <h1>
              Build the system <span>your next stage depends on.</span>
            </h1>
            <p className="squeeze-subheading">
              Tell us what you're building, where it's under pressure, and what needs to change. Three
              short steps — and a senior engineer reads it, not a sales queue.
            </p>

            {/* 3 Core Commitments */}
            <div className="squeeze-commitments">
              <div className="commitment-card">
                <span className="commitment-num">01</span>
                <div>
                  <h4>Senior Technical Ownership</h4>
                  <p>
                    Lead architects and veteran systems engineers write and review your core
                    infrastructure—never outsourced or passed to juniors.
                  </p>
                </div>
              </div>
              <div className="commitment-card">
                <span className="commitment-num">02</span>
                <div>
                  <h4>Zero-Downtime Migration Practices</h4>
                  <p>
                    Idempotent migrations, parallel replication, and health probes ensure your business
                    operations never miss a beat.
                  </p>
                </div>
              </div>
              <div className="commitment-card">
                <span className="commitment-num">03</span>
                <div>
                  <h4>Clear Time-Boxed Deliverables</h4>
                  <p>
                    Scoped 2-week to 12-week milestones with transparent commercial terms and weekly
                    verifiable production releases.
                  </p>
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
                  Your information will be reviewed by senior engineering leadership. We'll respond with
                  whether there's a fit and the clearest next step — not a generic sales sequence.
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
                    <small>INVESTMENT</small>
                    <strong>
                      {budgetOptions.find((b) => b.label === selectedBudget)?.tier ?? "—"}
                    </strong>
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
                      <span>
                        <strong>24-Hour Technical Assessment:</strong> A senior partner reviews your stack
                        requirements and bottlenecks.
                      </span>
                    </li>
                    <li>
                      <Check size={13} />
                      <span>
                        <strong>Architecture Discovery Call:</strong> 30-minute focused working session to
                        scope boundaries and milestones.
                      </span>
                    </li>
                    <li>
                      <Check size={13} />
                      <span>
                        <strong>Fixed-Scope Proposal:</strong> Clear milestone timeline, technical
                        architecture specification, and commercial terms.
                      </span>
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
              <form onSubmit={handleSubmit} className="squeeze-form" noValidate>
                <div className="squeeze-form-header form-header">
                  <h3>{STEPS[step - 1].title}</h3>
                  <p>
                    {step === 1 && "Start with the problem. Detail here is what earns a straight answer."}
                    {step === 2 && "What's at risk, and who decides. This sets the priority."}
                    {step === 3 && "Last step — scope, and how to reach you."}
                  </p>
                </div>

                {/* Progress: position and total effort shown up front */}
                <ol className="sp-progress" aria-label="Form progress">
                  {STEPS.map((s) => (
                    <li
                      key={s.id}
                      className={`sp-progress-step ${step === s.id ? "active" : ""} ${
                        step > s.id ? "done" : ""
                      }`}
                      aria-current={step === s.id ? "step" : undefined}
                    >
                      <span className="sp-progress-kicker">
                        {step > s.id ? <Check size={10} /> : s.kicker}
                      </span>
                      <span className="sp-progress-label">{s.title}</span>
                    </li>
                  ))}
                </ol>

                {step === 1 && (
                  <>
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

                    <div className="form-group">
                      <label>Describe the workflow, product, or system you want to change. *</label>
                      <textarea
                        rows={6}
                        placeholder="What does the system do today, who relies on it, and where does the current approach break down? Name the part that's hardest to operate, change, or trust — and what you've already tried."
                        value={projectBrief}
                        onChange={(e) => setProjectBrief(e.target.value)}
                        className="form-textarea"
                      />
                      <div className={`sp-meter ${briefReady ? "ok" : ""}`}>
                        <span className="sp-meter-bar">
                          <span
                            className="sp-meter-fill"
                            style={{ width: `${Math.min(100, (briefWords / 90) * 100)}%` }}
                          />
                        </span>
                        <span className="sp-meter-text">
                          {briefReady
                            ? `${briefWords} words — specific enough to assess`
                            : `${projectBrief.trim().length} / ${MIN_BRIEF_CHARS} characters minimum`}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="form-group">
                      <label>What would a successful engagement change? *</label>
                      <div className="form-chip-group">
                        {outcomeOptions.map((opt) => (
                          <button
                            type="button"
                            key={opt}
                            className={`form-chip ${selectedOutcomes.includes(opt) ? "active" : ""}`}
                            onClick={() => toggleOutcome(opt)}
                            aria-pressed={selectedOutcomes.includes(opt)}
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
                          <option key={u.label} value={u.label}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Who owns this decision? *</label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="form-select"
                      >
                        {decisionRoles.map((r) => (
                          <option key={r.label} value={r.label}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className="form-row-two">
                      <div className="form-group">
                        <label>Desired timing *</label>
                        <select
                          value={selectedTimeline}
                          onChange={(e) => setSelectedTimeline(e.target.value)}
                          className="form-select"
                        >
                          {timelineOptions.map((t) => (
                            <option key={t.label} value={t.label}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Investment range *</label>
                        <select
                          value={selectedBudget}
                          onChange={(e) => setSelectedBudget(e.target.value)}
                          className="form-select"
                        >
                          {budgetOptions.map((b) => (
                            <option key={b.label} value={b.label}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="sp-hint">
                      Engagements start at $25,000. Naming a range now saves a round trip — it isn't a
                      commitment.
                    </p>

                    <div className="form-row-two">
                      <div className="form-group">
                        <label>Your Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Alex Vance"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="form-input"
                          autoComplete="name"
                        />
                      </div>
                      <div className="form-group">
                        <label>Work Email *</label>
                        <input
                          type="email"
                          placeholder="alex@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="form-input"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="form-row-two">
                      <div className="form-group">
                        <label>Company / Organization</label>
                        <input
                          type="text"
                          placeholder="e.g. Acme Global Logistics"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          className="form-input"
                          autoComplete="organization"
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
                          autoComplete="url"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>How did you hear about us?</label>
                      <select
                        value={referral}
                        onChange={(e) => setReferral(e.target.value)}
                        className="form-select"
                      >
                        {referralSources.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Honeypot: hidden from people, tempting to bots */}
                    <div className="sp-honeypot" aria-hidden="true">
                      <label htmlFor="sp-company-fax">Company fax number</label>
                      <input
                        id="sp-company-fax"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={trap}
                        onChange={(e) => setTrap(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {(stepError || error) && (
                  <div className="form-error-banner" role="alert">
                    {stepError ?? error}
                  </div>
                )}

                <div className="form-footer-stacked">
                  <div className="sp-nav">
                    {step > 1 && (
                      <button type="button" className="sp-back-btn" onClick={goBack}>
                        <ChevronLeft size={15} />
                        <span>Back</span>
                      </button>
                    )}
                    <button
                      type={step < 3 ? "button" : "submit"}
                      onClick={step < 3 ? goNext : undefined}
                      disabled={status === "submitting"}
                      className="button solid submit-btn-full sp-next-btn"
                    >
                      {status === "submitting" ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Sending project context...</span>
                        </>
                      ) : step < 3 ? (
                        <>
                          <span>Continue</span>
                          <ArrowRight size={15} />
                        </>
                      ) : (
                        <>
                          <span>Send project context</span>
                          <ArrowUpRight size={15} />
                        </>
                      )}
                    </button>
                  </div>

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

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link href="/" className="site-logo">
              <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
            </Link>
            <p>Engineering systems your growth depends on.</p>
            <div className="footer-brand-contact">
              <a href="mailto:hello@restart.ng">hello@restart.ng</a>
              <a href="tel:+2349060114747">+234 906 011 4747</a>
            </div>
          </div>
          <div>
            <strong>PLATFORM</strong>
            <Link href="/#platform">Platform</Link>
            <Link href="/#solutions">Solutions</Link>
            <Link href="/#case-studies">Case Studies</Link>
            <Link href="/#insights">Insights</Link>
          </div>
          <div>
            <strong>COMPANY</strong>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/careers">Careers</Link>
          </div>
          <div>
            <strong>CONNECT</strong>
            <a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">
              LinkedIn <ArrowUpRight size={12} />
            </a>
            <a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={12} />
            </a>
            <Link href="/start-project" className="footer-text-btn">
              Book an intro <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span>
          <span>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
