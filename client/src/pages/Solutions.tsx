import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, ChevronRight, Menu, X } from "lucide-react";
import { solutionsData } from "@/data/solutions";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

export default function Solutions() {
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useEffect(() => {
    applyPageSeo({
      title: "Solutions",
      description: "Restart turns operational friction into technical leverage through production-ready platforms, commerce systems, AI engineering, and senior technical direction.",
      path: "/solutions",
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
          <Link href="/solutions" className="active" onClick={() => setMenuOpen(false)}>
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
        <section className="portfolio-hero container">
          <div className="section-intro centered">
            <span className="section-label teal">SYSTEMS WE BUILD</span>
            <h1>Remove the friction <span>slowing growth.</span></h1>
            <p>Restart maps the workflows costing you time, builds the systems that remove them, and delivers the technical foundation your team can run.</p>
          </div>
        </section>

        <section className="lanes-section container">
          <div className="lane-grid">
            {solutionsData.map((solution) => {
              const Icon = solution.icon;
              return (
                <article className={`lane-card ${solution.accent}`} key={solution.slug}>
                  <div className="lane-top">
                    <span className="lane-number">{solution.number}</span>
                    <Icon size={17} />
                  </div>
                  <h3 style={{ fontSize: "24px", fontWeight: "600" }}>{solution.title}</h3>
                  <p>{solution.intro}</p>
                  <div className="tag-row">
                    {solution.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <Link href={`/solutions/${solution.slug}`} className="card-link">
                    Explore {solution.kicker.toLowerCase()} <ArrowRight size={14} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">NEXT STEP</span>
            <h2>Bring us <span>the hard part.</span></h2>
            <p>Tell us where the constraint sits. We will help you identify the next system to build, the capacity it can return, and whether the timing and fit make sense.</p>
            <div className="final-cta-buttons">
              <Link href="/start-project" className="button solid">Tell us where it’s stuck <ArrowUpRight size={15} /></Link>
              <Link href="/platform" className="button outline">How the platform works <ChevronRight size={15} /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
