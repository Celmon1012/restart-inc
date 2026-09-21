import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowUpRight, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { fetchInsightBySlug, InsightDetail as InsightDetailData } from "@/lib/wp";
import { applyArticleSeo, resetSeoToDefault } from "@/lib/seo";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function InsightDetail({ params }: { params: { slug: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  const [insight, setInsight] = useState<InsightDetailData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setInsight(undefined);

    fetchInsightBySlug(params.slug)
      .then((data) => {
        if (!cancelled) setInsight(data);
      })
      .catch(() => {
        if (!cancelled) setInsight(null);
      });

    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  useEffect(() => {
    if (!insight) return;
    const description = insight.excerpt || `${insight.title} — practical engineering perspective from Restart Inc.`;
    applyArticleSeo({
      title: insight.title,
      description,
      url: `https://restart.ng/insights/${insight.id}`,
      category: insight.kicker,
      datePublished: insight.date,
      dateModified: insight.modified || insight.date,
    });
    return () => resetSeoToDefault();
  }, [insight]);

  const nav = (
    <header className="site-header">
      <Link href="/" className="site-logo" aria-label="Restart home">
        <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
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
  );

  const footer = (
    <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering growth systems for serious operators.</p><a href="mailto:hello@restart.ng">hello@restart.ng</a></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>
  );

  if (insight === undefined) {
    return (
      <div className="page-shell">
        {nav}
        <main>
          <section className="portfolio-hero container">
            <div className="section-intro centered">
              <span className="section-label teal">INSIGHTS</span>
              <h1>Loading…</h1>
            </div>
          </section>
        </main>
        {footer}
      </div>
    );
  }

  if (insight === null) {
    return (
      <div className="page-shell">
        {nav}
        <main className="squeeze-main container" style={{ textAlign: "center" }}>
          <h1>Insight not found</h1>
          <p className="squeeze-subheading" style={{ margin: "12px auto 24px" }}>
            That article doesn't exist or may have been unpublished.
          </p>
          <Link href="/insights" className="button solid">Back to Insights</Link>
        </main>
        {footer}
      </div>
    );
  }

  return (
    <div className="page-shell">
      {nav}

      <main>
        <article className="insight-article container">
          <Link href="/insights" className="insight-back-link">
            <ChevronLeft size={14} /> All Insights
          </Link>

          <span className="section-label teal">{insight.kicker}</span>
          <h1>{insight.title}</h1>
          <time className="insight-article-date" dateTime={insight.date}>
            {formatDate(insight.date)}
          </time>

          {insight.content ? (
            <div className="insight-article-body" dangerouslySetInnerHTML={{ __html: insight.content }} />
          ) : (
            <p className="insight-article-body-placeholder">Full write-up coming soon.</p>
          )}
        </article>

        <section className="final-cta container">
          <span className="section-label teal">START A CONVERSATION</span>
          <h2>Have a system in mind?<br /><span>Let's talk about it.</span></h2>
          <p>Tell us what you are building, where your architecture is feeling pressure, or which migration you need to execute with zero downtime.</p>
          <div className="hero-buttons">
            <Link href="/start-project" className="button solid">Tell us what you're building <ArrowUpRight size={15} /></Link>
            <Link href="/insights" className="button outline">More insights <ChevronRight size={15} /></Link>
          </div>
        </section>
      </main>

      {footer}
    </div>
  );
}
