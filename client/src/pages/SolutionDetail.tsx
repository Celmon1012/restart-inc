import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Menu, X } from "lucide-react";
import { solutionsData } from "@/data/solutions";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { offers } from "@/data/offers";
import { caseStudiesData } from "@/data/caseStudies";
import { FaqSection, ContactSection, SignOff } from "@/components/PageSections";
import { useReveal } from "@/hooks/useReveal";
import "@/styles/solutions.css";

/** Which scoped engagement and which case-study category belong to each discipline. */
const engagementFor: Record<string, string> = {
  saas: "MVP BUILD",
  medusa: "MEDUSA COMMERCE BUILD",
  ai: "AI INTEGRATION SPRINT",
  architecture: "ARCHITECTURE AUDIT",
};
const categoryFor: Record<string, string> = {
  "saas-platforms": "saas",
  commerce: "commerce",
  "ai-engineering": "ai",
  "architecture-leadership": "infrastructure",
};

export default function SolutionDetail({ params }: { params: { slug: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  const solution = solutionsData.find((s) => s.slug === params.slug);
  useReveal([params.slug]);

  useEffect(() => {
    if (!solution) return;
    applyPageSeo({
      title: solution.title,
      description: solution.intro,
      path: `/solutions/${solution.slug}`,
    });
    return () => resetSeoToDefault();
  }, [solution]);

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
  const words = solution.title.split(" ");
  const titleTail = words.slice(-1)[0];
  const titleHead = words.slice(0, -1).join(" ");
  const engagement = offers.find((x) => x.kicker === engagementFor[solution.tierId]);
  const related = caseStudiesData.filter((c) => c.category === categoryFor[solution.slug]).slice(0, 3);
  const others = solutionsData.filter((s) => s.slug !== solution.slug);

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
          <Link href="/solutions" className="active" onClick={() => setMenuOpen(false)}>
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
            <span className="sol-eyebrow">DISCIPLINE {solution.number} / {solution.kicker}</span>
            <h1>{titleHead} <span className="sol-pill">{titleTail}</span></h1>
            <p>{solution.intro}</p>
            <div className="sol-hero-actions">
              <Link href={`/start-project?tier=${encodeURIComponent(solution.tierId)}`} className="button solid">Start a project <ArrowUpRight size={15} /></Link>
              <Link href="/solutions" className="button outline">All solutions <ChevronRight size={15} /></Link>
            </div>
          </div>
        </section>

        <section className="sol-wrap sd-top">
          <div className={`sd-visual ${solution.accent} sol-reveal`}>
            <span className="cs-rings" aria-hidden="true" />
            <span className="sd-number" aria-hidden="true">{solution.number}</span>
            <span className="sd-icon" aria-hidden="true"><Icon size={34} /></span>
            <span className="sd-kicker">{solution.kicker}</span>
            <div className="sd-chips">{solution.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </div>

          <div className="sd-intro">
            <div className="sol-reveal">
              <h2 className="sd-h">What this covers</h2>
              <p className="sd-text">{solution.description}</p>
            </div>
            <aside className="sol-reveal" style={{ "--d": 1 } as React.CSSProperties}>
              <h3 className="sd-h small">Built with</h3>
              <div className="sol-tags">{solution.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            </aside>
          </div>
        </section>

        <section className="sol-wrap sd-deliver" id="deliverables">
          <div className="sd-deliver-copy sol-reveal">
            <span className="sol-eyebrow">DELIVERABLES</span>
            <h2 className="sol-h2">What you <span>keep.</span></h2>
            <p className="sol-lede">Every deliverable is yours whether or not we do the next step.</p>
            <ul className="sd-checks">
              {solution.deliverables.map((item) => <li key={item}><Check size={16} />{item}</li>)}
            </ul>
          </div>
          {engagement && (
            <aside className="sol-plan feature sd-engagement sol-reveal" style={{ "--d": 1 } as React.CSSProperties}>
              <span className="sol-plan-tag">{engagement.kicker} · {engagement.duration.toUpperCase()}</span>
              <h3 style={{ fontSize: "1.5rem", lineHeight: 1.2 }}>{engagement.title}</h3>
              <p>{engagement.text}</p>
              <Link href={`/start-project?tier=${encodeURIComponent(engagement.kicker)}`} className="button solid">{engagement.cta} <ArrowUpRight size={15} /></Link>
            </aside>
          )}
        </section>

        {related.length > 0 && (
          <section className="sol-section sol-wrap" id="proof">
            <div className="sol-head sol-reveal">
              <span className="sol-eyebrow">PROOF</span>
              <h2 className="sol-h2">Measured <span>in production.</span></h2>
            </div>
            <div className="sd-proof">
              {related.map((study, i) => (
                <Link href={`/case-studies?study=${study.id}`} className={`sd-proof-card ${study.tone} sol-reveal`} style={{ "--d": i } as React.CSSProperties} key={study.id}>
                  <span className="sd-proof-type">{study.type}</span>
                  <strong>{study.metrics[0].value}</strong>
                  <small>{study.metrics[0].label}</small>
                  <h3>{study.title}</h3>
                  <span className="sol-link">Read the case study <ArrowRight size={15} /></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="sol-section sol-wrap" id="more">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">MORE DISCIPLINES</span>
            <h2 className="sol-h2">Keep <span>exploring.</span></h2>
          </div>
          <div className="sd-more">
            {others.map((s, i) => (
              <Link href={`/solutions/${s.slug}`} className="sol-row sd-more-card sol-reveal" style={{ "--d": i } as React.CSSProperties} key={s.slug}>
                <span className="sol-row-num">{s.number}</span>
                <span className="sd-more-title">{s.kicker}</span>
                <p>{s.intro}</p>
                <span className="sol-link">Explore <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>

        <FaqSection />
        <ContactSection
          eyebrow="NEXT STEP"
          heading={<>Ready to scope <span>{solution.kicker.toLowerCase()}?</span></>}
          lede="Tell us what you are building and where the constraint sits. We will tell you quickly whether the timing and fit make sense."
        />
        <SignOff />
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
