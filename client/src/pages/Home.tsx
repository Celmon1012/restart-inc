// Design: Preserve Restart's midnight engineering theme, teal signal color, compact nav, and technical editorial tone from the supplied reference.
// This homepage intentionally avoids fabricated testimonials; proof is expressed through operating principles, delivery systems, and concrete service scope.
import { openCookieSettings } from "@/lib/consent";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, BrainCircuit, CalendarDays, Check, ChevronDown, ChevronRight, CircleCheck, Code2, Layers3, Menu, Network, ShieldCheck, X } from "lucide-react";
import CaseStudyModal from "@/components/CaseStudyModal";
import { caseStudiesData, CaseStudy } from "@/data/caseStudies";
import NamedClients from "@/components/NamedClients";
import InsightArt from "@/components/InsightArt";
import { HeroDots, HeroLines, HeroStats } from "@/components/HeroBackdrop";
import ConsolePreview from "@/components/ConsolePreview";
import DeliveryPreview from "@/components/DeliveryPreview";
import { platformStack } from "@/data/stack";
import { faqs } from "@/data/faqs";
import { useInsights } from "@/hooks/useInsights";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

// Four Disciplines, Referenceable engagements, the Platform band, the tech wall,
// the process strip and Insights are hidden on the home page (the tech wall and
// process now live on /platform). Flip to true to bring them back.
const SHOW_HIDDEN_HOME_SECTIONS = false;

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


export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null);
  const [, setLocation] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";
  const { insights } = useInsights();

  useEffect(() => {
    applyPageSeo({
      title: "Restart Inc.",
      description: "Turn operational friction into technical leverage. Restart maps the workflows costing you most, builds the systems that remove them, and makes every step visible in the Console.",
      path: "/",
    });
    return () => resetSeoToDefault();
  }, []);

  const openOnboarding = (lane?: string) => {
    setLocation(lane ? `/start-project?tier=${encodeURIComponent(lane)}` : "/start-project");
  };

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
      <Link href="/" className="site-logo" aria-label="Restart home">
        <LogoMark />
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
        <Link href="/case-studies" onClick={() => setMenuOpen(false)}>
          <span>CASE STUDIES</span>
          <span className="nav-indicator" />
        </Link>
        <Link href="/insights" onClick={() => setMenuOpen(false)}>
          <span>INSIGHTS</span>
          <span className="nav-indicator" />
        </Link>
        <Link href="/about" onClick={() => setMenuOpen(false)}>
          <span>ABOUT</span>
          <span className="nav-indicator" />
        </Link>
          <div className="mobile-nav-actions">
<a href={consoleHref}>{consoleLabel}</a>
            <Link href="/scorecard" className="header-cta">Get an assessment <ArrowUpRight size={14} /></Link>
          </div>
        </nav>
        <div className="header-actions">
<a href={consoleHref} className="login-link">{consoleLabel}</a>
          <Link href="/scorecard" className="header-cta">Get an assessment <ArrowUpRight size={14} /></Link>
        <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>

    <main id="top">
      <section className="hero-section hero-trend">
        <HeroDots />
        <HeroLines />
        <ConsolePreview href={consoleHref} />
        <div className="hero-shell">
          <div className="hero-content">
            <h1>Turn operational friction into <span>technical leverage.</span></h1>
            <p>We map the workflows costing you most, build the systems that remove them, and you follow every step in the Restart Console.</p>
            <div className="hero-buttons">
              <Link href="/start-project" className="button solid">Tell us where it’s stuck <ArrowUpRight size={15} /></Link>
              <Link href="/platform" className="button outline">See the Console <ChevronRight size={15} /></Link>
            </div>
            <div className="hero-proof-row">
              <span><Check size={13} /> Senior technical ownership</span>
              <span><Check size={13} /> Production-ready delivery</span>
              <span><Check size={13} /> Clear, time-boxed scope</span>
            </div>
          </div>
        </div>
      </section>
      <HeroStats
        label="Measured in production"
        items={caseStudiesData.flatMap((c) => c.metrics.map((m) => ({ ...m, href: `/case-studies?study=${c.id}`, title: c.title, onSelect: () => setSelectedCaseStudy(c) })))}
      />

      {SHOW_HIDDEN_HOME_SECTIONS && <>
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
      </>}

      <section className="offers-section container" id="work">
        <div className="section-intro centered">
          <SectionLabel>WAYS TO ENGAGE / SCOPED DELIVERY</SectionLabel>
          <h2>Choose the next move.</h2>
          <p>Start with a defined outcome. A short technical review sets scope, timeline, and cost; you get weekly checkpoints and a system your team can run.</p>
        </div>
        <div className="lane-grid offer-grid">
          {offers.map((offer, i) => (
            <article className={`lane-card ${i % 2 ? "violet" : "teal"}`} key={offer.kicker}>
              <div className="lane-top">
                <span className="lane-number">{offer.kicker}</span>
                <span className="lane-number">{offer.duration}</span>
              </div>
              <h3>{offer.title}</h3>
              <p>{offer.text}</p>
              <Link href={`/start-project?tier=${encodeURIComponent(offer.kicker)}`} className="card-link">
                {offer.cta} <ArrowUpRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="case-studies-section container" id="case-studies">
        <div className="section-intro centered">
          <SectionLabel>CASE STUDIES / PROOF SYSTEM</SectionLabel>
          <h2>Show the constraint.<br /><span>Prove the change.</span></h2>
          <p>{SHOW_HIDDEN_HOME_SECTIONS ? "Two kinds of proof, in sequence. First the measurable results on anonymised engagements. Then the two clients we can name, with systems you can open yourself." : "Measurable results on anonymised engagements: the starting condition, the intervention, and the production result."}</p>
        </div>

        <div className="proof-sequence">
        <div className="proof-stage">
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
        </div>

        {/*
          The interstitial is doing real work: it turns two grids that
          previously read as duplicate "case studies" sections into one
          sequence. Numbering them 01/02 lets the anonymised work establish
          scale and the named work establish that it is checkable -- which is
          the claim a referral-driven buyer actually acts on.
        */}
        {SHOW_HIDDEN_HOME_SECTIONS && <>
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
        </>}
        </div>
      </section>

      {/* Integration wall: the technologies we deploy on, named on hover/focus. */}
      {SHOW_HIDDEN_HOME_SECTIONS && <section className="integration-section"><div className="container integration-wrap"><div className="section-copy"><SectionLabel>WE BUILD ON</SectionLabel><h2>Make the work lighter <span>—not more connected for its own sake.</span></h2><p>Your tools should reduce friction, not create another system to manage. Restart connects the product, platform, automation, and operational surfaces that keep your business moving.</p></div><ul className="integration-wall">{platformStack.map((item) => <li key={item.name} className="integration-icon" tabIndex={0}><img src={item.logo} alt="" aria-hidden="true" /><span className="integration-name">{item.name}</span></li>)}</ul></div></section>}

      {/*
        Previously two sections ("SEAMLESS INTEGRATION FOR" and "PLATFORM") making
        substantially the same argument — that we connect product, platform, and
        operational surfaces to remove friction. Merged into one, and the former
        twelve-icon wall (unlabelled Lucide glyphs carrying no information) is
        replaced by the real technologies we deploy on.
      */}
      {SHOW_HIDDEN_HOME_SECTIONS && <section className="platform-section" id="platform-detail">
        <div className="container platform-wrap">
          <div className="platform-copy">
            <SectionLabel>PLATFORM</SectionLabel>
            <h2>Turn operational friction into <span>technical leverage.</span></h2>
            <p>
              Your tools should reduce friction, not become another system to manage. We map the
              workflows, constraints, and costs shaping your business, then connect the product,
              platform, and operational surfaces that keep it moving.
            </p>
            <Link href="/platform" className="button outline small platform-more">
              How the platform works <ArrowRight size={14} />
            </Link>
          </div>
          <div className="saas-art platform-art">
            <DeliveryPreview />
          </div>
        </div>
      </section>}

      {SHOW_HIDDEN_HOME_SECTIONS && <section className="proof-section" id="process"><div className="container"><div className="section-intro centered"><SectionLabel>SIMPLE 4 STEPS PROCESS</SectionLabel><h2>A straightforward path.</h2><p>No lengthy proposals or open-ended retainers — just a clear sequence from your first message to a system your team can run.</p></div><div className="proof-grid"><div><CircleCheck size={18} /><strong>01. Start the conversation.</strong><p>Tell us what you are building and where it is stuck. We reply quickly with whether the timing and fit make sense.</p></div><div><ShieldCheck size={18} /><strong>02. Scope the real work.</strong><p>A short technical review turns your constraint into a concrete plan — deliverables, timeline, and cost, with no surprises later.</p></div><div><Layers3 size={18} /><strong>03. Build in the open.</strong><p>Weekly checkpoints, visible progress, and decisions made together — not a black box that reappears at the deadline.</p></div><div><Network size={18} /><strong>04. Launch and hand off.</strong><p>Ship to production with documentation and context your team can operate without us.</p></div></div></div></section>}

      {SHOW_HIDDEN_HOME_SECTIONS && <section className="insights-section container" id="insights"><div className="section-intro centered"><SectionLabel>INSIGHTS</SectionLabel><h2>Insights for making decisions.</h2><p>Practical perspectives on architecture, operations, AI, cloud infrastructure, and the decisions that determine whether a system holds up under pressure.</p></div><div className="insight-grid">{insights.slice(0, 3).map((insight) => { return <Link key={insight.id} href={`/insights/${insight.id}`} className="insight-card"><InsightArt insight={insight} /><span>{insight.kicker}{insight.date && <time dateTime={insight.date} className="insight-date"> · {new Date(insight.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>}</span><h3>{insight.title}</h3><ArrowUpRight size={15} /></Link>; })}</div><Link className="button outline small center-button" href="/insights">Read all insights <ArrowRight size={14} /></Link></section>}

      <section className="faq-section container" id="faq"><div className="faq-heading"><SectionLabel>FAQS</SectionLabel><h2>Good questions.<br /><span>Useful answers.</span></h2><p>The questions we hear most from founders and operators before their first project — answered plainly, no sales language.</p><Link href="/contact" className="button outline small">Still have a question? Get in touch <ArrowRight size={14} /></Link></div><div className="faq-list">{faqs.map(([question, answer], i) => <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={question}><button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}><span>{question}</span><ChevronDown size={20} strokeWidth={2.75} /></button>{openFaq === i && <p>{answer}</p>}</div>)}</div></section>

      <section className="final-cta" id="contact">
        <div className="final-cta-grid" />
        <div className="container final-cta-content">
          <SectionLabel>READY FOR THE NEXT STAGE?</SectionLabel>
          <h2>Bring us <span>the hard part.</span></h2>
          <p>Restart will help you build systems your growth can depend on—reliable enough for today, structured enough for tomorrow, and clear enough for your team to keep improving.</p>
          <div className="final-cta-buttons">
          <Link href="/start-project" className="button solid">Tell us where it’s stuck <ArrowUpRight size={15} /></Link>
            <Link href="/solutions" className="button outline">Explore solutions <ChevronRight size={15} /></Link>
          </div>
        </div>
      </section>
    </main>

    <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><LogoMark /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© 2026 Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
  </div>;
}
