// A project's Coolify link, managed from its admin page: attach an existing
// Coolify project, create a fresh one, or detach. Coolify calls go through
// console-admin-infra. Creating makes the Coolify project only -- the
// project's own server is provisioned and deployed onto separately.

import { confirmAction } from "@/components/confirmAction";
import { useState } from "react";
import { AlertTriangle, Link2, Plus } from "lucide-react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { backupState, loadCoolifyProjects, runInfraAction, summarizeResources, type CoolifyProject } from "@/lib/admin";
import { formatRelative } from "@/lib/format";

type CoolifyServer = CoolifyProject["servers"][number];

// What Coolify's last OS patch check found on a server. Security updates and a
// pending reboot are the two things worth acting on; a pile of routine updates
// is only noted.
function ServerPatchChips({ server }: { server: CoolifyServer }) {
  if (server.reachable === false) return <span className="health-badge down">Unreachable</span>;
  const p = server.patches;
  if (!p) return <span className="health-badge muted" title="Coolify hasn't checked this server for updates yet">Not checked</span>;
  const clear = p.security === 0 && !p.rebootRequired;
  return (
    <>
      {p.security > 0 && <span className="health-badge down">{p.security} security update{p.security === 1 ? "" : "s"}</span>}
      {p.rebootRequired && <span className="health-badge warn">Reboot required</span>}
      {p.updates > p.security && <span className="health-badge muted">{p.updates - p.security} other update{p.updates - p.security === 1 ? "" : "s"}</span>}
      {clear && p.updates === 0 && <span className="health-badge ok">Up to date</span>}
      {p.checkedAt && <span className="admin-muted" title={p.checkedAt}>checked {formatRelative(p.checkedAt)}</span>}
    </>
  );
}

// One database's backup state. "None" is the one to notice: a data store with
// no schedule has nothing to restore from.
function BackupChip({ backup }: { backup: NonNullable<CoolifyProject["backups"]>[number] }) {
  const state = backupState(backup);
  const when = backup.lastAt ? formatRelative(backup.lastAt) : null;
  if (state === "none") return <span className="health-badge down">No backup</span>;
  if (state === "failed") return <span className="health-badge down">Last backup failed{when ? ` ${when}` : ""}</span>;
  if (state === "stale") return <span className="health-badge warn">{when ? `Last backup ${when}` : "No backup has run yet"}</span>;
  if (state === "ok") return <span className="health-badge ok">Backed up {when}</span>;
  return <span className="health-badge muted">Backups unknown</span>;
}

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

  async function unlink() {
    if (!(await confirmAction({ title: "Detach from Coolify?", description: `Detach ${workspaceName} from its Coolify project? Nothing in Coolify is deleted; the client stops seeing its servers here.`, confirmLabel: "Detach" }))) return;
    void run({ action: "unlink", workspace_id: workspaceId });
  }

  async function create() {
    if (!(await confirmAction({ title: "Create Coolify project?", description: `Create a new Coolify project "${workspaceName}" and link it? Deploy it onto its own new server, not an existing client's.`, confirmLabel: "Create", tone: "default" }))) return;
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
            {linked?.resources && linked.resources.length > 0 && (
              <div className="app-meta-item">
                <span className="meta-k">Health</span>
                <span className="meta-v infra-chips">
                  {(() => {
                    const h = summarizeResources(linked.resources);
                    return (
                      <>
                        {h.down.length > 0 && <span className="health-badge down" title={h.down.join(", ")}>{h.down.length} down</span>}
                        {h.healthy > 0 && <span className="health-badge ok">{h.healthy} healthy</span>}
                        {h.noCheck > 0 && <span className="health-badge muted" title="Running, but Coolify has no healthcheck for these, so a failure wouldn't show">{h.noCheck} no healthcheck</span>}
                      </>
                    );
                  })()}
                </span>
              </div>
            )}
            {linked?.backups?.map((b) => (
              <div className="app-meta-item" key={`backup-${b.name}`}>
                <span className="meta-k">{b.name} backups</span>
                <span className="meta-v infra-chips"><BackupChip backup={b} /></span>
              </div>
            ))}
            {linked?.servers.map((s) => (
              <div className="app-meta-item" key={s.uuid}>
                <span className="meta-k">{s.name} updates</span>
                <span className="meta-v infra-chips"><ServerPatchChips server={s} /></span>
              </div>
            ))}
          </div>
          {linked && summarizeResources(linked.resources).down.length > 0 && (
            <p className="infra-note admin-warn">
              <AlertTriangle size={13} /> Not running or unhealthy: {summarizeResources(linked.resources).down.join(", ")}.
            </p>
          )}
          {linked?.servers.some((s) => s.sharedWith.length > 0) && (
            <p className="infra-note admin-muted">
              Server shared with {Array.from(new Set(linked.servers.flatMap((s) => s.sharedWith))).join(", ")}.
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
