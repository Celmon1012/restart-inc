// Every project (console workspace) across every client, with delivery state
// at a glance. Clicking a row opens the project's own page (ProjectDetail),
// where milestones, requests, support, and billing are managed.

import { useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { formatDate } from "@/lib/format";
import {
  ENGAGEMENT_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  loadCoolifyProjects,
  loadPortfolio,
  runInfraAction,
  type CoolifyProject,
  type ProjectStatus
} from "@/lib/admin";

type Filter = "all" | ProjectStatus;

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  const tone = PROJECT_STATUS_TONE[status];
  return (
    <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone}`}>{PROJECT_STATUS_LABEL[status].toUpperCase()}</span>
  );
}

export function ProgressCell({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return <span className="admin-muted">—</span>;
  const pct = Math.round((completed / total) * 100);
  return (
    <span className="admin-progress-cell">
      <span className="cp-progress"><i style={{ width: `${pct}%` }} /></span>
      <span>{completed}/{total}</span>
    </span>
  );
}

// Coolify projects no console project points at -- work running on our
// infrastructure that the console can't see. Import makes a console project
// for one, already linked, under the client's email.
function UnlinkedCoolifyProjects({ clientEmails, onImported }: { clientEmails: string[]; onImported: () => void }) {
  const coolify = useAsyncResource(() => loadCoolifyProjects(), [], { errorMessage: "Couldn't reach Coolify" });
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const unlinked = (coolify.data ?? []).filter((p) => !p.workspaceId);
  if (coolify.loading || (!coolify.error && unlinked.length === 0)) return null;

  function start(p: CoolifyProject) {
    setOpen(p.uuid);
    setName(p.name);
    setEmail("");
    setActionError(null);
  }

  async function submit(e: React.FormEvent, uuid: string) {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await runInfraAction({ action: "import", coolify_project_uuid: uuid, name: name.trim(), contact_email: email.trim() });
      setOpen(null);
      onImported();
      void coolify.refresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overview-section infra-section">
      <h2 className="overview-section-title">Coolify projects not in the console ({unlinked.length})</h2>
      <p className="cp-empty mb-4">Import one to track it here and give the client access.</p>
      {coolify.error ? (
        <ErrorAlert message={coolify.error} onRetry={coolify.retry} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Coolify project</th>
                <th>Server</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {unlinked.map((p) => (
                <tr key={p.uuid}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.description && <div className="admin-muted">{p.description}</div>}
                  </td>
                  <td>
                    {p.servers.length ? p.servers.map((s) => s.name).join(", ") : <span className="admin-muted">Nothing deployed</span>}
                    {p.servers.some((s) => s.sharedWith.length) && (
                      <div className="admin-warn">Shared with {Array.from(new Set(p.servers.flatMap((s) => s.sharedWith))).join(", ")}</div>
                    )}
                  </td>
                  <td className="num">
                    {open === p.uuid ? (
                      <form className="infra-import-form" onSubmit={(e) => void submit(e, p.uuid)}>
                        <input className="console-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" aria-label="Project name" autoFocus />
                        <input
                          className="console-input"
                          type="email"
                          list="infra-client-emails"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Client email"
                          aria-label="Client email"
                        />
                        <button type="button" className="console-btn-secondary" onClick={() => setOpen(null)} disabled={busy}>Cancel</button>
                        <button type="submit" className="dash-action-btn" disabled={busy || name.trim().length < 2 || !email.trim()}>
                          <span>Import</span>
                        </button>
                        {actionError && <div className="admin-warn infra-import-error">{actionError}</div>}
                      </form>
                    ) : (
                      <button type="button" className="console-btn-secondary" onClick={() => start(p)}>Import</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="infra-client-emails">
            {Array.from(new Set(clientEmails)).map((e) => <option key={e} value={e} />)}
          </datalist>
        </div>
      )}
    </section>
  );
}

export default function AdminProjects() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource(() => loadPortfolio(), [], {
    errorMessage: "Failed to load projects"
  });
  const projects = data?.projects ?? [];
  const clientName = new Map((data?.clients ?? []).flatMap((c) => c.projects.map((p) => [p.id, c.name] as const)));

  const needle = search.trim().toLowerCase();
  const visible = projects
    .filter((p) => filter === "all" || p.status === filter)
    .filter(
      (p) =>
        !needle ||
        [p.name, clientName.get(p.id), p.contact_email, p.currentMilestone].some((v) => v?.toLowerCase().includes(needle))
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const count = (s: ProjectStatus) => projects.filter((p) => p.status === s).length;

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading projects" : error ? `Could not load projects: ${error}` : `${visible.length} projects shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Projects</h1>
          <p>Every engagement, where it stands, and what's next. Open one to manage it.</p>
        </div>
      </div>

      {error && <ErrorAlert message={`Couldn't load projects: ${error}`} onRetry={retry} />}

      {!loading && projects.length > 0 && (
        <div className="cp-stats mb-6">
          <div>
            <small>PROJECTS</small>
            <strong>{projects.length}</strong>
            <em>{data?.clients.length ?? 0} clients · {count("live")} live</em>
          </div>
          <div>
            <small>IN PROGRESS</small>
            <strong>{count("active")}</strong>
            <em>{count("not-started")} not started</em>
          </div>
          <div>
            <small>BLOCKED</small>
            <strong className={count("blocked") ? "warn" : undefined}>{count("blocked")}</strong>
            <em>{count("blocked") ? "need unblocking" : "Nothing blocked"}</em>
          </div>
          <div>
            <small>SCOPING</small>
            <strong>{count("onboarding")}</strong>
            <em>no milestones yet</em>
          </div>
        </div>
      )}

      <div className="admin-toolbar">
        {(["all", "active", "blocked", "not-started", "live", "onboarding", "completed"] as Filter[]).map((f) => (
          <button key={f} className={`dash-tab-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? `All (${projects.length})` : `${PROJECT_STATUS_LABEL[f]} (${count(f)})`}
          </button>
        ))}
        <span className="admin-toolbar-spacer" />
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search projects or clients…" aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading projects…" />
      ) : error ? null : projects.length === 0 ? (
        <EmptyState title="No projects yet" hint="Projects appear when a client finishes onboarding or starts a new project." />
      ) : visible.length === 0 ? (
        <div className="dash-empty-state">No projects match this view.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Engagement</th>
                <th>Milestones</th>
                <th>Current milestone</th>
                <th className="num">Open tasks</th>
                <th>Next due</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setLocation(`/admin/projects/${p.id}`)}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="admin-muted">{clientName.get(p.id) !== p.name ? clientName.get(p.id) : p.contact_email ?? "—"}</div>
                  </td>
                  <td><ProjectStatusPill status={p.status} /></td>
                  <td>{p.engagement_type ? ENGAGEMENT_LABEL[p.engagement_type] ?? p.engagement_type : p.tier_label ?? "—"}</td>
                  <td><ProgressCell completed={p.completed} total={p.milestones} /></td>
                  <td>{p.currentMilestone ?? <span className="admin-muted">—</span>}</td>
                  <td className="num">{p.tasksTotal ? p.tasksOpen : "—"}</td>
                  <td className={p.nextDue && new Date(p.nextDue) < new Date() ? "admin-warn" : undefined}>
                    {p.nextDue ? formatDate(p.nextDue) : "—"}
                  </td>
                  <td>{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <UnlinkedCoolifyProjects
          clientEmails={(data?.clients ?? []).map((c) => c.email).filter((e): e is string => Boolean(e))}
          onImported={() => void refresh()}
        />
      )}
    </ConsoleLayout>
  );
}
