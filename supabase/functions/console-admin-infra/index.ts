// Admin-only: keep console projects and Coolify projects in step.
//
// Console projects (console.workspaces) and Coolify projects were two lists
// joined only by a coolify_project_uuid typed in by hand, so they drifted:
// Coolify projects with no console project, console projects stuck in
// "provisioning". This function backs the admin controls that close that gap.
// Like console-data, it exists because COOLIFY_API_TOKEN can control every
// client's server and must never reach the browser.
//
// GET (or POST with no action) /functions/v1/console-admin-infra
//   -> every Coolify project, which console project (if any) it's linked to,
//      and the server(s) its production resources run on
// POST /functions/v1/console-admin-infra  { action, ... }
//   link    { workspace_id, coolify_project_uuid }  attach an existing Coolify project
//   create  { workspace_id }                        create a Coolify project for it, then link
//   unlink  { workspace_id }                        detach (nothing in Coolify is touched)
//   import  { coolify_project_uuid, name, contact_email }  new console project for an unlinked Coolify project
//
// Authorization is two layers: app_metadata.is_admin checked here, and the
// writes going through console.admin_* functions as the caller's own JWT,
// which check console.is_admin() again inside Postgres.
//
// Policy: one console project = one Coolify project = its own dedicated
// server. "create" makes the Coolify project only -- the new server is
// provisioned and its resources deployed onto it as an engineer's step. The
// GET response flags any server that more than one Coolify project uses, so
// a project deployed onto another client's server shows up.
//
// Zero external imports, same cold-start reasoning as every other function here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const COOLIFY_API_URL = (Deno.env.get("COOLIFY_API_URL") ?? "https://cp.restart.ng").replace(/\/$/, "");
const COOLIFY_API_TOKEN = Deno.env.get("COOLIFY_API_TOKEN")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
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

interface WorkspaceRow {
  id: string;
  name: string;
  coolify_project_uuid: string | null;
}

async function getWorkspaces(jwt: string): Promise<WorkspaceRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?select=id,name,coolify_project_uuid`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Accept-Profile": "console" },
  });
  if (!res.ok) throw new Error(`workspaces lookup -> ${res.status}`);
  return res.json();
}

// PostgREST RPC as the caller. Surfaces the function's own exception message
// ("That Coolify project is already linked...") rather than a bare status.
async function rpc(jwt: string, fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Profile": "console",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.message ?? `${fn} -> ${res.status}`);
  return body;
}

async function coolify(path: string, init: RequestInit = {}) {
  const res = await fetch(`${COOLIFY_API_URL}/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${COOLIFY_API_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Coolify ${init.method ?? "GET"} ${path} -> ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

const RESOURCE_KEYS = [
  "applications", "services", "postgresqls", "mysqls", "mariadbs", "mongodbs",
  "redis", "keydbs", "clickhouses", "dragonflies",
];

// Servers a project's production resources sit on. Same shapes console-data
// reads: applications/databases carry destination.server, services carry server.
async function projectServers(uuid: string): Promise<Array<{ uuid: string; name: string }>> {
  let env: Record<string, any> | null;
  try {
    env = await coolify(`/projects/${uuid}/production`);
  } catch {
    return [];
  }
  if (!env) return [];
  const servers = new Map<string, string>();
  for (const key of RESOURCE_KEYS) {
    for (const r of env[key] ?? []) {
      const s = r.destination?.server ?? r.server;
      if (s?.uuid) servers.set(s.uuid, s.name ?? s.uuid);
    }
  }
  return Array.from(servers, ([uuid, name]) => ({ uuid, name }));
}

async function listProjects(jwt: string) {
  const [projects, workspaces] = await Promise.all([coolify("/projects"), getWorkspaces(jwt)]);
  const byUuid = new Map(workspaces.filter((w) => w.coolify_project_uuid).map((w) => [w.coolify_project_uuid!, w]));
  const rows = await Promise.all(
    ((projects ?? []) as Array<Record<string, any>>).map(async (p) => {
      const ws = byUuid.get(p.uuid) ?? null;
      return {
        uuid: p.uuid as string,
        name: p.name as string,
        description: (p.description as string | null) ?? null,
        workspaceId: ws?.id ?? null,
        workspaceName: ws?.name ?? null,
        servers: await projectServers(p.uuid),
      };
    })
  );

  // Which Coolify projects each server hosts, to flag shared servers.
  const hosts = new Map<string, string[]>();
  for (const r of rows) for (const s of r.servers) hosts.set(s.uuid, [...(hosts.get(s.uuid) ?? []), r.name]);

  return rows
    .map((r) => ({
      ...r,
      servers: r.servers.map((s) => ({ ...s, sharedWith: (hosts.get(s.uuid) ?? []).filter((n) => n !== r.name) })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function requireCoolifyProject(uuid: unknown) {
  if (typeof uuid !== "string" || !uuid.trim()) throw new Error("Missing Coolify project");
  const project = await coolify(`/projects/${uuid.trim()}`);
  if (!project) throw new Error("That Coolify project no longer exists");
  return project;
}

async function createAndLink(jwt: string, workspaceId: unknown) {
  if (typeof workspaceId !== "string") throw new Error("Missing project");
  const ws = (await getWorkspaces(jwt)).find((w) => w.id === workspaceId);
  if (!ws) throw new Error("Project not found");
  if (ws.coolify_project_uuid) throw new Error("This project is already linked to Coolify");

  const created = await coolify("/projects", {
    method: "POST",
    body: JSON.stringify({ name: ws.name, description: `Console project ${ws.id}` }),
  });
  const uuid = created?.uuid as string | undefined;
  if (!uuid) throw new Error("Coolify didn't return the new project");

  try {
    // Coolify creates "production" with a new project; console-data reads
    // that environment by name, so make sure it's there.
    if (!(await coolify(`/projects/${uuid}/production`))) {
      await coolify(`/projects/${uuid}/environments`, { method: "POST", body: JSON.stringify({ name: "production" }) });
    }
    await rpc(jwt, "admin_set_workspace_infra", { p_workspace_id: ws.id, p_coolify_project_uuid: uuid });
  } catch (err) {
    // Don't leave an orphan Coolify project behind; it's still empty.
    await coolify(`/projects/${uuid}`, { method: "DELETE" }).catch(() => null);
    throw err;
  }
  return { coolifyProjectUuid: uuid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const caller = await getUser(jwt);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (!caller.isAdmin) return json({ error: "Admins only" }, 403);

  try {
    // supabase.functions.invoke() POSTs even with no body, so a call without
    // an action is the listing, whatever the method.
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (!body?.action) {
      return json({ projects: await listProjects(jwt) });
    }
    switch (body.action) {
      case "link": {
        const project = await requireCoolifyProject(body.coolify_project_uuid);
        await rpc(jwt, "admin_set_workspace_infra", { p_workspace_id: body.workspace_id, p_coolify_project_uuid: project.uuid });
        return json({ ok: true });
      }
      case "unlink":
        await rpc(jwt, "admin_set_workspace_infra", { p_workspace_id: body.workspace_id, p_coolify_project_uuid: null });
        return json({ ok: true });
      case "create":
        return json(await createAndLink(jwt, body.workspace_id));
      case "import": {
        const project = await requireCoolifyProject(body.coolify_project_uuid);
        const workspaceId = await rpc(jwt, "admin_import_workspace", {
          p_name: body.name,
          p_contact_email: body.contact_email,
          p_coolify_project_uuid: project.uuid,
        });
        return json({ workspaceId });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
