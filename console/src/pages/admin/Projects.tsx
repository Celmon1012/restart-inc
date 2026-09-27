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
  loadPortfolio,
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
            <em>{data?.clients.length ?? 0} clients</em>
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
        {(["all", "active", "blocked", "not-started", "onboarding", "completed"] as Filter[]).map((f) => (
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
    </ConsoleLayout>
  );
}
