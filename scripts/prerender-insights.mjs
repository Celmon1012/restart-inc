// Build-time SSG for /insights/:slug.
//
// Production serves the built `dist/` directory as static files via Caddy
// (see nixpacks.toml -- the Express server in server/index.ts is not the
// production entrypoint). A pure client-side fetch means crawlers that don't
// execute JavaScript (many AEO/answer-engine bots included) would see an
// empty shell. This script runs after `vite build` and writes a real static
// HTML file per published post -- title, meta, OG, JSON-LD, and the actual
// article text baked in -- so Caddy can serve it directly at
// /insights/<slug>/index.html. The React app still boots on top for
// interactivity; this only changes what a non-JS request sees first.
//
// Trade-off: this content is only as fresh as the last restart-website
// deploy. A post published in WordPress won't get its own crawlable static
// page until the next redeploy (the SPA route still works immediately for
// browsers/JS crawlers via the live GraphQL fetch -- this only affects
// non-JS crawlers hitting the URL directly before a redeploy).
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

function buildPage(template, post) {
  const title = decodeEntities(post.title);
  const category = (post.categories?.nodes?.[0]?.name ?? "Engineering").toUpperCase();
  const description = post.excerpt
    ? stripTags(post.excerpt).slice(0, 160)
    : `${title} — practical engineering perspective from ${SITE_NAME}`;
  const url = `${SITE_URL}/insights/${post.slug}`;
  const published = post.date;
  const modified = post.modified || post.date;
  const bodyHtml = post.content || "";

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
    image: DEFAULT_OG_IMAGE,
  };

  const headExtra = `
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
    <meta property="article:section" content="${escapeAttr(category)}" />
    <meta property="article:published_time" content="${published}" />
    <meta property="article:modified_time" content="${modified}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `;

  const articleHtml = `
    <div class="page-shell">
      <header class="site-header">
        <a href="/" class="site-logo" aria-label="Restart home"><img src="/brand/restart-logo.svg" alt="Restart Inc." class="site-logo-img" /></a>
      </header>
      <main>
        <article class="insight-article container">
          <a href="/insights" class="insight-back-link">&larr; All Insights</a>
          <span class="section-label teal">${category}</span>
          <h1>${title}</h1>
          <time class="insight-article-date" datetime="${published}">${formatDate(published)}</time>
          ${bodyHtml ? `<div class="insight-article-body">${bodyHtml}</div>` : `<p class="insight-article-body-placeholder">Full write-up coming soon.</p>`}
        </article>
      </main>
    </div>
  `;

  let html = template.replace(
    /<title>.*?<\/title>/s,
    `<title>${escapeAttr(title)} — ${SITE_NAME} Insights</title>`
  );
  html = html.replace(/<meta name="description"[^>]*>/, "");
  html = html.replace("</head>", `${headExtra}\n  </head>`);
  html = html.replace(
    /<div id="root"><\/div>|<div id="root">.*?<\/div>/s,
    `<div id="root">${articleHtml}</div>`
  );
  return html;
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.warn(`[prerender-insights] ${TEMPLATE_PATH} not found -- skipping (run after the build's static copy step).`);
    return;
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  let posts = [];
  try {
    posts = await fetchPosts();
  } catch (err) {
    console.warn(`[prerender-insights] Could not reach WordPress (${err.message}) -- writing sitemap with static routes only, build continues.`);
  }

  let count = 0;
  for (const post of posts) {
    const page = buildPage(template, post);
    const outDir = path.join(DIST_DIR, "insights", post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), page, "utf-8");
    count++;
  }

  console.log(`[prerender-insights] Wrote ${count} static insight page(s) to dist/insights/<slug>/index.html`);

  writeSitemap(posts);
}

const STATIC_ROUTES = ["/", "/about", "/case-studies", "/insights", "/contact", "/start-project"];
const SOLUTION_SLUGS = ["saas-platforms", "commerce", "ai-engineering", "architecture-leadership"];

function writeSitemap(posts) {
  const now = new Date().toISOString();
  const urls = [
    ...STATIC_ROUTES.map((route) => ({ loc: `${SITE_URL}${route}`, lastmod: now })),
    ...SOLUTION_SLUGS.map((slug) => ({ loc: `${SITE_URL}/solutions/${slug}`, lastmod: now })),
    ...posts.map((post) => ({
      loc: `${SITE_URL}/insights/${post.slug}`,
      lastmod: new Date(post.modified || post.date).toISOString(),
    })),
  ];

  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, "sitemap.xml"), xml, "utf-8");
  console.log(`[prerender-insights] Wrote sitemap.xml with ${urls.length} URL(s)`);
}

main().catch((err) => {
  console.warn(`[prerender-insights] Unexpected error, skipping: ${err.message}`);
});
