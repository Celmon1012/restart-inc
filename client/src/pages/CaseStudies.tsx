import { openCookieSettings } from "@/lib/consent";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, ShieldCheck, Menu, X, ExternalLink } from "lucide-react";
import { caseStudiesData, CaseStudy } from "@/data/caseStudies";
import CaseStudyModal from "@/components/CaseStudyModal";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

export default function CaseStudies() {
  const [selectedStudy, setSelectedStudy] = useState<CaseStudy | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useEffect(() => {
    applyPageSeo({
      title: "Case Studies",
      description: "Proof of technical leverage from Restart Inc. engagements — the operational constraint, the system built, and the measurable production result.",
      path: "/case-studies",
    });
    return () => resetSeoToDefault();
  }, []);

  // Deep link: /case-studies?study=<id> opens that study (used by the homepage
  // stats bar and llms.txt).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("study");
    const study = id && caseStudiesData.find((c) => c.id === id);
    if (study) setSelectedStudy(study);
  }, []);

  const categories = [
    { id: "all", label: "All Deliveries", count: caseStudiesData.length },
    { id: "infrastructure", label: "Private Cloud & Infrastructure", count: caseStudiesData.filter(c => c.category === "infrastructure").length },
    { id: "ai", label: "AI & Agentic Systems", count: caseStudiesData.filter(c => c.category === "ai").length },
    { id: "commerce", label: "Commerce Infrastructure", count: caseStudiesData.filter(c => c.category === "commerce").length },
    { id: "saas", label: "Multi-Tenant SaaS", count: caseStudiesData.filter(c => c.category === "saas").length },
  ];

  const filteredStudies = activeCategory === "all"
    ? caseStudiesData
    : caseStudiesData.filter((c) => c.category === activeCategory);

  const openOnboarding = (lane?: string) => {
    setLocation(lane ? `/start-project?tier=${encodeURIComponent(lane)}` : "/start-project");
  };

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
        {/* Portfolio Hero Banner */}
        <section className="portfolio-hero container">
          <div className="section-intro centered">
            <span className="section-label teal">PRODUCTION DELIVERY DOSSIERS</span>
            <h1>Show the work.<br /><span>Prove the difference.</span></h1>
            <p>
              Documented interventions that remove operational friction, return capacity to teams, and hold up in production.
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

        {/* Portfolio Grid */}
        <section className="portfolio-grid-section container">
          <div className="case-study-grid">
            {filteredStudies.map((study, i) => (
              <article
                className={`case-study-card ${study.tone} clickable-card`}
                key={study.id}
                onClick={() => setSelectedStudy(study)}
                tabIndex={0}
                role="button"
                aria-label={`View case study: ${study.title}`}
              >
                <div className="case-study-top">
                  <span className={`section-label ${study.tone}`}>{study.type}</span>
                  <span className="case-study-index">0{i + 1}</span>
                </div>
                <h3>{study.title}</h3>
                <p>{study.summary}</p>
                <div className="case-tags">
                  {study.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="outcome-grid">
                  {study.metrics.map((m) => (
                    <div key={m.label}>
                      <small>{m.label}</small>
                      <strong>{m.value}</strong>
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
        </section>

        {/* Engineering Methodology Banner */}
        <section className="portfolio-methodology-section container">
          <div className="portfolio-method-box">
            <div className="method-box-header">
              <span className="section-label violet">OPERATING DISCIPLINE</span>
                  <h2>How we turn friction into leverage</h2>
                  <p>Every Restart engagement follows a clear production cadence designed to return capacity without introducing a new operational burden.</p>
            </div>
            <div className="method-steps-grid">
              <div className="method-step">
                <span className="step-num">01</span>
                <h4>Senior Architecture Audit</h4>
                <p>We trace bottlenecks, database locks, and latency ceilings directly in code—no guesswork.</p>
              </div>
              <div className="method-step">
                <span className="step-num">02</span>
                <h4>Zero-Downtime Execution</h4>
                <p>Idempotent migrations, parallel replication, and safe feature flags protect continuous operations.</p>
              </div>
              <div className="method-step">
                <span className="step-num">03</span>
                <h4>Hardened SLAs & Proof</h4>
                <p>Telemetry instrumentation and regression eval suites prove performance before client sign-off.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Section */}
        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">START A CONVERSATION</span>
            <h2>Turn the constraint into<br /><span>technical leverage.</span></h2>
            <p>Tell us where the work is getting stuck, what it is costing the team, and what needs to change in production.</p>
            <div className="final-cta-buttons">
              <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
              <Link href="/" className="button outline">Back to Home <ChevronRight size={15} /></Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>

      {/* Case Study Detail Modal */}
      <CaseStudyModal
        isOpen={!!selectedStudy}
        onClose={() => setSelectedStudy(null)}
        caseStudy={selectedStudy}
        onDiscuss={(title) => {
          setSelectedStudy(null);
          openOnboarding(title);
        }}
      />

    </div>
  );
}
