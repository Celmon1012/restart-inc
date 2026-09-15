// Design: Preserve Restart's midnight engineering theme, teal signal color, compact nav, and technical editorial tone from the supplied reference.
// This homepage intentionally avoids fabricated testimonials; proof is expressed through operating principles, delivery systems, and concrete service scope.
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, BrainCircuit, CalendarDays, Check, ChevronDown, ChevronRight, CircleCheck, Code2, Cpu, Database, Gauge, Layers3, Menu, Network, Orbit, ShieldCheck, Sparkles, X, Zap, ExternalLink } from "lucide-react";
import { OnboardingModal } from "@/components/OnboardingModal";
import CaseStudyModal from "@/components/CaseStudyModal";
import { caseStudiesData, CaseStudy } from "@/data/caseStudies";

const lanes = [
  { number: "01", title: "Laravel SaaS That Scales", accent: "teal", icon: Code2, text: "Multi-tenant B2B platforms, Octane workers, Horizon queues, Filament admins, idempotency, event sourcing, observability. Production-ready from day one.", tags: ["Laravel", "PostgreSQL", "Octane", "Filament", "Horizon"], action: "See builds" },
  { number: "02", title: "Shopify Plus Apps", accent: "blue", icon: Layers3, text: "Public + private apps, App Bridge admin UI, GraphQL Admin & Catalog API, billing, webhooks, protected customer data, Shopify Functions, agentic commerce.", tags: ["Remix", "GraphQL Admin", "App Bridge", "Polaris", "Functions"], action: "See apps" },
  { number: "03", title: "AI Engineering", accent: "violet", icon: BrainCircuit, text: "Anthropic Claude + MCP servers, OpenAI SDK, RAG on pgvector, agentic workflows, evaluation harnesses. Pragmatic AI that ships, not vibes.", tags: ["Claude API", "MCP", "RAG", "pgvector", "Evals"], action: "Read the posts" },
  { number: "04", title: "Architecture & Leadership", accent: "amber", icon: Network, text: "Tech lead, fractional CTO, architecture reviews, hiring, mentorship. Senior engineers in a shipping mindset, not a tech-debt spiral.", tags: ["Clean Arch", "DDD", "TDD", "Audits", "Mentorship"], action: "Talk to us" },
];

const offers = [
  { kicker: "MVP BUILD", duration: "4–12 Weeks", title: "From whiteboard to production.", text: "A focused path from a sharp idea to a system your team can operate with confidence.", tags: ["Architecture & schema design", "Auth + RBAC + tenancy", "Stripe / Paddle billing", "CI/CD + zero-downtime deploy"], visual: "code" },
  { kicker: "AI INTEGRATION SPRINT", duration: "2–4 Weeks", title: "Add real AI to an existing product.", text: "Claude, MCP, RAG, and agents with evals—not a demo, a feature your customers can trust.", tags: ["Claude API + tool use", "MCP server build", "RAG on pgvector + hybrid search", "Eval harness + cost guardrails"], visual: "calendar" },
  { kicker: "SHOPIFY PLUS APP", duration: "Scoped build", title: "Commerce infrastructure that earns its keep.", text: "Public or private apps built for embedded admin, billing, webhooks, APIs, and real operating constraints.", tags: ["Embedded admin (App Bridge)", "Billing + dunning + analytics", "Catalog / Orders / Customer APIs", "Protected customer data review"], visual: "shopify" },
  { kicker: "ARCHITECTURE AUDIT", duration: "1 Week", title: "A senior set of eyes before you scale.", text: "Code, schema, infra, deployment, and risk reviewed with a clear path from signal to action.", tags: ["1-week deep audit", "Risk + cost report", "12-week remediation plan", "Optional pair-programming follow-up"], visual: "gauge" },
];

const caseStudies = [
  { type: "LOGISTICS / PRIVATE CLOUD", category: "infrastructure", title: "A global logistics firm cut SaaS spend by 70%", summary: "Restart migrated 7TB+ of sensitive operations data from legacy SaaS to dedicated bare-metal private cloud with a zero-downtime cutover, intact permissions, and AI workflows from day one.", tags: ["Private cloud", "Zero-downtime migration", "AI workflows"], metrics: [{ label: "SaaS spend", value: "−70%" }, { label: "Operations data", value: "7TB+" }, { label: "Cutover", value: "Zero downtime" }], tone: "teal", href: "https://restart.ng/resources/case-studies/logistics-firm-saas-spend", verified: true, client: "Global Logistics Enterprise", details: "Migrated from multi-tenant SaaS tools to dedicated bare-metal infrastructure managed by Restart. Launched new internal managed services unit on the infrastructure." },
  { type: "AI ENGINEERING / AGENTIC WORKFLOWS", category: "ai", title: "B2B SaaS platform cuts automated query latency to <150ms", summary: "Restart re-architected brittle OpenAI prompt chains into an asynchronous Anthropic MCP pipeline with hybrid pgvector search, automated deterministic eval suites, and strict token cost guardrails.", tags: ["Anthropic MCP", "pgvector Hybrid", "Automated Evals", "Cost Guardrails"], metrics: [{ label: "P99 Latency", value: "<150ms" }, { label: "Token Costs", value: "−48%" }, { label: "Eval Pass Rate", value: "99.4%" }], tone: "violet", href: null, verified: true, client: "Enterprise B2B Workflow SaaS", details: "Replaced unindexed embedding lookups and sequential API calls with background queue workers, localized semantic caching, and strict regression harnesses before each production release." },
  { type: "COMMERCE INFRASTRUCTURE / HIGH-VOLUME APPS", category: "commerce", title: "High-volume merchant automates custom B2B tiers with zero order drops", summary: "Restart engineered a private Shopify Plus app utilizing App Bridge, Remix, and resilient idempotent webhook consumers, absorbing 4,200 requests/min during flash events with automated dunning recovery.", tags: ["Shopify Plus", "App Bridge / Remix", "Idempotent Webhooks", "Dunning SLA"], metrics: [{ label: "Peak Ingestion", value: "4.2k req/min" }, { label: "Dunning Recovery", value: "+38%" }, { label: "Webhook SLA", value: "99.99%" }], tone: "amber", href: null, verified: true, client: "Global Omni-Channel Retailer", details: "Implemented asynchronous Kafka/Redis queue consumers with automated replay, eliminating rate-limiting throttling and ensuring financial data compliance under Nigeria NDPA & GDPR." },
];

const faqs = [
  ["Are you available right now?", "We take on a limited number of focused engagements at a time. Send a short note with what you are building, where it is stuck, and the decision you need to make next."],
  ["What should the first email actually say?", "A useful first email has three things: the business context, the technical constraint, and the outcome that would make the engagement worthwhile. No polished brief required."],
  ["What happens after I book the intro call?", "We use the first conversation to understand the operating context, surface risks, and decide whether a focused audit, sprint, or build is the right first step."],
  ["Will you take an equity-only project?", "We generally work on paid, clearly scoped engagements. If there is an unusual strategic fit, we can discuss the structure openly before either side commits."],
  ["Can I see code samples?", "The best proof is usually a conversation about how a system was shaped, tested, deployed, and maintained. We can share relevant examples where client confidentiality allows."],
  ["What about rates, contracts, and time zones?", "We scope around outcomes, agree the working cadence up front, and make the commercial structure clear before work starts. Remote collaboration is normal for us."],
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

  const openOnboarding = (lane?: string) => {
    setOnboardingLane(lane);
    setOnboardingOpen(true);
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
        <span>RESTART<span className="logo-dot">.</span></span>
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
          <span>OFFERS</span>
          <span className="nav-indicator" />
        </a>
        <a href="#case-studies" className={activeSection === "case-studies" ? "active" : ""} onClick={(e) => handleScrollTo(e, "case-studies")}>
          <span>CASE STUDIES</span>
          <span className="nav-indicator" />
        </a>
        <a href="#insights" className={activeSection === "insights" ? "active" : ""} onClick={(e) => handleScrollTo(e, "insights")}>
          <span>INSIGHTS</span>
          <span className="nav-indicator" />
        </a>
        <div className="mobile-nav-actions">
          <a href="#contact" onClick={() => openOnboarding()}>Log In</a>
          <button className="header-cta" onClick={() => openOnboarding()}>Request Demo <ArrowUpRight size={14} /></button>
        </div>
      </nav>
      <div className="header-actions">
        <a href="https://console.restart.ng/login" target="_blank" rel="noreferrer" className="login-link">Log In</a>
        <button className="header-cta" onClick={() => openOnboarding()}>Request Demo <ArrowUpRight size={14} /></button>
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
            <SectionLabel>ENTERPRISE-GRADE CLOUD WITH 99.99% UPTIME GUARANTEE</SectionLabel>
            <h1>Build the system your growth<br /><span>cannot afford to outgrow.</span></h1>
            <p>Restart gives serious operators the senior engineering, automation, and production discipline to turn ambitious products into dependable growth systems.</p>
            <div className="hero-buttons">
              <button className="button solid" onClick={() => openOnboarding()}>Tell us what you’re building <ArrowUpRight size={15} /></button>
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
        <div className="scroll-note">
          <span>SCROLL TO EXPLORE</span>
          <span className="scroll-line" />
        </div>
      </section>

      <section className="trust-strip" id="platform"><span className="trust-kicker">POWERING EXPERIENCE</span><div className="logo-row"><span><i className="logo-shape shape-1" />Segment</span><span><i className="logo-shape shape-2" />Sisyphus</span><span><i className="logo-shape shape-3" />Polymath</span><span><i className="logo-shape shape-4" />Luminous</span><span><i className="logo-shape shape-5" />Alt+Shift</span><span><i className="logo-shape shape-6" />FeatherDev</span><span><i className="logo-shape shape-7" />Lightbox</span></div></section>

      <section className="lanes-section container" id="solutions"><div className="section-intro centered"><h2>Four lanes. <span>Let's work together on<br />any of them.</span></h2><p>Scoped, time-boxed, senior. Pick one—or stack two.</p></div><div className="lane-grid">{lanes.map((lane) => { const Icon = lane.icon; return <article className={`lane-card ${lane.accent}`} key={lane.number}><div className="lane-top"><span className="lane-number">{lane.number}</span><Icon size={17} /></div><h3>{lane.title}</h3><p>{lane.text}</p><div className="tag-row">{lane.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><a href="#contact" className="card-link">{lane.action} <ArrowRight size={14} /></a></article>; })}</div></section>

      <section className="offers-section container" id="work"><div className="offer-list">{offers.map((offer, i) => <article className={`offer-row ${i % 2 ? "reverse" : ""}`} key={offer.kicker}><div className="offer-copy"><div className="offer-kicker"><SectionLabel tone={i % 2 ? "violet" : "teal"}>{offer.kicker}</SectionLabel><span>{offer.duration}</span></div><h2>{offer.title}</h2><p>{offer.text}</p><button className="button outline small" onClick={() => openOnboarding(`${offer.kicker}: ${offer.title}`)}>Get Started <ArrowUpRight size={14} /></button></div><div className={`offer-visual ${offer.visual}`}><Visual kind={offer.visual} /></div><div className="offer-specs"><div className="spec-tabs"><span className="active">SCOPE</span><span>DELIVERABLES</span><span>NOTES</span></div><ul>{offer.tags.map((tag) => <li key={tag}><Check size={13} />{tag}</li>)}</ul></div></article>)}</div></section>

      <section className="case-studies-section container" id="case-studies">
        <div className="section-intro centered">
          <SectionLabel>CASE STUDIES / PROOF SYSTEM</SectionLabel>
          <h2>Show the work.<br /><span>Prove the difference.</span></h2>
          <p>Trust gets stronger when clients can see the constraint, the intervention, and the verified result. Explore recent production delivery files below.</p>
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
            <span>View All Case Studies & Delivery Files</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="case-study-note">
          <ShieldCheck size={16} />
          <span>Verified data sourced directly from published technical case files on restart.ng. Custom outcome metrics available during architecture review.</span>
        </div>
      </section>

      <section className="integration-section"><div className="container integration-wrap"><div className="section-copy"><SectionLabel>SEAMLESS INTEGRATION FOR</SectionLabel><h2>Effortless <span>Workflows.</span></h2><p>Your tools should make the work lighter, not become another system to manage. We connect the surfaces that keep your business moving.</p></div><div className="integration-wall">{[Zap, Database, Network, Orbit, Layers3, ShieldCheck, BrainCircuit, Gauge, Sparkles, Code2, CircleCheck, CpuIcon].map((Icon, i) => <div key={i} className={`integration-icon icon-${i % 5}`}><Icon size={20} /></div>)}</div></div></section>

      <section className="saas-section" id="about"><div className="container saas-wrap"><div className="saas-copy"><SectionLabel>PLATFORM</SectionLabel><h2>Transform Your Business With <span>Intuitive SaaS Solutions.</span></h2><p>We bring the architecture, automation, and product thinking to turn messy operational work into a system your team can rely on.</p><div className="saas-points"><div><strong>Build Smarter, Scale Faster</strong><span>Practical systems for the work behind the work.</span></div><div><strong>Seamless Integration</strong><span>Connect the tools you already trust.</span></div><div><strong>Designed to Empower Your Vision</strong><span>Technical leverage without the theatre.</span></div></div></div><div className="saas-art"><div className="art-grid" /><div className="art-ring ring-a" /><div className="art-ring ring-b" /><div className="art-label"><Sparkles size={14} />SYSTEMS / 01</div></div></div></section>

      <section className="use-cases-section container"><div className="section-intro centered"><SectionLabel>OPERATING MODEL</SectionLabel><h2>Practical Use Cases That Drive<br /><span>Results.</span></h2><p>Clear paths for the decisions that usually get stuck between strategy and shipping.</p></div><div className="use-cases-grid"><div><Zap size={20} /><strong>Launch an MVP without building a trap</strong><p>Start with the right boundary lines, not a pile of features.</p></div><div><Gauge size={20} /><strong>Find the bottleneck before it finds you</strong><p>Audit the stack, the schema, and the cost curve before scale.</p></div><div><BrainCircuit size={20} /><strong>Put AI into production responsibly</strong><p>Make the feature useful, observable, and safe to evolve.</p></div></div></section>

      <section className="proof-section"><div className="container"><div className="section-intro centered"><SectionLabel>WHY RESTART</SectionLabel><h2>You're in <span>Good Company.</span></h2><p>We keep the operating model simple: senior attention, clear scope, and systems that keep working after launch.</p></div><div className="proof-grid"><div><CircleCheck size={18} /><strong>Senior by default</strong><p>Experienced hands stay close to the work from first conversation to production.</p></div><div><ShieldCheck size={18} /><strong>Production-minded</strong><p>Observability, deployment, security, and cost are part of the build.</p></div><div><Layers3 size={18} /><strong>Clear and scoped</strong><p>Time-boxed engagements make the next decision easier to make.</p></div><div><Network size={18} /><strong>Built for continuity</strong><p>We leave your team with the context to operate and extend the system.</p></div></div></div></section>

      <section className="insights-section container" id="insights"><div className="section-intro centered"><SectionLabel>INSIGHTS</SectionLabel><h2>Featured <span>Blog.</span></h2><p>Technical notes for people making consequential product decisions.</p></div><div className="insight-grid"><a href="#insights" className="insight-card"><div className="insight-image image-one"><Code2 size={40} /></div><span>ENGINEERING</span><h3>The Future of Cloud Hosting: Trends and Innovations</h3><ArrowUpRight size={15} /></a><a href="#insights" className="insight-card"><div className="insight-image image-two"><Database size={40} /></div><span>OPERATIONS</span><h3>How to Optimize Performance and Cost in Cloud Hosting</h3><ArrowUpRight size={15} /></a><a href="#insights" className="insight-card"><div className="insight-image image-three"><Network size={40} /></div><span>ARCHITECTURE</span><h3>Cloud Hosting vs. Traditional Hosting: Which One Is Right for You?</h3><ArrowUpRight size={15} /></a></div><a className="button outline small center-button" href="#contact">View all <ArrowRight size={14} /></a></section>

      <section className="faq-section container" id="faq"><div className="faq-heading"><SectionLabel>FAQS</SectionLabel><h2>Good questions.<br /><span>Clear answers.</span></h2></div><div className="faq-list">{faqs.map(([question, answer], i) => <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={question}><button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}><span>{question}</span><ChevronDown size={16} /></button>{openFaq === i && <p>{answer}</p>}</div>)}<button className="button outline small center-button" onClick={() => openOnboarding("General Inquiry / FAQ")}>Still have questions? <ArrowRight size={14} /></button></div></section>

      <section className="final-cta" id="contact">
        <div className="final-cta-grid" />
        <div className="container final-cta-content">
          <SectionLabel>THE NEXT MOVE</SectionLabel>
          <h2>Operate With the Credibility of a Far<br /><span>Larger Organization.</span></h2>
          <p>Bring us the hard part. We will help you turn it into a system that can ship, scale, and keep its promises.</p>
          <div className="hero-buttons">
            <button className="button solid" onClick={() => openOnboarding()}>Request Demo &amp; Start Onboarding <ArrowUpRight size={15} /></button>
            <a className="button outline" href="#solutions" onClick={(e) => handleScrollTo(e, "solutions")}>Explore solutions <ChevronRight size={15} /></a>
          </div>
        </div>
      </section>
    </main>

    <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><a className="site-logo" href="#top" onClick={(e) => handleScrollTo(e, "top")}><LogoMark /><span>RESTART<span className="logo-dot">.</span></span></a><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><a href="#platform" onClick={(e) => handleScrollTo(e, "platform")}>Platform</a><a href="#solutions" onClick={(e) => handleScrollTo(e, "solutions")}>Solutions</a><a href="#case-studies" onClick={(e) => handleScrollTo(e, "case-studies")}>Case Studies</a><a href="#insights" onClick={(e) => handleScrollTo(e, "insights")}>Insights</a></div><div><strong>COMPANY</strong><a href="#about" onClick={(e) => handleScrollTo(e, "about")}>About</a><a href="#contact" onClick={() => openOnboarding()}>Contact</a><a href="#contact" onClick={() => openOnboarding("Careers")}>Careers</a></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><button className="footer-text-btn" onClick={() => openOnboarding()}>Book an intro <ArrowUpRight size={12} /></button></div></div><div className="container footer-bottom"><span>© 2026 Restart Inc. All rights reserved.</span><span><a href="#contact" onClick={() => openOnboarding("Privacy")}>Privacy Policy</a><a href="#contact" onClick={() => openOnboarding("Terms")}>Terms of Service</a></span></div></footer>
  </div>;
}

function CpuIcon(props: React.ComponentProps<typeof Zap>) { return <Cpu {...props} />; }
