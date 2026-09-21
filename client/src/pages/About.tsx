import { useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Menu, ShieldCheck, Target, Users, X } from "lucide-react";
import { solutionsData } from "@/data/solutions";

const principles = [
  {
    title: "Senior ownership, not delegation.",
    text: "The person who scopes your system is the person who builds it — never handed off to a junior once the contract is signed.",
  },
  {
    title: "Production discipline by default.",
    text: "Every engagement ships with observability, tests, and a handoff your team can actually run without us.",
  },
  {
    title: "Scoped, not open-ended.",
    text: "Time-boxed engagements with a defined outcome — audits, sprints, and builds, not a retainer that never resolves.",
  },
];

const facts = [
  {
    icon: ShieldCheck,
    title: "Senior technical ownership",
    text: "Lead architects and engineers work on your core infrastructure directly — never outsourced or passed to juniors.",
  },
  {
    icon: Target,
    title: "Registered & scoped to deliver",
    text: "Restart operates as Restart Integrated Systems Ltd, a CAC-registered engineering firm based in Nigeria, working with operators globally.",
  },
  {
    icon: Users,
    title: "Direct access, no relay",
    text: "You talk to the engineer building your system — not an account manager passing along notes.",
  },
];

export default function About() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  return (
    <div className="page-shell">
      {/* Header Navigation */}
      <header className="site-header">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <nav className={menuOpen ? "open" : ""}>
          <Link href="/#platform" onClick={() => setMenuOpen(false)}>
            <span>PLATFORM</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/#solutions" onClick={() => setMenuOpen(false)}>
            <span>SOLUTIONS</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/#work" onClick={() => setMenuOpen(false)}>
            <span>WAYS TO ENGAGE</span>
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
          <Link href="/about" className={location.startsWith("/about") ? "active" : ""} onClick={() => setMenuOpen(false)}>
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

      <main>
        {/* Hero */}
        <section className="portfolio-hero container">
          <div className="section-intro centered">
            <span className="section-label teal">ABOUT RESTART</span>
            <h1>The engineering partner<br /><span>for the hard parts.</span></h1>
            <p>
              Restart exists for the point where a good product idea meets real-world complexity — tangled workflows,
              systems that stop communicating, AI added without the controls to make it trustworthy, and growth that
              exposes assumptions no one documented.
            </p>
          </div>
        </section>

        {/* Our Story */}
        <section className="saas-section container">
          <div className="saas-wrap">
            <div className="saas-copy">
              <span className="section-label teal">OUR STORY</span>
              <h2>Why Restart exists.</h2>
              <p>
                Most technical failures aren't dramatic. They're a tenancy boundary that leaks quietly, a migration
                that goes fine until it doesn't, an AI feature that worked in the demo and nowhere else. Restart
                exists to make sure the decisions holding your system together are made by someone senior enough to
                see them coming — and to stay accountable for them through production, not just through launch.
              </p>
              <div className="saas-points">
                {principles.map((p) => (
                  <div key={p.title}>
                    <strong>{p.title}</strong>
                    <span>{p.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="saas-art">
              <div className="art-grid" />
              <div className="art-ring ring-a" />
              <div className="art-ring ring-b" />
              <div className="art-label"><ShieldCheck size={14} />OWNERSHIP / 01</div>
            </div>
          </div>
        </section>

        {/* How we work / facts */}
        <section className="about-facts-section container">
          <div className="section-intro centered">
            <span className="section-label teal">HOW WE WORK</span>
            <h2>Founded and led by <span>Ademola Usuf.</span></h2>
            <p>
              Restart is founded and led by Ademola Usuf, and operates as Restart Integrated Systems Ltd — a
              CAC-registered engineering firm based in Nigeria, working with ambitious builders and operators
              globally.
            </p>
          </div>
          <div className="about-facts-grid">
            {facts.map((fact) => (
              <div className="about-fact-card" key={fact.title}>
                <fact.icon size={20} className="text-teal" />
                <h4>{fact.title}</h4>
                <p>{fact.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What we do */}
        <section className="lanes-section container" id="disciplines">
          <div className="section-intro centered">
            <span className="section-label teal">WHAT WE DO</span>
            <h2>Four disciplines, <span>one standard.</span></h2>
            <p>Restart brings architecture, automation, product engineering, and production discipline together so bold ideas can move from decision to delivery without becoming a technical liability.</p>
          </div>
          <div className="lane-grid">
            {solutionsData.map((lane) => {
              const Icon = lane.icon;
              return (
                <article className={`lane-card ${lane.accent}`} key={lane.slug}>
                  <div className="lane-top">
                    <span className="lane-number">{lane.number}</span>
                    <Icon size={17} />
                  </div>
                  <h3 style={{ fontSize: "24px", fontWeight: "600" }}>{lane.title}</h3>
                  <p>{lane.intro}</p>
                  <Link href={`/solutions/${lane.slug}`} className="card-link">
                    Explore {lane.kicker.toLowerCase()} <ArrowRight size={14} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">READY TO WORK TOGETHER?</span>
            <h2>Bring us <span>the hard part.</span></h2>
            <p>Restart will help you turn it into a system that can ship, scale, and keep its promises.</p>
            <div className="final-cta-buttons">
              <Link href="/start-project" className="button solid">Tell us what you're building <ArrowUpRight size={15} /></Link>
              <Link href="/contact" className="button outline">Get in touch</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>
    </div>
  );
}
