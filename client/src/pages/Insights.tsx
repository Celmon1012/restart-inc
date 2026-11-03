import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AlertCircle, ArrowRight, ArrowUpRight, ChevronRight, Menu, RefreshCw, X } from "lucide-react";
import { useInsights } from "@/hooks/useInsights";
import InsightArt from "@/components/InsightArt";
import { applyPageSeo, applyJsonLd, resetSeoToDefault, SITE_URL } from "@/lib/seo";

function initialCategoryFromUrl(): string {
  if (typeof window === "undefined") return "all";
  return new URLSearchParams(window.location.search).get("category") ?? "all";
}

/** Placeholder grid shown while the first WordPress request is in flight. */
function InsightsSkeleton() {
  return (
    <div className="insight-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="insight-card insight-card-skeleton" key={i}>
          <div className="insight-image skeleton-block" />
          <span className="skeleton-line skeleton-kicker" />
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-title short" />
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const [activeCategory, setActiveCategory] = useState<string>(initialCategoryFromUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";
  const { published, drafts, loading, degraded, error, refetch } = useInsights();
  const insights = published;

  useEffect(() => {
    applyPageSeo({
      title: "Insights",
      description: "Practical perspectives on architecture, operations, AI, cloud infrastructure, and the decisions that determine whether a system holds up under pressure.",
      path: "/insights",
    });
    return () => resetSeoToDefault();
  }, []);

  useEffect(() => {
    if (insights.length === 0) return;
    applyJsonLd("insights-list-jsonld", {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Restart Insights",
      url: `${SITE_URL}/insights`,
      blogPost: insights.map((insight) => ({
        "@type": "BlogPosting",
        headline: insight.title,
        url: `${SITE_URL}/insights/${insight.id}`,
        articleSection: insight.kicker,
      })),
    });
  }, [insights]);

  function selectCategory(id: string) {
    setActiveCategory(id);
    const url = new URL(window.location.href);
    if (id === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", id);
    window.history.replaceState({}, "", url);
  }

  const categories = [
    { id: "all", label: "All Insights", count: insights.length },
    { id: "engineering", label: "Engineering", count: insights.filter(i => i.category === "engineering").length },
    { id: "operations", label: "Operations", count: insights.filter(i => i.category === "operations").length },
    { id: "architecture", label: "Architecture", count: insights.filter(i => i.category === "architecture").length },
  ];

  const filteredInsights = activeCategory === "all"
    ? insights
    : insights.filter((i) => i.category === activeCategory);

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
                onClick={() => selectCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span className="filter-count">{cat.count}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Insights Grid */}
        <section className="portfolio-grid-section container">
          {degraded && (
            <div className="insight-notice" role="status">
              <AlertCircle size={16} />
              <div>
                <strong>Showing a saved set of insights.</strong>
                <span>
                  We couldn't reach the publishing system just now, so you're seeing our
                  most recent evergreen pieces. Everything below is real and readable.
                </span>
                {error && <span className="insight-notice-detail">{error}</span>}
              </div>
              <button type="button" className="insight-notice-retry" onClick={refetch}>
                <RefreshCw size={13} /> Try again
              </button>
            </div>
          )}

          {loading && !degraded ? (
            <InsightsSkeleton />
          ) : filteredInsights.length > 0 ? (
            <div className="insight-grid">
              {filteredInsights.map((insight) => {
                return (
                  <Link key={insight.id} href={`/insights/${insight.id}`} className="insight-card">
                    <InsightArt insight={insight} />
                    <span>{insight.kicker}</span>
                    <h3>{insight.title}</h3>
                    <ArrowUpRight size={15} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="insight-empty">
              <strong>Nothing published in this category yet.</strong>
              <span>New engineering writing lands here first — check back shortly.</span>
              <button type="button" className="button outline small" onClick={() => selectCategory("all")}>
                View all insights
              </button>
            </div>
          )}

          {drafts.length > 0 && (
            <div className="insight-drafts">
              <div className="insight-drafts-head">
                <span className="section-label teal">COMING SOON</span>
                <p>
                  These pieces are being written now. They'll appear in full once the
                  final drafts are published.
                </p>
              </div>
              <div className="insight-drafts-list">
                {drafts
                  .filter((d) => activeCategory === "all" || d.category === activeCategory)
                  .map((draft) => {
                    const Icon = draft.icon;
                    return (
                      <Link key={draft.id} href={`/insights/${draft.id}`} className="insight-draft-item">
                        <span className="insight-draft-icon"><Icon size={17} /></span>
                        <span className="insight-draft-body">
                          <span className="insight-draft-kicker">{draft.kicker}</span>
                          <span className="insight-draft-title">{draft.title}</span>
                        </span>
                        <span className="insight-draft-badge">In progress</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}
        </section>

        {/* Bottom CTA Section */}
        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">START A CONVERSATION</span>
            <h2>Have a system in mind?<br /><span>Let's talk about it.</span></h2>
            <p>Tell us what you are building, where your architecture is feeling pressure, or which migration you need to execute with zero downtime.</p>
            <div className="final-cta-buttons">
              <Link href="/start-project" className="button solid">Tell us what you’re building <ArrowUpRight size={15} /></Link>
              <Link href="/case-studies" className="button outline">See our work <ChevronRight size={15} /></Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>

    </div>
  );
}
