// Owner-only: invite a teammate and give them a staff role (ops or finance, or owner).
//
// POST /functions/v1/console-admin-team  { action: "invite", email, roles: ["ops" | "finance" | "owner"] }
//   -> sends the person an invitation email (their account is created if it doesn't exist) and
//      sets their roles. If they already have an account, only the roles are set.
//
// This is a function, not a browser call, because creating an account and sending the invitation
// need the service-role key, which can control every account and must never reach the browser.
// Listing people and changing roles don't need it: the console does those as the owner through
// console.admin_list_staff() and console.admin_set_staff_roles(), which check the owner role in
// Postgres. The role change here also goes through that function, as the caller, so it is checked
// there too.
//
// Zero external imports, same cold-start reasoning as every other function here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Where the invitation link lands. /reset-password doubles as "set your first password".
const CONSOLE_URL = (Deno.env.get("CONSOLE_URL") ?? "https://console.restart.ng").replace(/\/$/, "");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["owner", "ops", "finance"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function callerRoles(jwt: string): Promise<{ id: string; roles: string[] } | null> {
  const headers = { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY };
  const [res, rolesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/my_effective_roles`, {
      method: "POST",
      headers: { ...headers, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null),
  ]);
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  if (rolesRes?.ok) {
    const list = await rolesRes.json().catch(() => null);
    if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
  }
  return { id: user.id, roles };
}

const adminHeaders = { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" };

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  // The team is small, so one page of the user list is enough to find an existing account.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: adminHeaders });
  if (!res.ok) throw new Error(`Couldn't look up existing accounts (${res.status})`);
  const body = await res.json();
  const users: Array<{ id: string; email?: string }> = body?.users ?? [];
  return users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const caller = await callerRoles(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (!caller.roles.includes("owner")) return json({ error: "Owners only" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "invite") return json({ error: "Unknown action" }, 400);

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
    const roles: string[] = Array.isArray(body.roles) ? body.roles.filter((r: unknown): r is string => typeof r === "string") : [];
    if (roles.length === 0 || roles.some((r) => !ROLES.includes(r))) return json({ error: "Choose at least one valid role" }, 400);

    // Create the account and send the invitation. An address that already has an account is not an
    // error: the roles are simply set on it.
    let userId: string | null = null;
    let invited = false;
    const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(`${CONSOLE_URL}/reset-password`)}`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email }),
    });
    if (inviteRes.ok) {
      const created = await inviteRes.json();
      userId = created?.id ?? null;
      invited = true;
    } else {
      const existing = await findUserByEmail(email);
      if (!existing) {
        const detail = await inviteRes.text().catch(() => "");
        return json({ error: `Couldn't send the invitation (${inviteRes.status}) ${detail}`.trim() }, 502);
      }
      userId = existing.id;
    }
    if (!userId) return json({ error: "The account was created but its id wasn't returned" }, 502);

    // As the caller, so Postgres checks the owner role again.
    const setRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_set_staff_roles`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Content-Profile": "console", "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: userId, p_roles: roles }),
    });
    if (!setRes.ok) {
      const err = await setRes.json().catch(() => null);
      return json({ error: err?.message ?? `Couldn't set the roles (${setRes.status})` }, 400);
    }

    return json({ ok: true, userId, email, roles, invited });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
