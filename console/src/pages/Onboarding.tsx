import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Check, Globe, Loader2, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { consoleSchema } from "@/lib/supabase";
import { MARKETING_URL } from "@/lib/site";
import { BUDGETS, ENGAGEMENTS, TIMELINES } from "@/lib/intakeOptions";
import AuthBackdrop from "@/components/AuthBackdrop";

// Option ids here must match the checks in console.complete_onboarding()
// (20260923120000_console_self_onboarding.sql) -- the function rejects
// anything else, and derives the qualification tier from them server-side.

const ROLES = ["Founder or owner", "Operations or business lead", "Product lead", "Engineering lead", "Consultant or advisor"];

const CLIENT_TYPES = [
  { id: "startup", label: "Startup", hint: "Building or scaling a product" },
  { id: "sme", label: "Established business", hint: "Operating today, with customers and staff" },
  { id: "enterprise", label: "Enterprise or institution", hint: "Multiple teams, procurement, compliance" },
  { id: "agency", label: "Agency or consultancy", hint: "Delivering for your own clients" },
  { id: "individual", label: "Independent operator", hint: "Solo founder or creator" }
];

type StepId = "you" | "org" | "need" | "fit";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const { needsOnboarding, workspaces, isAdmin, refresh } = useWorkspace();

  // Google/GitHub hand over a real name; getDisplayName()'s email-prefix
  // fallback isn't one, so only prefill from the provider metadata.
  const [fullName, setFullName] = useState(
    () => ((user?.user_metadata?.full_name || user?.user_metadata?.name) as string | undefined) ?? ""
  );
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [clientType, setClientType] = useState("");
  const [engagement, setEngagement] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Someone who already has a workspace (or an admin) has nothing to do here.
  useEffect(() => {
    if (!needsOnboarding && (workspaces.length > 0 || isAdmin)) {
      setLocation("/overview");
    }
  }, [needsOnboarding, workspaces.length, isAdmin, setLocation]);

  // "Just looking around" skips the fit questions -- there's no project to
  // size yet, and asking for a budget there would be noise.
  const steps: StepId[] = useMemo(
    () => (engagement === "exploring" ? ["you", "org", "need"] : ["you", "org", "need", "fit"]),
    [engagement]
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;

  const canContinue =
    step === "you"
      ? fullName.trim().length > 0 && role !== ""
      : step === "org"
        ? company.trim().length > 0 && clientType !== ""
        : step === "need"
          ? engagement !== ""
          : timeline !== "" && budget !== "";

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const isExploring = engagement === "exploring";
    const { error: rpcError } = await consoleSchema().rpc("complete_onboarding", {
      p_full_name: fullName.trim(),
      p_role: role,
      p_company: company.trim(),
      p_website: website.trim() || null,
      p_client_type: clientType,
      p_engagement_type: engagement,
      p_timeline: isExploring ? null : timeline,
      p_budget: isExploring ? null : budget
    });
    if (rpcError) {
      setError(rpcError.message || "We couldn't create your workspace. Please try again.");
      setSubmitting(false);
      return;
    }
    await refresh();
    setLocation("/overview");
  };

  const next = () => {
    if (!canContinue || submitting) return;
    if (isLast) {
      submit();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  const renderOptions = (
    options: Array<{ id: string; label: string; hint?: string }>,
    selected: string,
    onSelect: (id: string) => void,
    compact = false
  ) => (
    <div className={`onboard-options ${compact ? "compact" : ""}`}>
      {options.map((opt) => (
        <button
          type="button"
          key={opt.id}
          className={`onboard-option ${selected === opt.id ? "selected" : ""}`}
          onClick={() => onSelect(opt.id)}
          aria-pressed={selected === opt.id}
        >
          <span className="onboard-option-text">
            <span className="onboard-option-label">{opt.label}</span>
            {opt.hint && <span className="onboard-option-hint">{opt.hint}</span>}
          </span>
          <span className="onboard-option-check">{selected === opt.id && <Check size={12} />}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="simple-login-shell">
      <AuthBackdrop />
      <header className="simple-login-topbar">
        <a href={MARKETING_URL} className="site-logo" aria-label="Restart home">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </a>
        <button type="button" onClick={handleSignOut} className="squeeze-back-link onboard-signout">
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <div className="simple-login-page">
        <div className="simple-login-card onboard-card">
          <div className="onboard-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s} className={`onboard-progress-seg ${i <= stepIndex ? "done" : ""}`} />
            ))}
          </div>
          <span className="onboard-step-count">
            STEP {stepIndex + 1} OF {steps.length}
          </span>

          {error && (
            <div className="login-error-banner">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            {step === "you" && (
              <>
                <h1>Set up your workspace</h1>
                <p className="simple-login-subtitle">A few short questions. Your answers shape what we propose.</p>
                <div className="simple-field-group">
                  <label htmlFor="onboard-name">Your name</label>
                  <div className="simple-input-wrap">
                    <User size={15} className="simple-input-icon" />
                    <input
                      id="onboard-name"
                      className="simple-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={200}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div className="simple-field-group onboard-field-gap">
                  <label>Your role</label>
                  {renderOptions(ROLES.map((r) => ({ id: r, label: r })), role, setRole, true)}
                </div>
              </>
            )}

            {step === "org" && (
              <>
                <h1>Your organization</h1>
                <p className="simple-login-subtitle">This becomes your workspace name.</p>
                <div className="simple-field-group">
                  <label htmlFor="onboard-company">Organization name</label>
                  <div className="simple-input-wrap">
                    <Building2 size={15} className="simple-input-icon" />
                    <input
                      id="onboard-company"
                      className="simple-input"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      maxLength={200}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div className="simple-field-group onboard-field-gap">
                  <label htmlFor="onboard-website">Website (optional)</label>
                  <div className="simple-input-wrap">
                    <Globe size={15} className="simple-input-icon" />
                    <input
                      id="onboard-website"
                      className="simple-input"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="company.com"
                      maxLength={300}
                    />
                  </div>
                </div>
                <div className="simple-field-group onboard-field-gap">
                  <label>Which describes you best?</label>
                  {renderOptions(CLIENT_TYPES, clientType, setClientType)}
                </div>
              </>
            )}

            {step === "need" && (
              <>
                <h1>What brings you to Restart?</h1>
                <p className="simple-login-subtitle">Pick the closest fit. You can change direction later.</p>
                {renderOptions(ENGAGEMENTS, engagement, setEngagement)}
              </>
            )}

            {step === "fit" && (
              <>
                <h1>Timing and budget</h1>
                <p className="simple-login-subtitle">So the first conversation starts at the right scope.</p>
                <div className="simple-field-group">
                  <label>When do you want to start?</label>
                  {renderOptions(TIMELINES, timeline, setTimeline, true)}
                </div>
                <div className="simple-field-group onboard-field-gap">
                  <label>Budget range</label>
                  {renderOptions(BUDGETS, budget, setBudget, true)}
                </div>
              </>
            )}

            <div className="onboard-actions">
              {stepIndex > 0 && (
                <button
                  type="button"
                  className="onboard-back-btn"
                  onClick={() => setStepIndex((i) => i - 1)}
                  disabled={submitting}
                >
                  <ArrowLeft size={14} /> Back
                </button>
              )}
              <button type="submit" className="simple-submit-btn onboard-next-btn" disabled={!canContinue || submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Creating workspace…
                  </>
                ) : isLast ? (
                  <>
                    Create workspace <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="onboard-signed-in-as">Signed in as {user?.email}</p>
        </div>
      </div>
    </div>
  );
}
