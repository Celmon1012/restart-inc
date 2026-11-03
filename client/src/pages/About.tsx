import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Activity, ArrowRight, ArrowUpRight, Menu, ShieldCheck, Target, UserCheck, X } from "lucide-react";
import { solutionsData } from "@/data/solutions";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

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
];

export default function About() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useEffect(() => {
    applyPageSeo({
      title: "About",
      description: "Restart Inc. builds the systems your growth depends on — turning operational friction into technical leverage and giving your team time back.",
      path: "/about",
    });
    return () => resetSeoToDefault();
  }, []);

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
        {/* Our Story */}
        <section className="saas-section container">
          <div className="saas-wrap">
            <div className="saas-copy">
              <span className="section-label teal">OUR STORY</span>
              <h1>Build the systems <span>your growth depends on.</span></h1>
              <p>
                Restart helps ambitious teams turn operational friction into technical leverage. We map the workflows
                costing you most, build the systems that remove them, and stay accountable through production.
              </p>
              <p>
                The result is not more software to manage. It is fewer manual handoffs, clearer ownership, and more
                capacity for the work only your team can do. We give you back your most precious asset — your time.
              </p>
            </div>
            <div className="saas-art">
              <div className="art-grid" />
              <div className="art-ring ring-a" />
              <div className="art-ring ring-b" />
              <div className="art-label"><ShieldCheck size={14} />OWNERSHIP / 01</div>
            </div>
          </div>
          <div className="proof-grid cols-3">
            {principles.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <Icon size={18} />
                <strong>{title}</strong>
                <p>{text}</p>
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
            <span className="section-label teal">READY FOR THE NEXT STAGE?</span>
            <h2>Bring us <span>the hard part.</span></h2>
            <p>Restart will help you build systems your growth can depend on—reliable enough for today, structured enough for tomorrow, and clear enough to give your team time back.</p>
            <div className="final-cta-buttons">
            <Link href="/start-project" className="button solid">Tell us where it's stuck <ArrowUpRight size={15} /></Link>
              <Link href="/contact" className="button outline">Get in touch</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
