import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, ShieldCheck, ArrowLeft, Menu, X, ExternalLink } from "lucide-react";
import { caseStudiesData, CaseStudy } from "@/data/caseStudies";
import CaseStudyModal from "@/components/CaseStudyModal";
import { OnboardingModal } from "@/components/OnboardingModal";

export default function CaseStudies() {
  const [selectedStudy, setSelectedStudy] = useState<CaseStudy | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingLane, setOnboardingLane] = useState<string | undefined>(undefined);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

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
        <div className="header-left">
          <Link href="/" className="logo-link">
            <span className="restart-mark" aria-hidden="true"><span /></span>
            <strong>RESTART<span>.</span></strong>
          </Link>
          <span className="header-divider" />
          <span className="header-subtitle">CASE STUDIES</span>
        </div>
        <nav className={`main-nav ${menuOpen ? "open" : ""}`}>
          <Link href="/#platform" onClick={() => setMenuOpen(false)}><span>PLATFORM</span></Link>
          <Link href="/#solutions" onClick={() => setMenuOpen(false)}><span>SOLUTIONS</span></Link>
          <Link href="/#work" onClick={() => setMenuOpen(false)}><span>OFFERS</span></Link>
          <Link href="/case-studies" className="active" onClick={() => setMenuOpen(false)}>
            <span>CASE STUDIES</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/#insights" onClick={() => setMenuOpen(false)}><span>INSIGHTS</span></Link>
          <div className="mobile-nav-actions">
            <Link href="/start-project" className="header-cta">Start a Project <ArrowUpRight size={14} /></Link>
          </div>
        </nav>
        <div className="header-actions">
          <Link href="/" className="login-link">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <Link href="/start-project" className="header-cta">
            Start a Project <ArrowUpRight size={14} />
          </Link>
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
              Documented engineering interventions, verified client outcomes, and battle-tested production architectures built for serious operators.
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
              <h2>How We Deliver With Zero Surprise</h2>
              <p>Every Restart engagement follows an unyielding production cadence designed to de-risk technical choices before they impact your growth.</p>
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
        <section className="final-cta container">
          <span className="section-label teal">START A CONVERSATION</span>
          <h2>Build your system with<br /><span>senior engineering rigor.</span></h2>
          <p>Tell us what you are building, where your architecture is feeling pressure, or which migration you need to execute with zero downtime.</p>
          <div className="hero-buttons">
            <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
            <Link href="/" className="button outline">Back to Home <ChevronRight size={15} /></Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><span className="restart-mark" aria-hidden="true"><span /></span><span>RESTART<span className="logo-dot">.</span></span></Link><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/#about">About</Link><Link href="/start-project">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>

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

      {/* Onboarding Inquiry Modal */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        initialLane={onboardingLane}
      />
    </div>
  );
}
