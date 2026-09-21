import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useInsights } from "@/hooks/useInsights";
import { ArrowUpRight, ChevronLeft, ChevronRight, Copy, Check, Linkedin, Menu, Twitter, X } from "lucide-react";
import { fetchInsightBySlug, InsightDetail as InsightDetailData } from "@/lib/wp";
import { applyArticleSeo, resetSeoToDefault, SITE_URL } from "@/lib/seo";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const CATEGORY_LABELS: Record<string, string> = {
  engineering: "Engineering",
  operations: "Operations",
  architecture: "Architecture",
};

function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable -- no-op, link is still visible in the address bar
    }
  }

  return (
    <div className="insight-share-row">
      <span className="insight-share-label">Share</span>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on X"
        className="insight-share-btn"
      >
        <Twitter size={14} />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on LinkedIn"
        className="insight-share-btn"
      >
        <Linkedin size={14} />
      </a>
      <button type="button" onClick={copyLink} aria-label="Copy link" className="insight-share-btn">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default function InsightDetail({ params }: { params: { slug: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";
  const { insights } = useInsights();

  const [insight, setInsight] = useState<InsightDetailData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setInsight(undefined);
    window.scrollTo(0, 0);

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
      url: `${SITE_URL}/insights/${insight.id}`,
      category: insight.kicker,
      datePublished: insight.date,
      dateModified: insight.modified || insight.date,
      image: insight.featuredImage,
    });
    return () => resetSeoToDefault();
  }, [insight]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { engineering: 0, operations: 0, architecture: 0 };
    for (const i of insights) counts[i.category] = (counts[i.category] ?? 0) + 1;
    return counts;
  }, [insights]);

  const recentPosts = useMemo(() => {
    return insights.filter((i) => i.id !== params.slug).slice(0, 5);
  }, [insights, params.slug]);

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
    <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>
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

  const shareUrl = `${SITE_URL}/insights/${insight.id}`;

  return (
    <div className="page-shell">
      {nav}

      <main>
        <div className="insight-layout container">
          <article className="insight-article">
            <Link href="/insights" className="insight-back-link">
              <ChevronLeft size={14} /> All Insights
            </Link>

            {insight.featuredImage && (
              <img
                src={insight.featuredImage}
                alt={insight.title}
                className="insight-featured-image"
              />
            )}

            <span className="section-label teal">{insight.kicker}</span>
            <h1>{insight.title}</h1>

            <div className="insight-article-meta">
              <time className="insight-article-date" dateTime={insight.date}>
                {formatDate(insight.date)}
              </time>
              <ShareRow url={shareUrl} title={insight.title} />
            </div>

            {insight.content ? (
              <div className="insight-article-body" dangerouslySetInnerHTML={{ __html: insight.content }} />
            ) : (
              <p className="insight-article-body-placeholder">Full write-up coming soon.</p>
            )}
          </article>

          <aside className="insight-sidebar">
            <div className="insight-widget">
              <h3 className="insight-widget-title">Categories</h3>
              <ul className="insight-widget-list">
                {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                  <li key={id}>
                    <Link href={`/insights?category=${id}`} className={insight.category === id ? "active" : ""}>
                      <span>{label}</span>
                      <span className="insight-widget-count">{categoryCounts[id] ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {recentPosts.length > 0 && (
              <div className="insight-widget">
                <h3 className="insight-widget-title">Recent Posts</h3>
                <ul className="insight-widget-recent">
                  {recentPosts.map((post) => (
                    <li key={post.id}>
                      <Link href={`/insights/${post.id}`}>
                        <span className="insight-widget-kicker">{post.kicker}</span>
                        <span className="insight-widget-recent-title">{post.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">START A CONVERSATION</span>
            <h2>Have a system in mind?<br /><span>Let's talk about it.</span></h2>
            <p>Tell us what you are building, where your architecture is feeling pressure, or which migration you need to execute with zero downtime.</p>
            <div className="final-cta-buttons">
              <Link href="/start-project" className="button solid">Tell us what you're building <ArrowUpRight size={15} /></Link>
              <Link href="/insights" className="button outline">More insights <ChevronRight size={15} /></Link>
            </div>
          </div>
        </section>
      </main>

      {footer}
    </div>
  );
}
