import { openCookieSettings } from "@/lib/consent";
import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, ChevronLeft, Menu, X } from "lucide-react";
import { useState } from "react";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface LegalPageLayoutProps {
  /** Page title, e.g. "Privacy Policy". */
  title: string;
  /** Eyebrow label shown above the title. */
  eyebrow: string;
  /** One-line summary under the title. */
  summary: string;
  /** Meta description for SEO. */
  seoDescription: string;
  /** Route path, e.g. "/privacy". */
  path: string;
  /** Date shown to the reader as the last substantive revision. */
  lastUpdated: string;
  sections: LegalSection[];
  /** Rendered at the top of the document, e.g. the "who we are" block. */
  intro?: ReactNode;
  /** Rendered after the final section, e.g. a review note. */
  afterword?: ReactNode;
}

export default function LegalPageLayout({
  title,
  eyebrow,
  summary,
  seoDescription,
  path,
  lastUpdated,
  sections,
  intro,
  afterword,
}: LegalPageLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useEffect(() => {
    applyPageSeo({ title, description: seoDescription, path });
    window.scrollTo(0, 0);
    return () => resetSeoToDefault();
  }, [title, seoDescription, path]);

  return (
    <div className="page-shell">
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
            <Link href="/start-project" className="header-cta">
              Start a Project <ArrowUpRight size={14} />
            </Link>
          </div>
        </nav>
        <div className="header-actions">
          <a href={consoleHref} className="login-link">{consoleLabel}</a>
          <Link href="/start-project" className="header-cta">
            Start a Project <ArrowUpRight size={14} />
          </Link>
          <button
            className="menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <main>
        <section className="legal-hero container">
          <Link href="/" className="insight-back-link">
            <ChevronLeft size={14} /> Back to home
          </Link>
          <span className="section-label teal">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="legal-summary">{summary}</p>
          <p className="legal-updated">
            Last updated <time dateTime={lastUpdated}>{lastUpdated}</time>
          </p>
        </section>

        <div className="legal-layout container">
          <nav className="legal-toc" aria-label="On this page">
            <span className="legal-toc-title">ON THIS PAGE</span>
            <ul>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    <span className="legal-toc-num">{String(i + 1).padStart(2, "0")}</span>
                    <span>{s.heading}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="legal-toc-contact">
              <span>Questions about this document?</span>
              <a href="mailto:legal@restart.ng">legal@restart.ng</a>
            </div>
          </nav>

          <article className="legal-body">
            {intro}
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="legal-section">
                <h2>
                  <span className="legal-section-num">{String(i + 1).padStart(2, "0")}</span>
                  {s.heading}
                </h2>
                {s.body}
              </section>
            ))}
            {afterword}
          </article>
        </div>

        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">QUESTIONS</span>
            <h2>
              Need this clarified?<br />
              <span>Ask us directly.</span>
            </h2>
            <p>
              Legal and procurement teams are welcome to raise specific questions. We
              answer these in writing, including for security and data-processing review.
            </p>
            <div className="final-cta-buttons">
              <Link href="/contact" className="button solid">
                Contact us <ArrowUpRight size={15} />
              </Link>
              <Link href="/start-project" className="button outline">
                Start a project
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link href="/" className="site-logo">
              <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
            </Link>
            <p>Engineering systems your growth depends on.</p>
            <div className="footer-brand-contact">
              <a href="mailto:hello@restart.ng">hello@restart.ng</a>
              <a href="tel:+2349060114747">+234 906 011 4747</a>
            </div>
          </div>
          <div>
            <strong>PLATFORM</strong>
            <Link href="/platform">Platform</Link>
            <Link href="/solutions">Solutions</Link>
            <Link href="/case-studies">Case Studies</Link>
            <Link href="/insights">Insights</Link>
          </div>
          <div>
            <strong>COMPANY</strong>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/careers">Careers</Link>
          </div>
          <div>
            <strong>CONNECT</strong>
            <a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">
              LinkedIn <ArrowUpRight size={12} />
            </a>
            <a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={12} />
            </a>
            <Link href="/start-project" className="footer-text-btn">
              Book an intro <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span>
          <span>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button>
          </span>
        </div>
      </footer>
    </div>
  );
}
