import { useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, ChevronRight, Menu, X } from "lucide-react";
import { insightsData } from "@/data/insights";

export default function Insights() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  const categories = [
    { id: "all", label: "All Insights", count: insightsData.length },
    { id: "engineering", label: "Engineering", count: insightsData.filter(i => i.category === "engineering").length },
    { id: "operations", label: "Operations", count: insightsData.filter(i => i.category === "operations").length },
    { id: "architecture", label: "Architecture", count: insightsData.filter(i => i.category === "architecture").length },
  ];

  const filteredInsights = activeCategory === "all"
    ? insightsData
    : insightsData.filter((i) => i.category === activeCategory);

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
        {/* Insights Hero Banner */}
        <section className="portfolio-hero container">
          <div className="section-intro centered">
            <span className="section-label teal">INSIGHTS</span>
            <h1>Insights for people making<br /><span>consequential product decisions.</span></h1>
            <p>
              Practical perspectives on architecture, operations, AI, cloud infrastructure, and the decisions that determine whether a system holds up under pressure.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="portfolio-filter-row">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`portfolio-filter-btn ${activeCategory === cat.id ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span className="filter-count">{cat.count}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Insights Grid */}
        <section className="portfolio-grid-section container">
          <div className="insight-grid">
            {filteredInsights.map((insight) => {
              const Icon = insight.icon;
              return (
                <a key={insight.id} href="#" className="insight-card" onClick={(e) => e.preventDefault()}>
                  <div className={`insight-image ${insight.image}`}><Icon size={40} /></div>
                  <span>{insight.kicker}</span>
                  <h3>{insight.title}</h3>
                  <ArrowUpRight size={15} />
                </a>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA Section */}
        <section className="final-cta container">
          <span className="section-label teal">START A CONVERSATION</span>
          <h2>Have a system in mind?<br /><span>Let's talk about it.</span></h2>
          <p>Tell us what you are building, where your architecture is feeling pressure, or which migration you need to execute with zero downtime.</p>
          <div className="hero-buttons">
            <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
            <Link href="/case-studies" className="button outline">See our work <ChevronRight size={15} /></Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><span className="restart-mark" aria-hidden="true"><span /></span><span>RESTART<span className="logo-dot">.</span></span></Link><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/#about">About</Link><Link href="/start-project">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>

    </div>
  );
}
