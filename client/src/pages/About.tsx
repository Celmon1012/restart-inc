import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Activity, ArrowRight, ArrowUpRight, Layers3, Menu, Target, UserCheck, X } from "lucide-react";
import { solutionsData } from "@/data/solutions";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { caseStudiesData } from "@/data/caseStudies";
import CountUp from "@/components/CountUp";
import ToolsHub from "@/components/ToolsHub";
import { FaqSection, ContactSection, SignOff, StackMarquee } from "@/components/PageSections";
import { useReveal } from "@/hooks/useReveal";
import "@/styles/solutions.css";

/** First headline result from each of the first three case studies. */
const stats = caseStudiesData.slice(0, 3).map((c) => ({ id: c.id, type: c.type, label: c.metrics[0].label, value: c.metrics[0].value }));

const principles = [
  {
    icon: UserCheck,
    title: "Senior ownership, not delegation.",
    text: "The person who scopes your system is the person who builds it — never handed off to a junior once the contract is signed.",
  },
  {
    icon: Activity,
    title: "Production discipline by default.",
    text: "Every engagement ships with observability, tests, and a handoff your team can actually run without us.",
  },
  {
    icon: Target,
    title: "Scoped, not open-ended.",
    text: "Time-boxed engagements with a defined outcome — audits, sprints, and builds, not a retainer that never resolves.",
  },
  {
    icon: Layers3,
    title: "Named tools, not a proprietary layer.",
    text: "Everything we build runs on open, documented technology you could hire for tomorrow, so the system stays yours and stays operable.",
  },
];

export default function About() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useReveal();

  useEffect(() => {
    applyPageSeo({
      title: "About",
      description: "Restart Inc. builds the systems your growth depends on — turning operational friction into technical leverage and giving your team time back.",
      path: "/about",
    });
    return () => resetSeoToDefault();
  }, []);

  return (
    <div className="page-shell sol-page">
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
            <span>CASE STUDIES</span>
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
        <section className="sol-hero">
          <div className="sol-hero-art" aria-hidden="true">
            <span className="sol-orb a" /><span className="sol-orb b" /><span className="sol-orb c" />
            <span className="sol-hero-grid" />
          </div>
          <div>
            <span className="sol-eyebrow">OUR STORY</span>
            <h1>Build the systems your growth <span className="sol-pill">depends on.</span></h1>
            <p>Restart helps ambitious teams turn operational friction into technical leverage. We map the workflows costing you most, build the systems that remove them, and stay accountable through production.</p>
          </div>
        </section>

        <section className="sol-section sol-wrap" id="story">
          <div className="ab-story">
            <div className="ab-loc sol-reveal">
              <div className="ab-globe" aria-hidden="true">
                <span className="m m1" /><span className="m m2" /><span className="m m3" />
                <span className="ab-pin"><i /></span>
              </div>
              <div className="ab-loc-copy">
                <span className="ab-live"><i />Working with teams worldwide</span>
                <h2>Registered in <span>Nigeria.</span></h2>
                <p>Restart Integrated Systems Ltd</p>
                <Link href="/start-project" className="button solid">Start a project <ArrowUpRight size={15} /></Link>
              </div>
            </div>
            <div className="ab-mission sol-reveal" style={{ "--d": 1 } as React.CSSProperties}>
              <span className="sol-eyebrow">OUR MISSION</span>
              <p>The result is not more software to manage. It is fewer manual handoffs, clearer ownership, and more capacity for the work only your team can do.</p>
              <p>We give you back your most precious asset: your time.</p>
            </div>
          </div>
          <StackMarquee />
        </section>

        <section className="sol-section sol-wrap" id="principles">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">HOW WE WORK</span>
            <h2 className="sol-h2">Guided by <span>principles.</span></h2>
          </div>
          <div className="ab-principles">
            {principles.map(({ icon: Icon, title, text }, i) => (
              <article className="ab-principle sol-reveal" style={{ "--d": i } as React.CSSProperties} key={title}>
                <span className="ab-principle-icon"><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sol-section sol-wrap" id="tools">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">TOOLS</span>
            <h2 className="sol-h2">We work with <span>named tools.</span></h2>
            <p className="sol-lede">Everything we build runs on open, documented technology you could hire for tomorrow. If we part ways, the system stays yours.</p>
          </div>
          <ToolsHub />
        </section>

        <section className="sol-section sol-wrap" id="results">
          <div className="ab-stats sol-reveal">
            <div className="ab-stats-head">
              <span className="sol-eyebrow">MEASURED</span>
              <h2 className="sol-h2">Results from <span>real systems.</span></h2>
            </div>
            <div className="ab-stats-grid">
              {stats.map((s) => (
                <div key={s.id}>
                  <strong><CountUp value={s.value} /></strong>
                  <b>{s.label}</b>
                  <small>{s.type}</small>
                </div>
              ))}
            </div>
            <Link href="/case-studies" className="sol-link">See the case studies <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className="sol-section sol-wrap" id="disciplines">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">WHAT WE DO</span>
            <h2 className="sol-h2">Four disciplines, <span>one standard.</span></h2>
            <p className="sol-lede">Architecture, automation, product engineering, and production discipline, so a decision turns into a system without becoming a liability.</p>
          </div>
          <div className="sd-more ab-disciplines">
            {solutionsData.map((lane, i) => (
              <Link href={`/solutions/${lane.slug}`} className="sol-row sd-more-card sol-reveal" style={{ "--d": i } as React.CSSProperties} key={lane.slug}>
                <span className="sol-row-num">{lane.number}</span>
                <span className="sd-more-title">{lane.kicker}</span>
                <p>{lane.intro}</p>
                <span className="sol-link">Explore <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>

        <FaqSection />
        <ContactSection
          eyebrow="READY FOR THE NEXT STAGE?"
          heading={<>Bring us <span>the hard part.</span></>}
          lede="Restart will help you build systems your growth can depend on: reliable enough for today, structured enough for tomorrow, and clear enough to give your team time back."
        />
        <SignOff />
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
