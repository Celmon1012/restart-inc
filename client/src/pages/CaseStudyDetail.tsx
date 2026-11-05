import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, ExternalLink, Menu, X } from "lucide-react";
import { caseStudiesData } from "@/data/caseStudies";
import { techLogo } from "@/data/stack";
import { ContactSection, SignOff } from "@/components/PageSections";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { useReveal } from "@/hooks/useReveal";
import "@/styles/solutions.css";

export default function CaseStudyDetail({ params }: { params: { id: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  const index = caseStudiesData.findIndex((c) => c.id === params.id);
  const study = caseStudiesData[index];
  const next = caseStudiesData[(index + 1) % caseStudiesData.length];

  useReveal([params.id]);

  useEffect(() => {
    if (!study) return;
    applyPageSeo({
      title: study.title,
      description: study.summary,
      path: `/case-studies/${study.id}`,
    });
    window.scrollTo(0, 0);
    return () => resetSeoToDefault();
  }, [study]);

  if (!study) {
    return (
      <div className="page-shell">
        <main className="squeeze-main container" style={{ textAlign: "center" }}>
          <h1>Case study not found</h1>
          <p className="squeeze-subheading" style={{ margin: "12px auto 24px" }}>That case study doesn't exist.</p>
          <Link href="/case-studies" className="button solid">All case studies</Link>
        </main>
      </div>
    );
  }

  const words = study.title.split(" ");
  const titleTail = words.slice(-2).join(" ");
  const titleHead = words.slice(0, -2).join(" ");
  const industry = study.type.split("/")[0].trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const num = String(index + 1).padStart(2, "0");

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
            <span className="sol-eyebrow">{study.type}</span>
            <h1>{titleHead} <span className="sol-pill">{titleTail}</span></h1>
            <p>{study.summary}</p>
            <div className="sol-hero-actions">
              <Link href={`/start-project?tier=${encodeURIComponent(study.title)}`} className="button solid">Discuss a similar project <ArrowUpRight size={15} /></Link>
              <Link href="/case-studies" className="button outline">All case studies <ChevronRight size={15} /></Link>
            </div>
          </div>
        </section>

        <section className="sol-wrap cd-top">
          <div className={`cd-panel ${study.tone} sol-reveal`}>
            <span className="cs-rings" aria-hidden="true" />
            <span className="cs-type">{study.type}</span>
            <span className="cs-index" aria-hidden="true">{num}</span>
            <div className="cd-metrics">
              {study.metrics.map((m) => (
                <div key={m.label}>
                  <strong>{m.value}</strong>
                  <small>{m.label}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`sol-wrap cd-body ${study.tone}`}>
          <div className="cd-block sol-reveal">
            <h2 className="sd-h">Project details</h2>
            <p className="sd-text">{study.details}</p>
            <dl className="cd-facts">
              <div><dt>CLIENT</dt><dd>{study.client}</dd></div>
              <div><dt>INDUSTRY</dt><dd>{industry}</dd></div>
              <div className="wide"><dt>DELIVERABLES</dt><dd><span className="sol-tags">{study.tags.map((t) => <span key={t}>{t}</span>)}</span></dd></div>
            </dl>
            {study.href && (
              <a href={study.href} className="sol-link" target="_blank" rel="noreferrer">Read the published write-up <ExternalLink size={15} /></a>
            )}
          </div>

          <div className="cd-block sol-reveal">
            <h2 className="sd-h">The constraint</h2>
            <p className="sd-text">{study.challenge}</p>
          </div>

          <div className="cd-stack sol-reveal">
            <span className="cd-stack-label">BUILT WITH</span>
            <div className="cd-stack-chips">
              {study.stack.map((s) => {
                const logo = techLogo(s);
                return <span key={s}>{logo && <img src={logo} alt="" />}{s}</span>;
              })}
            </div>
          </div>

          <div className="cd-block sol-reveal">
            <h2 className="sd-h">What we built</h2>
            <p className="sd-text">{study.solution}</p>
          </div>

          <div className="cd-block sol-reveal">
            <h2 className="sd-h">Project results</h2>
            <ul className="sd-checks cd-results">
              {study.results.map((r) => <li key={r}><Check size={16} />{r}</li>)}
            </ul>
          </div>
        </section>

        <section className="sol-section sol-wrap" id="next">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">NEXT CASE STUDY</span>
            <h2 className="sol-h2">Keep <span>reading.</span></h2>
          </div>
          <Link href={`/case-studies/${next.id}`} className={`cd-next ${next.tone} sol-reveal`}>
            <span className="cd-next-type">{next.type}</span>
            <strong>{next.metrics[0].value}</strong>
            <small>{next.metrics[0].label}</small>
            <h3>{next.title}</h3>
            <span className="sol-link">Read the case study <ArrowRight size={15} /></span>
          </Link>
        </section>

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
