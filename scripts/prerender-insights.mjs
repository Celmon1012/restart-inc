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
  "#8211": "–", "#8212": "—", "#8216": "‘", "#8217": "’",
  "#8220": "“", "#8221": "”", "#8230": "…", nbsp: " ",
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
    : `${title} — practical engineering perspective from ${SITE_NAME}`;
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
            ${featuredImage && !featuredImage.includes("/restart-cover-") ? `<img src="${escapeAttr(featuredImage)}" alt="${escapeAttr(title)}" class="insight-featured-image" />` : ""}
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

  return injectPage(template, { title: `${title} — ${SITE_NAME} Insights`, headExtra, bodyHtml: articleHtml });
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
    description: "Restart Inc. is an engineering firm built on senior ownership, production discipline, and scoped delivery — not open-ended retainers.",
  },
  {
    route: "/case-studies",
    title: "Case Studies",
    description: "Verified outcomes from Restart Inc. engagements — private cloud migrations, AI engineering, and commerce infrastructure, with the starting constraint and the production result.",
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
    description: "Scope your build with Restart Inc. — tell us what you're building, where the constraint sits, and what decision you need to make next.",
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
    description: "Work at Restart Inc. — senior engineering ownership, scoped delivery, and production discipline. Open roles in platform, AI systems, and product engineering.",
  },
];

// Structured data and crawlable content for the non-article routes. Answer
// engines mostly don't run JavaScript, so what they can quote is what is in
// this HTML: a real heading, the page's substance, links to the rest of the
// site, and schema.org JSON-LD naming what the page is.
const ORG_REF = { "@type": "Organization", name: SITE_NAME, url: SITE_URL };

const PAGE_TYPES = {
  "/about": "AboutPage",
  "/contact": "ContactPage",
  "/solutions": "CollectionPage",
  "/case-studies": "CollectionPage",
  "/insights": "CollectionPage",
};

const NAV_LINKS = [
  ["/platform", "Platform"],
  ["/solutions", "Solutions"],
  ["/case-studies", "Proof"],
  ["/insights", "Insights"],
  ["/about", "About"],
];

const FOOTER_LINKS = [
  ["/contact", "Contact"],
  ["/careers", "Careers"],
  ["/start-project", "Start a Project"],
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Service"],
];

const jsonLdTag = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

function breadcrumbLd(crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([route, name], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${route}` })),
  };
}

function pageShell(mainHtml) {
  const nav = NAV_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join("");
  const footer = FOOTER_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join("");
  return `
    <div class="page-shell">
      <header class="site-header">
        <a href="/" class="site-logo" aria-label="Restart home"><img src="/brand/restart-logo.svg" alt="Restart Inc." class="site-logo-img" /></a>
        <nav>${nav}</nav>
      </header>
      <main>${mainHtml}</main>
      <footer class="site-footer"><div class="container">${footer}</div></footer>
    </div>
  `;
}

function buildStaticPage(template, { route, title, description, crumbs, contentHtml = "", kicker = "", jsonLd = [] }) {
  const url = `${SITE_URL}${route}`;
  const trail = crumbs ?? [["/", "Home"], [route, title]];
  const webPage = {
    "@context": "https://schema.org",
    "@type": PAGE_TYPES[route] ?? "WebPage",
    name: title,
    description,
    url,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    publisher: ORG_REF,
  };
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
    ${[webPage, breadcrumbLd(trail), ...jsonLd].map(jsonLdTag).join("\n    ")}
  `;
  const bodyHtml = pageShell(`
        <section class="portfolio-hero container">
          <div class="section-intro centered">
            ${kicker ? `<span class="section-label teal">${escapeAttr(kicker)}</span>` : ""}
            <h1>${escapeAttr(title)}</h1>
            <p>${escapeAttr(description)}</p>
          </div>
        </section>
        ${contentHtml}
  `);
  return injectPage(template, { title: `${title} — ${SITE_NAME}`, headExtra, bodyHtml });
}

function solutionsIndexContent(solutions) {
  const items = solutions
    .map(
      (s) => `
          <article class="lane-card ${s.accent}">
            <span class="lane-number">${s.number}</span>
            <h2><a href="/solutions/${s.slug}">${escapeAttr(s.title)}</a></h2>
            <p>${escapeAttr(s.intro)}</p>
          </article>`
    )
    .join("");
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: solutions.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.title, url: `${SITE_URL}/solutions/${s.slug}` })),
  };
  return { contentHtml: `<section class="lanes-section container"><div class="lane-grid">${items}</div></section>`, jsonLd: [list] };
}

function solutionDetailContent(s) {
  const service = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.title,
    serviceType: s.kicker,
    description: s.description,
    url: `${SITE_URL}/solutions/${s.slug}`,
    provider: ORG_REF,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Deliverables",
      itemListElement: s.deliverables.map((d) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: d } })),
    },
  };
  const contentHtml = `
        <section class="portfolio-grid-section container">
          <p>${escapeAttr(s.description)}</p>
          <h2>Deliverables</h2>
          <ul>${s.deliverables.map((d) => `<li>${escapeAttr(d)}</li>`).join("")}</ul>
          <h2>Stack</h2>
          <p>${s.tags.map(escapeAttr).join(", ")}</p>
          <p><a href="/start-project?tier=${encodeURIComponent(s.tierId)}">Start a project</a> · <a href="/solutions">All solutions</a></p>
        </section>`;
  return { contentHtml, jsonLd: [service] };
}

function caseStudiesContent(studies) {
  const items = studies
    .map(
      (s) => `
          <article class="case-study-card">
            <h2>${escapeAttr(s.title)}</h2>
            <p>${escapeAttr(s.summary)}</p>
            <ul>${s.metrics.map((m) => `<li><strong>${escapeAttr(m.value)}</strong> ${escapeAttr(m.label)}</li>`).join("")}</ul>
          </article>`
    )
    .join("");
  return { contentHtml: items ? `<section class="container">${items}</section>` : "" };
}

function insightsIndexContent(posts) {
  const published = posts.filter(isPublished);
  if (!published.length) return {};
  const items = published
    .map((p) => `<li><a href="/insights/${p.slug}">${escapeAttr(decodeEntities(p.title))}</a> <time datetime="${p.date}">${formatDate(p.date)}</time></li>`)
    .join("");
  return { contentHtml: `<section class="container"><ul>${items}</ul></section>` };
}

// The homepage is dist/index.html itself, which is also the SPA fallback for
// routes with no prerendered file. Its head meta already describes the
// homepage; this adds the hero, the four disciplines, and the FAQ as real HTML
// plus FAQPage JSON-LD -- the question/answer pairs answer engines quote.
function buildHomePage(template, { solutions, faqs }) {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  const description = template.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  const disciplines = solutions
    .map((s) => `<li><a href="/solutions/${s.slug}">${escapeAttr(s.title)}</a> ${escapeAttr(s.intro)}</li>`)
    .join("");
  const faqHtml = faqs.map(([q, a]) => `<h3>${escapeAttr(q)}</h3><p>${escapeAttr(a)}</p>`).join("");
  const bodyHtml = pageShell(`
        <section class="hero-section container">
          <h1>Build systems your growth depends on.</h1>
          <p>${description}</p>
          <p><a href="/start-project">Tell us what you're building</a></p>
        </section>
        ${disciplines ? `<section class="container"><h2>Four disciplines</h2><ul>${disciplines}</ul></section>` : ""}
        ${faqHtml ? `<section class="faq-section container"><h2>Frequently asked questions</h2>${faqHtml}</section>` : ""}
  `);
  let html = template;
  if (faqs.length) html = html.replace("</head>", `  ${jsonLdTag(faqLd)}\n  </head>`);
  return html.replace(/<div id="root"><\/div>|<div id="root">.*?<\/div>/s, `<div id="root">${bodyHtml}</div>`);
}

function writePage(route, html) {
  const outDir = path.join(DIST_DIR, route);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.warn(`[prerender] ${TEMPLATE_PATH} not found -- skipping (run after the build's static copy step).`);
    return;
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const data = await loadSiteData();

  let posts = [];
  try {
    posts = await fetchPosts();
  } catch (err) {
    console.warn(`[prerender] Could not reach WordPress (${err.message}) -- skipping insight pages, static pages and sitemap still written.`);
  }

  let count = 0;
  for (const post of posts) {
    writePage(`insights/${post.slug}`, buildInsightPage(template, post, posts));
    count++;
  }
  console.log(`[prerender] Wrote ${count} static insight page(s) to dist/insights/<slug>/index.html`);

  const pageContent = {
    "/solutions": () => solutionsIndexContent(data.solutions),
    "/case-studies": () => caseStudiesContent(data.studies),
    "/insights": () => insightsIndexContent(posts),
  };
  for (const staticPage of STATIC_PAGES) {
    writePage(staticPage.route, buildStaticPage(template, { ...staticPage, ...(pageContent[staticPage.route]?.() ?? {}) }));
  }
  for (const s of data.solutions) {
    const route = `/solutions/${s.slug}`;
    writePage(route, buildStaticPage(template, {
      route,
      title: s.title,
      description: s.intro,
      kicker: `DISCIPLINE ${s.number} / ${s.kicker}`,
      crumbs: [["/", "Home"], ["/solutions", "Solutions"], [route, s.title]],
      ...solutionDetailContent(s),
    }));
  }
  console.log(`[prerender] Wrote ${STATIC_PAGES.length + data.solutions.length} static page(s) with per-route meta`);

  // Last: every page above was built from the untouched shell template.
  fs.writeFileSync(TEMPLATE_PATH, buildHomePage(template, data), "utf-8");
  console.log(`[prerender] Wrote homepage content (${data.faqs.length} FAQs as FAQPage JSON-LD)`);

  writeSitemap(posts, data.solutions);
  writeLlmsTxt(posts, data);
}

// Case studies, solutions, and FAQs live in TypeScript for the React app. Load
// them through esbuild (already a build dependency) so the prerendered pages and
// llms.txt never drift from what the site shows. Icon imports are stubbed: the
// data files reference lucide components, which have no meaning in static HTML.
async function loadClientData(file) {
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [path.resolve(process.cwd(), "client/src/data", file)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
    plugins: [{
      name: "stub-icons",
      setup(b) {
        b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: "lucide-react", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "module.exports = new Proxy({}, { get: () => null });", loader: "js" }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function loadSiteData() {
  const load = async (file, key) => {
    try {
      return (await loadClientData(file))[key] ?? [];
    } catch (err) {
      console.warn(`[prerender] Could not load ${file} (${err.message}) -- continuing without it.`);
      return [];
    }
  };
  const [studies, solutions, faqs] = await Promise.all([
    load("caseStudies.ts", "caseStudiesData"),
    load("solutions.ts", "solutionsData"),
    load("faqs.ts", "faqs"),
  ]);
  return { studies, solutions, faqs };
}

// /llms.txt (https://llmstxt.org): a plain-markdown map of the site for AI
// assistants and agents. /llms-full.txt adds the full case study and article
// text so an agent can answer from one fetch.
function writeLlmsTxt(posts, { studies, solutions }) {
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
    ...solutions.map((s) => `- [${s.title}](${SITE_URL}/solutions/${s.slug}): ${s.intro}`),
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

function writeSitemap(posts, solutions) {
  const now = new Date().toISOString();
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: now },
    ...STATIC_PAGES.map((p) => ({ loc: `${SITE_URL}${p.route}`, lastmod: now })),
    ...solutions.map((s) => ({ loc: `${SITE_URL}/solutions/${s.slug}`, lastmod: now })),
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
