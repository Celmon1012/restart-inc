import { Code2, Database, Network, Gauge, Zap, Layers3, LucideIcon } from "lucide-react";

export interface Insight {
  id: string;
  category: "engineering" | "operations" | "architecture";
  kicker: string;
  title: string;
  icon: LucideIcon;
  image: "image-one" | "image-two" | "image-three";
  date?: string;
  featuredImage?: string | null;
  /** Length of the WordPress body in characters; 0 when nothing is published. */
  contentLength?: number;
  /**
   * True when the post exists in WordPress but carries little or no body copy,
   * i.e. it is still being written. Drafts are listed separately and are never
   * advertised as finished articles.
   */
  isDraft?: boolean;
}

/** Posts shorter than this are treated as in-progress editorial drafts. */
export const MIN_PUBLISHED_CHARS = 240;

export const insightsData: Insight[] = [
  {
    id: "cloud-infrastructure-is-a-product-decision",
    category: "engineering",
    kicker: "ENGINEERING",
    title: "Cloud infrastructure is a product decision — not just a hosting decision.",
    icon: Code2,
    image: "image-one",
  },
  {
    id: "performance-and-cost-are-connected",
    category: "operations",
    kicker: "OPERATIONS",
    title: "Performance and cost are connected: how to find the trade-off before scale.",
    icon: Database,
    image: "image-two",
  },
  {
    id: "when-to-extend-vs-redraw-the-boundary",
    category: "architecture",
    kicker: "ARCHITECTURE",
    title: "When to extend the existing system — and when to redraw the boundary.",
    icon: Network,
    image: "image-three",
  },
  {
    id: "observability-is-a-habit-not-a-dashboard",
    category: "engineering",
    kicker: "ENGINEERING",
    title: "Observability isn't a dashboard — it's a habit your team practices daily.",
    icon: Gauge,
    image: "image-two",
  },
  {
    id: "webhooks-fail-quietly-design-for-it",
    category: "operations",
    kicker: "OPERATIONS",
    title: "Webhooks fail quietly. Design your systems to notice when they do.",
    icon: Zap,
    image: "image-three",
  },
  {
    id: "multi-tenant-by-default",
    category: "architecture",
    kicker: "ARCHITECTURE",
    title: "Multi-tenant by default: the decision that is expensive to reverse later.",
    icon: Layers3,
    image: "image-one",
  },
];
