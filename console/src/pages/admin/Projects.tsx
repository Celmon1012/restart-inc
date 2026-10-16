// Every project (console workspace) across every client, with delivery state
// at a glance. Clicking a row opens the project's own page (ProjectDetail),
// where milestones, requests, support, and billing are managed.

import { useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/confirmAction";
import { RowMenu } from "@/components/admin/RowMenu";
import { consoleSchema } from "@/lib/supabase";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import {
  ENGAGEMENT_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  loadCoolifyProjects,
  loadPortfolio,
  loadTeamMembers,
  runInfraAction,
  type CoolifyProject,
  type ProjectStatus
} from "@/lib/admin";

type Filter = "all" | ProjectStatus;
// Statuses shown as tiles and as board columns, from first contact to done.
const STRIP: ProjectStatus[] = ["onboarding", "not-started", "active", "live", "blocked", "completed"];

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
                      <div className="admin-muted">Shared with {Array.from(new Set(p.servers.flatMap((s) => s.sharedWith))).join(", ")}</div>
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
  const { isOwner } = useWorkspace();
  const { user } = useAuth();
  const team = useAsyncResource(() => loadTeamMembers(), []);
  const [lead, setLead] = useState("all");
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // List or board; remembered between visits.
  const [view, setViewState] = useState<"list" | "board">(() => {
    try { return localStorage.getItem("restart.projects.view") === "board" ? "board" : "list"; } catch { return "list"; }
  });
  const setView = (v: "list" | "board") => {
    setViewState(v);
    try { localStorage.setItem("restart.projects.view", v); } catch { /* a private window: the choice just is not remembered */ }
  };

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource(() => loadPortfolio({ includeArchived: showArchived }), [showArchived], {
    errorMessage: "Failed to load projects"
  });
  const projects = data?.projects ?? [];
  const clientName = new Map((data?.clients ?? []).flatMap((c) => c.projects.map((p) => [p.id, c.name] as const)));

  const memberName = (id: string | null | undefined) => (id ? (team.data ?? []).find((m) => m.user_id === id)?.email.split("@")[0] ?? "—" : "—");
  const setLeadFor = async (ids: string[], leadId: string | null) => {
    const results = await Promise.all(ids.map((id) => consoleSchema().rpc("admin_set_workspace_lead", { p_workspace_id: id, p_lead_id: leadId })));
    const failed = results.find((r) => r.error);
    if (failed?.error) toast.error(failed.error.message);
    else toast.success(ids.length === 1 ? (leadId ? `Lead set to ${memberName(leadId)}` : "Lead cleared") : `${ids.length} projects assigned to ${memberName(leadId)}`);
    await refresh();
  };
  const unassigned = projects.filter((p) => !p.lead_id && !p.archived_at);
  const leadCount = (id: string) => projects.filter((p) => p.lead_id === id).length;

  const needle = search.trim().toLowerCase();
  const visible = projects
    .filter((p) => filter === "all" || p.status === filter)
    .filter((p) => lead === "all" || (lead === "mine" ? p.lead_id === user?.id : lead === "none" ? !p.lead_id : p.lead_id === lead))
    .filter(
      (p) =>
        !needle ||
        [p.name, clientName.get(p.id), p.contact_email, p.currentMilestone].some((v) => v?.toLowerCase().includes(needle))
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const count = (s: ProjectStatus) => projects.filter((p) => p.status === s).length;
  const myCount = (s: ProjectStatus) => projects.filter((p) => p.status === s && p.lead_id === user?.id).length;
  const overdue = (p: { nextDue: string | null; status: ProjectStatus }) => Boolean(p.nextDue) && new Date(p.nextDue as string) < new Date() && p.status !== "completed";

  const visibleIds = visible.map((p) => p.id);
  const picked = visibleIds.filter((id) => selected.has(id));
  const allPicked = visibleIds.length > 0 && picked.length === visibleIds.length;
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () =>
    downloadCsv(
      `restart-projects-${new Date().toISOString().slice(0, 10)}.csv`,
      ["project", "client", "contact_email", "status", "engagement", "lead", "milestones_done", "milestones_total", "open_tasks", "next_due", "started"],
      visible.map((p) => [
        p.name,
        clientName.get(p.id) ?? "",
        p.contact_email ?? "",
        PROJECT_STATUS_LABEL[p.status],
        p.engagement_type ? ENGAGEMENT_LABEL[p.engagement_type] ?? p.engagement_type : p.tier_label ?? "",
        p.lead_id ? memberName(p.lead_id) : "",
        p.completed,
        p.milestones,
        p.tasksTotal ? p.tasksOpen : 0,
        p.nextDue ?? "",
        p.created_at.slice(0, 10)
      ])
    );

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

      {!loading && projects.length > 0 && view === "list" && (
        <div className="task-strip six">
          {STRIP.map((st) => (
            <button
              key={st}
              type="button"
              className={`task-strip-tile ps-${st} ${filter === st ? "active" : ""}`}
              onClick={() => setFilter(filter === st ? "all" : st)}
              aria-pressed={filter === st}
            >
              <span><strong>{count(st)}</strong> {PROJECT_STATUS_LABEL[st]}</span>
              <em>{myCount(st)} mine</em>
            </button>
          ))}
        </div>
      )}

      <div className="admin-toolbar">
        <div role="group" aria-label="View" style={{ display: "inline-flex", gap: 4 }}>
          <button className={`dash-tab-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")} aria-pressed={view === "list"}>List</button>
          <button className={`dash-tab-btn ${view === "board" ? "active" : ""}`} onClick={() => setView("board")} aria-pressed={view === "board"}>Board</button>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Status">
          {(["all", "active", "blocked", "not-started", "live", "onboarding", "completed"] as Filter[]).map((f) => (
            <option key={f} value={f}>{f === "all" ? `All statuses (${projects.length})` : `${PROJECT_STATUS_LABEL[f]} (${count(f)})`}</option>
          ))}
        </select>
        <select value={lead} onChange={(e) => setLead(e.target.value)} aria-label="Lead">
          <option value="all">Any lead</option>
          <option value="mine">Mine ({user ? leadCount(user.id) : 0})</option>
          <option value="none">No lead ({projects.filter((p) => !p.lead_id).length})</option>
          {(team.data ?? []).filter((m) => m.user_id !== user?.id).map((m) => <option key={m.user_id} value={m.user_id}>{m.email.split("@")[0]} ({leadCount(m.user_id)})</option>)}
        </select>
        {unassigned.length > 0 && user && (
          <button
            className="dash-tab-btn"
            onClick={async () => {
              if (await confirmAction({
                title: "Take lead of unassigned projects?",
                description: `Make yourself the lead of the ${unassigned.length} project${unassigned.length === 1 ? "" : "s"} that have no lead?`,
                confirmLabel: "Make me lead",
                tone: "default"
              })) void setLeadFor(unassigned.map((p) => p.id), user.id);
            }}
          >
            Assign {unassigned.length} unassigned to me
          </button>
        )}
        <label className="admin-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        <span className="admin-toolbar-spacer" />
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search projects or clients…" aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="dash-tab-btn" onClick={exportCsv} disabled={visible.length === 0}>Export CSV</button>
      </div>

      {view === "list" && picked.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <strong>{picked.length} selected</strong>
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) void setLeadFor(picked, v === "none" ? null : v).then(() => setSelected(new Set()));
            }}
            aria-label="Set lead"
          >
            <option value="">Set lead…</option>
            {(team.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.email.split("@")[0]}</option>)}
            <option value="none">No lead</option>
          </select>
          <span className="admin-toolbar-spacer" />
          <button className="dash-tab-btn" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading projects…" />
      ) : error ? null : projects.length === 0 ? (
        <EmptyState title="No projects yet" hint="Projects appear when a client finishes onboarding or starts a new project." />
      ) : visible.length === 0 ? (
        <div className="dash-empty-state">
          {lead !== "all" && lead !== "none" && projects.every((p) => !p.lead_id)
            ? "No project has a lead yet. Use “Assign unassigned to me” above, or set a lead from a row's menu."
            : "No projects match this view."}
        </div>
      ) : view === "board" ? (
        <div className="task-board six">
          {STRIP.map((st) => {
            const cards = visible.filter((p) => p.status === st);
            return (
              <section key={st} className={`task-col ps-${st}`} aria-label={`${PROJECT_STATUS_LABEL[st]}, ${cards.length} projects`}>
                <header><span>{PROJECT_STATUS_LABEL[st]}</span><em>{cards.length}</em></header>
                <div className="task-col-body">
                  {cards.map((p) => (
                    <article key={p.id} className={`task-card project-card ${overdue(p) ? "overdue" : ""}`} onClick={() => setLocation(`/admin/projects/${p.id}`)}>
                      <div className="task-card-top"><strong>{p.name}</strong></div>
                      <div className="admin-muted task-card-sub">{clientName.get(p.id) !== p.name ? clientName.get(p.id) : p.contact_email ?? "—"}</div>
                      {p.milestones > 0 && <ProgressCell completed={p.completed} total={p.milestones} />}
                      <div className="task-card-foot">
                        <span className={overdue(p) ? "admin-danger" : "admin-muted"}>{p.nextDue ? formatDate(p.nextDue) : "No date"}</span>
                        <span className="admin-muted">{memberName(p.lead_id)}</span>
                        {p.tasksTotal > 0 && <span className="admin-muted">{p.tasksOpen} open</span>}
                      </div>
                    </article>
                  ))}
                  {cards.length === 0 && <p className="task-col-empty admin-muted">Nothing here</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table tasks-compact">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={allPicked} onChange={() => setSelected(allPicked ? new Set() : new Set(visibleIds))} aria-label="Select all shown projects" />
                </th>
                <th>Project</th>
                <th>Status</th>
                <th>Engagement</th>
                <th>Lead</th>
                <th>Milestones</th>
                <th className="num">Open tasks</th>
                <th>Next due</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className={`clickable ${overdue(p) ? "row-overdue" : ""}`} onClick={() => setLocation(`/admin/projects/${p.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleRow(p.id)} aria-label={`Select ${p.name}`} />
                  </td>
                  <td className="task-name" title={p.name}>
                    <strong>{p.name}</strong>
                    {p.archived_at && <span className="admin-muted"> · archived</span>}
                    <span className="admin-muted"> · {clientName.get(p.id) !== p.name ? clientName.get(p.id) : p.contact_email ?? "—"}</span>
                  </td>
                  <td><ProjectStatusPill status={p.status} /></td>
                  <td className="admin-muted">{p.engagement_type ? ENGAGEMENT_LABEL[p.engagement_type] ?? p.engagement_type : p.tier_label ?? "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className="priority-select pr-low"
                      value={p.lead_id ?? ""}
                      onChange={(e) => void setLeadFor([p.id], e.target.value || null)}
                      aria-label={`Lead of ${p.name}`}
                    >
                      <option value="">No lead</option>
                      {(team.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.email.split("@")[0]}</option>)}
                    </select>
                  </td>
                  <td><ProgressCell completed={p.completed} total={p.milestones} /></td>
                  <td className="num">{p.tasksTotal ? p.tasksOpen : "—"}</td>
                  <td className={overdue(p) ? "admin-danger" : "admin-muted"}>{p.nextDue ? formatDate(p.nextDue) : "—"}</td>
                  <td className="admin-muted">{formatDate(p.created_at)}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      label={`Actions for ${p.name}`}
                      items={[
                        { label: "Open project", onClick: () => setLocation(`/admin/projects/${p.id}`) },
                        ...(user && p.lead_id !== user.id ? [{ label: "Make me the lead", onClick: () => void setLeadFor([p.id], user.id) }] : []),
                        ...(p.lead_id ? [{ label: "Clear lead", onClick: () => void setLeadFor([p.id], null) }] : [])
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={10} className="admin-muted">
                  {visible.length} of {projects.length} projects · {visible.filter(overdue).length} overdue · {data?.clients.length ?? 0} clients
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {isOwner && !loading && !error && (
        <UnlinkedCoolifyProjects
          clientEmails={(data?.clients ?? []).map((c) => c.email).filter((e): e is string => Boolean(e))}
          onImported={() => void refresh()}
        />
      )}
    </ConsoleLayout>
  );
}
