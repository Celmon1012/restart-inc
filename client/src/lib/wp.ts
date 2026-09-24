import { Code2, Database, Network } from "lucide-react";
import type { Insight } from "@/data/insights";
import { MIN_PUBLISHED_CHARS } from "@/data/insights";

/** Reading time in minutes, rounded up with a 1-minute floor. */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Reading time for HTML bodies, ignoring tag names. */
export function readMinutesFromHtml(html: string): number {
  return readingMinutes(html.replace(/<[^>]+>/g, " "));
}

/**
 * A post only counts as published when it carries a real body. Anything
 * shorter is an in-progress draft: it must not be listed as finished work, and
 * its page must not be advertised to search engines as an article.
 */
export function isPublishedPost(content: string | null | undefined): boolean {
  return (content ?? "").trim().length >= MIN_PUBLISHED_CHARS;
}

export const WPGRAPHQL_ENDPOINT = "https://wp.restart.ng/graphql";

const FEATURED_IMAGE_FIELDS = `
  featuredImage {
    node {
      sourceUrl
      altText
    }
  }
`;

const INSIGHTS_QUERY = `
  query Insights {
    posts(first: 50) {
      nodes {
        slug
        title
        date
        content
        categories(first: 1) {
          nodes {
            name
            slug
          }
        }
        ${FEATURED_IMAGE_FIELDS}
      }
    }
  }
`;

export const INSIGHT_DETAIL_QUERY = `
  query InsightBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      slug
      title
      content
      excerpt
      date
      modified
      categories(first: 1) {
        nodes {
          name
          slug
        }
      }
      ${FEATURED_IMAGE_FIELDS}
    }
  }
`;

export interface InsightDetail {
  id: string;
  category: Insight["category"];
  kicker: string;
  title: string;
  content: string;
  excerpt: string;
  date: string;
  modified: string;
  featuredImage: string | null;
}

const CATEGORY_ICON: Record<Insight["category"], Insight["icon"]> = {
  engineering: Code2,
  operations: Database,
  architecture: Network,
};

const IMAGE_CLASSES: Insight["image"][] = ["image-one", "image-two", "image-three"];

const KNOWN_CATEGORIES: Insight["category"][] = ["engineering", "operations", "architecture"];

function decodeEntities(html: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = html;
  return el.value;
}

function resolveCategory(node: any): { category: Insight["category"]; name: string } {
  const slug = (node.categories?.nodes?.[0]?.slug ?? "engineering").toLowerCase();
  const category: Insight["category"] = KNOWN_CATEGORIES.includes(slug as Insight["category"])
    ? (slug as Insight["category"])
    : "engineering";
  const name: string = node.categories?.nodes?.[0]?.name ?? "Engineering";
  return { category, name };
}

function resolveFeaturedImage(node: any): string | null {
  return node.featuredImage?.node?.sourceUrl ?? null;
}

export async function fetchInsights(): Promise<Insight[]> {
  const res = await fetch(WPGRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: INSIGHTS_QUERY }),
  });
  if (!res.ok) throw new Error(`WPGraphQL request failed with ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);

  const nodes: any[] = json.data?.posts?.nodes ?? [];
  return nodes.map((node, index) => {
    const { category, name } = resolveCategory(node);
    const contentLength = (node.content ?? "").trim().length;
    return {
      id: node.slug,
      category,
      kicker: name.toUpperCase(),
      title: decodeEntities(node.title),
      icon: CATEGORY_ICON[category],
      image: IMAGE_CLASSES[index % IMAGE_CLASSES.length],
      date: node.date,
      featuredImage: resolveFeaturedImage(node),
      contentLength,
      isDraft: contentLength < MIN_PUBLISHED_CHARS,
    };
  });
}

export async function fetchInsightBySlug(slug: string): Promise<InsightDetail | null> {
  const res = await fetch(WPGRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: INSIGHT_DETAIL_QUERY, variables: { slug } }),
  });
  if (!res.ok) throw new Error(`WPGraphQL request failed with ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);

  const node = json.data?.post;
  if (!node) return null;

  const { category, name } = resolveCategory(node);
  return {
    id: node.slug,
    category,
    kicker: name.toUpperCase(),
    title: decodeEntities(node.title),
    content: node.content ?? "",
    excerpt: decodeEntities((node.excerpt ?? "").replace(/<[^>]+>/g, "")),
    date: node.date,
    modified: node.modified,
    featuredImage: resolveFeaturedImage(node),
  };
}
