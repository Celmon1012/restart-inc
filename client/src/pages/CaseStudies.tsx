import { openCookieSettings } from "@/lib/consent";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, ShieldCheck, Menu, X, ExternalLink } from "lucide-react";
import { caseStudiesData } from "@/data/caseStudies";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import StudyCard from "@/components/StudyCard";
import { FaqSection, ContactSection, SignOff } from "@/components/PageSections";
import { useReveal } from "@/hooks/useReveal";
import "@/styles/solutions.css";

const toneColor: Record<string, string> = {
  teal: "var(--teal)",
  violet: "var(--violet)",
  amber: "var(--amber)",
  blue: "var(--blue)",
};

const PERCENT = /^[−+-]?\d+(\.\d+)?%$/;

export default function CaseStudies() {
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

  // Old deep link: /case-studies?study=<id> now lives at /case-studies/<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("study");
    if (id && caseStudiesData.some((c) => c.id === id)) setLocation(`/case-studies/${id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const bars = caseStudiesData.flatMap((c) =>
    c.metrics
      .filter((m) => PERCENT.test(m.value))
      .map((m) => ({
        id: c.id,
        type: c.type,
        tone: c.tone,
        label: m.label,
        value: m.value,
        width: Math.min(100, Math.abs(parseFloat(m.value.replace("−", "-")))),
      })),
  );

  useReveal([activeCategory]);

  const openOnboarding = (lane?: string) => {
    setLocation(lane ? `/start-project?tier=${encodeURIComponent(lane)}` : "/start-project");
  };

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
        <section className="sol-hero">
          <div className="sol-hero-art" aria-hidden="true">
            <span className="sol-orb a" /><span className="sol-orb b" /><span className="sol-orb c" />
            <span className="sol-hero-grid" />
          </div>
          <div>
            <span className="sol-eyebrow">PRODUCTION DELIVERY DOSSIERS</span>
            <h1>Show the constraint. Prove the <span className="sol-pill">change.</span></h1>
            <p>Documented interventions that remove operational friction, return capacity to teams, and hold up in production.</p>
          </div>
        </section>

        <section className="sol-wrap" id="work">
          <div className="portfolio-filter-row cs-filters">
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
          <div className="cs-list">
            {filteredStudies.map((study, i) => (
              <StudyCard key={study.id} study={study} index={i} onOpen={() => setLocation(`/case-studies/${study.id}`)} />
            ))}
          </div>
        </section>

        {bars.length > 0 && (
          <section className="sol-wrap" id="results">
            <div className="cs-results sol-reveal">
              <div className="sol-head">
                <span className="sol-eyebrow">MEASURED IN PRODUCTION</span>
                <h2 className="sol-h2">Results that <span>held up.</span></h2>
                <p className="sol-lede">The percentage outcomes from the engagements above, as documented in each delivery file.</p>
              </div>
              <div className="cs-bars">
                {bars.map((b) => (
                  <div className="cs-bar-row sol-reveal" key={`${b.id}-${b.label}`} style={{ "--tone": toneColor[b.tone] } as React.CSSProperties}>
                    <div><b>{b.label}</b><small>{b.type}</small></div>
                    <div className="cs-bar" role="img" aria-label={`${b.label}: ${b.value}`}>
                      <i style={{ "--w": `${b.width}%` } as React.CSSProperties} />
                      <em>{b.value}</em>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="portfolio-methodology-section container cs-method">
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

        <FaqSection />
        <ContactSection
          eyebrow="START A CONVERSATION"
          heading={<>Turn the constraint into <span>technical leverage.</span></>}
          lede="Tell us where the work is getting stuck, what it is costing the team, and what needs to change in production."
        />
        <SignOff />
      </main>

      {/* Footer */}
      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>

    </div>
  );
}
