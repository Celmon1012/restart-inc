// Console workspace data proxy.
//
// The console SPA can never hold a Coolify API token -- that token can see
// and control every client's server, not just the caller's. This function
// is the only thing that holds it: it verifies the caller's Supabase
// session, looks up which workspace(s) they're a member of (console schema,
// not "public" -- this instance is shared with other restart-inc apps), and
// only then calls Coolify server-side, scoped to that one workspace's
// project.
//
// Deliberately zero external imports (no @supabase/supabase-js). This
// self-hosted edge runtime downloads npm/esm.sh dependencies fresh on every
// cold start with no bundling/caching, which hit Deno's wall-clock limit
// and killed the isolate before it ever ran. Talking to GoTrue/PostgREST
// directly over plain fetch() avoids that entirely -- and as a side
// benefit, the workspace lookup below runs as the CALLER's own JWT against
// RLS-protected PostgREST, not a service-role query with a manual filter,
// so Postgres itself enforces the one thing that must never be wrong: a
// user only ever seeing their own workspaces.
//
// GET /functions/v1/console-data              -> workspace list + first workspace's live data
// GET /functions/v1/console-data?workspace_id= -> workspace list + that workspace's live data
//
// Convention assumed here (matches how every workspace has been set up so
// far): one Coolify project per workspace, with a single "production"
// environment, and every resource in that environment sitting on the same
// dedicated server. If that ever stops being true for some workspace, this
// needs to resolve environments/servers per-resource instead of assuming one.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const COOLIFY_API_URL = (Deno.env.get("COOLIFY_API_URL") ?? "https://cp.restart.ng").replace(/\/$/, "");
const COOLIFY_API_TOKEN = Deno.env.get("COOLIFY_API_TOKEN")!;

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

interface WorkspaceRow {
  id: string;
  name: string;
  tier_label: string | null;
  // NULL for a workspace created through console onboarding that staff
  // haven't provisioned infrastructure for yet.
  coolify_project_uuid: string | null;
}

async function getUser(jwt: string): Promise<{ id: string; isAdmin: boolean } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  // app_metadata, not user_metadata -- only settable via the service-role
  // Admin API, never via the user's own auth.updateUser() call, so a client
  // account can never grant itself this by editing its own profile.
  return { id: user.id, isAdmin: Boolean(user.app_metadata?.is_admin) };
}

// Runs as the caller's own JWT, not service_role -- console.workspace_members'
// RLS policy ("user_id = auth.uid()") is what actually scopes this, not the
// app code. Never widen this to a service-role call without keeping an
// equivalent explicit filter.
async function getMyWorkspaces(jwt: string): Promise<WorkspaceRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workspace_members?select=workspaces(id,name,tier_label,coolify_project_uuid)`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: SUPABASE_ANON_KEY,
        "Accept-Profile": "console",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`workspace lookup -> ${res.status}`);
  }
  const rows: Array<{ workspaces: WorkspaceRow | null }> = await res.json();
  return rows.map((r) => r.workspaces).filter((w): w is WorkspaceRow => Boolean(w));
}

// Admin path: console.workspaces' RLS policy lets an is_admin account read
// every row directly, no membership join needed. Still runs as the
// caller's own JWT -- the admin bypass lives in the RLS policy itself
// (console.is_admin()), not in this function trusting a client-asserted flag.
async function getAllWorkspaces(jwt: string): Promise<WorkspaceRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?select=id,name,tier_label,coolify_project_uuid`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
      "Accept-Profile": "console",
    },
  });
  if (!res.ok) {
    throw new Error(`workspace lookup -> ${res.status}`);
  }
  return res.json();
}

async function coolifyFetch(path: string) {
  const res = await fetch(`${COOLIFY_API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${COOLIFY_API_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Coolify ${path} -> ${res.status}`);
  }
  return res.json();
}

function firstFqdn(fqdn: string | null | undefined): string {
  if (!fqdn) return "";
  return fqdn.split(",")[0].replace(/^https?:\/\//, "");
}

// Coolify stores this in UTC but formats it as "YYYY-MM-DD HH:MM:SS" (no
// offset), unlike its created_at/updated_at fields which come back full ISO
// -- normalize so the frontend can hand it straight to `new Date()`.
function normalizeCoolifyTimestamp(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const iso = ts.includes("T") ? ts : `${ts.replace(" ", "T")}Z`;
  const parsed = new Date(iso);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// A service is a group of containers (app.applications + app.databases in
// Coolify's model), not one process, so it has no last_online_at of its own
// -- the most recent heartbeat among its containers is the closest honest
// equivalent to "when this resource was last confirmed up."
function serviceLastOnlineAt(svc: Record<string, any>): string | null {
  const containers = [...(svc.applications ?? []), ...(svc.databases ?? [])];
  const timestamps = containers
    .map((c: Record<string, any>) => normalizeCoolifyTimestamp(c.last_online_at))
    .filter((t): t is string => t !== null);
  return timestamps.length === 0 ? null : timestamps.sort().at(-1)!;
}

const STANDALONE_DB_KEYS: Record<string, string> = {
  postgresqls: "standalone-postgresql",
  mysqls: "standalone-mysql",
  mariadbs: "standalone-mariadb",
  mongodbs: "standalone-mongodb",
  redis: "standalone-redis",
  keydbs: "standalone-keydb",
  clickhouses: "standalone-clickhouse",
  dragonflies: "standalone-dragonfly",
};

function mapResources(env: Record<string, any>) {
  const resources: any[] = [];
  let serverRef: { uuid: string; name: string; ip: string } | null = null;

  for (const app of env.applications ?? []) {
    serverRef ??= app.destination?.server ?? null;
    resources.push({
      kind: "application",
      uuid: app.uuid,
      name: app.name,
      status: app.status,
      fqdn: firstFqdn(app.fqdn),
      gitRepository: app.git_repository,
      gitBranch: app.git_branch,
      gitCommitSha: app.git_commit_sha,
      buildPack: app.build_pack,
      lastOnlineAt: normalizeCoolifyTimestamp(app.last_online_at),
    });
  }

  for (const svc of env.services ?? []) {
    serverRef ??= svc.server ?? null;
    resources.push({
      kind: "service",
      uuid: svc.uuid,
      name: svc.name,
      status: svc.status,
      serviceType: svc.service_type,
      lastOnlineAt: serviceLastOnlineAt(svc),
    });
  }

  for (const [key, databaseType] of Object.entries(STANDALONE_DB_KEYS)) {
    for (const db of env[key] ?? []) {
      serverRef ??= db.destination?.server ?? null;
      resources.push({
        kind: "database",
        uuid: db.uuid,
        name: db.name,
        status: db.status,
        databaseType,
        isPublic: Boolean(db.is_public),
        lastOnlineAt: normalizeCoolifyTimestamp(db.last_online_at),
      });
    }
  }

  return { resources, serverRef };
}

// Deployment history is per-application, not per-project, so a workspace
// with several applications needs one call per app. Small, bounded lists
// (every workspace here has a handful of apps at most) so running them
// concurrently and merging is cheap; failures are swallowed per-app so one
// app's deploy history being unavailable doesn't blank the whole feed.
async function fetchDeployments(appUuid: string, appName: string) {
  try {
    const rows = await coolifyFetch(`/deployments/applications/${appUuid}?take=10`);
    return (Array.isArray(rows) ? rows : []).map((d: Record<string, any>) => ({
      uuid: d.deployment_uuid,
      applicationName: appName,
      status: d.status,
      commitSha: typeof d.commit === "string" ? d.commit.slice(0, 7) : null,
      createdAt: d.created_at,
      trigger: d.is_webhook ? "webhook" : d.is_api ? "api" : "manual",
    }));
  } catch {
    return [];
  }
}

async function fetchWorkspaceLiveData(coolifyProjectUuid: string) {
  const env = await coolifyFetch(`/projects/${coolifyProjectUuid}/production`);
  const { resources, serverRef } = mapResources(env);

  let server = null;
  if (serverRef) {
    try {
      const full = await coolifyFetch(`/servers/${serverRef.uuid}`);
      server = {
        uuid: full.uuid,
        name: full.name,
        ip: full.ip,
        isReachable: Boolean(full.settings?.is_reachable),
        cpus: full.server_metadata?.cpus ?? null,
        memoryGb: full.server_metadata?.memory_bytes
          ? Math.round(full.server_metadata.memory_bytes / 1024 / 1024 / 1024)
          : null,
        dockerVersion: full.settings?.docker_version ?? null,
        os: full.server_metadata?.os ?? null,
        arch: full.server_metadata?.arch ?? null,
        kernel: full.server_metadata?.kernel ?? null,
        composeVersion: full.settings?.compose_version ?? null,
        upSince: full.server_metadata?.uptime_since ?? null,
      };
    } catch {
      // Server detail is a nice-to-have; resource list still stands without it.
      server = { uuid: serverRef.uuid, name: serverRef.name, ip: serverRef.ip };
    }
  }

  const applications = resources.filter((r) => r.kind === "application");
  const deploymentLists = await Promise.all(
    applications.map((app) => fetchDeployments(app.uuid, app.name))
  );
  const deployments = deploymentLists
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10);

  return {
    server,
    environments: [{ name: "production", resources }],
    deployments,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  let workspaces: WorkspaceRow[];
  try {
    workspaces = caller.isAdmin ? await getAllWorkspaces(jwt) : await getMyWorkspaces(jwt);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  if (workspaces.length === 0) return json({ workspaces: [], active: null, isAdmin: caller.isAdmin });

  const requestedId = new URL(req.url).searchParams.get("workspace_id");
  // Belt-and-suspenders: getMyWorkspaces() already only returns rows RLS
  // allows this caller to see, but never trust a client-supplied id beyond
  // checking it's actually in that already-scoped list.
  const target = requestedId ? workspaces.find((w) => w.id === requestedId) : workspaces[0];
  if (!target) return json({ error: "Not a member of that workspace" }, 403);

  try {
    const live = target.coolify_project_uuid
      ? await fetchWorkspaceLiveData(target.coolify_project_uuid)
      : { server: null, environments: [{ name: "production", resources: [] }], deployments: [] };
    return json({
      workspaces: workspaces.map((w) => ({ id: w.id, name: w.name, tier: w.tier_label })),
      active: {
        id: target.id,
        name: target.name,
        tier: target.tier_label,
        provisioning: !target.coolify_project_uuid,
        ...live,
      },
      isAdmin: caller.isAdmin,
    });
  } catch (err) {
    return json({ error: `Failed to load Coolify data: ${(err as Error).message}` }, 502);
  }
});
