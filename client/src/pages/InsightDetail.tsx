import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useInsights } from "@/hooks/useInsights";
import { ArrowUpRight, ChevronLeft, ChevronRight, Copy, Check, Facebook, Linkedin, Menu, Twitter, X } from "lucide-react";
import { fetchInsightBySlug, InsightDetail as InsightDetailData } from "@/lib/wp";
import type { Insight } from "@/data/insights";
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

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.82L2 22l5.38-1.41a9.86 9.86 0 0 0 4.66 1.18h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.11h-.01a8.18 8.18 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.53 3.69-8.22 8.22-8.22 2.2 0 4.26.86 5.82 2.42a8.17 8.17 0 0 1 2.41 5.82c0 4.53-3.69 8.18-8.24 8.18Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.7-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.17 1.73 2.64 4.2 3.7.59.25 1.05.4 1.41.51.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

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
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on Facebook"
        className="insight-share-btn"
      >
        <Facebook size={14} />
      </a>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on WhatsApp"
        className="insight-share-btn"
      >
        <WhatsAppIcon />
      </a>
      <button type="button" onClick={copyLink} aria-label="Copy link" className="insight-share-btn">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function PostNav({ previous, next }: { previous?: Insight; next?: Insight }) {
  if (!previous && !next) return null;
  return (
    <nav className="insight-post-nav" aria-label="Post navigation">
      <div className="insight-post-nav-item">
        {previous && (
          <Link href={`/insights/${previous.id}`}>
            <span className="insight-post-nav-label"><ChevronLeft size={13} /> Previous</span>
            <span className="insight-post-nav-title">{previous.title}</span>
          </Link>
        )}
      </div>
      <div className="insight-post-nav-divider" />
      <div className="insight-post-nav-item next">
        {next && (
          <Link href={`/insights/${next.id}`}>
            <span className="insight-post-nav-label">Next <ChevronRight size={13} /></span>
            <span className="insight-post-nav-title">{next.title}</span>
          </Link>
        )}
      </div>
    </nav>
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

  const { previousPost, nextPost } = useMemo(() => {
    const index = insights.findIndex((i) => i.id === params.slug);
    if (index === -1) return { previousPost: undefined, nextPost: undefined };
    // insights is date-desc (newest first): the next array entry is older (Previous), the prior entry is newer (Next).
    return { previousPost: insights[index + 1], nextPost: insights[index - 1] };
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
            </div>

            {insight.content ? (
              <div className="insight-article-body" dangerouslySetInnerHTML={{ __html: insight.content }} />
            ) : (
              <p className="insight-article-body-placeholder">Full write-up coming soon.</p>
            )}

            <div className="insight-article-footer">
              <ShareRow url={shareUrl} title={insight.title} />
              <PostNav previous={previousPost} next={nextPost} />
            </div>
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
