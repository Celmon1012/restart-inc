import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, History, LayoutGrid, Loader2, Server, Terminal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { consoleSchema } from "@/lib/supabase";
import { getDisplayName } from "@/lib/utils";
import { BUDGETS, ENGAGEMENTS, TIMELINES } from "@/lib/intakeOptions";

/* ------------------------------------------------------------------
 * "Add new project" for a signed-in member. Split layout: a short form
 * on the left and, on the right, a live preview of the console with the
 * new project's name in the workspace switcher. Creates the workspace
 * through console.create_project() (20260925130000 migration), then
 * switches to it.
 * ------------------------------------------------------------------ */

type Step = "name" | "need" | "fit";
const STEPS: Step[] = ["name", "need", "fit"];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { refresh, setActiveWorkspaceId } = useWorkspace();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  // ?engagement= preselects the need step (e.g. the sidebar's AI promo);
  // only known ids are taken, so a stale or hand-edited link just starts blank.
  const [engagement, setEngagement] = useState(() => {
    const preset = new URLSearchParams(window.location.search).get("engagement") ?? "";
    return ENGAGEMENTS.some((e) => e.id === preset) ? preset : "";
  });
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const nameValid = trimmed.length >= 2 && trimmed.length <= 80;
  const index = STEPS.indexOf(step);
  const exploring = engagement === "exploring";

  const back = () => {
    setError(null);
    if (index === 0) setLocation("/console/overview");
    else setStep(STEPS[index - 1]);
  };

  const create = async () => {
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await consoleSchema().rpc("create_project", {
      p_name: trimmed,
      p_engagement_type: engagement,
      p_timeline: exploring ? null : timeline || null,
      p_budget: exploring ? null : budget || null,
      p_brief: brief.trim() || null,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(
        rpcError.code === "PGRST202"
          ? "Creating projects from the console isn't switched on yet. Contact support and we'll set it up."
          : /failed to fetch|network/i.test(rpcError.message ?? "")
            ? "We couldn't reach the server. Check your connection and try again."
            : rpcError.message || "We couldn't create the project. Please try again."
      );
      return;
    }
    await refresh();
    if (typeof data === "string") setActiveWorkspaceId(data);
    setLocation("/console/overview");
  };

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "name" && nameValid) setStep("need");
    else if (step === "need" && engagement) exploring ? void create() : setStep("fit");
    else if (step === "fit") void create();
  };

  const option = (
    opts: { id: string; label: string; hint?: string }[],
    selected: string,
    onPick: (id: string) => void,
    label: string
  ) => (
    <div className="np-options" role="radiogroup" aria-label={label}>
      {opts.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={selected === o.id}
          key={o.id}
          className={`np-option ${selected === o.id ? "selected" : ""}`}
          onClick={() => onPick(o.id)}
        >
          <span>{o.label}</span>
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );

  const canContinue = step === "name" ? nameValid : step === "need" ? Boolean(engagement) : true;
  const lastStep = step === "fit" || (step === "need" && exploring);

  return (
    <div className="np-shell">
      <div className="np-left">
        <form className="np-form" data-step={step} onSubmit={next} noValidate>
          <img src="/brand/restart-mark.png" alt="" className="np-mark" />
          <div className="np-dots" aria-label={`Step ${index + 1} of ${exploring ? 2 : 3}`}>
            {STEPS.slice(0, exploring ? 2 : 3).map((s, i) => <i key={s} className={i <= index ? "on" : undefined} />)}
          </div>

          {step === "name" && (
            <>
              <h1>Name your project</h1>
              <p>Choose a name for your new project</p>
              <label className="np-label" htmlFor="np-name">Project name</label>
              <input
                id="np-name"
                className="np-input"
                autoFocus
                maxLength={80}
                placeholder="e.g. Customer portal"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {nameValid && (
                <div className="np-hint">
                  <CheckCircle2 size={15} />
                  <span>Your workspace will appear as <b>{trimmed}</b></span>
                </div>
              )}
            </>
          )}

          {step === "need" && (
            <>
              <h1>What does this project need?</h1>
              <p>Pick the closest fit. A senior engineer reviews it before anything is provisioned.</p>
              {option(ENGAGEMENTS, engagement, setEngagement, "Engagement type")}
            </>
          )}

          {step === "fit" && (
            <>
              <h1>Timing and scope</h1>
              <p>Optional, but it helps us come back with the right proposal.</p>
              <span className="np-label">Timing</span>
              {option(TIMELINES, timeline, setTimeline, "Timing")}
              <span className="np-label">Budget</span>
              {option(BUDGETS, budget, setBudget, "Budget")}
              <label className="np-label" htmlFor="np-brief">Anything we should know? <em>(optional)</em></label>
              <textarea
                id="np-brief"
                className="np-input np-textarea"
                maxLength={2000}
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </>
          )}

          {error && (
            <div className="np-error" role="alert"><AlertCircle size={15} /><span>{error}</span></div>
          )}

          <button type="submit" className="np-primary" disabled={!canContinue || submitting}>
            {submitting ? <><Loader2 size={15} className="spin" /> Creating…</> : lastStep ? "Create project" : "Continue"}
          </button>
          <button type="button" className="np-back" onClick={back} disabled={submitting}>
            {index === 0 ? <><ArrowLeft size={14} /> Back to console</> : "Back"}
          </button>
        </form>
      </div>

      <div className="np-right" aria-hidden="true">
        <div className="np-preview">
          <aside className="np-preview-side">
            <div className="np-preview-ws">
              <span className="np-preview-avatar">{(trimmed || "N").charAt(0).toUpperCase()}</span>
              <span className={trimmed ? "np-preview-name" : "np-preview-name placeholder"}>{trimmed || "Your project"}</span>
            </div>
            {[LayoutGrid, Server, Clock, Terminal, History].map((Icon, i) => (
              <div key={i} className="np-preview-row"><Icon size={14} /><i style={{ width: [64, 88, 72, 80, 60][i] }} /></div>
            ))}
          </aside>
          <div className="np-preview-main">
            <span className="np-preview-hello">Hello, {getDisplayName(user)}</span>
            <div className="np-preview-bars"><i /><i /></div>
            <div className="np-preview-block" />
            <div className="np-preview-block tall" />
          </div>
        </div>
      </div>
    </div>
  );
}
