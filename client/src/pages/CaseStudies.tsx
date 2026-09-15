import React, { useState } from "react";
import { Link } from "wouter";
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
    setOnboardingLane(lane);
    setOnboardingOpen(true);
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
            <button className="header-cta" onClick={() => openOnboarding()}>Start a Project <ArrowUpRight size={14} /></button>
          </div>
        </nav>
        <div className="header-actions">
          <Link href="/" className="login-link">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <button className="header-cta" onClick={() => openOnboarding()}>
            Start a Project <ArrowUpRight size={14} />
          </button>
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
            <button className="button solid" onClick={() => openOnboarding()}>Tell us what you’re building <ArrowUpRight size={15} /></button>
            <Link href="/" className="button outline">Back to Home <ChevronRight size={15} /></Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer container">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="restart-mark" aria-hidden="true"><span /></span>
              <strong>RESTART<span>.</span></strong>
            </div>
            <p>Engineering growth systems for serious operators.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <strong>NAVIGATION</strong>
              <Link href="/">Home</Link>
              <Link href="/case-studies">All Case Studies</Link>
              <Link href="/#solutions">Four Lanes</Link>
              <Link href="/#work">Productized Offers</Link>
            </div>
            <div className="footer-col">
              <strong>DELIVERY LANES</strong>
              <span>Laravel SaaS</span>
              <span>Shopify Plus Apps</span>
              <span>AI Engineering</span>
              <span>Architecture Leadership</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span>
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Back to top ↑</a>
        </div>
      </footer>

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
