// Console billing proxy — same shape as console-data, different external
// system. A Lago API key has full access to every client's billing data
// (invoices, revenue, customer records), so it can never reach the
// browser; this function is the only thing that holds it.
//
// GET /functions/v1/console-billing?workspace_id=<id>
//
// Zero external imports, same reason as console-data: this self-hosted
// edge runtime re-downloads npm/esm.sh dependencies on every cold start
// with no caching, which hit Deno's wall-clock limit and killed the
// isolate before it ever ran. Plain fetch() avoids that entirely.

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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

// Runs as the caller's own JWT against RLS -- this is the entire
// authorization boundary. A workspace this account can't see in
// console.workspaces (admin or member) simply comes back empty, and
// that's treated as "not found", not "forbidden", so this can't be used
// to probe which workspace ids exist.
async function getWorkspaceLagoCustomerId(jwt: string, workspaceId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=lago_customer_id`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: SUPABASE_ANON_KEY,
        "Accept-Profile": "console",
      },
    }
  );
  if (!res.ok) throw new Error(`workspace lookup -> ${res.status}`);
  const rows: Array<{ lago_customer_id: string | null }> = await res.json();
  return rows[0]?.lago_customer_id ?? null;
}

async function lagoFetch(path: string) {
  const res = await fetch(`${LAGO_API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${LAGO_API_KEY}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lago ${path} -> ${res.status}`);
  return res.json();
}

interface LagoSubscription {
  external_id: string;
  plan_code: string;
  status: string;
  started_at: string | null;
}

interface LagoInvoice {
  number: string;
  issuing_date: string;
  status: string;
  payment_status: string;
  total_amount_cents: number;
  currency: string;
  file_url: string | null;
}

interface LagoPlan {
  name: string;
  code: string;
  amount_cents: number;
  amount_currency: string;
  interval: string;
}

async function fetchBilling(externalCustomerId: string) {
  const [customerRes, subsRes, invoicesRes] = await Promise.all([
    lagoFetch(`/customers/${encodeURIComponent(externalCustomerId)}`),
    lagoFetch(`/subscriptions?external_customer_id=${encodeURIComponent(externalCustomerId)}`),
    lagoFetch(`/invoices?external_customer_id=${encodeURIComponent(externalCustomerId)}&per_page=20`),
  ]);

  const subscriptions: LagoSubscription[] = subsRes?.subscriptions ?? [];
  const invoices: LagoInvoice[] = invoicesRes?.invoices ?? [];

  // Plans aren't included inline on a subscription (only plan_code is), so
  // fetch each distinct plan referenced to get its real price/interval.
  const planCodes = [...new Set(subscriptions.map((s) => s.plan_code))];
  const plans = await Promise.all(planCodes.map((code) => lagoFetch(`/plans/${encodeURIComponent(code)}`)));
  const planByCode = new Map<string, LagoPlan>(
    plans.filter((p): p is { plan: LagoPlan } => Boolean(p?.plan)).map((p) => [p.plan.code, p.plan])
  );

  return {
    customer: customerRes?.customer
      ? {
          externalId: externalCustomerId,
          name: customerRes.customer.name,
          paymentProvider: customerRes.customer.payment_provider ?? null,
        }
      : null,
    subscriptions: subscriptions.map((s) => {
      const plan = planByCode.get(s.plan_code);
      return {
        planCode: s.plan_code,
        planName: plan?.name ?? s.plan_code,
        status: s.status,
        startedAt: s.started_at,
        amountCents: plan?.amount_cents ?? null,
        currency: plan?.amount_currency ?? null,
        interval: plan?.interval ?? null,
      };
    }),
    invoices: invoices.map((inv) => ({
      number: inv.number,
      issuingDate: inv.issuing_date,
      status: inv.status,
      paymentStatus: inv.payment_status,
      totalAmountCents: inv.total_amount_cents,
      currency: inv.currency,
      fileUrl: inv.file_url,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId) return json({ error: "workspace_id is required" }, 400);

  let lagoCustomerId: string | null;
  try {
    lagoCustomerId = await getWorkspaceLagoCustomerId(jwt, workspaceId);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  if (!lagoCustomerId) {
    // Either the workspace doesn't exist, isn't visible to this caller
    // (RLS filtered it out), or billing simply hasn't been configured for
    // it yet -- all three look identical from here, which is correct:
    // this must never reveal whether a workspace id exists.
    return json({ billingConfigured: false });
  }

  try {
    const billing = await fetchBilling(lagoCustomerId);
    return json({ billingConfigured: true, ...billing });
  } catch (err) {
    return json({ error: `Failed to load billing data: ${(err as Error).message}` }, 502);
  }
});
