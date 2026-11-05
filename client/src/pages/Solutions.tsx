import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Menu, X } from "lucide-react";
import { solutionsData } from "@/data/solutions";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { platformStack } from "@/data/stack";
import { useReveal } from "@/hooks/useReveal";
import { FaqSection, ContactSection, SignOff } from "@/components/PageSections";
import "@/styles/solutions.css";

const shortNames: Record<string, string> = {
  "saas-platforms": "SaaS platforms",
  commerce: "Commerce infrastructure",
  "ai-engineering": "AI engineering",
  "architecture-leadership": "Architecture & leadership",
};

const architectureAudit = solutionsData.find((x) => x.slug === "architecture-leadership");

export default function Solutions() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(solutionsData[0]?.slug ?? null);
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
        <section className="sol-hero">
          <div className="sol-hero-art" aria-hidden="true">
            <span className="sol-orb a" /><span className="sol-orb b" /><span className="sol-orb c" />
            <span className="sol-hero-grid" />
          </div>
          <div>
            <span className="sol-eyebrow">SYSTEMS WE BUILD</span>
            <h1>Remove the friction slowing <span className="sol-pill">growth.</span></h1>
            <p>Restart maps the workflows costing you time, builds the systems that remove them, and delivers the technical foundation your team can run.</p>
            <div className="sol-hero-actions">
              <Link href="/start-project" className="button solid">Tell us where it’s stuck <ArrowUpRight size={15} /></Link>
              <Link href="/platform" className="button outline">See the Console <ChevronRight size={15} /></Link>
            </div>
          </div>
        </section>

        <section className="sol-section sol-wrap" id="disciplines">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">FOUR DISCIPLINES</span>
            <h2 className="sol-h2">Built end to <span>end.</span></h2>
            <p className="sol-lede">Architecture, automation, product engineering, and production discipline, so a decision turns into a system without becoming a liability.</p>
          </div>
          <div className="sol-list">
            {solutionsData.map((solution, i) => {
              const open = openRow === solution.slug;
              return (
                <div className={`sol-row sol-reveal ${open ? "open" : ""}`} style={{ "--d": i } as React.CSSProperties} key={solution.slug}>
                  <button
                    type="button"
                    className="sol-row-head"
                    aria-expanded={open}
                    aria-controls={`sol-row-${solution.slug}`}
                    onClick={() => setOpenRow(open ? null : solution.slug)}
                  >
                    <span className="sol-row-num">{solution.number}</span>
                    <span className="sol-row-title">{shortNames[solution.slug] ?? solution.kicker}</span>
                    <span className="sol-row-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
                  </button>
                  <div className="sol-row-body" id={`sol-row-${solution.slug}`} role="region" aria-label={shortNames[solution.slug]}>
                    <div>
                      <div className="sol-row-inner">
                        <h3>{solution.title}</h3>
                        <p>{solution.intro}</p>
                        <div className="sol-tags">{solution.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                        <Link href={`/solutions/${solution.slug}`} className="sol-link">Explore {shortNames[solution.slug]?.toLowerCase()} <ArrowRight size={15} /></Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sol-marquee-wrap sol-reveal">
            <span className="sol-marquee-label">Built on tools you could hire for</span>
            <div className="sol-marquee">
              <div className="sol-marquee-track">
                {[0, 1].map((copy) => platformStack.map((item) => (
                  <span className="sol-marquee-item" key={`${copy}-${item.name}`} aria-hidden={copy === 1 ? "true" : undefined}>
                    <img src={item.logo} alt="" />{item.name}
                  </span>
                )))}
              </div>
            </div>
          </div>
        </section>

        <section className="sol-section sol-wrap" id="start">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">WHERE TO START</span>
            <h2 className="sol-h2">Start small, <span>scope clearly.</span></h2>
            <p className="sol-lede">Two low-commitment first steps. Both end with something you keep, whether or not we work together after.</p>
          </div>
          <div className="sol-plans">
            <article className="sol-plan sol-reveal">
              <span className="sol-plan-tag">READINESS SCORECARD</span>
              <h3>Free <small>5 minutes</small></h3>
              <p>Twelve questions across six areas, scored instantly.</p>
              <ul>
                <li><Check size={15} />A readiness score for your systems</li>
                <li><Check size={15} />Your weakest areas, ranked</li>
                <li><Check size={15} />The first steps we would take</li>
              </ul>
              <Link href="/scorecard" className="button outline">Take the scorecard <ArrowUpRight size={15} /></Link>
            </article>
            <article className="sol-plan feature sol-reveal" style={{ "--d": 1 } as React.CSSProperties}>
              <span className="sol-plan-tag">ARCHITECTURE AUDIT</span>
              <h3>1 week <small>senior review</small></h3>
              <p>A deep review of your code, schema, infrastructure, and cost curve, with a plan for what to do next.</p>
              <ul>
                {architectureAudit?.deliverables.map((d) => <li key={d}><Check size={15} />{d}</li>)}
              </ul>
              <Link href={`/start-project?tier=${encodeURIComponent("ARCHITECTURE AUDIT")}`} className="button solid">Book an architecture audit <ArrowUpRight size={15} /></Link>
            </article>
          </div>
        </section>

        <FaqSection />
        <ContactSection
          eyebrow="NEXT STEP"
          heading={<>Bring us <span>the hard part.</span></>}
          lede="Tell us where the constraint sits. We will help you identify the next system to build, the capacity it can return, and whether the timing and fit make sense."
        />
        <SignOff />
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
