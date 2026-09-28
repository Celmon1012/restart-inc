// Build-time SSG for /insights/:slug plus baked-in meta for every other route.
//
// Production serves the built `dist/` directory as static files via Caddy
// (see nixpacks.toml -- the Express server in server/index.ts is not the
// production entrypoint). A pure client-side fetch/head-tag update means
// crawlers that don't execute JavaScript (many AEO/answer-engine bots
// included) would see the same generic shell on every URL. This script runs
// after `vite build` and writes real static HTML per route -- correct
// title/meta/OG/JSON-LD everywhere, plus full article content, a featured
// image, sidebar, and share links baked into each insight page -- so Caddy
// can serve it directly. The React app still boots on top for interactivity;
// this only changes what a non-JS request sees first.
//
// Trade-off: insight page content is only as fresh as the last
// restart-website deploy. A post published in WordPress won't get its own
// crawlable static page until the next redeploy (the SPA route still works
// immediately for browsers/JS crawlers via the live GraphQL fetch -- this
// only affects non-JS crawlers hitting the URL directly before a redeploy).
//
// Never fails the build: a WordPress outage during CI should not block a
// deploy of the rest of the site.

import fs from "node:fs";
import path from "node:path";

const WPGRAPHQL_ENDPOINT = "https://wp.restart.ng/graphql";
const SITE_URL = "https://restart.ng";
const SITE_NAME = "Restart Inc.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/brand/restart-mark.png`;
const DIST_DIR = path.resolve(process.cwd(), "dist");
const TEMPLATE_PATH = path.join(DIST_DIR, "index.html");

// Keep in sync with MIN_PUBLISHED_CHARS in client/src/data/insights.ts.
// A post with less body than this is still being written: it must not be
// published to crawlers as an article, so we mark it noindex and omit it from
// the sitemap instead of shipping "coming soon" as the page's content.
const MIN_PUBLISHED_CHARS = 240;

function isPublished(post) {
  return (post.content ?? "").trim().length >= MIN_PUBLISHED_CHARS;
}

const QUERY = `
  query PrerenderInsights {
    posts(first: 100) {
      nodes {
        slug
        title
        content
        excerpt
        date
        modified
        categories(first: 1) {
          nodes { name slug }
        }
        featuredImage {
          node { sourceUrl altText }
        }
      }
    }
  }
`;

const ENTITY_MAP = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#039": "'", apos: "'",
  "#8211": "â", "#8212": "â", "#8216": "â", "#8217": "â",
  "#8220": "â", "#8221": "â", "#8230": "â¦", nbsp: " ",
};

function decodeEntities(str) {
  return str.replace(/&([a-zA-Z0-9#]+);/g, (m, code) => ENTITY_MAP[code] ?? m);
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).trim();
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

async function fetchPosts() {
  const res = await fetch(WPGRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) throw new Error(`WPGraphQL request failed with ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data?.posts?.nodes ?? [];
}

const CATEGORY_LABELS = { engineering: "Engineering", operations: "Operations", architecture: "Architecture" };

function categoryOf(post) {
  return (post.categories?.nodes?.[0]?.slug ?? "engineering").toLowerCase();
}

function buildSidebar(allPosts, currentSlug) {
  const counts = { engineering: 0, operations: 0, architecture: 0 };
  for (const p of allPosts) {
    const c = categoryOf(p);
    if (c in counts) counts[c]++;
  }

  const categoriesHtml = Object.entries(CATEGORY_LABELS)
    .map(
      ([id, label]) =>
        `<li><a href="/insights?category=${id}"><span>${label}</span><span class="insight-widget-count">${counts[id] ?? 0}</span></a></li>`
    )
    .join("");

  const recent = allPosts.filter((p) => p.slug !== currentSlug).slice(0, 5);
  const recentHtml = recent
    .map((p) => {
      const name = (p.categories?.nodes?.[0]?.name ?? "Engineering").toUpperCase();
      return `<li><a href="/insights/${p.slug}"><span class="insight-widget-kicker">${escapeAttr(name)}</span><span class="insight-widget-recent-title">${escapeAttr(decodeEntities(p.title))}</span></a></li>`;
    })
    .join("");

  return `
    <aside class="insight-sidebar">
      <div class="insight-widget">
        <h3 class="insight-widget-title">Categories</h3>
        <ul class="insight-widget-list">${categoriesHtml}</ul>
      </div>
      ${recent.length > 0 ? `<div class="insight-widget"><h3 class="insight-widget-title">Recent Posts</h3><ul class="insight-widget-recent">${recentHtml}</ul></div>` : ""}
    </aside>
  `;
}

function buildPostNav(allPosts, currentSlug) {
  const index = allPosts.findIndex((p) => p.slug === currentSlug);
  if (index === -1) return "";
  // allPosts is date-desc (newest first): the next array entry is older (Previous), the prior entry is newer (Next).
  const previous = allPosts[index + 1];
  const next = allPosts[index - 1];
  if (!previous && !next) return "";

  const item = (post, dir) => {
    if (!post) return `<div class="insight-post-nav-item${dir === "next" ? " next" : ""}"></div>`;
    const label =
      dir === "next"
        ? `Next <span aria-hidden="true">&rarr;</span>`
        : `<span aria-hidden="true">&larr;</span> Previous`;
    return `
      <div class="insight-post-nav-item${dir === "next" ? " next" : ""}">
        <a href="/insights/${post.slug}">
          <span class="insight-post-nav-label">${label}</span>
          <span class="insight-post-nav-title">${escapeAttr(decodeEntities(post.title))}</span>
        </a>
      </div>
    `;
  };

  return `
    <nav class="insight-post-nav" aria-label="Post navigation">
      ${item(previous, "prev")}
      <div class="insight-post-nav-divider"></div>
      ${item(next, "next")}
    </nav>
  `;
}

function buildShareRow(url, title) {
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  return `
    <div class="insight-share-row">
      <span class="insight-share-label">Share</span>
      <a href="${tw}" target="_blank" rel="noreferrer" aria-label="Share on X" class="insight-share-btn">X</a>
      <a href="${li}" target="_blank" rel="noreferrer" aria-label="Share on LinkedIn" class="insight-share-btn">in</a>
      <a href="${fb}" target="_blank" rel="noreferrer" aria-label="Share on Facebook" class="insight-share-btn">f</a>
      <a href="${wa}" target="_blank" rel="noreferrer" aria-label="Share on WhatsApp" class="insight-share-btn">wa</a>
    </div>
  `;
}

function buildInsightPage(template, post, allPosts) {
  const title = decodeEntities(post.title);
  const category = (post.categories?.nodes?.[0]?.name ?? "Engineering").toUpperCase();
  const description = post.excerpt
    ? stripTags(post.excerpt).slice(0, 160)
    : `${title} â practical engineering perspective from ${SITE_NAME}`;
  const url = `${SITE_URL}/insights/${post.slug}`;
  const published = post.date;
  const modified = post.modified || post.date;
  const bodyHtml = post.content || "";
  const featuredImage = post.featuredImage?.node?.sourceUrl || null;
  const ogImage = featuredImage || DEFAULT_OG_IMAGE;
  const isLive = isPublished(post);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished: published,
    dateModified: modified,
    articleSection: category,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
    },
    image: ogImage,
  };

  const headExtra = `
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${url}" />
    ${isLive ? "" : `<meta name="robots" content="noindex, follow" />`}
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="article:section" content="${escapeAttr(category)}" />
    <meta property="article:published_time" content="${published}" />
    <meta property="article:modified_time" content="${modified}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `;

  const articleHtml = `
    <div class="page-shell">
      <header class="site-header">
        <a href="/" class="site-logo" aria-label="Restart home"><img src="/brand/restart-logo.svg" alt="Restart Inc." class="site-logo-img" /></a>
      </header>
      <main>
        <div class="insight-layout container">
          <article class="insight-article">
            <a href="/insights" class="insight-back-link">&larr; All Insights</a>
            ${featuredImage ? `<img src="${escapeAttr(featuredImage)}" alt="${escapeAttr(title)}" class="insight-featured-image" />` : ""}
            <span class="section-label teal">${category}</span>
            <h1>${title}</h1>
            <div class="insight-article-meta">
              <time class="insight-article-date" datetime="${published}">${formatDate(published)}</time>
            </div>
            ${
              isLive
                ? `<div class="insight-article-body">${bodyHtml}</div>`
                : `<div class="insight-inprogress">
                     <div class="insight-inprogress-head">
                       <strong>This piece is still being written.</strong>
                       <span>It's a working draft rather than a finished article. It will appear in full once the final draft is published.</span>
                     </div>
                     <div class="insight-inprogress-actions">
                       <a href="/insights" class="button outline small">Read published insights</a>
                     </div>
                   </div>`
            }
            <div class="insight-article-footer">
              ${buildShareRow(url, title)}
              ${buildPostNav(allPosts, post.slug)}
            </div>
          </article>
          ${buildSidebar(allPosts, post.slug)}
        </div>
      </main>
    </div>
  `;

  return injectPage(template, { title: `${title} â ${SITE_NAME} Insights`, headExtra, bodyHtml: articleHtml });
}

function injectPage(template, { title, headExtra, bodyHtml }) {
  let html = template.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(title)}</title>`);
  // Strip the static per-page-overridable tags baked into index.html (description,
  // canonical, og:*, twitter:*) so they don't duplicate alongside this route's own.
  // The Organization/WebSite JSON-LD blocks are left untouched -- those are sitewide.
  html = html.replace(/<meta name="description"[^>]*>\s*/, "");
  html = html.replace(/<link rel="canonical"[^>]*>\s*/, "");
  html = html.replace(/<meta property="og:[^"]*"[^>]*>\s*/g, "");
  html = html.replace(/<meta name="twitter:[^"]*"[^>]*>\s*/g, "");
  html = html.replace("</head>", `${headExtra}\n  </head>`);
  html = html.replace(/<div id="root"><\/div>|<div id="root">.*?<\/div>/s, `<div id="root">${bodyHtml}</div>`);
  return html;
}

const STATIC_PAGES = [
  {
    route: "/platform",
    title: "Platform",
    description: "How Restart turns operational friction into technical leverage: map the workflows and costs, automate the repeatable work, and build the platform underneath — tracked in the Restart Console.",
  },
  {
    route: "/solutions",
    title: "Solutions",
    description: "Four engineering disciplines: SaaS platforms, commerce infrastructure, AI engineering, and architecture leadership — each delivered with senior technical ownership.",
  },
  {
    route: "/scorecard",
    title: "Readiness Scorecard",
    description: "Score your system in five minutes across observability, deployment safety, data recovery, security, architecture, and ownership, with the first concrete fix for your weakest areas.",
  },
  {
    route: "/about",
    title: "About",
    description: "Restart Inc. is an engineering firm built on senior ownership, production discipline, and scoped delivery â not open-ended retainers.",
  },
  {
    route: "/case-studies",
    title: "Case Studies",
    description: "Verified outcomes from Restart Inc. engagements â private cloud migrations, AI engineering, and commerce infrastructure, with the starting constraint and the production result.",
  },
  {
    route: "/insights",
    title: "Insights",
    description: "Practical perspectives on architecture, operations, AI, cloud infrastructure, and the decisions that determine whether a system holds up under pressure.",
  },
  {
    route: "/contact",
    title: "Contact",
    description: "Tell Restart Inc. what you're building and where it's stuck. We reply quickly with whether the timing and fit make sense.",
  },
  {
    route: "/start-project",
    title: "Start a Project",
    description: "Scope your build with Restart Inc. â tell us what you're building, where the constraint sits, and what decision you need to make next.",
  },
  {
    route: "/privacy",
    title: "Privacy Policy",
    description: "How Restart Inc. collects, uses, shares, and protects personal data, and the rights you have under the Nigeria Data Protection Act 2023.",
  },
  {
    route: "/terms",
    title: "Terms of Service",
    description: "The terms governing use of Restart Inc.'s websites, client console, and engineering services under Nigerian law.",
  },
  {
    route: "/careers",
    title: "Careers",
    description: "Work at Restart Inc. â senior engineering ownership, scoped delivery, and production discipline. Open roles in platform, AI systems, and product engineering.",
  },
];

const SOLUTIONS = [
  { slug: "saas-platforms", title: "Build a platform your team can operate.", description: "Multi-tenant B2B platforms designed around clear boundaries, resilient jobs, secure access, observable workflows, and the operational detail that makes production sustainable." },
  { slug: "commerce", title: "Make commerce operations work harder.", description: "Custom commerce platforms built on Medusa â admin workflows, billing, protected data, resilient webhooks, and the realities of high-volume commerce." },
  { slug: "ai-engineering", title: "Put AI where it can earn trust.", description: "We turn models, retrieval, tools, and agents into useful product capabilities â with evaluation, observability, and cost controls built in from the start." },
  { slug: "architecture-leadership", title: "Bring experience to the decisions that matter.", description: "Architecture reviews, fractional technical leadership, hiring support, and hands-on mentorship for teams that need a clearer path from complexity to execution." },
];

function buildStaticPage(template, { route, title, description }) {
  const url = `${SITE_URL}${route}`;
  const headExtra = `
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
  `;
  const bodyHtml = `
    <div class="page-shell">
      <header class="site-header">
        <a href="/" class="site-logo" aria-label="Restart home"><img src="/brand/restart-logo.svg" alt="Restart Inc." class="site-logo-img" /></a>
      </header>
      <main>
        <section class="portfolio-hero container">
          <div class="section-intro centered">
            <h1>${escapeAttr(title)}</h1>
            <p>${escapeAttr(description)}</p>
          </div>
        </section>
      </main>
    </div>
  `;
  return injectPage(template, { title: `${title} â ${SITE_NAME}`, headExtra, bodyHtml });
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.warn(`[prerender] ${TEMPLATE_PATH} not found -- skipping (run after the build's static copy step).`);
    return;
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  let posts = [];
  try {
    posts = await fetchPosts();
  } catch (err) {
    console.warn(`[prerender] Could not reach WordPress (${err.message}) -- skipping insight pages, static pages and sitemap still written.`);
  }

  let count = 0;
  for (const post of posts) {
    const page = buildInsightPage(template, post, posts);
    const outDir = path.join(DIST_DIR, "insights", post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), page, "utf-8");
    count++;
  }
  console.log(`[prerender] Wrote ${count} static insight page(s) to dist/insights/<slug>/index.html`);

  for (const staticPage of STATIC_PAGES) {
    const page = buildStaticPage(template, staticPage);
    const outDir = path.join(DIST_DIR, staticPage.route);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), page, "utf-8");
  }
  for (const solution of SOLUTIONS) {
    const page = buildStaticPage(template, { route: `/solutions/${solution.slug}`, title: solution.title, description: solution.description });
    const outDir = path.join(DIST_DIR, "solutions", solution.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), page, "utf-8");
  }
  console.log(`[prerender] Wrote ${STATIC_PAGES.length + SOLUTIONS.length} static page(s) with per-route meta`);

  writeSitemap(posts);
  await writeLlmsTxt(posts);
}

// Case studies live in TypeScript for the React app. Load them through esbuild
// (already a build dependency) so llms.txt never drifts from what the site shows.
async function loadCaseStudies() {
  const { transformSync } = await import("esbuild");
  const src = fs.readFileSync(path.resolve(process.cwd(), "client/src/data/caseStudies.ts"), "utf-8");
  const { code } = transformSync(src, { loader: "ts", format: "esm" });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  return mod.caseStudiesData ?? [];
}

// /llms.txt (https://llmstxt.org): a plain-markdown map of the site for AI
// assistants and agents. /llms-full.txt adds the full case study and article
// text so an agent can answer from one fetch.
async function writeLlmsTxt(posts) {
  let studies = [];
  try {
    studies = await loadCaseStudies();
  } catch (err) {
    console.warn(`[prerender] Could not load case studies for llms.txt (${err.message}) -- writing without them.`);
  }
  const published = posts.filter(isPublished);
  const metricLine = (s) => s.metrics.map((m) => `${m.label}: ${m.value}`).join("; ");
  const studyUrl = (s) => `${SITE_URL}/case-studies?study=${s.id}`;

  const header = [
    `# ${SITE_NAME}`,
    "",
    "> Restart Inc. is a technology and engineering firm that helps builders and operators turn complex workflows and product ideas into reliable, scalable systems, with senior technical ownership from architecture through production. Registered in Nigeria as Restart Integrated Systems Ltd.",
    "",
    "Engagements are scoped and time-boxed (audits, sprints, and builds), not open-ended retainers. The person who scopes a system is the person who builds it.",
    "",
  ];

  const sections = [
    "## Services",
    ...SOLUTIONS.map((s) => `- [${s.title}](${SITE_URL}/solutions/${s.slug}): ${s.description}`),
    "",
    "## Case studies",
    ...studies.map((s) => `- [${s.title}](${studyUrl(s)}): ${s.summary} (${metricLine(s)})`),
    "",
    "## Insights",
    ...(published.length
      ? published.map((p) => `- [${stripTags(p.title)}](${SITE_URL}/insights/${p.slug}): ${stripTags(p.excerpt || "").slice(0, 220)}`)
      : [`- [All insights](${SITE_URL}/insights)`]),
    "",
    "## Company",
    ...STATIC_PAGES.map((p) => `- [${p.title}](${SITE_URL}${p.route}): ${p.description}`),
    "",
    "## Optional",
    `- [Full text](${SITE_URL}/llms-full.txt): Complete case studies and published articles in one file.`,
    "",
  ];

  const full = [
    ...header,
    "## Case studies",
    "",
    ...studies.flatMap((s) => [
      `### ${s.title}`,
      `Source: ${studyUrl(s)}`,
      `Client: ${s.client} | Type: ${s.type} | Stack: ${s.stack.join(", ")}`,
      `Results: ${metricLine(s)}`,
      "",
      `Challenge: ${s.challenge}`,
      "",
      `Solution: ${s.solution}`,
      "",
      ...s.results.map((r) => `- ${r}`),
      "",
    ]),
    "## Insights",
    "",
    ...published.flatMap((p) => [
      `### ${stripTags(p.title)}`,
      `Source: ${SITE_URL}/insights/${p.slug} | Published: ${formatDate(p.date)}`,
      "",
      stripTags(p.content.replace(/<\/(p|h[1-6]|li|blockquote)>/g, "\n\n")).replace(/\n{3,}/g, "\n\n"),
      "",
    ]),
  ];

  fs.writeFileSync(path.join(DIST_DIR, "llms.txt"), [...header, ...sections].join("\n"), "utf-8");
  fs.writeFileSync(path.join(DIST_DIR, "llms-full.txt"), full.join("\n"), "utf-8");
  console.log(`[prerender] Wrote llms.txt and llms-full.txt (${studies.length} case studies, ${published.length} articles)`);
}

function writeSitemap(posts) {
  const now = new Date().toISOString();
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: now },
    ...STATIC_PAGES.map((p) => ({ loc: `${SITE_URL}${p.route}`, lastmod: now })),
    ...SOLUTIONS.map((s) => ({ loc: `${SITE_URL}/solutions/${s.slug}`, lastmod: now })),
    // In-progress posts are noindex, so advertising them here would contradict
    // the page's own directive. Only published articles belong in the sitemap.
    ...posts
      .filter(isPublished)
      .map((post) => ({
        loc: `${SITE_URL}/insights/${post.slug}`,
        lastmod: new Date(post.modified || post.date).toISOString(),
      })),
  ];

  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, "sitemap.xml"), xml, "utf-8");
  const draftCount = posts.length - posts.filter(isPublished).length;
  console.log(
    `[prerender] Wrote sitemap.xml with ${urls.length} URL(s)` +
      (draftCount ? ` (${draftCount} in-progress post(s) excluded as noindex)` : "")
  );
}

main().catch((err) => {
  console.warn(`[prerender] Unexpected error, skipping: ${err.message}`);
});
