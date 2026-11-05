// Design: Preserve Restart's midnight engineering theme, teal signal color, compact nav, and technical editorial tone from the supplied reference.
// This homepage intentionally avoids fabricated testimonials; proof is expressed through operating principles, delivery systems, and concrete service scope.
import { openCookieSettings } from "@/lib/consent";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Layers3, Map as MapIcon, Menu, MessagesSquare, Rocket, X } from "lucide-react";
import { caseStudiesData } from "@/data/caseStudies";
import InsightArt from "@/components/InsightArt";
import { HeroStats } from "@/components/HeroBackdrop";
import DeliveryPreview from "@/components/DeliveryPreview";
import ProcessSlider from "@/components/ProcessSlider";
import TechTag from "@/components/TechTag";
import { FaqSection, ContactSection, SignOff } from "@/components/PageSections";
import { solutionsData } from "@/data/solutions";
import { offers } from "@/data/offers";
import { useInsights } from "@/hooks/useInsights";
import { useReveal } from "@/hooks/useReveal";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import "@/styles/solutions.css";

const shortNames: Record<string, string> = {
  "saas-platforms": "SaaS platforms",
  commerce: "Commerce infrastructure",
  "ai-engineering": "AI engineering",
  "architecture-leadership": "Architecture & leadership",
};

const processSteps = [
  { icon: MessagesSquare, phase: "Intro", title: "Start the conversation", text: "Tell us what you are building and where it is stuck. We reply quickly with whether the timing and fit make sense." },
  { icon: MapIcon, phase: "Scope", title: "Scope the real work", text: "A short technical review turns your constraint into a concrete plan: deliverables, timeline, and cost, with no surprises later." },
  { icon: Layers3, phase: "Build", title: "Build in the open", text: "Weekly checkpoints, visible progress, and decisions made together, not a black box that reappears at the deadline." },
  { icon: Rocket, phase: "Handoff", title: "Launch and hand off", text: "Ship to production with documentation and context your team can operate without us." },
];

function LogoMark() {
  return <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(solutionsData[0]?.slug ?? null);
  const [, setLocation] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";
  const { insights } = useInsights();
  useReveal();
  const activeSolution = solutionsData.find((s) => s.slug === openRow) ?? solutionsData[0];
  const ActiveIcon = activeSolution.icon;

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

  return <div className="restart-home sol-page">
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
      <section className="sol-hero hm-hero">
        <div className="sol-hero-art" aria-hidden="true">
          <span className="sol-orb a" /><span className="sol-orb b" /><span className="sol-orb c" />
          <span className="sol-hero-grid" />
        </div>
        <div className="hm-hero-copy">
          <h1>Turn operational friction<br />{" "}into <span className="sol-pill">technical leverage.</span></h1>
          <p>We map the workflows costing you most, build the systems that remove them, and you follow every step in the Restart Console.</p>
          <div className="sol-hero-actions">
            <Link href="/start-project" className="button solid">Tell us where it’s stuck <ArrowUpRight size={15} /></Link>
            <Link href="/platform" className="button outline">See the Console <ChevronRight size={15} /></Link>
          </div>
          <div className="hero-proof-row">
            <span><Check size={13} /> Senior technical ownership</span>
            <span><Check size={13} /> Production-ready delivery</span>
            <span><Check size={13} /> Clear, time-boxed scope</span>
          </div>
        </div>
      </section>
      <HeroStats
        label="Measured in production"
        items={caseStudiesData.flatMap((c) => c.metrics.map((m) => ({ ...m, href: `/case-studies/${c.id}`, title: c.title, onSelect: () => setLocation(`/case-studies/${c.id}`) })))}
      />

      <section className="sol-section sol-wrap" id="solutions">
        <div className="hm-build">
          <div className="hm-build-copy sol-reveal">
            <span className="sol-eyebrow">WHAT WE BUILD</span>
            <h2 className="sol-h2">Built end <span>to end.</span></h2>
            <p className="sol-lede">Architecture, automation, product engineering, and production discipline, so a decision turns into a system without becoming a liability.</p>
            <div className={`sd-visual hm-build-visual ${activeSolution.accent}`} key={activeSolution.slug}>
              <span className="cs-rings" aria-hidden="true" />
              <span className="sd-number" aria-hidden="true">{activeSolution.number}</span>
              <span className="sd-icon" aria-hidden="true"><ActiveIcon size={30} /></span>
              <span className="sd-kicker">{activeSolution.kicker}</span>
              <div className="sd-chips">{activeSolution.tags.slice(0, 4).map((tag) => <TechTag key={tag} name={tag} />)}</div>
            </div>
            <Link href="/solutions" className="button outline small hm-build-more">See all solutions <ArrowRight size={14} /></Link>
          </div>
          <div className="sol-list">
            {solutionsData.map((solution, i) => {
              const open = openRow === solution.slug;
              return (
                <div className={`sol-row sol-reveal ${open ? "open" : ""}`} style={{ "--d": i } as React.CSSProperties} key={solution.slug}>
                  <button
                    type="button"
                    className="sol-row-head"
                    aria-expanded={open}
                    aria-controls={`home-row-${solution.slug}`}
                    onClick={() => setOpenRow(open ? null : solution.slug)}
                  >
                    <span className="sol-row-title">{shortNames[solution.slug] ?? solution.kicker}</span>
                    <span className="sol-row-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
                  </button>
                  <div className="sol-row-body" id={`home-row-${solution.slug}`} role="region">
                    <div>
                      <div className="sol-row-inner">
                        <h3>{solution.title}</h3>
                        <p>{solution.intro}</p>
                        <div className="sol-tags">{solution.tags.map((tag) => <TechTag key={tag} name={tag} />)}</div>
                        <Link href={`/solutions/${solution.slug}`} className="sol-link">Explore this discipline <ArrowRight size={15} /></Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sol-section sol-wrap" id="case-studies">
        <div className="sol-head sol-reveal">
          <span className="sol-eyebrow">CASE STUDIES</span>
          <h2 className="sol-h2">Show the constraint. <span>Prove the change.</span></h2>
          <p className="sol-lede">Measurable results on anonymised engagements: the starting condition, the intervention, and the production result.</p>
        </div>
        <div className="sd-proof">
          {caseStudiesData.slice(0, 3).map((study, i) => (
            <button
              type="button"
              className={`sd-proof-card hm-proof ${study.tone} sol-reveal`}
              style={{ "--d": i } as React.CSSProperties}
              key={study.id}
              onClick={() => setLocation(`/case-studies/${study.id}`)}
              aria-label={`View case study: ${study.title}`}
            >
              <span className="sd-proof-type">{study.type}</span>
              <strong>{study.metrics[0].value}</strong>
              <small>{study.metrics[0].label}</small>
              <h3>{study.title}</h3>
              <span className="sol-link">Read the dossier <ArrowUpRight size={15} /></span>
            </button>
          ))}
        </div>
        <div className="hm-more sol-reveal"><Link href="/case-studies" className="button outline small">View all case studies <ArrowRight size={14} /></Link></div>
      </section>

      <ProcessSlider
        id="process"
        label="Process"
        heading={<>From Idea<br />{" "}to Production</>}
        steps={processSteps}
      />

      <section className="sol-section" id="platform">
        <div className="hm-console sol-reveal">
          <div className="hm-console-inner">
          <div className="hm-console-copy">
            <span className="sol-eyebrow">THE RESTART CONSOLE</span>
            <h2 className="sol-h2">No black box <span>between you and the work.</span></h2>
            <p className="sol-lede">Every client workspace gets its own Console: system health, delivery milestones, activity, access, billing, and support in one place.</p>
            <Link href="/platform" className="sol-link">How the Console works <ArrowRight size={15} /></Link>
          </div>
          <div className="hm-console-art saas-art platform-art platform-page-art">
            <DeliveryPreview />
          </div>
          </div>
        </div>
      </section>

      <section className="sol-section sol-wrap" id="work">
        <div className="sol-head sol-reveal">
          <span className="sol-eyebrow">WAYS TO ENGAGE</span>
          <h2 className="sol-h2">Choose the <span>next move.</span></h2>
          <p className="sol-lede">Start with a defined outcome. A short technical review sets scope, timeline, and cost; you get weekly checkpoints and a system your team can run.</p>
        </div>
        <div className="hm-offers">
          {offers.map((offer, i) => (
            <article className={`sol-card hm-offer ${i % 2 ? "violet" : "teal"} sol-reveal`} style={{ "--d": i } as React.CSSProperties} key={offer.kicker}>
              <span className="sol-card-kicker" style={{ marginTop: 0 }}>{offer.kicker} · {offer.duration.toUpperCase()}</span>
              <h3>{offer.title}</h3>
              <p>{offer.text}</p>
              <Link href={`/start-project?tier=${encodeURIComponent(offer.kicker)}`} className="sol-link">{offer.cta} <ArrowUpRight size={14} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="sol-section sol-wrap" id="insights">
        <div className="sol-head sol-reveal">
          <span className="sol-eyebrow">INSIGHTS</span>
          <h2 className="sol-h2">Insights for <span>making decisions.</span></h2>
          <p className="sol-lede">Practical perspectives on architecture, operations, AI, cloud infrastructure, and the decisions that determine whether a system holds up under pressure.</p>
        </div>
        <div className="insight-grid hm-insights">
          {insights.slice(0, 3).map((insight) => (
            <Link key={insight.id} href={`/insights/${insight.id}`} className="insight-card">
              <InsightArt insight={insight} />
              <span>{insight.kicker}{insight.date && <time dateTime={insight.date} className="insight-date"> · {new Date(insight.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>}</span>
              <h3>{insight.title}</h3>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
        <div className="hm-more"><Link className="button outline small" href="/insights">Read all insights <ArrowRight size={14} /></Link></div>
      </section>

      <FaqSection />
      <ContactSection
        eyebrow="READY FOR THE NEXT STAGE?"
        heading={<>Bring us <span>the hard part.</span></>}
        lede="Restart will help you build systems your growth can depend on: reliable enough for today, structured enough for tomorrow, and clear enough for your team to keep improving."
      />
      <SignOff />
    </main>

    <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><LogoMark /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© 2026 Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
  </div>;
}
