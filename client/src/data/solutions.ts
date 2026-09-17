import { Code2, Layers3, BrainCircuit, Network, LucideIcon } from "lucide-react";

export interface Solution {
  slug: string;
  number: string;
  accent: "teal" | "blue" | "violet" | "amber";
  icon: LucideIcon;
  kicker: string;
  title: string;
  intro: string;
  description: string;
  tags: string[];
  deliverables: string[];
  tierId: string;
}

export const solutionsData: Solution[] = [
  {
    slug: "saas-platforms",
    number: "01",
    accent: "teal",
    icon: Code2,
    kicker: "SAAS PLATFORMS",
    title: "Build a platform your team can operate.",
    intro: "Multi-tenant B2B platforms designed around clear boundaries, resilient jobs, secure access, observable workflows, and the operational detail that makes production sustainable.",
    description: "Most SaaS platforms don't fail at the demo — they fail six months in, when tenancy boundaries leak, background jobs silently stop retrying, or a schema decision made in week two becomes the thing blocking every feature after it. We build the platform layer first: tenancy, auth, roles, billing, and observability, so the product work that follows has a foundation instead of a pile of assumptions.",
    tags: ["Laravel", "PostgreSQL", "Octane", "Filament", "Horizon", "Observability"],
    deliverables: ["Architecture and schema design", "Authentication, roles, permissions, and tenancy", "Billing through Stripe or Paddle", "CI/CD and zero-downtime deployment", "Observability and production handoff"],
    tierId: "saas",
  },
  {
    slug: "commerce",
    number: "02",
    accent: "blue",
    icon: Layers3,
    kicker: "COMMERCE INFRASTRUCTURE",
    title: "Make commerce operations work harder.",
    intro: "Custom commerce platforms built on Medusa — admin workflows, billing, protected data, resilient webhooks, and the realities of high-volume commerce.",
    description: "Off-the-shelf commerce platforms are fast to start and expensive to outgrow. When your catalog, pricing, or fulfillment logic doesn't fit the platform's assumptions, you end up building workarounds on top of a system that was never meant to hold them. We build commerce infrastructure on Medusa that matches how your business actually operates — custom admin workflows, idempotent webhook processing, and APIs that hold up under real order volume.",
    tags: ["Medusa", "Next.js", "PostgreSQL", "Admin API", "Workflows"],
    deliverables: ["Custom admin workflows", "Billing, dunning, and analytics", "Catalog, order, and customer APIs", "Idempotent webhook processing", "Protected customer data review"],
    tierId: "medusa",
  },
  {
    slug: "ai-engineering",
    number: "03",
    accent: "violet",
    icon: BrainCircuit,
    kicker: "AI ENGINEERING",
    title: "Put AI where it can earn trust.",
    intro: "We turn models, retrieval, tools, and agents into useful product capabilities — with evaluation, observability, and cost controls built in from the start.",
    description: "An AI feature that works in a demo and one that survives production are built differently. Production AI needs evaluation harnesses that catch regressions before users do, retrieval that's actually grounded in your data, tool-calling that fails safely, and cost guardrails that don't surprise you at the end of the month. We build the AI layer with the same production discipline as the rest of your system — not as a bolt-on.",
    tags: ["Claude API", "MCP", "RAG", "pgvector", "Evaluation harnesses"],
    deliverables: ["Claude or OpenAI API integration", "MCP server and tool-use implementation", "Hybrid retrieval with pgvector", "Evaluation harness and regression checks", "Cost and latency guardrails"],
    tierId: "ai",
  },
  {
    slug: "architecture-leadership",
    number: "04",
    accent: "amber",
    icon: Network,
    kicker: "ARCHITECTURE & LEADERSHIP",
    title: "Bring experience to the decisions that matter.",
    intro: "Architecture reviews, fractional technical leadership, hiring support, and hands-on mentorship for teams that need a clearer path from complexity to execution.",
    description: "Some of the most expensive mistakes in a system's life are architectural decisions made without enough context — a schema that can't support the next feature, a migration path that assumes zero downtime is optional, a scaling plan that doesn't exist until it's urgent. We bring senior judgment to those decisions before they get expensive: reviewing what exists, mapping the real risk, and giving your team a concrete plan to act on.",
    tags: ["Architecture reviews", "Domain modeling", "Testing strategy", "Technical leadership", "Mentorship"],
    deliverables: ["One-week technical deep dive", "Risk, cost, and reliability report", "Prioritized 12-week remediation plan", "Optional pair-programming follow-up"],
    tierId: "architecture",
  },
];
