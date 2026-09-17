// One-time catalog setup for Lago — creates the plans (recurring retainers)
// and add-ons (one-time offers: Audit, MVP Build, infra pass-through) that
// back the price ladder in pricing-strategy.md.
//
// This talks to your LIVE, self-hosted Lago instance (billing-api.restart.ng
// by default) — the same one console-billing/index.ts reads from. It is
// intentionally NOT run by Claude: it needs your own LAGO_API_KEY, and it's
// a real change to production billing, so it defaults to a dry run.
//
// Usage:
//   LAGO_API_KEY=xxx node scripts/setup-lago-plans.mjs            # dry run, prints what would be created
//   LAGO_API_KEY=xxx node scripts/setup-lago-plans.mjs --apply    # actually creates missing plans/add-ons
//
// Idempotent: skips anything whose code already exists. Never updates or
// deletes an existing plan/add-on -- edit those by hand in Lago if a price
// changes, so a re-run of this script can't silently move a live price.

// No :3000 here -- Coolify's proxy terminates TLS on 443 for this domain and
// routes internally to the container's port 3000. Hitting :3000 directly
// bypasses the proxy and gets "connection refused" (confirmed 2026-09-17).
const LAGO_API_URL = (process.env.LAGO_API_URL ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = process.env.LAGO_API_KEY;
const APPLY = process.argv.includes("--apply");

if (!LAGO_API_KEY) {
  console.error("LAGO_API_KEY is required (never commit it -- pass it as an env var).");
  process.exit(1);
}

// List-price floor per pricing-strategy.md. Real deals are scoped within the
// documented band and may be invoiced above this -- that override happens at
// subscription/invoice time in Lago, not here. This script only seeds the
// catalog floor so every SKU exists to subscribe/invoice against.
const plans = [
  // -- Recurring: DevOps Retainer (USD) --
  { kind: "plan", code: "devops-retainer-standard-usd", name: "DevOps Retainer — Standard (USD)", interval: "monthly", amount_cents: 250_000, amount_currency: "USD" },
  { kind: "plan", code: "devops-retainer-growth-usd", name: "DevOps Retainer — Growth (USD)", interval: "monthly", amount_cents: 600_000, amount_currency: "USD" },
  { kind: "plan", code: "growth-engineering-pod-usd", name: "Dedicated Growth Engineering Pod (USD)", interval: "monthly", amount_cents: 10_000_000, amount_currency: "USD" },

  // -- Recurring: DevOps Retainer (NGN, conservative pricing, VAT-exclusive) --
  { kind: "plan", code: "devops-retainer-standard-ngn", name: "DevOps Retainer — Standard (NGN)", interval: "monthly", amount_cents: 40_000_000, amount_currency: "NGN" },
  { kind: "plan", code: "devops-retainer-growth-ngn", name: "DevOps Retainer — Growth (NGN)", interval: "monthly", amount_cents: 100_000_000, amount_currency: "NGN" },

  // Dedicated server capacity ladder, per pricing-strategy.md section 6 --
  // one per production project, tier chosen upfront or upgraded later via a
  // Lago plan change on the subscription. Annual-commitment-only, confirmed
  // 2026-09-17 -- no monthly option. The description still calls out the
  // "2 months free" framing (yearly price = 10x the monthly-equivalent rate)
  // so that shows on the plan/invoice even though monthly isn't selectable.
  { kind: "plan", code: "dedicated-server-vps10-ngn", name: "Dedicated Server — VPS 10 (NGN)", interval: "yearly", amount_cents: 28_000_000, amount_currency: "NGN", description: "4 vCPU / 8GB RAM / 75GB NVMe -- billed annually, equivalent to ₦28,000/mo (2 months free vs. paying monthly)." },
  { kind: "plan", code: "dedicated-server-vps20-ngn", name: "Dedicated Server — VPS 20 (NGN)", interval: "yearly", amount_cents: 36_000_000, amount_currency: "NGN", description: "6 vCPU / 12GB RAM / 100GB NVMe -- billed annually, equivalent to ₦36,000/mo (2 months free vs. paying monthly)." },
  { kind: "plan", code: "dedicated-server-vps30-ngn", name: "Dedicated Server — VPS 30 (NGN)", interval: "yearly", amount_cents: 68_000_000, amount_currency: "NGN", description: "8 vCPU / 24GB RAM / 200GB NVMe -- billed annually, equivalent to ₦68,000/mo (2 months free vs. paying monthly)." },

  { kind: "plan", code: "dedicated-server-vps10-usd", name: "Dedicated Server — VPS 10 (USD)", interval: "yearly", amount_cents: 20_000, amount_currency: "USD", description: "4 vCPU / 8GB RAM / 75GB NVMe -- billed annually, equivalent to $20/mo (2 months free vs. paying monthly)." },
  { kind: "plan", code: "dedicated-server-vps20-usd", name: "Dedicated Server — VPS 20 (USD)", interval: "yearly", amount_cents: 30_000, amount_currency: "USD", description: "6 vCPU / 12GB RAM / 100GB NVMe -- billed annually, equivalent to $30/mo (2 months free vs. paying monthly)." },
  { kind: "plan", code: "dedicated-server-vps30-usd", name: "Dedicated Server — VPS 30 (USD)", interval: "yearly", amount_cents: 50_000, amount_currency: "USD", description: "8 vCPU / 24GB RAM / 200GB NVMe -- billed annually, equivalent to $50/mo (2 months free vs. paying monthly)." },

  // -- One-time: Audit / Build offers (USD) --
  { kind: "add_on", code: "architecture-audit-usd", name: "Architecture Audit (USD)", amount_cents: 1_200_000, amount_currency: "USD", description: "1-week senior technical deep dive + 12-week remediation roadmap." },
  { kind: "add_on", code: "mvp-build-usd", name: "MVP Build — Laravel/Octane (USD)", amount_cents: 3_500_000, amount_currency: "USD", description: "4-12 week MVP build. List price is the floor of the $35k-75k band -- override per deal when invoicing." },
  { kind: "add_on", code: "medusa-commerce-build-usd", name: "Medusa Commerce Build (USD)", amount_cents: 3_000_000, amount_currency: "USD", description: "Scoped commerce build. Floor of the $30k-70k band -- override per deal." },
  { kind: "add_on", code: "ai-integration-sprint-usd", name: "AI Integration Sprint (USD)", amount_cents: 1_500_000, amount_currency: "USD", description: "2-4 week sprint. Floor of the $15k-30k band -- override per deal." },
  { kind: "add_on", code: "infra-passthrough-usd", name: "Infrastructure Pass-Through (USD)", amount_cents: 100, amount_currency: "USD", description: "Cost + 15-20% markup, billed monthly. Amount is set per-invoice from the actual cloud bill -- Lago rejects 0 as an add-on price, so this $1 is a placeholder, always override at invoicing time." },

  // -- One-time: Audit / Build offers (NGN, conservative pricing, VAT-exclusive) --
  { kind: "add_on", code: "architecture-audit-ngn", name: "Architecture Audit (NGN)", amount_cents: 280_000_000, amount_currency: "NGN", description: "3-5 day local audit + roadmap. VAT-exclusive -- add 7.5% at invoicing." },
  // Real documented floor is ₦9M (900_000_000 kobo), but Lago's add-on
  // amount_cents ceiling sits somewhere between 280,000,000 (confirmed OK,
  // see architecture-audit-ngn) and 900,000,000 (confirmed "value_is_out_of_range",
  // 2026-09-17). This catalog entry is a placeholder to satisfy that ceiling,
  // not the real price -- actual MVP Build deals are invoiced at the documented
  // ₦9M-25M band via one-off override regardless of this seeded value.
  { kind: "add_on", code: "mvp-build-ngn", name: "MVP Build — Local (NGN)", amount_cents: 250_000_000, amount_currency: "NGN", description: "4-8 week local MVP build. Real price band is ₦9M-25M (see pricing-strategy.md) -- always override at invoicing, this catalog value only exists to stay under Lago's add-on ceiling. VAT-exclusive." },
  { kind: "add_on", code: "infra-passthrough-ngn", name: "Infrastructure Pass-Through (NGN)", amount_cents: 100, amount_currency: "NGN", description: "USD infra cost converted at invoice-date rate + markup. Lago rejects 0 as an add-on price, so this is a nominal placeholder -- always override at invoicing time." },
];

async function lagoGet(path) {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${LAGO_API_KEY}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function lagoPost(path, body) {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LAGO_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

for (const item of plans) {
  const isPlan = item.kind === "plan";
  const lookupPath = isPlan ? `/plans/${item.code}` : `/add_ons/${item.code}`;
  const existing = await lagoGet(lookupPath);

  if (existing) {
    console.log(`skip   ${item.kind} ${item.code} (already exists)`);
    continue;
  }

  const payload = isPlan
    ? { plan: { name: item.name, code: item.code, interval: item.interval, amount_cents: item.amount_cents, amount_currency: item.amount_currency, pay_in_advance: true, description: item.description } }
    : { add_on: { name: item.name, code: item.code, amount_cents: item.amount_cents, amount_currency: item.amount_currency, description: item.description } };

  if (!APPLY) {
    console.log(`would create   ${item.kind} ${item.code}   ${item.amount_currency} ${(item.amount_cents / 100).toLocaleString()}`);
    continue;
  }

  const createPath = isPlan ? "/plans" : "/add_ons";
  await lagoPost(createPath, payload);
  console.log(`created ${item.kind} ${item.code}`);
}

if (!APPLY) {
  console.log("\nDry run only -- nothing was created. Re-run with --apply to write to Lago.");
}
