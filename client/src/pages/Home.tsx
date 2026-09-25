// Design: Preserve Restart's midnight engineering theme, teal signal color, compact nav, and technical editorial tone from the supplied reference.
// This homepage intentionally avoids fabricated testimonials; proof is expressed through operating principles, delivery systems, and concrete service scope.
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, BrainCircuit, CalendarDays, Check, ChevronDown, ChevronRight, CircleCheck, Code2, Cpu, Database, Gauge, Layers3, Menu, Network, Orbit, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import CaseStudyModal from "@/components/CaseStudyModal";
import { caseStudiesData, CaseStudy } from "@/data/caseStudies";
import NamedClients from "@/components/NamedClients";
import { useInsights } from "@/hooks/useInsights";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

const stackLogos: Record<string, string> = {
  "Laravel": "/logos/stacks/laravel.svg",
  "PostgreSQL": "/logos/stacks/postgresql.svg",
  "Filament": "/logos/stacks/filament.svg",
  "Medusa": "/logos/stacks/medusa.svg",
  "Next.js": "/logos/stacks/nextdotjs.svg",
  "Claude API": "/logos/stacks/anthropic.svg",
  "Supabase": "/logos/stacks/supabase.svg",
  "n8n": "/logos/stacks/n8n.svg",
  "Chatwoot": "/logos/stacks/chatwoot.svg",
  "Lago": "/logos/stacks/lago.svg",
  "WhatsApp": "/logos/stacks/whatsapp.svg",
};

/**
 * The technology row on the platform section. Every entry is a real platform we
 * deploy on, with the asset it ships with — not a decorative logo strip.
 */
const platformStack: { name: string; logo: string }[] = [
  { name: "Laravel", logo: "/logos/stacks/laravel.svg" },
  { name: "PostgreSQL", logo: "/logos/stacks/postgresql.svg" },
  { name: "Next.js", logo: "/logos/stacks/nextdotjs.svg" },
  { name: "Supabase", logo: "/logos/stacks/supabase.svg" },
  { name: "Medusa", logo: "/logos/stacks/medusa.svg" },
  { name: "Filament", logo: "/logos/stacks/filament.svg" },
  { name: "Claude API", logo: "/logos/stacks/anthropic.svg" },
  { name: "n8n", logo: "/logos/stacks/n8n.svg" },
  { name: "Chatwoot", logo: "/logos/stacks/chatwoot.svg" },
  { name: "Lago", logo: "/logos/stacks/lago.svg" },
  { name: "WhatsApp Business", logo: "/logos/stacks/whatsapp.svg" },
  { name: "PaperclipAI", logo: "/logos/stacks/paperclipai.svg" },
];

const lanes = [
  { number: "01", slug: "saas-platforms", title: "Build a platform your team can operate.", accent: "teal", icon: Code2, text: "Multi-tenant B2B platforms designed around clear boundaries, resilient jobs, secure access, observable workflows, and the operational detail that makes production sustainable.", tags: ["Laravel", "PostgreSQL", "Supabase", "Filament", "Horizon", "Lago"], action: "Explore SaaS builds" },
  { number: "02", slug: "commerce", title: "Make commerce operations work harder.", accent: "blue", icon: Layers3, text: "Custom commerce platforms built on Medusa — admin workflows, billing, protected data, resilient webhooks, and the realities of high-volume commerce.", tags: ["Medusa", "Next.js", "PostgreSQL", "n8n", "Chatwoot", "WhatsApp"], action: "Explore commerce builds" },
  { number: "03", slug: "ai-engineering", title: "Put AI where it can earn trust.", accent: "violet", icon: BrainCircuit, text: "We turn models, retrieval, tools, and agents into useful product capabilities — with evaluation, observability, and cost controls built in from the start.", tags: ["Claude API", "MCP", "Supabase", "pgvector", "PaperclipAI"], action: "Explore AI engineering" },
  { number: "04", slug: "architecture-leadership", title: "Bring experience to the decisions that matter.", accent: "amber", icon: Network, text: "Architecture reviews, fractional technical leadership, hiring support, and hands-on mentorship for teams that need a clearer path from complexity to execution.", tags: ["Architecture reviews", "Domain modeling", "Testing strategy", "Technical leadership", "Mentorship"], action: "Talk to an engineer" },
];

const offers = [
  { kicker: "MVP BUILD", duration: "4–12 Weeks", title: "From a sharp idea to a system that can ship.", text: "A focused build path for founders and operators who need the right boundaries, architecture, and production foundation before momentum turns into rework.", tags: ["Architecture and schema design", "Authentication, roles, permissions, and tenancy", "Billing through Stripe or Paddle", "CI/CD and zero-downtime deployment", "Observability and production handoff"], visual: "code", cta: "Start an MVP build" },
  { kicker: "AI INTEGRATION SPRINT", duration: "2–4 Weeks", title: "Add AI your customers can rely on.", text: "A focused sprint to turn a promising AI concept into a useful, observable product feature — with evaluation, tool use, retrieval, and cost controls included.", tags: ["Claude or OpenAI API integration", "MCP server and tool-use implementation", "Hybrid retrieval with pgvector", "Evaluation harness and regression checks", "Cost and latency guardrails"], visual: "calendar", cta: "Scope an AI sprint" },
  { kicker: "MEDUSA COMMERCE BUILD", duration: "Scoped build", title: "Build commerce infrastructure that earns its keep.", text: "Custom storefronts and admin workflows built on Medusa — billing, APIs, webhooks, protected data, and the operating constraints of serious commerce teams.", tags: ["Custom admin workflows", "Billing, dunning, and analytics", "Catalog, order, and customer APIs", "Idempotent webhook processing", "Protected customer data review"], visual: "shopify", cta: "Scope a commerce build" },
  { kicker: "ARCHITECTURE AUDIT", duration: "1 Week", title: "Find the constraint before you scale into it.", text: "A senior review of your code, schema, infrastructure, deployment model, cost curve, and technical risk — followed by a practical plan for what to do next.", tags: ["One-week technical deep dive", "Risk, cost, and reliability report", "Prioritized 12-week remediation plan", "Optional pair-programming follow-up"], visual: "gauge", cta: "Book an architecture audit" },
];

const faqs = [
  ["Are you available right now?", "We work with a limited number of active engagements so senior technical ownership remains real. Send us what you are building and the constraint you are facing; we will tell you quickly whether the timing and fit make sense."],
  ["What should the first email actually say?", "Send the short version: what you are building, what is not working, where the risk sits, and what decision you need to make next. A rough outline is enough."],
  ["What happens after I book the intro call?", "We review the context before the call, use the conversation to clarify the system and the constraint, then recommend the smallest useful next step — whether that is a build, sprint, audit, or no engagement yet."],
  ["Will you take an equity-only project?", "Our default model is paid, scoped delivery. If there is a strong strategic fit, we can discuss alternatives, but we do not use equity-only work as the standard engagement model."],
  ["Can I see code samples?", "We can share relevant examples, architecture patterns, delivery files, and case-study detail where confidentiality allows. The most useful proof is usually how the system performs under its real constraints."],
  ["What about rates, contracts, and time zones?", "We scope work around a defined outcome, timeline, and delivery model before starting. We will make the commercial structure and working cadence clear during the first conversation."],
];

function LogoMark() {
  return <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />;
}

function SectionLabel({ children, tone = "teal" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`section-label ${tone}`}>{children}</span>;
}

function Visual({ kind }: { kind: string }) {
  if (kind === "calendar") return <div className="visual-calendar"><div className="calendar-head"><CalendarDays size={15} /><span>SPRINT PLAN</span></div><div className="calendar-days">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={`${d}${i}`}>{d}</span>)}</div><div className="calendar-row"><i /><i /><i className="active" /><i className="active" /><i className="active" /><i /><i /></div><div className="calendar-row short"><i /><i className="active" /><i className="active" /><i className="active" /><i /><i /><i /></div><div className="calendar-row"><i /><i /><i /><i className="active" /><i className="active" /><i /><i /></div></div>;
  if (kind === "gauge") return <div className="visual-gauge"><div className="gauge-arc"><span>80%</span></div><p>Confidence after a senior review</p></div>;
  if (kind === "shopify") return <div className="visual-shopify"><div className="shopify-orb"><span>×</span></div><div className="shopify-ring ring-one" /><div className="shopify-ring ring-two" /><small>COMMERCE SURFACE</small></div>;
  return <div className="visual-code"><div className="code-tabs"><span>server.ts</span><span>deploy</span><span>✓</span></div><code><i>01</i><b>const</b> tenant = <em>await</em> app.<u>boot</u>();<br /><i>02</i><b>await</b> queue.<u>dispatch</u>(job);<br /><i>03</i><b>return</b> response.<u>ready</u>();<br /><i>04</i><b>health</b>.<u>check</u>({`{`} uptime: <strong>99.99</strong> {`}`});</code></div>;
}

function SignalPanel() {
  return <div className="signal-panel" aria-label="Restart operating signal">
    <div className="signal-panel-top"><span className="signal-status"><i /> LIVE OPERATING SIGNAL</span><span>R/ 01</span></div>
    <div className="signal-orbit"><div className="signal-orbit-ring ring-outer" /><div className="signal-orbit-ring ring-inner" /><div className="signal-orbit-core"><span>R</span><small>READY</small></div><span className="orbit-label label-top">SCOPE</span><span className="orbit-label label-right">SHIP</span><span className="orbit-label label-bottom">SCALE</span></div>
    <div className="signal-readout"><div><small>UPTIME TARGET</small><strong>99.99<span>%</span></strong></div><div><small>DELIVERY LANES</small><strong>04</strong></div><div><small>MODE</small><strong>Senior<span>+</span></strong></div></div>
    <div className="signal-footer"><span>Architecture → Execution</span><span><i /> System ready</span></div>
  </div>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState("top");
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null);
  const [, setLocation] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";
  const { insights } = useInsights();

  useEffect(() => {
    applyPageSeo({
      title: "Restart Inc.",
      description: "Restart Inc. is a technology and engineering firm that helps ambitious builders and operators turn complex workflows and product ideas into reliable, scalable systems.",
      path: "/",
    });
    return () => resetSeoToDefault();
  }, []);

  const openOnboarding = (lane?: string) => {
    setLocation(lane ? `/start-project?tier=${encodeURIComponent(lane)}` : "/start-project");
  };

  // Smooth scroll handler with offset for sticky header
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (target) {
      const headerOffset = 76;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // Scrollspy observer for active section indicator
  useEffect(() => {
    const sectionIds = ["top", "platform", "solutions", "work", "case-studies", "about", "insights", "faq", "contact"];
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <div className="restart-home">
    <CaseStudyModal
      isOpen={!!selectedCaseStudy}
      onClose={() => setSelectedCaseStudy(null)}
      caseStudy={selectedCaseStudy}
      onDiscuss={(title) => {
        setSelectedCaseStudy(null);
        openOnboarding(title);
      }}
    />

    <header className="site-header">
      <a className="site-logo" href="#top" onClick={(e) => handleScrollTo(e, "top")} aria-label="Restart home">
        <LogoMark />
      </a>
      <nav className={menuOpen ? "open" : ""}>
        <a href="#platform" className={activeSection === "platform" ? "active" : ""} onClick={(e) => handleScrollTo(e, "platform")}>
          <span>PLATFORM</span>
          <span className="nav-indicator" />
        </a>
        <a href="#solutions" className={activeSection === "solutions" ? "active" : ""} onClick={(e) => handleScrollTo(e, "solutions")}>
          <span>SOLUTIONS</span>
          <span className="nav-indicator" />
        </a>
        <a href="#work" className={activeSection === "work" ? "active" : ""} onClick={(e) => handleScrollTo(e, "work")}>
          <span>WAYS TO ENGAGE</span>
          <span className="nav-indicator" />
        </a>
        <a href="#case-studies" className={activeSection === "case-studies" ? "active" : ""} onClick={(e) => handleScrollTo(e, "case-studies")}>
          <span>PROOF</span>
          <span className="nav-indicator" />
        </a>
        <a href="#insights" className={activeSection === "insights" ? "active" : ""} onClick={(e) => handleScrollTo(e, "insights")}>
          <span>INSIGHTS</span>
          <span className="nav-indicator" />
        </a>
        <Link href="/about">
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

    <main id="top">
      <section className="hero-section">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <div className="hero-grid-lines" />
        <div className="hero-shell">
          <div className="hero-content">
            <h1>Build systems <span>your growth depends on.</span></h1>
            <p>Restart Inc. is a technology and engineering firm that helps ambitious builders and operators turn complex workflows and product ideas into reliable, scalable systems—with senior technical ownership from architecture through production.</p>
            <div className="hero-buttons">
              <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
              <a className="button outline" href="#process" onClick={(e) => handleScrollTo(e, "process")}>See how we build <ChevronRight size={15} /></a>
            </div>
            <div className="hero-proof-row">
              <span><Check size={13} /> Senior technical ownership</span>
              <span><Check size={13} /> Production-ready delivery</span>
              <span><Check size={13} /> Clear, time-boxed scope</span>
            </div>
          </div>
          <SignalPanel />
        </div>
      </section>

      <div id="platform" />

      <section className="lanes-section container" id="solutions">
        <div className="section-intro centered">
          <SectionLabel>FOUR DISCIPLINES</SectionLabel>
          <h2>Let's build together!</h2>
          <p>Restart brings architecture, automation, product engineering, and production discipline together so bold ideas can move from decision to delivery without becoming a technical liability.</p>
        </div>
        <div className="lane-grid">
          {lanes.map((lane) => {
            const Icon = lane.icon;
            return (
              <article className={`lane-card ${lane.accent}`} key={lane.number}>
                <div className="lane-top">
                  <span className="lane-number">{lane.number}</span>
                  <Icon size={17} />
                </div>
                <h3 style={{ fontSize: "24px", fontWeight: "600" }}>{lane.title}</h3>
                <p>{lane.text}</p>
                <div className="tag-row">
                  {lane.tags.map((tag) => (
                    <span key={tag}>
                      {stackLogos[tag] && <img src={stackLogos[tag]} alt="" aria-hidden="true" className="tag-logo" />}
                      {tag}
                    </span>
                  ))}
                </div>
                <Link href={`/solutions/${lane.slug}`} className="card-link">
                  {lane.action} <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="offers-section container" id="work"><div className="section-intro centered"><SectionLabel>WAYS TO ENGAGE / SCOPED DELIVERY</SectionLabel><h2>Choose the next move.</h2><p>Every Restart engagement is designed to create useful momentum. Start with a defined outcome, make the important decisions visible, and leave with a system your team can operate or a clear path to build it.</p></div><div className="offer-list">{offers.map((offer, i) => <article className={`offer-row ${i % 2 ? "reverse" : ""}`} key={offer.kicker}><div className="offer-copy"><div className="offer-kicker"><SectionLabel tone={i % 2 ? "violet" : "teal"}>{offer.kicker}</SectionLabel><span>{offer.duration}</span></div><h2>{offer.title}</h2><p>{offer.text}</p><Link href={`/start-project?tier=${encodeURIComponent(offer.kicker)}`} className="button outline small">{offer.cta} <ArrowUpRight size={14} /></Link></div><div className={`offer-visual ${offer.visual}`}><Visual kind={offer.visual} /></div><div className="offer-specs"><div className="spec-tabs"><span className="active">SCOPE</span><span>DELIVERABLES</span><span>NOTES</span></div><ul>{offer.tags.map((tag) => <li key={tag}><Check size={13} />{tag}</li>)}</ul></div></article>)}</div></section>

      <section className="case-studies-section container" id="case-studies">
        <div className="section-intro centered">
          <SectionLabel>CASE STUDIES / PROOF SYSTEM</SectionLabel>
          <h2>Show the constraint.<br /><span>Prove the change.</span></h2>
          <p>Two kinds of proof, in sequence. First the measurable results on anonymised engagements. Then the two clients we can name, with systems you can open yourself.</p>
        </div>

        <div className="proof-sequence">
        <div className="proof-stage">
        <div className="proof-stage-head">
          <h3>Measurable results, anonymised</h3>
          <p>Enterprise-scale engagements where the client asked not to be named. The starting condition, the intervention, and the production result are all documented.</p>
        </div>

        <div className="case-study-grid">
          {caseStudiesData.slice(0, 3).map((study, i) => (
            <article
              className={`case-study-card ${study.tone} clickable-card`}
              key={study.id}
              onClick={() => setSelectedCaseStudy(study)}
              tabIndex={0}
              role="button"
              aria-label={`View case study: ${study.title}`}
            >
              <div className="case-study-top">
                <SectionLabel tone={study.tone}>{study.type}</SectionLabel>
                <span className="case-study-index">0{i + 1}</span>
              </div>
              <div className="case-study-visual">
                <div className="case-study-orbit" />
                <div className="case-study-core">
                  <span>{i === 0 ? "BUILD" : i === 1 ? "EVAL" : "FLOW"}</span>
                </div>
              </div>
              <h3>{study.title}</h3>
              <p>{study.summary}</p>
              <div className="outcome-grid">
                {study.metrics.map((metric) => (
                  <div key={metric.label}>
                    <small>{metric.label}</small>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>
              <div className="case-card-actions">
                <span className="case-link-btn">
                  <span>Read Full Dossier</span>
                  <ArrowUpRight size={13} />
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* View All Case Studies Button */}
        <div className="view-all-cases-container">
          <Link href="/case-studies" className="view-all-cases-button">
            <span>View all case studies and delivery files</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="case-study-note">
          <ShieldCheck size={16} />
          <span>Verified outcomes are sourced from published technical case files. Additional project metrics are available during architecture review.</span>
        </div>
        </div>

        {/*
          The interstitial is doing real work: it turns two grids that
          previously read as duplicate "case studies" sections into one
          sequence. Numbering them 01/02 lets the anonymised work establish
          scale and the named work establish that it is checkable -- which is
          the claim a referral-driven buyer actually acts on.
        */}
        <div className="proof-interstitial">
          <span className="proof-interstitial-rule" />
          <span className="proof-interstitial-mark">THEN, THE CLIENTS WE CAN NAME</span>
          <span className="proof-interstitial-rule" />
        </div>

        <div className="proof-stage">
          <div className="proof-stage-head">
            <h3>Referenceable engagements</h3>
            <p>Live systems, named clients, open to inspection. If you want a reference before committing to anything, start here.</p>
          </div>

          <NamedClients />
        </div>
        </div>
      </section>

      {/* ALTERNATIVE: the earlier integration icon wall, kept alongside PLATFORM below so the two can be compared. Delete whichever loses. */}
      <section className="integration-section"><div className="container integration-wrap"><div className="section-copy"><SectionLabel>SEAMLESS INTEGRATION FOR</SectionLabel><h2>Make the work lighter <span>—not more connected for its own sake.</span></h2><p>Your tools should reduce friction, not create another system to manage. Restart connects the product, platform, automation, and operational surfaces that keep your business moving.</p></div><div className="integration-wall">{[Zap, Database, Network, Orbit, Layers3, ShieldCheck, BrainCircuit, Gauge, Sparkles, Code2, CircleCheck, Cpu].map((Icon, i) => <div key={i} className={`integration-icon icon-${i % 5}`}><Icon size={40} /></div>)}</div></div></section>

      {/*
        Previously two sections ("SEAMLESS INTEGRATION FOR" and "PLATFORM") making
        substantially the same argument — that we connect product, platform, and
        operational surfaces to remove friction. Merged into one, and the former
        twelve-icon wall (unlabelled Lucide glyphs carrying no information) is
        replaced by the real technologies we deploy on.
      */}
      <section className="platform-section" id="platform-detail">
        <div className="container platform-wrap">
          <div className="platform-copy">
            <SectionLabel>PLATFORM</SectionLabel>
            <h2>Turn operational friction into <span>technical leverage.</span></h2>
            <p>
              Your tools should reduce friction, not become another system to manage. We map the
              workflows, constraints, and costs shaping your business, then connect the product,
              platform, and operational surfaces that keep it moving.
            </p>
            <div className="saas-points">
              <div><strong>See the system clearly.</strong><span>Map the workflows, constraints, dependencies, and costs that are shaping the business.</span></div>
              <div><strong>Remove the repeatable friction.</strong><span>Automate the work that slows good teams down and build interfaces around the decisions that matter.</span></div>
              <div><strong>Create capacity for the next stage.</strong><span>Build a foundation that supports growth without forcing a full rewrite every time the business changes direction.</span></div>
            </div>
          </div>
          <div className="saas-art">
            <div className="dash-mock">
              <div className="dash-mock-chrome"><span className="dash-mock-dot" /><span className="dash-mock-dot" /><span className="dash-mock-dot" /><div className="dash-mock-url" /></div>
              <div className="dash-mock-body">
                <div className="dash-mock-nav"><span className="active">Overview</span><span>Systems</span><span>Delivery</span><span>Activity</span></div>
                <div className="dash-mock-main">
                  <div className="dash-mock-stats"><div><small>UPTIME</small><strong>99.99%</strong></div><div><small>SYSTEMS</small><strong>10</strong></div><div><small>DEPLOYS</small><strong>24</strong></div></div>
                  <div className="dash-mock-chart"><i style={{ height: "38%" }} /><i style={{ height: "64%" }} /><i style={{ height: "30%" }} /><i style={{ height: "82%" }} /><i style={{ height: "54%" }} /><i style={{ height: "70%" }} /><i style={{ height: "46%" }} /></div>
                  <div className="dash-mock-rows"><div><span className="dot" />restart-console<span className="pill">Healthy</span></div><div><span className="dot" />restart-website<span className="pill">Healthy</span></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container platform-stack">
          <div className="platform-stack-label">
            <span>WE BUILD ON</span>
            <p>
              The technologies our clients' systems actually run on. We name them because we can
              be held to them.
            </p>
          </div>
          <ul className="platform-stack-row">
            {platformStack.map((item) => (
              <li key={item.name}>
                <img src={item.logo} alt="" aria-hidden="true" />
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="proof-section" id="process"><div className="container"><div className="section-intro centered"><SectionLabel>SIMPLE 4 STEPS PROCESS</SectionLabel><h2>A straightforward path.</h2><p>No lengthy proposals or open-ended retainers — just a clear sequence from your first message to a system your team can run.</p></div><div className="proof-grid"><div><CircleCheck size={18} /><strong>01. Start the conversation.</strong><p>Tell us what you are building and where it is stuck. We reply quickly with whether the timing and fit make sense.</p></div><div><ShieldCheck size={18} /><strong>02. Scope the real work.</strong><p>A short technical review turns your constraint into a concrete plan — deliverables, timeline, and cost, with no surprises later.</p></div><div><Layers3 size={18} /><strong>03. Build in the open.</strong><p>Weekly checkpoints, visible progress, and decisions made together — not a black box that reappears at the deadline.</p></div><div><Network size={18} /><strong>04. Launch and hand off.</strong><p>Ship to production with documentation and context your team can operate without us.</p></div></div></div></section>

      <section className="insights-section container" id="insights"><div className="section-intro centered"><SectionLabel>INSIGHTS</SectionLabel><h2>Insights for making decisions.</h2><p>Practical perspectives on architecture, operations, AI, cloud infrastructure, and the decisions that determine whether a system holds up under pressure.</p></div><div className="insight-grid">{insights.slice(0, 3).map((insight) => { const Icon = insight.icon; return <Link key={insight.id} href={`/insights/${insight.id}`} className="insight-card"><div className={`insight-image ${insight.image}`}><Icon size={40} /></div><span>{insight.kicker}</span><h3>{insight.title}</h3><ArrowUpRight size={15} /></Link>; })}</div><Link className="button outline small center-button" href="/insights">Read all insights <ArrowRight size={14} /></Link></section>

      <section className="faq-section container" id="faq"><div className="faq-heading"><SectionLabel>FAQS</SectionLabel><h2>Good questions.<br /><span>Useful answers.</span></h2><p>The questions we hear most from founders and operators before their first project — answered plainly, no sales language.</p><Link href="/contact" className="button outline small">Still have a question? Get in touch <ArrowRight size={14} /></Link></div><div className="faq-list">{faqs.map(([question, answer], i) => <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={question}><button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}><span>{question}</span><ChevronDown size={20} strokeWidth={2.75} /></button>{openFaq === i && <p>{answer}</p>}</div>)}</div></section>

      <section className="final-cta" id="contact">
        <div className="final-cta-grid" />
        <div className="container final-cta-content">
          <SectionLabel>READY FOR THE NEXT STAGE?</SectionLabel>
          <h2>Bring us <span>the hard part.</span></h2>
          <p>Restart will help you build systems your growth can depend on—reliable enough for today, structured enough for tomorrow, and clear enough for your team to keep improving.</p>
          <div className="final-cta-buttons">
            <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
            <a className="button outline" href="#solutions" onClick={(e) => handleScrollTo(e, "solutions")}>Explore solutions <ChevronRight size={15} /></a>
          </div>
        </div>
      </section>
    </main>

    <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><a className="site-logo" href="#top" onClick={(e) => handleScrollTo(e, "top")}><LogoMark /></a><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><a href="#platform" onClick={(e) => handleScrollTo(e, "platform")}>Platform</a><a href="#solutions" onClick={(e) => handleScrollTo(e, "solutions")}>Solutions</a><a href="#case-studies" onClick={(e) => handleScrollTo(e, "case-studies")}>Case Studies</a><a href="#insights" onClick={(e) => handleScrollTo(e, "insights")}>Insights</a></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© 2026 Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></span></div></footer>
  </div>;
}
