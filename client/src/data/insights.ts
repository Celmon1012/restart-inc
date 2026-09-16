import { Code2, Database, Network, LucideIcon } from "lucide-react";

export interface Insight {
  id: string;
  category: "engineering" | "operations" | "architecture";
  kicker: string;
  title: string;
  icon: LucideIcon;
  image: "image-one" | "image-two" | "image-three";
}

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
];
