import { useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Menu, X } from "lucide-react";
import { solutionsData } from "@/data/solutions";

export default function SolutionDetail({ params }: { params: { slug: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  const solution = solutionsData.find((s) => s.slug === params.slug);

  if (!solution) {
    return (
      <div className="page-shell">
        <main className="squeeze-main container" style={{ textAlign: "center" }}>
          <h1>Solution not found</h1>
          <p className="squeeze-subheading" style={{ margin: "12px auto 24px" }}>That discipline page doesn't exist.</p>
          <Link href="/" className="button solid">Back to Home</Link>
        </main>
      </div>
    );
  }

  const Icon = solution.icon;

  return (
    <div className="page-shell">
      {/* Header Navigation */}
      <header className="site-header">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <span className="restart-mark" aria-hidden="true"><span /></span>
          <span>RESTART INC<span className="logo-dot">.</span></span>
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
          <Link href="/#about" onClick={() => setMenuOpen(false)}>
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
        {/* Solution Hero */}
        <section className="portfolio-hero container">
          <div className="section-intro centered">
            <span className={`section-label ${solution.accent}`}>DISCIPLINE {solution.number} / {solution.kicker}</span>
            <h1>{solution.title}</h1>
            <p>{solution.intro}</p>
          </div>
        </section>

        {/* Solution Detail */}
        <section className="portfolio-grid-section container">
          <div className={`lane-card ${solution.accent}`} style={{ minHeight: "auto", padding: "36px 34px" }}>
            <div className="lane-top">
              <span className="lane-number">{solution.number}</span>
              <Icon size={20} />
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.75, color: "#b0b7c7", marginTop: 22, maxWidth: 720 }}>{solution.description}</p>
            <div className="tag-row" style={{ marginTop: 24 }}>
              {solution.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          </div>

          <div className="offer-specs" style={{ marginTop: 14, maxWidth: 500 }}>
            <div className="spec-tabs"><span className="active">DELIVERABLES</span></div>
            <ul>
              {solution.deliverables.map((item) => <li key={item}><Check size={13} />{item}</li>)}
            </ul>
          </div>
        </section>

        {/* Bottom CTA Section */}
        <section className="final-cta container">
          <span className={`section-label ${solution.accent}`}>NEXT STEP</span>
          <h2>Ready to scope<br /><span>{solution.kicker.toLowerCase()}?</span></h2>
          <p>Tell us what you are building and where the constraint sits. We will tell you quickly whether the timing and fit make sense.</p>
          <div className="hero-buttons">
            <Link href={`/start-project?tier=${encodeURIComponent(solution.tierId)}`} className="button solid">Start a project <ArrowUpRight size={15} /></Link>
            <Link href="/" className="button outline">Explore all solutions <ChevronRight size={15} /></Link>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><span className="restart-mark" aria-hidden="true"><span /></span><span>RESTART<span className="logo-dot">.</span></span></Link><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/#about">About</Link><Link href="/contact">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>
    </div>
  );
}
