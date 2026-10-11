function setMetaTag(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function setJsonLd(id: string, data: Record<string, unknown> | null) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export const SITE_NAME = "Restart Inc.";
export const SITE_URL = "https://restart.ng";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/brand/restart-mark.png`;
const DEFAULT_TITLE = "Restart Inc. — Engineering systems your growth depends on";
const DEFAULT_DESCRIPTION =
  "As a technology firm we help ambitious builders and operators turn complex workflows and product ideas into reliable, scalable production systems.";

export function applyJsonLd(id: string, data: Record<string, unknown>) {
  setJsonLd(id, data);
}

export function clearJsonLd(id: string) {
  setJsonLd(id, null);
}

export interface PageSeo {
  title: string;
  description: string;
  path: string;
  image?: string;
}

/** Sets title/description/canonical/OG/Twitter for a regular (non-article) page. */
export function applyPageSeo(seo: PageSeo) {
  const fullTitle = seo.title === SITE_NAME ? DEFAULT_TITLE : `${seo.title} — ${SITE_NAME}`;
  const url = `${SITE_URL}${seo.path}`;
  const image = seo.image ?? DEFAULT_OG_IMAGE;

  document.title = fullTitle;
  setMetaTag("name", "description", seo.description);
  setCanonical(url);

  setMetaTag("property", "og:type", "website");
  setMetaTag("property", "og:title", seo.title);
  setMetaTag("property", "og:description", seo.description);
  setMetaTag("property", "og:url", url);
  setMetaTag("property", "og:site_name", SITE_NAME);
  setMetaTag("property", "og:image", image);

  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", seo.title);
  setMetaTag("name", "twitter:description", seo.description);
  setMetaTag("name", "twitter:image", image);

  setJsonLd("insight-jsonld", null);
}

export interface ArticleSeo {
  title: string;
  description: string;
  url: string;
  category: string;
  datePublished: string;
  dateModified: string;
  image?: string | null;
}

export function applyArticleSeo(seo: ArticleSeo) {
  const fullTitle = `${seo.title} — ${SITE_NAME} Insights`;
  const image = seo.image ?? DEFAULT_OG_IMAGE;
  document.title = fullTitle;

  setMetaTag("name", "description", seo.description);
  setCanonical(seo.url);

  setMetaTag("property", "og:type", "article");
  setMetaTag("property", "og:title", seo.title);
  setMetaTag("property", "og:description", seo.description);
  setMetaTag("property", "og:url", seo.url);
  setMetaTag("property", "og:site_name", SITE_NAME);
  setMetaTag("property", "og:image", image);
  setMetaTag("property", "article:section", seo.category);
  setMetaTag("property", "article:published_time", seo.datePublished);
  setMetaTag("property", "article:modified_time", seo.dateModified);

  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", seo.title);
  setMetaTag("name", "twitter:description", seo.description);
  setMetaTag("name", "twitter:image", image);

  setJsonLd("insight-jsonld", {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: seo.title,
    description: seo.description,
    datePublished: seo.datePublished,
    dateModified: seo.dateModified,
    articleSection: seo.category,
    mainEntityOfPage: { "@type": "WebPage", "@id": seo.url },
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
    },
    image,
  });
}

export function resetSeoToDefault() {
  document.title = DEFAULT_TITLE;
  setMetaTag("name", "description", DEFAULT_DESCRIPTION);
  setCanonical(SITE_URL);
  setMetaTag("property", "og:type", "website");
  setMetaTag("property", "og:title", SITE_NAME);
  setMetaTag("property", "og:description", DEFAULT_DESCRIPTION);
  setMetaTag("property", "og:url", SITE_URL);
  setMetaTag("property", "og:image", DEFAULT_OG_IMAGE);
  setJsonLd("insight-jsonld", null);
}
