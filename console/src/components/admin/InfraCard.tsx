// A project's Coolify link, managed from its admin page: attach an existing
// Coolify project, create a fresh one, or detach. Coolify calls go through
// console-admin-infra. Creating makes the Coolify project only -- the
// project's own server is provisioned and deployed onto separately.

import { useState } from "react";
import { AlertTriangle, Link2, Plus } from "lucide-react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { loadCoolifyProjects, runInfraAction } from "@/lib/admin";

export function InfraCard({
  workspaceId,
  workspaceName,
  coolifyProjectUuid,
  onChanged
}: {
  workspaceId: string;
  workspaceName: string;
  coolifyProjectUuid: string | null;
  onChanged: () => void;
}) {
  const coolify = useAsyncResource(() => loadCoolifyProjects(), [coolifyProjectUuid], {
    errorMessage: "Couldn't reach Coolify"
  });
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const linked = coolify.data?.find((p) => p.uuid === coolifyProjectUuid) ?? null;
  const unlinked = (coolify.data ?? []).filter((p) => !p.workspaceId);

  async function run(body: Parameters<typeof runInfraAction>[0]) {
    setBusy(true);
    setActionError(null);
    try {
      await runInfraAction(body);
      setChoice("");
      onChanged();
      void coolify.refresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function unlink() {
    if (!window.confirm(`Detach ${workspaceName} from its Coolify project? Nothing in Coolify is deleted; the client stops seeing its servers here.`)) return;
    void run({ action: "unlink", workspace_id: workspaceId });
  }

  function create() {
    if (!window.confirm(`Create a new Coolify project "${workspaceName}" and link it? Deploy it onto its own new server, not an existing client's.`)) return;
    void run({ action: "create", workspace_id: workspaceId });
  }

  return (
    <div className="cp-card">
      <div className="cp-card-head"><span>Infrastructure</span></div>

      {coolifyProjectUuid ? (
        <>
          <div className="app-meta-list">
            <div className="app-meta-item">
              <span className="meta-k">Coolify project</span>
              <span className="meta-v">{coolify.loading ? "…" : linked?.name ?? <span className="admin-warn">Missing in Coolify ({coolifyProjectUuid})</span>}</span>
            </div>
            <div className="app-meta-item">
              <span className="meta-k">Server</span>
              <span className="meta-v">
                {coolify.loading
                  ? "…"
                  : linked?.servers.length
                    ? linked.servers.map((s) => s.name).join(", ")
                    : <span className="admin-muted">Nothing deployed yet</span>}
              </span>
            </div>
          </div>
          {linked?.servers.some((s) => s.sharedWith.length > 0) && (
            <p className="infra-note admin-warn">
              <AlertTriangle size={13} /> Server shared with {Array.from(new Set(linked.servers.flatMap((s) => s.sharedWith))).join(", ")}. Each project should have its own server.
            </p>
          )}
          <div className="admin-form-actions">
            <button type="button" className="console-btn-secondary" onClick={unlink} disabled={busy}>Detach</button>
          </div>
        </>
      ) : (
        <>
          <p className="cp-empty">Not provisioned. The client sees this project as "setting up" until it's linked.</p>
          {coolify.error ? (
            <p className="infra-note admin-warn">{coolify.error}</p>
          ) : (
            <div className="infra-link-row">
              <select
                className="console-select"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                disabled={busy || coolify.loading}
                aria-label="Coolify project to link"
              >
                <option value="">{coolify.loading ? "Loading Coolify projects…" : unlinked.length ? "Link an existing Coolify project…" : "No unlinked Coolify projects"}</option>
                {unlinked.map((p) => (
                  <option key={p.uuid} value={p.uuid}>{p.name}{p.servers.length ? ` · ${p.servers.map((s) => s.name).join(", ")}` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                className="console-btn-secondary"
                disabled={busy || !choice}
                onClick={() => void run({ action: "link", workspace_id: workspaceId, coolify_project_uuid: choice })}
              >
                <Link2 size={13} /> Link
              </button>
              <button type="button" className="dash-action-btn" disabled={busy} onClick={create}>
                <Plus size={13} />
                <span>Create in Coolify</span>
              </button>
            </div>
          )}
        </>
      )}
      {actionError && <p className="infra-note admin-warn">{actionError}</p>}
    </div>
  );
}
