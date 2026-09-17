// Hand-authored delivery milestones -- this is Restart's own curated status
// update for the engagement, not a claim about live telemetry, so unlike the
// dashboard metrics this replaced, it's fine for it to be static content
// maintained by the team rather than pulled from a live system.

export type MilestoneStatus = "completed" | "in-progress";

export interface Milestone {
  id: string;
  status: MilestoneStatus;
  order: number;
  title: string;
  description: string;
  meta: string;
}

export const DELIVERY_MILESTONES: Milestone[] = [
  {
    id: "sprint-01",
    status: "completed",
    order: 1,
    title: "Architecture Audit & Technical Debt Inventory",
    description:
      "Profiling database bottlenecks, eliminating N+1 queries, and formalizing zero-downtime migration blueprint.",
    meta: "Sign-off: Lead Architect · Delivered in 10 business days"
  },
  {
    id: "sprint-02",
    status: "completed",
    order: 2,
    title: "Bare-Metal Private Cloud Cutover",
    description:
      "Migrated 7TB+ of storage with continuous dual-write replication and zero downtime to active supply chain operations.",
    meta: "70% SaaS spend reduction achieved"
  },
  {
    id: "sprint-03",
    status: "completed",
    order: 3,
    title: "MCP-Powered Automated Order Routing",
    description: "Shipped structured AI tool-calling pipeline with deterministic test suite and fallback circuit-breakers.",
    meta: "Sub-150ms P99 SLA confirmed"
  },
  {
    id: "sprint-04",
    status: "in-progress",
    order: 4,
    title: "PostgreSQL Multi-Tenant Partitioning",
    description: "Zero-downtime table partitioning to sustain 10x traffic expansion for upcoming peak volume season.",
    meta: "Cutover scheduled: Friday 23:00 UTC (no user disruption)"
  }
];

export function getCurrentMilestone(): Milestone | undefined {
  return DELIVERY_MILESTONES.find((m) => m.status === "in-progress");
}
