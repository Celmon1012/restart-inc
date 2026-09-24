/**
 * Named client engagements.
 *
 * Every figure and capability here is drawn from something verifiable --
 * live production sites, the client's own repositories, the Coolify
 * deployment record, or the operational billing record -- not from
 * marketing copy. Where a number does not exist yet, the metric states the
 * structural fact instead of inventing a percentage.
 *
 * These are deliberately separate from `caseStudies.ts`. That file holds
 * anonymised engagements under a "the site does not name clients" policy;
 * this one names two clients who are referenceable. The distinction is the
 * point: named, checkable proof carries more weight in a referral-driven
 * market than anonymised enterprise-scale proof.
 */

export interface NamedClientMetric {
  label: string;
  value: string;
}

export interface NamedClient {
  id: string;
  client: string;
  fullName: string;
  sector: string;
  location: string;
  liveUrl: string;
  liveLabel: string;
  tone: "teal" | "violet";
  badge: string;
  headline: string;
  constraint: string;
  built: string[];
  outcomes: string[];
  metrics: NamedClientMetric[];
  stack: string[];
  /** What was actually checked to justify these claims. */
  verifiedBy: string;
}

export const namedClients: NamedClient[] = [
  {
    id: "yata",
    client: "YATA",
    fullName: "Yoruba Artisans & Traders Association",
    sector: "Financial services for artisans",
    location: "Nigeria",
    liveUrl: "https://yata.network",
    liveLabel: "yata.network",
    tone: "teal",
    badge: "NAMED ENGAGEMENT",
    headline: "A member funds platform that verifies identity before it moves money.",
    constraint:
      "An artisan association distributing funds to members had no trustworthy way to confirm that the bank account being paid belonged to the verified person asking for it. That gap is where fraud lives, and it also meant every disbursement needed manual review with no audit trail behind it.",
    built: [
      "Member onboarding that resolves a bank account against the verified name before anyone can request funds",
      "A bank-account check record written to its own audit table, so every verification is reconstructable after the fact",
      "An admin console with bulk approval, CSV export, and disbursement gated strictly to bank-verified members",
      "WhatsApp notifications wired into the member journey, because that is where the members actually are",
      "Subscription billing on Lago with Flutterwave collection, issuing live hosted checkout links",
    ],
    outcomes: [
      "Payouts are gated on a bank-account check, so an unverified account cannot reach a disbursement",
      "Every verification leaves a durable record rather than a reviewer's memory",
      "Runs on its own dedicated server, separate from shared infrastructure",
      "End-to-end payment collection confirmed against a real invoice",
    ],
    metrics: [
      { label: "Payout gating", value: "BVN + NUBAN" },
      { label: "Infrastructure", value: "Dedicated" },
      { label: "Collections", value: "Flutterwave live" },
    ],
    stack: [
      "Next.js",
      "TypeScript",
      "PostgreSQL",
      "Dojah identity",
      "WhatsApp Business Cloud",
      "Lago billing",
      "Flutterwave",
    ],
    verifiedBy:
      "Live at yata.network; product surface and verification flow read from the client repository; billing chain confirmed against a real ₦1,500,000 invoice issued through Lago to a live Flutterwave hosted checkout.",
  },
  {
    id: "taxiq",
    client: "TaxIQ",
    fullName: "TaxIQ — Nigerian Tax Compliance",
    sector: "Tax compliance software",
    location: "Nigeria",
    liveUrl: "https://taxiq.ng",
    liveLabel: "taxiq.ng",
    tone: "violet",
    badge: "NAMED ENGAGEMENT",
    headline: "Tax compliance tooling built for operators who are not accountants.",
    constraint:
      "Nigerian tax obligations change by the year and by the entity type, and the people who owe them — freelancers, small businesses, people earning across borders — are the least equipped to track thresholds or produce the paperwork. Generic accounting tools assume a finance department that most of these operators do not have.",
    built: [
      "A compliance score that turns scattered obligations into one number an operator can act on",
      "Tax calculation and threshold tracking that flags exposure before a filing deadline does",
      "Document handling for invoices and expenses, including an expense auditor",
      "An invoice generator that produces the paperwork rather than just describing it",
      "Onboarding that resolves the business and its tax identifier, then verifies by one-time code",
      "A global-earner path, for income that does not arrive from a single jurisdiction",
    ],
    outcomes: [
      "Compliance status is a single visible number instead of a filing-season discovery",
      "Thresholds are tracked continuously rather than checked once a year",
      "Self-serve onboarding, including tax identifier lookup and verification",
      "Live and operating in production",
    ],
    metrics: [
      { label: "Functional modules", value: "8" },
      { label: "Tax year", value: "2026" },
      { label: "Status", value: "Live" },
    ],
    stack: [
      "React",
      "TypeScript",
      "Docker",
      "PostgreSQL",
      "Auth service",
    ],
    verifiedBy:
      "Live at taxiq.ng and app.taxiq.ng; the eight functional modules and the onboarding and verification steps were enumerated directly from the application source; deployment confirmed in the Coolify cluster record.",
  },
];
