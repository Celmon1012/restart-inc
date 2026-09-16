// Design: Preserve Restart's midnight engineering theme, teal signal color, compact nav, and technical editorial tone from the supplied reference.
// This homepage intentionally avoids fabricated testimonials; proof is expressed through operating principles, delivery systems, and concrete service scope.
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, ArrowUpRight, BrainCircuit, CalendarDays, Check, ChevronDown, ChevronRight, CircleCheck, Code2, Cpu, Database, Gauge, Layers3, Menu, Network, Orbit, ShieldCheck, Sparkles, X, Zap, ExternalLink } from "lucide-react";
import { OnboardingModal } from "@/components/OnboardingModal";
import CaseStudyModal from "@/components/CaseStudyModal";
import { caseStudiesData, CaseStudy } from "@/data/caseStudies";

const lanes = [
  { number: "01", title: "Build a platform your team can operate.", accent: "teal", icon: Code2, text: "Multi-tenant B2B platforms designed around clear boundaries, resilient jobs, secure access, observable workflows, and the operational detail that makes production sustainable.", tags: ["Laravel", "PostgreSQL", "Octane", "Filament", "Horizon", "Observability"], action: "Explore SaaS builds" },
  { number: "02", title: "Make commerce operations work harder.", accent: "blue", icon: Layers3, text: "Custom commerce platforms built on Medusa — admin workflows, billing, protected data, resilient webhooks, and the realities of high-volume commerce.", tags: ["Medusa", "Next.js", "PostgreSQL", "Admin API", "Workflows"], action: "Explore commerce builds" },
  { number: "03", title: "Put AI where it can earn trust.", accent: "violet", icon: BrainCircuit, text: "We turn models, retrieval, tools, and agents into useful product capabilities — with evaluation, observability, and cost controls built in from the start.", tags: ["Claude API", "MCP", "RAG", "pgvector", "Evaluation harnesses"], action: "Explore AI engineering" },
  { number: "04", title: "Bring experience to the decisions that matter.", accent: "amber", icon: Network, text: "Architecture reviews, fractional technical leadership, hiring support, and hands-on mentorship for teams that need a clearer path from complexity to execution.", tags: ["Architecture reviews", "Domain modeling", "Testing strategy", "Technical leadership", "Mentorship"], action: "Talk to an engineer" },
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
  return <span className="restart-mark" aria-hidden="true"><span /></span>;
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
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingLane, setOnboardingLane] = useState<string | undefined>(undefined);
  const [activeSection, setActiveSection] = useState("top");
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null);
  const [, setLocation] = useLocation();

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
    <OnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} initialLane={onboardingLane} />
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
        <span>RESTART INC<span className="logo-dot">.</span></span>
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
          <div className="mobile-nav-actions">
            <Link href="/login">Client Login</Link>
            <Link href="/start-project" className="header-cta">Start a Project <ArrowUpRight size={14} /></Link>
          </div>
        </nav>
        <div className="header-actions">
          <Link href="/login" className="login-link">Client Login</Link>
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
            <SectionLabel>ENGINEERING GROWTH SYSTEMS / TECHNICAL OWNERSHIP</SectionLabel>
            <h1>Build for <span>what’s next.</span></h1>
            <p>Restart Inc. is a technology and engineering firm that helps ambitious operators turn complex workflows and product ideas into reliable, scalable systems.</p>
            <div className="hero-buttons">
              <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
              <a className="button outline" href="#solutions" onClick={(e) => handleScrollTo(e, "solutions")}>See how we work <ChevronRight size={15} /></a>
            </div>
            <div className="hero-proof-row">
              <span><Check size={13} /> Senior technical ownership</span>
              <span><Check size={13} /> Built for production</span>
              <span><Check size={13} /> Clear next steps</span>
            </div>
          </div>
          <SignalPanel />
        </div>
      </section>

      <section className="trust-strip" id="platform"><span className="trust-kicker">TOOLS, TEAMS, AND ECOSYSTEMS WE WORK ACROSS</span><div className="logo-row"><span><img src="/logos/logo-segment.png" alt="Segment" style={{ height: 22, width: "auto" }} /></span><span><img src="/logos/logo-sisyphus.png" alt="Sisyphus" style={{ height: 22, width: "auto" }} /></span><span><img src="/logos/logo-polymath.png" alt="Polymath" style={{ height: 22, width: "auto" }} /></span><span><img src="/logos/logo-luminous.png" alt="Luminous" style={{ height: 22, width: "auto" }} /></span><span><img src="/logos/logo-altshift.png" alt="Alt+Shift" style={{ height: 22, width: "auto" }} /></span><span><img src="/logos/logo-featherdev.png" alt="FeatherDev" style={{ height: 22, width: "auto" }} /></span><span><img src="/logos/logo-lightbox.png" alt="Lightbox" style={{ height: 22, width: "auto" }} /></span></div></section>

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
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <Link href={`/start-project?tier=${encodeURIComponent(lane.title)}`} className="card-link">
                  {lane.action} <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="offers-section container" id="work"><div className="section-intro centered"><SectionLabel>WAYS TO ENGAGE / SCOPED DELIVERY</SectionLabel><h2>Choose the next move<br /><span>—not a vague retainer.</span></h2><p>Every Restart engagement is designed to create useful momentum. Start with a defined outcome, make the important decisions visible, and leave with a system your team can operate or a clear path to build it.</p></div><div className="offer-list">{offers.map((offer, i) => <article className={`offer-row ${i % 2 ? "reverse" : ""}`} key={offer.kicker}><div className="offer-copy"><div className="offer-kicker"><SectionLabel tone={i % 2 ? "violet" : "teal"}>{offer.kicker}</SectionLabel><span>{offer.duration}</span></div><h2>{offer.title}</h2><p>{offer.text}</p><Link href={`/start-project?tier=${encodeURIComponent(offer.kicker)}`} className="button outline small">{offer.cta} <ArrowUpRight size={14} /></Link></div><div className={`offer-visual ${offer.visual}`}><Visual kind={offer.visual} /></div><div className="offer-specs"><div className="spec-tabs"><span className="active">SCOPE</span><span>DELIVERABLES</span><span>NOTES</span></div><ul>{offer.tags.map((tag) => <li key={tag}><Check size={13} />{tag}</li>)}</ul></div></article>)}</div></section>

      <section className="case-studies-section container" id="case-studies">
        <div className="section-intro centered">
          <SectionLabel>CASE STUDIES / PROOF SYSTEM</SectionLabel>
          <h2>Show the constraint.<br /><span>Prove the change.</span></h2>
          <p>The strongest technical work is measurable. See the starting condition, the intervention, and the production result behind selected Restart engagements.</p>
        </div>

        {/* Case Study Cards */}
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
              <div className="case-tags">
                {study.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
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
      </section>

      <section className="integration-section"><div className="container integration-wrap"><div className="section-copy"><SectionLabel>SEAMLESS INTEGRATION FOR</SectionLabel><h2>Make the work lighter <span>—not more connected for its own sake.</span></h2><p>Your tools should reduce friction, not create another system to manage. Restart connects the product, platform, automation, and operational surfaces that keep your business moving.</p></div><div className="integration-wall">{[Zap, Database, Network, Orbit, Layers3, ShieldCheck, BrainCircuit, Gauge, Sparkles, Code2, CircleCheck, CpuIcon].map((Icon, i) => <div key={i} className={`integration-icon icon-${i % 5}`}><Icon size={40} /></div>)}</div></div></section>

      <section className="saas-section" id="about"><div className="container saas-wrap"><div className="saas-copy"><SectionLabel>PLATFORM</SectionLabel><h2>Turn operational friction into <span>technical leverage.</span></h2><p>Restart combines architecture, automation, and product thinking to turn messy operational work into a system your team can understand, improve, and rely on.</p><div className="saas-points"><div><strong>See the system clearly.</strong><span>Map the workflows, constraints, dependencies, and costs that are shaping the business.</span></div><div><strong>Remove the repeatable friction.</strong><span>Automate the work that slows good teams down and build interfaces around the decisions that matter.</span></div><div><strong>Create capacity for the next stage.</strong><span>Build a foundation that supports growth without forcing a full rewrite every time the business changes direction.</span></div></div></div><div className="saas-art"><div className="art-grid" /><div className="art-ring ring-a" /><div className="art-ring ring-b" /><div className="art-label"><Sparkles size={14} />SYSTEMS / 01</div></div></div></section>

      <section className="use-cases-section container"><div className="section-intro centered"><SectionLabel>OPERATING MODEL</SectionLabel><h2>The decisions that usually get stuck<br /><span>between strategy and shipping.</span></h2><p>Restart creates a clear path through the moments where product ambition meets technical consequence.</p></div><div className="use-cases-grid"><div><Zap size={20} /><strong>Launch an MVP without building a trap.</strong><p>Start with the right boundaries, data model, and operating assumptions — not a pile of features that becomes expensive to unwind.</p></div><div><Gauge size={20} /><strong>Find the constraint before it finds you.</strong><p>Review the stack, schema, infrastructure, and cost curve before growth turns a technical compromise into an operating problem.</p></div><div><BrainCircuit size={20} /><strong>Put AI into production responsibly.</strong><p>Make the feature useful, observable, testable, and safe to evolve after the demo is over.</p></div></div></section>

      <section className="proof-section"><div className="container"><div className="section-intro centered"><SectionLabel>WHY RESTART</SectionLabel><h2>Senior judgment. Clear scope.<br /><span>Systems that keep working.</span></h2><p>Restart keeps the engagement model simple: experienced technical ownership, visible decisions, and delivery that leaves your team stronger after launch.</p></div><div className="proof-grid"><div><CircleCheck size={18} /><strong>Senior by default.</strong><p>The people shaping the system stay close to the work — from the first conversation to production.</p></div><div><ShieldCheck size={18} /><strong>Production-minded from the beginning.</strong><p>Observability, deployment, security, performance, and cost are not cleanup tasks. They are part of the build.</p></div><div><Layers3 size={18} /><strong>Clear enough to act on.</strong><p>Time-boxed engagements turn uncertainty into a decision, a deliverable, or a practical next step.</p></div><div><Network size={18} /><strong>Built for continuity.</strong><p>We leave your team with the context, documentation, and operating confidence to extend the system without us.</p></div></div></div></section>

      <section className="insights-section container" id="insights"><div className="section-intro centered"><SectionLabel>INSIGHTS</SectionLabel><h2>Insights for people making<br /><span>consequential product decisions.</span></h2><p>Practical perspectives on architecture, operations, AI, cloud infrastructure, and the decisions that determine whether a system holds up under pressure.</p></div><div className="insight-grid"><a href="#insights" className="insight-card"><div className="insight-image image-one"><Code2 size={40} /></div><span>ENGINEERING</span><h3>Cloud infrastructure is a product decision — not just a hosting decision.</h3><ArrowUpRight size={15} /></a><a href="#insights" className="insight-card"><div className="insight-image image-two"><Database size={40} /></div><span>OPERATIONS</span><h3>Performance and cost are connected: how to find the trade-off before scale.</h3><ArrowUpRight size={15} /></a><a href="#insights" className="insight-card"><div className="insight-image image-three"><Network size={40} /></div><span>ARCHITECTURE</span><h3>When to extend the existing system — and when to redraw the boundary.</h3><ArrowUpRight size={15} /></a></div><a className="button outline small center-button" href="#contact">Read all insights <ArrowRight size={14} /></a></section>

      <section className="faq-section container" id="faq"><div className="faq-heading"><SectionLabel>FAQS</SectionLabel><h2>Good questions.<br /><span>Useful answers.</span></h2></div><div className="faq-list">{faqs.map(([question, answer], i) => <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={question}><button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}><span>{question}</span><ChevronDown size={16} /></button>{openFaq === i && <p>{answer}</p>}</div>)}<Link href="/start-project" className="button outline small center-button">Still have a question? Tell us what you're building <ArrowRight size={14} /></Link></div></section>

      <section className="final-cta" id="contact">
        <div className="final-cta-grid" />
        <div className="container final-cta-content">
          <SectionLabel>READY FOR YOUR NEXT MOVE?</SectionLabel>
          <h2>Bring us <span>the hard part.</span></h2>
          <p>Restart will help you turn it into a system that can ship, scale, and keep its promises.</p>
          <div className="final-cta-buttons">
            <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
            <a className="button outline" href="#solutions" onClick={(e) => handleScrollTo(e, "solutions")}>Explore solutions <ChevronRight size={15} /></a>
          </div>
        </div>
      </section>
    </main>

    <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><a className="site-logo" href="#top" onClick={(e) => handleScrollTo(e, "top")}><LogoMark /><span>RESTART<span className="logo-dot">.</span></span></a><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><a href="#platform" onClick={(e) => handleScrollTo(e, "platform")}>Platform</a><a href="#solutions" onClick={(e) => handleScrollTo(e, "solutions")}>Solutions</a><a href="#case-studies" onClick={(e) => handleScrollTo(e, "case-studies")}>Case Studies</a><a href="#insights" onClick={(e) => handleScrollTo(e, "insights")}>Insights</a></div><div><strong>COMPANY</strong><a href="#about" onClick={(e) => handleScrollTo(e, "about")}>About</a><Link href="/start-project">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© 2026 Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>
  </div>;
}

function CpuIcon(props: React.ComponentProps<typeof Zap>) { return <Cpu {...props} />; }
