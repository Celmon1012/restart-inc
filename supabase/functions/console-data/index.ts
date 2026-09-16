// Console workspace data proxy.
//
// The console SPA can never hold a Coolify API token — that token can see
// and control every client's server, not just the caller's. This function
// is the only thing that holds it: it verifies the caller's Supabase
// session, looks up which workspace(s) they're a member of (console schema,
// not "public" — this instance is shared with other restart-inc apps), and
// only then calls Coolify server-side, scoped to that one workspace's
// project.
//
// GET /functions/v1/console-data              -> workspace list + first workspace's live data
// GET /functions/v1/console-data?workspace_id= -> workspace list + that workspace's live data
//
// Convention assumed here (matches how every workspace has been set up so
// far): one Coolify project per workspace, with a single "production"
// environment, and every resource in that environment sitting on the same
// dedicated server. If that ever stops being true for some workspace, this
// needs to resolve environments/servers per-resource instead of assuming one.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
  coolify_project_uuid: string;
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
      });
    }
  }

  return { resources, serverRef };
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
        // Coolify has no concept of physical region/datacenter — if you
        // want one shown, it has to come from restart-inc's own records,
        // not this call.
        region: null,
      };
    } catch {
      // Server detail is a nice-to-have; resource list still stands without it.
      server = { uuid: serverRef.uuid, name: serverRef.name, ip: serverRef.ip, region: null };
    }
  }

  return {
    server,
    environments: [{ name: "production", resources }],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const { data: memberships, error: memErr } = await admin
    .schema("console")
    .from("workspace_members")
    .select("workspaces:workspace_id (id, name, tier_label, coolify_project_uuid)")
    .eq("user_id", userData.user.id);

  if (memErr) return json({ error: memErr.message }, 500);

  const workspaces: WorkspaceRow[] = (memberships ?? [])
    .map((m: any) => m.workspaces)
    .filter(Boolean);

  if (workspaces.length === 0) return json({ workspaces: [], active: null });

  const requestedId = new URL(req.url).searchParams.get("workspace_id");
  // Never trust a client-supplied workspace_id beyond checking it's one of
  // THIS caller's own memberships above — that check is the entire security
  // boundary between clients.
  const target = requestedId ? workspaces.find((w) => w.id === requestedId) : workspaces[0];
  if (!target) return json({ error: "Not a member of that workspace" }, 403);

  try {
    const live = await fetchWorkspaceLiveData(target.coolify_project_uuid);
    return json({
      workspaces: workspaces.map((w) => ({ id: w.id, name: w.name, tier: w.tier_label })),
      active: {
        id: target.id,
        name: target.name,
        tier: target.tier_label,
        ...live,
      },
    });
  } catch (err) {
    return json({ error: `Failed to load Coolify data: ${(err as Error).message}` }, 502);
  }
});
