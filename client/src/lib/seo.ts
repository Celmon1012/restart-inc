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

function setJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export interface ArticleSeo {
  title: string;
  description: string;
  url: string;
  category: string;
  datePublished: string;
  dateModified: string;
}

const SITE_NAME = "Restart Inc.";
const DEFAULT_OG_IMAGE = "https://restart.ng/brand/restart-mark.png";

export function applyArticleSeo(seo: ArticleSeo) {
  const fullTitle = `${seo.title} — ${SITE_NAME} Insights`;
  document.title = fullTitle;

  setMetaTag("name", "description", seo.description);
  setCanonical(seo.url);

  setMetaTag("property", "og:type", "article");
  setMetaTag("property", "og:title", seo.title);
  setMetaTag("property", "og:description", seo.description);
  setMetaTag("property", "og:url", seo.url);
  setMetaTag("property", "og:site_name", SITE_NAME);
  setMetaTag("property", "og:image", DEFAULT_OG_IMAGE);
  setMetaTag("property", "article:section", seo.category);
  setMetaTag("property", "article:published_time", seo.datePublished);
  setMetaTag("property", "article:modified_time", seo.dateModified);

  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", seo.title);
  setMetaTag("name", "twitter:description", seo.description);
  setMetaTag("name", "twitter:image", DEFAULT_OG_IMAGE);

  setJsonLd("insight-jsonld", {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: seo.title,
    description: seo.description,
    datePublished: seo.datePublished,
    dateModified: seo.dateModified,
    articleSection: seo.category,
    mainEntityOfPage: { "@type": "WebPage", "@id": seo.url },
    author: { "@type": "Organization", name: SITE_NAME, url: "https://restart.ng" },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
    },
    image: DEFAULT_OG_IMAGE,
  });
}

export function resetSeoToDefault() {
  document.title = "Restart Inc. — Engineering Growth Systems for Serious Operators";
  const jsonLd = document.getElementById("insight-jsonld");
  if (jsonLd) jsonLd.remove();
  setMetaTag(
    "name",
    "description",
    "Restart Inc. is a technology and engineering firm that helps ambitious builders and operators turn complex workflows and product ideas into reliable, scalable systems."
  );
}
