import { openCookieSettings } from "@/lib/consent";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL, normalisePhone, whatsappLink } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Loader2, Menu, MessageCircle, RotateCcw, X } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { SCORE_AREAS, bandFor } from "@/data/scorecard";

export default function Scorecard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const started = useRef(false);

  useEffect(() => {
    applyPageSeo({
      title: "Readiness Scorecard",
      description: "Score your system in five minutes across observability, deployment safety, data recovery, security, architecture, and ownership, with the first concrete fix for your weakest areas.",
      path: "/scorecard",
    });
    return () => resetSeoToDefault();
  }, []);

  const [step, setStep] = useState(0);
  const stepperRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const area = SCORE_AREAS[step];
  const isLast = step === SCORE_AREAS.length - 1;
  const stepComplete = area.questions.every((q) => answers[q.id] !== undefined);

  const goTo = (next: number) => {
    setStep(next);
    track("scorecard_step", { step: next + 1, area: SCORE_AREAS[next].id });
  };

  // After a step change (not on first load), move keyboard/screen-reader focus
  // to the new step's heading and bring the stepper back into view, since the
  // content above it doesn't change.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const top = (stepperRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 96;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const result = useMemo(() => {
    const areas = SCORE_AREAS.map((a) => {
      const got = a.questions.reduce((n, q) => n + (answers[q.id] ?? 0), 0);
      return { area: a, pct: Math.round((got / (a.questions.length * 3)) * 100) };
    });
    const total = Math.round(areas.reduce((n, a) => n + a.pct, 0) / areas.length);
    const weakest = [...areas].sort((x, y) => x.pct - y.pct).slice(0, 2);
    return { areas, total, weakest, band: bandFor(total) };
  }, [answers]);

  const answer = (qid: string, score: number) => {
    if (!started.current) {
      started.current = true;
      track("scorecard_start");
    }
    setAnswers((prev) => ({ ...prev, [qid]: score }));
  };

  const reveal = () => {
    setShowResult(true);
    track("scorecard_complete", { score: result.total, band: result.band.label, weakest: result.weakest.map((w) => w.area.id).join(",") });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const reset = () => {
    setAnswers({});
    setShowResult(false);
    setStep(0);
    started.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [lead, setLead] = useState<{ status: "idle" | "sending" | "sent" | "error"; reference?: string; message?: string }>({ status: "idle" });

  const sendResult = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalisedPhone = normalisePhone(phone);
    if (phone.trim() && !normalisedPhone) {
      setLead({ status: "error", message: "That phone number doesn't look right. Include the country code, e.g. +234 806 000 0000." });
      return;
    }
    if (!isSupabaseConfigured) {
      setLead({ status: "error", message: "Sending isn't configured on this deployment. Please email hello@restart.ng." });
      return;
    }
    setLead({ status: "sending" });
    const reference = `RST-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;
    const brief = [
      `Readiness Scorecard: ${result.total}/100 (${result.band.label}).`,
      ...result.areas.map(({ area, pct }) => `- ${area.title}: ${pct}%`),
      `Weakest: ${result.weakest.map((w) => w.area.title).join(", ")}.`,
    ].join("\n");
    const base = {
      reference_id: reference,
      name: name.trim(),
      email: email.trim(),
      company: company.trim() || null,
      project_brief: brief,
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
    };
    const scorecard = {
      score: result.total,
      band: result.band.label,
      areas: Object.fromEntries(result.areas.map(({ area, pct }) => [area.id, pct])),
      weakest: result.weakest.map((w) => w.area.id),
      // Carried so the acknowledgement email can repeat the first fix for
      // each weak area without the server needing its own copy of the text.
      weakest_detail: result.weakest.map(({ area, pct }) => ({ title: area.title, pct, fix: area.nextStep })),
    };
    const contact = { phone: normalisedPhone, whatsapp_opt_in: whatsappOptIn && normalisedPhone !== null };

    let { error } = await supabase.schema("console").from("inquiries").insert({ ...base, ...contact, source: "scorecard", scorecard });
    // Before migration 20260929120000 there are no phone columns.
    if (error && ["42703", "PGRST204"].includes(error.code ?? "")) {
      ({ error } = await supabase.schema("console").from("inquiries").insert({ ...base, source: "scorecard", scorecard }));
    }
    // Until migration 20260925120000_console_inquiries_scorecard is applied the
    // table rejects source "scorecard" (23514) and has no scorecard column
    // (PGRST204/42703). Don't lose the lead over that: file it as a contact
    // inquiry; the brief already carries the full result.
    if (error && ["23514", "42703", "PGRST204"].includes(error.code ?? "")) {
      ({ error } = await supabase.schema("console").from("inquiries").insert({ ...base, source: "contact_page", project_brief: `[Scorecard] ${brief}` }));
    }
    if (error) {
      setLead({ status: "error", message: "We couldn't send that. Please try again, or email hello@restart.ng." });
      return;
    }
    track("scorecard_lead", { score: result.total });
    setLead({ status: "sent", reference });
  };

  const reviewHref = `/start-project?scorecard=${encodeURIComponent(
    `${result.total}|${result.weakest.map((w) => w.area.title).join(", ")}`
  )}`;

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
          <span className="section-label teal">FREE ASSESSMENT · 5 MINUTES</span>
          <h1>Readiness <span>Scorecard</span></h1>
          <p>
            Six short steps, two questions each, across the areas where systems usually fail in production. You get a score, the two
            areas carrying the most risk, and the first concrete fix for each. No email required.
          </p>
        </header>

        {!showResult && (
          <div className="scorecard-stepper" ref={stepperRef}>
            <div className="scorecard-progress" role="status" aria-live="polite">
              <ol className="scorecard-segments" aria-hidden="true">
                {SCORE_AREAS.map((a, i) => (
                  <li key={a.id} className={i < step ? "done" : i === step ? "current" : undefined} />
                ))}
              </ol>
              <span>Step {step + 1} of {SCORE_AREAS.length}</span>
            </div>

            <section key={area.id} className="scorecard-area" aria-labelledby={`area-${area.id}`}>
              <h2 id={`area-${area.id}`} tabIndex={-1} ref={headingRef}>
                <span>{String(step + 1).padStart(2, "0")}</span>{area.title}
              </h2>
              {area.questions.map((q) => (
                <fieldset key={q.id} className="scorecard-question">
                  <legend>{q.prompt}</legend>
                  <div className="scorecard-options">
                    {q.options.map((o) => (
                      <label key={o.label} className={answers[q.id] === o.score ? "selected" : undefined}>
                        <input type="radio" name={q.id} checked={answers[q.id] === o.score} onChange={() => answer(q.id, o.score)} />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </section>

            <div className="scorecard-nav">
              {step > 0 ? (
                <button type="button" className="button outline" onClick={() => goTo(step - 1)}>
                  <ArrowLeft size={15} /> Back
                </button>
              ) : <span />}
              <div className="scorecard-nav-next">
                {!stepComplete && <span>Answer both questions to continue.</span>}
                {isLast ? (
                  <button type="button" className="button solid" disabled={!stepComplete} onClick={reveal}>
                    See my score <ArrowRight size={15} />
                  </button>
                ) : (
                  <button type="button" className="button solid" disabled={!stepComplete} onClick={() => goTo(step + 1)}>
                    Next: {SCORE_AREAS[step + 1].title} <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {showResult && (
          <section ref={resultRef} className="scorecard-result" aria-labelledby="scorecard-result-title">
            <div className="scorecard-score">
              <strong>{result.total}<small>/100</small></strong>
              <div>
                <h2 id="scorecard-result-title">{result.band.label}</h2>
                <p>{result.band.summary}</p>
              </div>
            </div>

            <div className="scorecard-areas">
              {result.areas.map(({ area, pct }) => (
                <div key={area.id} className="scorecard-area-bar">
                  <span>{area.title}</span>
                  <div><i className={pct < 50 ? "low" : pct < 75 ? "mid" : undefined} style={{ width: `${Math.max(pct, 3)}%` }} /></div>
                  <em>{pct}%</em>
                </div>
              ))}
            </div>

            <h3>Where to start</h3>
            <div className="scorecard-steps">
              {result.weakest.map(({ area, pct }) => (
                <div key={area.id}>
                  <span>{area.title} · {pct}%</span>
                  <p>{area.nextStep}</p>
                </div>
              ))}
            </div>

            <div className="scorecard-cta">
              <div>
                <h3>Want a second pair of eyes on it?</h3>
                <p>Send your result to a senior engineer. We'll reply with what we'd fix first and whether we're the right people to do it.</p>
              </div>
              <button type="button" className="button outline" onClick={reset}><RotateCcw size={14} /> Retake</button>
            </div>

            {lead.status === "sent" ? (
              <div className="scorecard-sent" role="status">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Result sent. Reference {lead.reference}.</strong>
                  <p>A senior engineer will review it and reply to {email}. We'll also email you a copy of your result.</p>
                  <a
                    className="button outline small sp-whatsapp"
                    href={whatsappLink(`Hi Restart, I just took the Readiness Scorecard (${lead.reference}, ${result.total}/100).`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("scorecard_whatsapp_click", { score: result.total })}
                  >
                    <MessageCircle size={15} /> Talk it through on WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <form className="scorecard-form" onSubmit={sendResult}>
                <label>
                  <span>Name</span>
                  <input required maxLength={200} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                  <span>Work email</span>
                  <input required type="email" maxLength={320} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  <span>Company <em>(optional)</em></span>
                  <input maxLength={200} autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
                </label>
                <label>
                  <span>Phone <em>(optional)</em></span>
                  <input type="tel" inputMode="tel" maxLength={24} autoComplete="tel" placeholder="+234 806 000 0000" value={phone} onChange={(e) => { setPhone(e.target.value); if (!e.target.value.trim()) setWhatsappOptIn(false); }} />
                </label>
                <label className={`sp-optin${phone.trim() ? "" : " disabled"}`}>
                  <input type="checkbox" checked={whatsappOptIn} disabled={!phone.trim()} onChange={(e) => setWhatsappOptIn(e.target.checked)} />
                  <span>You can also reply to me on WhatsApp at this number. A person replies, only about this result.</span>
                </label>
                <div className="scorecard-form-actions">
                  <button type="submit" className="button solid" disabled={lead.status === "sending"}>
                    {lead.status === "sending" ? <><Loader2 size={15} className="spin" /> Sending…</> : <>Send my results <ArrowUpRight size={15} /></>}
                  </button>
                  <Link href={reviewHref} className="scorecard-alt" onClick={() => track("scorecard_review_click", { score: result.total })}>
                    Or start a full project brief <ArrowRight size={13} />
                  </Link>
                </div>
                {lead.status === "error" && <p className="scorecard-error" role="alert">{lead.message}</p>}
                <p className="scorecard-fineprint">We use this only to reply about your result. <Link href="/privacy">Privacy Policy</Link></p>
              </form>
            )}
          </section>
        )}
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
