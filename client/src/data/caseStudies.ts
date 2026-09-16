export interface CaseStudyMetric {
  label: string;
  value: string;
}

export interface CaseStudy {
  id: string;
  type: string;
  category: "infrastructure" | "ai" | "commerce" | "saas";
  title: string;
  client: string;
  summary: string;
  tags: string[];
  metrics: CaseStudyMetric[];
  tone: "teal" | "violet" | "amber" | "blue";
  href: string | null;
  verified: boolean;
  details: string;
  challenge: string;
  solution: string;
  results: string[];
  stack: string[];
}

export const caseStudiesData: CaseStudy[] = [
  {
    id: "logistics-private-cloud",
    type: "LOGISTICS / PRIVATE CLOUD",
    category: "infrastructure",
    title: "A global logistics firm cut SaaS spend by 70%",
    client: "Global Logistics & Freight Enterprise",
    summary: "Restart migrated 7TB+ of sensitive operations data from legacy SaaS to dedicated bare-metal private cloud with a zero-downtime cutover, intact permissions, and AI workflows from day one.",
    tags: ["Private cloud", "Zero-downtime migration", "Bare metal", "AI workflows"],
    metrics: [
      { label: "SaaS spend", value: "−70%" },
      { label: "Operations data", value: "7TB+" },
      { label: "Cutover", value: "Zero downtime" }
    ],
    tone: "teal",
    href: "https://restart.ng/resources/case-studies/logistics-firm-saas-spend",
    verified: true,
    details: "Migrated from multi-tenant SaaS tools to dedicated bare-metal infrastructure managed by Restart. Launched new internal managed services unit on the infrastructure.",
    challenge: "The client was facing an impending contract renewal for their legacy SaaS logistics management suite with escalating usage tier penalties projected at $3M+ annually. International freight tracking, customs documentation, and warehouse dispatch operated continuously 24/7/365, making any maintenance downtime catastrophic. Historical operations data exceeded 7TB across complex relational tables with strict role-based access control.",
    solution: "Restart designed and engineered an autonomous private cloud infrastructure on dedicated bare-metal hardware. We developed parallel data replication conduits with real-time idempotency validators and preserved role-level permission hierarchies. A synchronized shadow deployment ran concurrently for 14 days before an off-peak DNS cutover achieved complete migration with zero system downtime.",
    results: [
      "70% immediate reduction in ongoing software licensing and infrastructure spend",
      "7TB+ mission-critical supply-chain data migrated without a single dropped transaction or inventory discrepancy",
      "Zero downtime cutover achieved across international freight forwarding and customs dispatch teams",
      "Client retained full sovereignty over customer data, ensuring NDPA & GDPR compliance",
      "Enabled client to establish their own internal managed IT services business unit"
    ],
    stack: ["Dedicated Bare Metal", "PostgreSQL", "Docker / Linux", "Redis Queue Cluster", "Real-Time Telemetry", "Custom ETL Pipelines"]
  },
  {
    id: "b2b-saas-ai-latency",
    type: "AI ENGINEERING / AGENTIC WORKFLOWS",
    category: "ai",
    title: "B2B SaaS platform cuts automated query latency to <150ms",
    client: "Enterprise B2B Workflow SaaS",
    summary: "Restart re-architected brittle OpenAI prompt chains into an asynchronous Anthropic MCP pipeline with hybrid pgvector search, automated deterministic eval suites, and strict token cost guardrails.",
    tags: ["Anthropic MCP", "pgvector Hybrid", "Automated Evals", "Cost Guardrails"],
    metrics: [
      { label: "P99 Latency", value: "<150ms" },
      { label: "Token Costs", value: "−48%" },
      { label: "Eval Pass Rate", value: "99.4%" }
    ],
    tone: "violet",
    href: null,
    verified: true,
    details: "Replaced unindexed embedding lookups and sequential API calls with background queue workers, localized semantic caching, and strict regression harnesses before each production release.",
    challenge: "The client's AI assistant feature was experiencing unacceptable 2.4-second response latencies during peak customer work hours. Brittle sequential prompt chains caused cascading API timeouts, while unindexed vector lookups and unmanaged context windows caused monthly LLM API bills to double without corresponding revenue growth.",
    solution: "Restart restructured the intelligence layer into an asynchronous agentic pipeline using Model Context Protocol (MCP) standards. We replaced naive cosine lookups with hybrid BM25 and pgvector HNSW indexing, introduced multi-tier semantic response caching, and implemented deterministic regression test suites running across 500+ operational test cases on every CI push.",
    results: [
      "P99 query response latency dropped from 2,400ms to under 150ms for 85% of frequent operator intents",
      "48% reduction in monthly token expenditure through intelligent prompt compression and semantic caching",
      "99.4% pass rate across automated regression eval suites, eliminating hallucination risks in customer-facing answers",
      "Zero vendor lock-in by designing model-agnostic routing capable of failing over between Anthropic and local fallback models"
    ],
    stack: ["Anthropic MCP", "PostgreSQL + pgvector", "HNSW Indexing", "Redis Semantic Cache", "FastAPI / Python", "Automated Eval Harness"]
  },
  {
    id: "shopify-plus-b2b",
    type: "COMMERCE INFRASTRUCTURE / HIGH-VOLUME APPS",
    category: "commerce",
    title: "High-volume merchant automates custom B2B tiers with zero order drops",
    client: "Global Omni-Channel Retailer",
    summary: "Restart engineered a custom Medusa commerce platform with an admin dashboard, Next.js storefront, and resilient idempotent webhook consumers, absorbing 4,200 requests/min during flash events with automated dunning recovery.",
    tags: ["Medusa", "Next.js / Admin API", "Idempotent Webhooks", "Dunning SLA"],
    metrics: [
      { label: "Peak Ingestion", value: "4.2k req/min" },
      { label: "Dunning Recovery", value: "+38%" },
      { label: "Webhook SLA", value: "99.99%" }
    ],
    tone: "amber",
    href: null,
    verified: true,
    details: "Implemented asynchronous Kafka/Redis queue consumers with automated replay, eliminating rate-limiting throttling and ensuring financial data compliance under Nigeria NDPA & GDPR.",
    challenge: "An omni-channel retail brand with rapid international expansion was crashing their commerce storefront during high-traffic drops. Their custom wholesale tier pricing rules were calculating synchronously on checkout page loads, leading to rate limit throttling, abandoned shopping carts, and missed enterprise replenishment orders.",
    solution: "Restart architected a hardened custom commerce platform on Medusa with a Next.js storefront and decoupled backend processing. We built an asynchronous Kafka/Redis webhook pipeline that pre-computes custom wholesale price matrices, stores customer tier entitlement tokens in edge caches, and handles payment failure retries with automated intelligent dunning sequences.",
    results: [
      "Handled 4,200 requests/minute during Black Friday flash sale peak with 100% order processing reliability",
      "38% improvement in failed transaction recovery through automated intelligent dunning workflows",
      "99.99% webhook ingestion SLA achieved with automated dead-letter queues and replay capabilities",
      "Wholesale tier price calculation latency reduced to zero milliseconds at checkout time"
    ],
    stack: ["Medusa Admin API", "Next.js / React", "Medusa Admin UI", "Kafka / Redis Streams", "PostgreSQL", "Tailwind CSS"]
  },
  {
    id: "laravel-multi-tenant-saas",
    type: "LARAVEL SAAS / MULTI-TENANT SYSTEMS",
    category: "saas",
    title: "FinTech operator scales multi-tenant core to 50k daily active organizations",
    client: "Pan-African Treasury & Billing Platform",
    summary: "Restart modernized a monolithic Laravel codebase into an Octane-powered, tenant-isolated architecture with asynchronous ledger reconciliation and automated database sharding.",
    tags: ["Laravel Octane", "Tenant Isolation", "Automated Sharding", "Audit Ledger"],
    metrics: [
      { label: "Daily Active Orgs", value: "50k+" },
      { label: "Reconciliation", value: "<30s" },
      { label: "Availability", value: "99.99%" }
    ],
    tone: "blue",
    href: null,
    verified: true,
    details: "Separated tenant database schemas, deployed Swoole/Octane memory persistence, and introduced automated ledger verification eliminating financial drift.",
    challenge: "The FinTech platform's shared-database multi-tenant schema was experiencing thread contention during end-of-month invoice reconciliation runs. As tenant count surpassed 15,000 organizations, queue worker backlogs delayed transaction webhook notifications by hours, leading to compliance warnings.",
    solution: "Restart re-architected the application core using Laravel Octane with high-performance Swoole runtimes. We introduced schema-level tenant isolation, partitioned the financial ledger into immutable append-only event streams, and deployed automated horizontal database sharding based on transaction velocity.",
    results: [
      "Effortlessly scaled platform capacity to over 50,000 concurrent corporate tenants",
      "Reduced end-of-month reconciliation processing time from 4.5 hours to under 30 seconds",
      "Maintained 99.99% platform availability across quarterly billing spikes",
      "Achieved bank-grade SOC 2 and NDPA audit compliance through immutable cryptographically verified audit ledgers"
    ],
    stack: ["Laravel 11", "Laravel Octane / Swoole", "PostgreSQL Schema Sharding", "Redis Cluster", "Horizon Queues", "Docker"]
  },
  {
    id: "iot-telemetry-pipeline",
    type: "HIGH-THROUGHPUT TELEMETRY & HARDENING",
    category: "infrastructure",
    title: "Industrial fleet operator achieves 99.995% uptime on 20,000 connected assets",
    client: "Heavy Equipment & Transport Fleet",
    summary: "Restart built an edge telemetry ingestion gateway absorbing 15,000 GPS/CAN bus telemetry events per second with automated anomaly detection and instant offline sync.",
    tags: ["IoT Gateway", "TimescaleDB", "Edge Processing", "Fault Tolerance"],
    metrics: [
      { label: "Events Ingested", value: "15k/sec" },
      { label: "Hardware Assets", value: "20,000" },
      { label: "Uptime Record", value: "99.995%" }
    ],
    tone: "teal",
    href: null,
    verified: true,
    details: "Built lightweight MQTT edge relays that buffer telemetry during remote cellular outages, forward-reconciling upon reconnection without data loss.",
    challenge: "The fleet management operator was experiencing 12% telemetry packet loss due to sporadic cellular connectivity across remote transit corridors. Central database write locks during burst uploads caused dispatch dashboards to freeze, leaving operations managers blind to real-time vehicle status.",
    solution: "Restart designed a resilient edge-to-cloud ingestion pipeline using MQTT brokers and TimescaleDB time-series hyper-tables. We implemented local SQLite edge buffering on vehicle gateways with compressed delta transmission and automated deduplication on ingest.",
    results: [
      "Sustained 15,000 events/second continuous ingestion with sub-50ms insertion times",
      "Eliminated telemetry packet loss entirely through intelligent store-and-forward edge caching",
      "Achieved 99.995% operational uptime across 20,000 connected transport assets",
      "Empowered predictive maintenance algorithms that prevented 140+ catastrophic roadside engine failures"
    ],
    stack: ["TimescaleDB", "MQTT Brokers", "Go Ingestion Relays", "Redis Streams", "Grafana Observability", "Python ML"]
  },
  {
    id: "autonomous-support-dispatch",
    type: "INTELLIGENT WORKFORCE & DISPATCH AUTOMATION",
    category: "ai",
    title: "On-demand services marketplace automates 74% of support and dispatch calls",
    client: "Metropolitan Home Services Platform",
    summary: "Restart deployed voice and text AI agents that verify service requests, handle scheduling conflicts, and dispatch nearest certified specialists automatically.",
    tags: ["Voice AI", "Autonomous Dispatch", "Twilio / Retell", "n8n Workflows"],
    metrics: [
      { label: "Calls Automated", value: "74%" },
      { label: "Booking Time", value: "<2 mins" },
      { label: "Resolution CSAT", value: "4.8 / 5" }
    ],
    tone: "violet",
    href: null,
    verified: true,
    details: "Combined Retell Voice AI with custom deterministic business rules in n8n, integrating directly into Perfex CRM and field technician mobile apps.",
    challenge: "A fast-growing on-demand home repairs marketplace was drowning in inbound phone calls during seasonal storm peaks. Support representatives spent 65% of their time collecting basic address and equipment model information, resulting in 18-minute customer wait times and lost bookings.",
    solution: "Restart engineered an autonomous voice and WhatsApp support dispatch system. The AI agent converses naturally with homeowners, validates warranty coverage, collects diagnostic photos via messaging, and directly schedules verified technicians in their geofenced service zones.",
    results: [
      "74% of inbound service inquiries and scheduling calls fully resolved without human agent intervention",
      "Average booking time slashed from 18 minutes to under 2 minutes",
      "Customer satisfaction rating increased to 4.8 / 5.0 due to instant 24/7 responsiveness",
      "Human support personnel transitioned into high-value B2B commercial account management"
    ],
    stack: ["Retell Voice AI", "n8n Workflow Automation", "Twilio API", "WhatsApp Business Cloud", "PostgreSQL", "Perfex CRM Integration"]
  }
];
