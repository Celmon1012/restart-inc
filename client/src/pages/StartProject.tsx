import { openCookieSettings } from "@/lib/consent";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { track, FUNNEL, STEP_NAMES } from "@/lib/analytics";
import { CONSOLE_URL, normalisePhone, whatsappLink } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";

/* ------------------------------------------------------------------ *
 * Intake model
 *
 * Four steps:
 *   1 Contact        -- name, email, optionally a WhatsApp number. Short.
 *   2 The situation  -- effort gate. Requires a specific written problem.
 *   3 The stakes     -- urgency and decision authority.
 *   4 Scope          -- timing and money.
 *
 * Contact comes first so the brief can be saved as the prospect goes
 * (console.save_inquiry_draft). Someone who leaves at step 3 gets an email
 * linking back to exactly where they stopped, instead of being lost.
 *
 * Budget is still asked last so it reads as a formality after the prospect
 * has already invested three minutes. Asking spend first invites a price
 * conversation before a problem conversation.
 * ------------------------------------------------------------------ */

const DRAFT_STORAGE_KEY = "rst-intake-draft";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(DRAFT_STORAGE_KEY, token);
    else localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  { label: "Within 2 weeks", weight: 15 },
  { label: "Within 30 days", weight: 12 },
  { label: "Next quarter", weight: 7 },
  { label: "Planning ahead", weight: 3 },
  { label: "Still exploring", weight: 0 },
];

/**
 * The floor is real, and it is stated in the UI rather than hidden.
 *
 * Same bands as the console intake (console/src/lib/intakeOptions.ts).
 * Under $10k is offered while the client base is being built -- some of
 * that work is worth taking at a concession -- but it scores lowest, so it
 * lands in nurture unless the rest of the brief is strong. "Not yet
 * budgeted" is kept deliberately -- a specific problem with an unclear
 * budget is still a qualified lead, unlike a specific budget with a vague
 * problem.
 */
const budgetOptions: Array<{ label: string; weight: number; tier: string }> = [
  { label: "Under $10,000", weight: 4, tier: "Under $10k" },
  { label: "$10,000–$25,000", weight: 10, tier: "$10k–$25k" },
  { label: "$25,000–$50,000", weight: 14, tier: "$25k–$50k" },
  { label: "$50,000–$100,000", weight: 19, tier: "$50k–$100k" },
  { label: "$100,000+", weight: 22, tier: "$100k+" },
  { label: "Not yet budgeted", weight: 6, tier: "Unbudgeted" },
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
  { id: 1, kicker: "01", title: "How we reach you" },
  { id: 2, kicker: "02", title: "The situation" },
  { id: 3, kicker: "03", title: "The stakes" },
  { id: 4, kicker: "04", title: "Scope and timing" },
] as const;
const LAST_STEP = STEPS.length;

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

/** A single-choice question as selectable cards, styled like the scorecard. */
function OptionCards({
  legend,
  name,
  options,
  value,
  onChange,
  note,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  note?: string;
}) {
  return (
    <fieldset className="scorecard-question">
      <legend>{legend}</legend>
      <div className="scorecard-options">
        {options.map((o) => (
          <label key={o} className={value === o ? "selected" : undefined}>
            <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      {note && <p className="sp-note">{note}</p>}
    </fieldset>
  );
}

export default function StartProject() {
  // Funnel reporting.
  //
  // Every step view is reported so each step has its own denominator -- the
  // drop-off rate for step 3 is meaningless without knowing how many people
  // actually reached step 3. `intake_started` fires once, guarded by a ref,
  // so the whole-funnel denominator is not inflated by re-renders.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      track(FUNNEL.STARTED, { entry: "start_project_page" });
    }
  }, []);

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
  const [selectedUrgency, setSelectedUrgency] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  // Step 4 — scope
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedTimeline, setSelectedTimeline] = useState("");
  const [referral, setReferral] = useState(referralSources[0]);
  const [website, setWebsite] = useState("");

  // Step 1 — contact
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  // Honeypot: never shown to a person, never focusable, never autofilled.
  const [trap, setTrap] = useState("");

  // The saved draft this brief is being written into, and a one-line notice
  // about it (resumed, already sent, reminders stopped).
  const draftTokenRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track(FUNNEL.STEP_VIEW, { step: step, step_name: STEP_NAMES[step] });
  }, [step]);

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
      // Arriving from the Readiness Scorecard: carry the result
      // into the brief so the engineer reviewing the inquiry sees it.
      const scorecardParam = params.get("scorecard");
      if (scorecardParam) {
        const [score, weakest] = scorecardParam.split("|");
        if (/^\d{1,3}$/.test(score ?? "")) {
          setProjectBrief(
            `Readiness Scorecard: ${score}/100.${weakest ? ` Weakest areas: ${weakest.slice(0, 200)}.` : ""}\n\n`
          );
        }
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
        setSelectedBudget(budgetOptions[3].label);
        setSelectedTimeline(timelineOptions[1].label);
      }
    } catch {}
  }, []);

  // Everything past step 1, as saved in the draft's payload.
  const draftPayload = () => ({
    objective: selectedObjective,
    systemStage: selectedSystemStage,
    constraint: selectedConstraint,
    projectBrief,
    outcomes: selectedOutcomes,
    impactMetric,
    urgency: selectedUrgency,
    role: selectedRole,
    budget: selectedBudget,
    timeline: selectedTimeline,
    referral,
    website,
  });

  // Resume a saved draft: from the link in a reminder email (?resume=), or
  // from this browser's own earlier visit. ?stop=1 on the same link turns
  // the reminders off.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    const fromLink = params.get("resume");
    const token = fromLink && UUID_RE.test(fromLink) ? fromLink : readStoredToken();
    if (!token || !UUID_RE.test(token)) return;
    let cancelled = false;

    (async () => {
      if (fromLink && params.get("stop") === "1") {
        await supabase.schema("console").rpc("stop_inquiry_followups", { p_token: token });
        if (!cancelled) setNotice("Done. You won't get any more reminders about this brief. It's still saved below if you want to finish it.");
        track("intake_reminders_stopped");
      }
      const { data, error: rpcError } = await supabase.schema("console").rpc("get_inquiry_draft", { p_token: token });
      const draft = Array.isArray(data) ? data[0] : null;
      if (cancelled || rpcError || !draft) {
        if (!fromLink) storeToken(null);
        return;
      }

      setName(draft.name ?? "");
      setEmail(draft.email ?? "");
      setCompany(draft.company ?? "");
      setPhone(draft.phone ?? "");
      setWhatsappOptIn(Boolean(draft.whatsapp_opt_in));

      if (draft.submitted_reference) {
        // Already sent. Keep the contact details, start a fresh brief.
        storeToken(null);
        setNotice(`That brief was already sent (reference ${draft.submitted_reference}). Your details are filled in if you want to start another.`);
        return;
      }

      const p = (draft.payload ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      if (str(p.objective)) setSelectedObjective(str(p.objective));
      if (str(p.systemStage)) setSelectedSystemStage(str(p.systemStage));
      if (str(p.constraint)) setSelectedConstraint(str(p.constraint));
      if (str(p.projectBrief)) setProjectBrief(str(p.projectBrief));
      if (Array.isArray(p.outcomes)) setSelectedOutcomes(p.outcomes.filter((o): o is string => typeof o === "string"));
      setImpactMetric(str(p.impactMetric));
      setSelectedUrgency(str(p.urgency));
      setSelectedRole(str(p.role));
      setSelectedBudget(str(p.budget));
      setSelectedTimeline(str(p.timeline));
      if (str(p.referral)) setReferral(str(p.referral));
      setWebsite(str(p.website));

      draftTokenRef.current = token;
      storeToken(token);
      setStep(Math.min(LAST_STEP, Math.max(1, Number(draft.last_step) || 1)));
      setNotice((current) => current ?? "Picking up where you left off. Everything you entered is saved.");
      track("intake_resumed", { via: fromLink ? "link" : "browser", step: draft.last_step });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save the brief so far. Never blocks the form: if saving fails (or the
  // draft functions aren't deployed yet) the visitor carries on and the
  // final submit still works on its own.
  const saveDraft = async (lastStep: number) => {
    if (!isSupabaseConfigured || trap.trim()) return;
    const { data, error: rpcError } = await supabase.schema("console").rpc("save_inquiry_draft", {
      p_token: draftTokenRef.current,
      p_name: name.trim(),
      p_email: email.trim(),
      p_company: company.trim(),
      p_phone: normalisePhone(phone) ?? "",
      p_whatsapp_opt_in: whatsappOptIn,
      p_last_step: lastStep,
      p_payload: draftPayload(),
    });
    if (!rpcError && typeof data === "string") {
      draftTokenRef.current = data;
      storeToken(data);
    }
  };

  const startOver = () => {
    draftTokenRef.current = null;
    storeToken(null);
    try {
      window.history.replaceState(null, "", "/start-project");
    } catch {}
    window.location.reload();
  };

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

  const phoneValid = !phone.trim() || normalisePhone(phone) !== null;

  function validateStep(current: number): string | null {
    if (current === 1) {
      if (!name.trim()) return "Please add your name.";
      if (!emailLooksReal) return "Please add a valid work email so we can reply.";
      if (!phoneValid) return "That phone number doesn't look right. Include the country code, e.g. +234 806 000 0000.";
      return null;
    }
    if (current === 2) {
      if (!briefReady)
        return `Please describe what needs to change in at least ${MIN_BRIEF_CHARS} characters — the specifics are what let us give you a straight answer.`;
      return null;
    }
    if (current === 3) {
      if (selectedOutcomes.length === 0) return "Select at least one outcome you're hoping for.";
      if (!impactMetric.trim()) return "Tell us what would be measurably different if this worked.";
      // No defaults on the scored questions: a preselected answer is scored
      // as if the prospect chose it, which inflated leads that clicked through.
      if (!selectedUrgency) return "Tell us what leaving this unresolved costs.";
      if (!selectedRole) return "Tell us who owns this decision.";
      return null;
    }
    if (!selectedTimeline) return "Pick the timing that fits.";
    if (!selectedBudget) return "Pick an investment range — it isn't a commitment.";
    return null;
  }

  const goNext = () => {
    const problem = validateStep(step);
    if (problem) {
      setStepError(problem);
      // Reported separately from completion so a validation rule that blocks
      // too many real buyers shows up as its own signal, not as "no drop-off".
      track(FUNNEL.STEP_BLOCKED, { step: step, step_name: STEP_NAMES[step] });
      return;
    }
    setStepError(null);
    track(FUNNEL.STEP_COMPLETE, {
      step: step,
      step_name: STEP_NAMES[step],
      // Categorical only -- never the free-text brief itself.
      outcome_count: step === 3 ? selectedOutcomes.length : undefined,
      word_count: step === 2 ? briefWords : undefined,
      whatsapp_opt_in: step === 1 ? whatsappOptIn : undefined,
    });
    const next = Math.min(LAST_STEP, step + 1);
    void saveDraft(next);
    setStep(next);
  };

  // After a step change (not on first load), move focus to the new step's
  // heading and bring it back into view, as the scorecard does.
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    const el = stepHeadingRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 140;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, [step]);

  const goBack = () => {
    setStepError(null);
    // Stepping backwards is a friction signal worth seeing, not a failure.
    track(FUNNEL.STEP_BACK, { from_step: step, from_step_name: STEP_NAMES[step] });
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step < LAST_STEP) {
      goNext();
      return;
    }
    const problem = validateStep(LAST_STEP);
    if (problem) {
      setStepError(problem);
      return;
    }

    // Silent discard. A bot that fills the honeypot sees the normal
    // success screen; nothing reaches the database.
    if (trap.trim()) {
      // Deliberately not reported as a conversion: this is a bot. It still
      // gets the confirmation page so the response looks identical to a real
      // submission, but without a reference ID.
      setStatus("success");
      navigate("/thank-you");
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

    const row = {
      reference_id: generatedRef,
      source: "start_project_page",
      name: name.trim(),
      email: email.trim(),
      company: company.trim() || null,
      service_tier: selectedObjective,
      budget_range: selectedBudget,
      project_stage: selectedSystemStage,
      target_timeline: selectedTimeline,
      project_brief: composedBrief.slice(0, 5000),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    };
    const normalisedPhone = normalisePhone(phone);
    let { error: insertError } = await supabase
      .schema("console")
      .from("inquiries")
      .insert({ ...row, phone: normalisedPhone, whatsapp_opt_in: whatsappOptIn && normalisedPhone !== null });
    // Until migration 20260929120000_console_inquiry_followup is applied the
    // table has no phone columns (PGRST204/42703). Don't lose the lead over it.
    if (insertError && ["42703", "PGRST204"].includes(insertError.code ?? "")) {
      ({ error: insertError } = await supabase.schema("console").from("inquiries").insert(row));
    }

    if (insertError) {
      setError(
        "We couldn't submit your inquiry — please try again, or email hello@restart.ng directly."
      );
      // A failed write is not a failed lead, but it is worth seeing: if the
      // insert starts failing, this event outpaces generate_lead and the gap
      // is the first visible symptom.
      track("intake_submit_error", { step: step });
      setStatus("idle");
      return;
    }

    // GA4's recommended name for a lead conversion. The fit band is included
    // so lead quality can be segmented in GA4 without exporting anything from
    // the console -- categorical, never personal.
    track(FUNNEL.LEAD, {
      fit_band: fit.band,
      fit_score: fit.score,
      focus_area: selectedObjective,
      budget_tier: budgetOptions.find((b) => b.label === selectedBudget)?.tier ?? "unknown",
      timeline: selectedTimeline,
      referral_source: referral,
    });

    // Close the draft so no reminder goes out for a brief that was sent.
    // Best effort: the notify function also skips drafts whose email has a
    // later inquiry.
    if (draftTokenRef.current) {
      await supabase
        .schema("console")
        .rpc("mark_inquiry_draft_submitted", { p_token: draftTokenRef.current, p_reference_id: generatedRef });
    }
    draftTokenRef.current = null;
    storeToken(null);

    setReferenceId(generatedRef);
    setStatus("success");
    // The reference travels in the URL so the confirmation page survives a
    // reload and can be shared with a colleague.
    navigate(`/thank-you?ref=${encodeURIComponent(generatedRef)}`);
  };

  return (
    <div className="page-shell">
      {/* Header Navigation */}
      <header className="site-header">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <nav className={menuOpen ? "open" : ""}>
          <Link href="/platform" onClick={() => setMenuOpen(false)}>
            <span>PLATFORM</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/solutions" onClick={() => setMenuOpen(false)}>
            <span>SOLUTIONS</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/case-studies" className={location.startsWith("/case-studies") ? "active" : ""} onClick={() => setMenuOpen(false)}>
            <span>PROOF</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/insights" className={location.startsWith("/insights") ? "active" : ""} onClick={() => setMenuOpen(false)}>
            <span>INSIGHTS</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/about" onClick={() => setMenuOpen(false)}>
            <span>ABOUT</span>
            <span className="nav-indicator" />
          </Link>
          <div className="mobile-nav-actions">
            <a href={consoleHref}>{consoleLabel}</a>
            <Link href="/start-project" className="header-cta">Start a Project <ArrowUpRight size={14} /></Link>
          </div>
        </nav>
        <div className="header-actions">
          <a href={consoleHref} className="login-link">{consoleLabel}</a>
          <Link href="/start-project" className="header-cta">Start a Project <ArrowUpRight size={14} /></Link>
          <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <main className="scorecard-main container">
        <header className="scorecard-intro">
          <span className="section-label teal">START A PROJECT</span>
          <h1>Tell us what you're <span>building</span></h1>
          <p>
            A senior engineer reads every brief and replies within one business day.
          </p>
        </header>

        {status === "success" ? (
          <section className="scorecard-result sp-success" aria-labelledby="sp-success-title">
            <div className="scorecard-score">
              <CheckCircle2 size={44} className="text-teal" />
              <div>
                <h2 id="sp-success-title">We've got it.</h2>
                <p>
                  A senior engineer will review your brief and reply with whether there's a fit and the clearest next
                  step. Your reference is <strong className="sp-ref">{referenceId}</strong>.
                </p>
              </div>
            </div>

            <div className="sp-summary">
              <div><small>Focus area</small><strong>{selectedObjective.split(" — ")[0]}</strong></div>
              <div><small>Investment</small><strong>{budgetOptions.find((b) => b.label === selectedBudget)?.tier ?? "—"}</strong></div>
              <div><small>Timing</small><strong>{selectedTimeline}</strong></div>
            </div>

            <h3>What happens next</h3>
            <div className="scorecard-steps sp-next">
              <div><span>Within one business day</span><p>A senior engineer reviews your brief and replies directly.</p></div>
              <div><span>Discovery call</span><p>A focused 30-minute working session to scope boundaries and milestones.</p></div>
              <div><span>Fixed-scope proposal</span><p>Milestones, architecture, and commercial terms in writing.</p></div>
            </div>

            <div className="scorecard-cta">
              <div />
              <div className="scorecard-cta-actions">
                <Link href="/" className="button outline">Back to home</Link>
                <button className="button solid" onClick={() => setStatus("idle")}>Start another brief</button>
              </div>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="scorecard-stepper" noValidate>
            <div className="scorecard-progress" role="status" aria-live="polite">
              <ol className="scorecard-segments" aria-hidden="true">
                {STEPS.map((s) => (
                  <li key={s.id} className={step > s.id ? "done" : step === s.id ? "current" : undefined} />
                ))}
              </ol>
              <span>Step {step} of {STEPS.length}</span>
            </div>

            <section className="scorecard-area" aria-labelledby={`sp-step-${step}`}>
              <h2 id={`sp-step-${step}`} tabIndex={-1} ref={stepHeadingRef}>
                <span>{STEPS[step - 1].kicker}</span>{STEPS[step - 1].title}
              </h2>

              {step === 1 && (
                <>
                  <fieldset className="scorecard-question">
                    <legend>Who should we reply to?</legend>
                    <div className="sp-fields">
                      <label><span>Your name *</span><input type="text" placeholder="e.g. Alex Vance" value={name} onChange={(e) => setName(e.target.value)} className="sp-field" autoComplete="name" /></label>
                      <label><span>Work email *</span><input type="email" placeholder="alex@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="sp-field" autoComplete="email" /></label>
                      <label><span>Company</span><input type="text" placeholder="e.g. Acme Global Logistics" value={company} onChange={(e) => setCompany(e.target.value)} className="sp-field" autoComplete="organization" /></label>
                      <label><span>WhatsApp / Phone no. <em>(optional)</em></span><input type="tel" placeholder="+234 806 000 0000" value={phone} onChange={(e) => { setPhone(e.target.value); if (!e.target.value.trim()) setWhatsappOptIn(false); }} className="sp-field" autoComplete="tel" inputMode="tel" /></label>
                    </div>
                    <label className={`sp-optin${phone.trim() ? "" : " disabled"}`}>
                      <input type="checkbox" checked={whatsappOptIn} disabled={!phone.trim()} onChange={(e) => setWhatsappOptIn(e.target.checked)} />
                      <span>Confirm on WhatsApp too, and let me reply there. Only about this brief. Reply STOP anytime.</span>
                    </label>
                  </fieldset>

                  {/* Honeypot: hidden from people, tempting to bots */}
                  <div className="sp-honeypot" aria-hidden="true">
                    <label htmlFor="sp-company-fax">Company fax number</label>
                    <input id="sp-company-fax" type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <OptionCards legend="What are you trying to accomplish?" name="objective" options={objectives.map((o) => o.label)} value={selectedObjective} onChange={setSelectedObjective} />
                  <OptionCards legend="Which describes the system today?" name="stage" options={systemStages} value={selectedSystemStage} onChange={setSelectedSystemStage} />
                  <OptionCards legend="What's the main constraint right now?" name="constraint" options={constraints} value={selectedConstraint} onChange={setSelectedConstraint} />
                  <fieldset className="scorecard-question">
                    <legend>Describe the workflow, product, or system you want to change.</legend>
                    <textarea
                      rows={6}
                      aria-label="Project brief"
                      placeholder="What does the system do today, who relies on it, and where does the current approach break down? Name the part that's hardest to operate, change, or trust — and what you've already tried."
                      value={projectBrief}
                      onChange={(e) => setProjectBrief(e.target.value)}
                      className="sp-field"
                    />
                    <div className={`sp-meter ${briefReady ? "ok" : ""}`}>
                      <span className="sp-meter-bar">
                        <span className="sp-meter-fill" style={{ width: `${Math.min(100, (briefWords / 90) * 100)}%` }} />
                      </span>
                      <span className="sp-meter-text">
                        {briefReady
                          ? `${briefWords} words — specific enough to assess`
                          : `${projectBrief.trim().length} / ${MIN_BRIEF_CHARS} characters minimum`}
                      </span>
                    </div>
                  </fieldset>
                </>
              )}

              {step === 3 && (
                <>
                  <fieldset className="scorecard-question">
                    <legend>What would a successful engagement change? <em className="sp-legend-note">Select all that apply</em></legend>
                    <div className="scorecard-options">
                      {outcomeOptions.map((opt) => {
                        const on = selectedOutcomes.includes(opt);
                        return (
                          <label key={opt} className={on ? "selected" : undefined}>
                            <input type="checkbox" checked={on} onChange={() => toggleOutcome(opt)} />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="scorecard-question">
                    <legend>If this works, what will be measurably different in 3–12 months?</legend>
                    <input
                      type="text"
                      aria-label="Measurable impact"
                      placeholder="e.g. Zero unplanned downtime during peak volume, 30% lower infrastructure spend"
                      value={impactMetric}
                      onChange={(e) => setImpactMetric(e.target.value)}
                      className="sp-field"
                    />
                  </fieldset>
                  <OptionCards legend="What's the cost of leaving this unresolved?" name="urgency" options={urgencyOptions.map((u) => u.label)} value={selectedUrgency} onChange={setSelectedUrgency} />
                  <OptionCards legend="Who owns this decision?" name="role" options={decisionRoles.map((r) => r.label)} value={selectedRole} onChange={setSelectedRole} />
                </>
              )}

              {step === 4 && (
                <>
                  <OptionCards legend="Desired timing" name="timeline" options={timelineOptions.map((t) => t.label)} value={selectedTimeline} onChange={setSelectedTimeline} />
                  <OptionCards legend="Investment range" name="budget" options={budgetOptions.map((b) => b.label)} value={selectedBudget} onChange={setSelectedBudget} note="Naming a range now saves a round trip — it isn't a commitment." />
                  <fieldset className="scorecard-question">
                    <legend>Website <em className="sp-legend-note">Optional</em></legend>
                    <input type="text" aria-label="Website" placeholder="e.g. acmelogistics.com" value={website} onChange={(e) => setWebsite(e.target.value)} className="sp-field" autoComplete="url" />
                  </fieldset>
                  <OptionCards legend="How did you hear about us?" name="referral" options={referralSources} value={referral} onChange={setReferral} />
                </>
              )}
            </section>

            {notice && (
              <div className="sp-notice" role="status">
                <span>{notice}</span>
                <button type="button" className="sp-notice-action" onClick={startOver}>Start over</button>
              </div>
            )}

            {(stepError || error) && (
              <div className="sp-error" role="alert">{stepError ?? error}</div>
            )}

            <div className="scorecard-nav">
              {step > 1 ? (
                <button type="button" className="button outline" onClick={goBack}>
                  <ArrowLeft size={15} /> Back
                </button>
              ) : <p className="sp-note sp-nav-note">Your brief saves as you go. If you leave before completing it, we'll send you a link back to where you stopped.</p>}
              <div className="scorecard-nav-next">
                <button
                  type={step < LAST_STEP ? "button" : "submit"}
                  onClick={step < LAST_STEP ? goNext : undefined}
                  disabled={status === "submitting"}
                  className="button solid"
                >
                  {status === "submitting" ? (
                    <><Loader2 size={15} className="animate-spin" /> Sending…</>
                  ) : step < LAST_STEP ? (
                    <>Next: {STEPS[step].title} <ArrowRight size={15} /></>
                  ) : (
                    <>Send project brief <ArrowUpRight size={15} /></>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
