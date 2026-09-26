// Admin-only, one-time-ish catalog setup for Lago -- creates the plans
// (recurring retainers) and add-ons (one-time offers: Audit, MVP Build,
// infra pass-through) that back the price ladder in pricing-strategy.md.
//
// This is the server-side twin of scripts/setup-lago-plans.mjs: same catalog,
// same idempotent "only create what's missing, never edit or delete"
// behavior, but it runs inside Supabase using the LAGO_API_KEY that's
// already configured there, so no one needs to export that key into a local
// shell to seed the catalog. Restricted to admins for the same reason
// console-billing restricts workspace billing reads -- this key can create
// real, invoiceable billing objects.
//
// GET  /functions/v1/setup-lago-catalog          -> dry run, lists what would be created
// POST /functions/v1/setup-lago-catalog          -> actually creates missing plans/add-ons
//
// Zero external imports, same reason as console-data/console-billing: this
// self-hosted edge runtime re-downloads npm/esm.sh dependencies on every
// cold start with no caching, which hit Deno's wall-clock limit and killed
// the isolate before it ever ran. Plain fetch() avoids that entirely.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// No :3000 here -- Coolify's proxy terminates TLS on 443 for this domain and
// routes internally to the container's port 3000. Hitting :3000 directly
// bypasses the proxy and gets "connection refused" (confirmed 2026-09-17).
const LAGO_API_URL = (Deno.env.get("LAGO_API_URL") ?? "https://billing-api.restart.ng").replace(/\/$/, "");
const LAGO_API_KEY = Deno.env.get("LAGO_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function getUser(jwt: string): Promise<{ id: string; isAdmin: boolean } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  return { id: user.id, isAdmin: Boolean(user.app_metadata?.is_admin) };
}

type CatalogItem =
  | { kind: "plan"; code: string; name: string; interval: string; amount_cents: number; amount_currency: string; description?: string }
  | { kind: "add_on"; code: string; name: string; amount_cents: number; amount_currency: string; description: string };

// List-price floor per pricing-strategy.md. Real deals are scoped within the
// documented band and may be invoiced above this -- that override happens at
// subscription/invoice time in Lago, not here. This only seeds the catalog
// floor so every SKU exists to subscribe/invoice against. Keep in sync with
// scripts/setup-lago-plans.mjs if either list changes.
const CATALOG: CatalogItem[] = [
  { kind: "plan", code: "devops-retainer-standard-usd", name: "DevOps Retainer — Standard (USD)", interval: "monthly", amount_cents: 250_000, amount_currency: "USD" },
  { kind: "plan", code: "devops-retainer-growth-usd", name: "DevOps Retainer — Growth (USD)", interval: "monthly", amount_cents: 600_000, amount_currency: "USD" },
  { kind: "plan", code: "growth-engineering-pod-usd", name: "Dedicated Growth Engineering Pod (USD)", interval: "monthly", amount_cents: 10_000_000, amount_currency: "USD" },
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

  // Managed Environment S/M/L: the Operate plan. One subscription per client
  // server (subscription external_id = the server's Coolify UUID), bundling
  // the server with monitoring, daily off-site backups, OS/security patching,
  // and business-hours incident response. Paid in advance. Upgrading a server
  // is a plan change on its subscription; an additional server is a new one.
  //
  // PRICES ARE DELIBERATELY UNSET (0). Set amount_cents before running this
  // function with POST -- runCatalog() refuses to create a zero-priced plan.
  // Price on the management, not the hardware (see the Operate plan notes).
  { kind: "plan", code: "managed-env-s-ngn", name: "Managed Environment S (NGN)", interval: "monthly", amount_cents: 0, amount_currency: "NGN", description: "4 vCPU / 8GB RAM / 75GB NVMe server with monitoring, daily off-site backups, patching, and business-hours incident response. Billed monthly in advance." },
  { kind: "plan", code: "managed-env-m-ngn", name: "Managed Environment M (NGN)", interval: "monthly", amount_cents: 0, amount_currency: "NGN", description: "6 vCPU / 12GB RAM / 100GB NVMe server with monitoring, daily off-site backups, patching, and business-hours incident response. Billed monthly in advance." },
  { kind: "plan", code: "managed-env-l-ngn", name: "Managed Environment L (NGN)", interval: "monthly", amount_cents: 0, amount_currency: "NGN", description: "8 vCPU / 24GB RAM / 200GB NVMe server with monitoring, daily off-site backups, patching, and 24/7 incident response. Billed monthly in advance." },
  { kind: "plan", code: "managed-env-s-usd", name: "Managed Environment S (USD)", interval: "monthly", amount_cents: 0, amount_currency: "USD", description: "4 vCPU / 8GB RAM / 75GB NVMe server with monitoring, daily off-site backups, patching, and business-hours incident response. Billed monthly in advance." },
  { kind: "plan", code: "managed-env-m-usd", name: "Managed Environment M (USD)", interval: "monthly", amount_cents: 0, amount_currency: "USD", description: "6 vCPU / 12GB RAM / 100GB NVMe server with monitoring, daily off-site backups, patching, and business-hours incident response. Billed monthly in advance." },
  { kind: "plan", code: "managed-env-l-usd", name: "Managed Environment L (USD)", interval: "monthly", amount_cents: 0, amount_currency: "USD", description: "8 vCPU / 24GB RAM / 200GB NVMe server with monitoring, daily off-site backups, patching, and 24/7 incident response. Billed monthly in advance." },

  // Managed Environment, client-hosted ("Your cloud"): the same operations on
  // a server in the client's own AWS/GCP/Azure/DO account or on-prem, attached
  // to Coolify over SSH. The client pays their provider directly; this is the
  // management fee only. Price it as a fixed floor (no lower than Managed
  // Environment S minus the server cost) -- it must not shrink because their
  // server is cheap. One subscription per server, external_id = Coolify UUID.
  // Onboarding (access, monitoring, backups in their account) is a one-off
  // add-on invoiced before the server is attached. PRICES UNSET, as above.
  { kind: "plan", code: "managed-env-byo-ngn", name: "Managed Environment — Your Cloud (NGN)", interval: "monthly", amount_cents: 0, amount_currency: "NGN", description: "Monitoring, daily off-site backups, patching, and business-hours incident response for a server in your own cloud account. Server billed by your provider, not included. Billed monthly in advance." },
  { kind: "plan", code: "managed-env-byo-usd", name: "Managed Environment — Your Cloud (USD)", interval: "monthly", amount_cents: 0, amount_currency: "USD", description: "Monitoring, daily off-site backups, patching, and business-hours incident response for a server in your own cloud account. Server billed by your provider, not included. Billed monthly in advance." },

  { kind: "add_on", code: "architecture-audit-usd", name: "Architecture Audit (USD)", amount_cents: 1_200_000, amount_currency: "USD", description: "1-week senior technical deep dive + 12-week remediation roadmap." },
  { kind: "add_on", code: "mvp-build-usd", name: "MVP Build — Laravel/Octane (USD)", amount_cents: 3_500_000, amount_currency: "USD", description: "4-12 week MVP build. Floor of the $35k-75k band -- override per deal when invoicing." },
  { kind: "add_on", code: "medusa-commerce-build-usd", name: "Medusa Commerce Build (USD)", amount_cents: 3_000_000, amount_currency: "USD", description: "Scoped commerce build. Floor of the $30k-70k band -- override per deal." },
  { kind: "add_on", code: "ai-integration-sprint-usd", name: "AI Integration Sprint (USD)", amount_cents: 1_500_000, amount_currency: "USD", description: "2-4 week sprint. Floor of the $15k-30k band -- override per deal." },
  { kind: "add_on", code: "client-cloud-onboarding-usd", name: "Your Cloud Onboarding (USD)", amount_cents: 0, amount_currency: "USD", description: "One-off: access setup, monitoring, off-site backups, and control-plane attach for a server in your own cloud account. Price unset -- decide before running with POST." },
  { kind: "add_on", code: "infra-passthrough-usd", name: "Infrastructure Pass-Through (USD)", amount_cents: 100, amount_currency: "USD", description: "Cost + 15-20% markup, billed monthly. Amount is set per-invoice from the actual cloud bill -- Lago rejects 0 as an add-on price, so this $1 is a placeholder, always override at invoicing time." },

  { kind: "add_on", code: "architecture-audit-ngn", name: "Architecture Audit (NGN)", amount_cents: 280_000_000, amount_currency: "NGN", description: "3-5 day local audit + roadmap. VAT-exclusive -- add 7.5% at invoicing." },
  // Real documented floor is ₦9M (900_000_000 kobo), but Lago's add-on
  // amount_cents ceiling sits somewhere between 280,000,000 (confirmed OK,
  // see architecture-audit-ngn) and 900,000,000 (confirmed "value_is_out_of_range",
  // 2026-09-17). This catalog entry is a placeholder to satisfy that ceiling,
  // not the real price -- actual MVP Build deals are invoiced at the documented
  // ₦9M-25M band via one-off override regardless of this seeded value.
  { kind: "add_on", code: "mvp-build-ngn", name: "MVP Build — Local (NGN)", amount_cents: 250_000_000, amount_currency: "NGN", description: "4-8 week local MVP build. Real price band is ₦9M-25M (see pricing-strategy.md) -- always override at invoicing, this catalog value only exists to stay under Lago's add-on ceiling. VAT-exclusive." },
  { kind: "add_on", code: "client-cloud-onboarding-ngn", name: "Your Cloud Onboarding (NGN)", amount_cents: 0, amount_currency: "NGN", description: "One-off: access setup, monitoring, off-site backups, and control-plane attach for a server in your own cloud account. VAT-exclusive. Price unset -- decide before running with POST." },
  { kind: "add_on", code: "infra-passthrough-ngn", name: "Infrastructure Pass-Through (NGN)", amount_cents: 100, amount_currency: "NGN", description: "USD infra cost converted at invoice-date rate + markup. Lago rejects 0 as an add-on price, so this is a nominal placeholder -- always override at invoicing time." },
];

async function lagoGet(path: string) {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${LAGO_API_KEY}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lago GET ${path} -> ${res.status}`);
  return res.json();
}

async function lagoPost(path: string, body: unknown) {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LAGO_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Lago POST ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

type CatalogResult = { kind: string; code: string; action: "skip" | "create" | "would_create" | "needs_price" | "error"; error?: string };

// Each item is independent -- one bad amount_cents value shouldn't hide
// whether the other 12 succeeded. A prior version let a single lagoPost
// failure throw out of the whole loop, which silently discarded the status
// of everything before it (confirmed the hard way: a real --apply run hit a
// validation error on one add-on and returned nothing about the rest).
async function runCatalog(apply: boolean): Promise<CatalogResult[]> {
  const results: CatalogResult[] = [];

  for (const item of CATALOG) {
    // A 0 price is a placeholder waiting for a pricing decision, never a real
    // price -- creating it would put a free plan into an invoiceable catalog.
    if (item.amount_cents <= 0) {
      results.push({ kind: item.kind, code: item.code, action: "needs_price" });
      continue;
    }
    try {
      const lookupPath = item.kind === "plan" ? `/plans/${item.code}` : `/add_ons/${item.code}`;
      const existing = await lagoGet(lookupPath);

      if (existing) {
        results.push({ kind: item.kind, code: item.code, action: "skip" });
        continue;
      }

      if (!apply) {
        results.push({ kind: item.kind, code: item.code, action: "would_create" });
        continue;
      }

      if (item.kind === "plan") {
        await lagoPost("/plans", {
          plan: { name: item.name, code: item.code, interval: item.interval, amount_cents: item.amount_cents, amount_currency: item.amount_currency, pay_in_advance: true, description: item.description },
        });
      } else {
        await lagoPost("/add_ons", {
          add_on: { name: item.name, code: item.code, amount_cents: item.amount_cents, amount_currency: item.amount_currency, description: item.description },
        });
      }
      results.push({ kind: item.kind, code: item.code, action: "create" });
    } catch (err) {
      results.push({ kind: item.kind, code: item.code, action: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (!caller.isAdmin) return json({ error: "Forbidden -- admin only" }, 403);

  const apply = req.method === "POST";

  try {
    const results = await runCatalog(apply);
    const errorCount = results.filter((r) => r.action === "error").length;
    return json({
      applied: apply,
      note: apply
        ? errorCount > 0
          ? `Created what it could; ${errorCount} item(s) failed -- see their "error" field. Fix those and POST again, it's safe to re-run.`
          : "Created any missing plans/add-ons."
        : "Dry run -- nothing was created. POST to this same URL to apply.",
      results,
    });
  } catch (err) {
    // A fetch-level failure (DNS, connection refused, TLS) only puts a
    // generic "error sending request for url (...)" in err.message -- the
    // actually useful detail is in the cause chain, which JSON.stringify
    // silently drops if returned as-is. Walk it explicitly instead.
    const chain: string[] = [];
    let cause: unknown = err;
    while (cause) {
      chain.push(cause instanceof Error ? cause.message : String(cause));
      cause = cause instanceof Error ? cause.cause : undefined;
    }
    return json({ error: chain.join(" -- caused by: "), lagoApiUrl: LAGO_API_URL }, 502);
  }
});
