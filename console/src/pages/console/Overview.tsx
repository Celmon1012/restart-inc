import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ResourceIcon } from "@/components/ResourceIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getResources, statusMeta, deploymentStatusLabel, deploymentTone, formatRelativeTime } from "@/lib/resources";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { consoleSchema } from "@/lib/supabase";
import { getCurrentDeliverable, type Deliverable } from "@/lib/deliverables";
import { getDisplayName } from "@/lib/utils";
import { BarChart, type BarChartColumn } from "@/components/BarChart";
import { CheckCircle2, AlertTriangle, ArrowRight, Clock, Terminal, Rocket, Server, XCircle, Loader2 } from "lucide-react";
import type { Deployment } from "@/lib/resources";
import { toast } from "sonner";

// Grouped oldest-to-newest so the chart reads left to right; capped at
// whatever the backend hands back (last 10 deploys), not a calendar window
// -- there's no history beyond that to back a fixed "last 14 days" claim.
function deploysByDay(deployments: Deployment[]): BarChartColumn[] {
  const byDay = new Map<string, Record<"healthy" | "warning" | "down", number>>();
  for (const d of [...deployments].reverse()) {
    const day = new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const entry = byDay.get(day) ?? { healthy: 0, warning: 0, down: 0 };
    entry[deploymentTone(d.status)]++;
    byDay.set(day, entry);
  }
  return Array.from(byDay.entries()).map(([label, counts]) => ({
    label,
    segments: [
      { tone: "healthy" as const, value: counts.healthy },
      { tone: "warning" as const, value: counts.warning },
      { tone: "down" as const, value: counts.down }
    ]
  }));
}

function activityStatusIcon(status: string) {
  if (status === "finished") return <CheckCircle2 size={15} className="text-teal" />;
  if (status === "failed") return <XCircle size={15} className="text-rose" />;
  if (status === "in_progress" || status === "running" || status === "queued") {
    return <Loader2 size={15} className="text-amber" />;
  }
  return <Rocket size={15} className="text-teal" />;
}

export default function Overview() {
  const { user } = useAuth();
  const { activeWorkspace, loading: workspaceLoading, error: workspaceError, refresh } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const resources = activeWorkspace ? getResources(activeWorkspace) : [];
  const attention = resources.filter((r) => statusMeta(r.status).tone !== "healthy");
  const downCount = attention.filter((r) => statusMeta(r.status).tone === "down").length;
  const warningCount = attention.length - downCount;
  const deployments = activeWorkspace?.deployments ?? [];
  const deploysLast24h = deployments.filter(
    (d) => Date.now() - new Date(d.createdAt).getTime() < 24 * 60 * 60 * 1000
  ).length;

  // Deliverables load through the shared hook so a failed read is reported and
  // retryable. This previously swallowed every error into an empty array, which
  // rendered exactly like "no milestones" -- the dashboard told an operator they
  // had no delivery milestones when the truth was that we could not read them.
  const {
    data: deliverableData,
    error: deliverablesError,
    retry: retryDeliverables,
  } = useAsyncResource<Deliverable[]>(
    async (signal) => {
      if (!activeWorkspace) return [];
      const { data, error: dbError } = await consoleSchema()
        .from("deliverables")
        .select("*")
        .eq("workspace_id", activeWorkspace.id);
      if (signal.aborted) return [];
      if (dbError) throw dbError;
      return data ?? [];
    },
    [activeWorkspace?.id],
    { enabled: Boolean(activeWorkspace), errorMessage: "Failed to load delivery milestones" }
  );
  const deliverables = deliverableData ?? [];

  // Derived from the loaded milestones, so they must sit after the hook rather
  // than above it.
  const currentMilestone = getCurrentDeliverable(deliverables);
  const completedMilestones = deliverables.filter((d) => d.status === "completed").length;

  const handleRefresh = () => {
    setIsRefreshing(true);
    refresh();
    toast.info("Refreshed workspace data");
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const headline =
    resources.length === 0
      ? "Getting your workspace set up"
      : attention.length === 0
        ? "Your systems are healthy"
        : attention.length === 1
          ? "One system needs your attention"
          : `${attention.length} systems need your attention`;

  return (
    <ConsoleLayout onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <StatusRegion
        message={
          workspaceLoading
            ? "Loading your workspace"
            : workspaceError
              ? `Could not load workspace data: ${workspaceError}`
              : deliverablesError
                ? `${resources.length} systems loaded; delivery milestones could not be read`
                : `${resources.length} systems and ${deliverables.length} delivery milestones loaded`
        }
      />
      {workspaceLoading && !activeWorkspace ? (
        <LoadingState label="Loading your workspace…" />
      ) : workspaceError ? (
        <ErrorAlert
          message={workspaceError}
          onRetry={() => void refresh()}
          retryLabel="Reload dashboard"
        />
      ) : !activeWorkspace ? (
        <EmptyState
          title="No workspace assigned yet"
          hint="No workspace has been assigned to your account. Contact Restart Inc to get set up, or start a project from the marketing site."
        />
      ) : (
        <>
          <div className="dash-header-row">
            <div>
              <span className="overview-greeting">
                {activeWorkspace.provisioning ? "Welcome" : "Welcome back"}, {getDisplayName(user)}
              </span>
              <span className="dash-kicker">OVERVIEW</span>
              <h1>Systems Overview</h1>
              <p>{headline} — here's the state of {activeWorkspace.name}'s systems and delivery right now.</p>
            </div>
          </div>

          {activeWorkspace.provisioning && (
            <div className="overview-provisioning-card">
              <div className="overview-card-icon">
                <Clock size={16} className="text-amber" />
              </div>
              <div>
                <h3>Your workspace is set up. Infrastructure comes next.</h3>
                <p>
                  A Restart engineer reviews your answers and replies to {user?.email} with a fit assessment and
                  proposed scope. Your dedicated server, systems, and delivery milestones appear here once the
                  engagement starts.
                </p>
                <Link href="/console/support" className="overview-section-link">
                  Ask a question now <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}

          <div className="overview-stats-row">
            <div className="overview-stat-tile">
              <div className="overview-stat-top">
                <span className="overview-stat-label">Systems</span>
                <Server size={14} className="text-teal" />
              </div>
              <span className="overview-stat-value">{resources.length}</span>
              <span className="overview-stat-meta">
                {resources.length === 0 ? "None deployed yet" : attention.length === 0 ? "All healthy" : `${attention.length} need attention`}
              </span>
            </div>
            <div className="overview-stat-tile">
              <div className="overview-stat-top">
                <span className="overview-stat-label">Needs attention</span>
                <AlertTriangle size={14} className={attention.length === 0 ? "text-teal" : "text-amber"} />
              </div>
              <span className="overview-stat-value">{attention.length}</span>
              <span className="overview-stat-meta">
                {attention.length === 0 ? "Nothing flagged" : `${warningCount} warning · ${downCount} down`}
              </span>
            </div>
            <div className="overview-stat-tile">
              <div className="overview-stat-top">
                <span className="overview-stat-label">Delivery</span>
                <Clock size={14} className="text-amber" />
              </div>
              <span className="overview-stat-value">
                {deliverables.length === 0 ? "—" : `${completedMilestones}/${deliverables.length}`}
              </span>
              <span className="overview-stat-meta">
                {currentMilestone ? currentMilestone.title : "No active milestone"}
              </span>
            </div>
            <div className="overview-stat-tile">
              <div className="overview-stat-top">
                <span className="overview-stat-label">Deployments</span>
                <Rocket size={14} className="text-teal" />
              </div>
              <span className="overview-stat-value">{deployments.length}</span>
              <span className="overview-stat-meta">
                {deployments.length === 0
                  ? "None yet"
                  : `${deploysLast24h} in last 24h · latest ${formatRelativeTime(deployments[0].createdAt)}`}
              </span>
            </div>
          </div>

          {/* Needs attention */}
          <div className="overview-section">
            <h2 className="overview-section-title">Needs attention</h2>
            {attention.length === 0 ? (
              <div className="overview-empty-ok">
                <CheckCircle2 size={16} className="text-teal" />
                <span>Nothing needs your attention right now.</span>
              </div>
            ) : (
              <div className="overview-attention-list">
                {attention.map((r) => {
                  const { label } = statusMeta(r.status);
                  return (
                    <Link href="/console/systems" key={r.uuid} className="overview-attention-row">
                      <AlertTriangle size={15} className="text-amber" />
                      <span className="overview-attention-name">{r.name}</span>
                      <span className="overview-attention-status">{label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current delivery */}
          <div className="overview-section">
            <div className="overview-section-head">
              <h2 className="overview-section-title">Current delivery</h2>
              <Link href="/console/delivery" className="overview-section-link">
                View all milestones <ArrowRight size={12} />
              </Link>
            </div>
            {deliverablesError ? (
              <div className="overview-not-connected">
                <AlertTriangle size={16} />
                <span>Couldn't read delivery milestones: {deliverablesError}</span>
                <button type="button" className="console-retry-btn" onClick={retryDeliverables}>
                  Retry
                </button>
              </div>
            ) : currentMilestone ? (
              <div className="overview-card">
                <div className="overview-card-icon">
                  <Clock size={16} className="text-amber" />
                </div>
                <div>
                  <h3>{currentMilestone.title}</h3>
                  <p>{currentMilestone.description}</p>
                  <span className="overview-card-meta">{currentMilestone.meta}</span>
                </div>
              </div>
            ) : (
              <div className="overview-empty-ok">
                <CheckCircle2 size={16} className="text-teal" />
                <span>No active delivery milestone right now.</span>
              </div>
            )}
          </div>

          {/* Systems summary */}
          <div className="overview-section">
            <div className="overview-section-head">
              <h2 className="overview-section-title">Systems</h2>
              <Link href="/console/systems" className="overview-section-link">
                View all systems <ArrowRight size={12} />
              </Link>
            </div>
            {resources.length === 0 ? (
              <div className="dash-empty-state">No resources deployed to this workspace's server yet.</div>
            ) : (
              <div className="overview-systems-grid">
                {resources.slice(0, 10).map((r) => {
                  const { label, tone } = statusMeta(r.status);
                  return (
                    <div className="overview-system-card" key={r.uuid}>
                      <div className="overview-system-card-top">
                        <ResourceIcon resource={r} size={20} className="text-teal" />
                        <span className="overview-system-name">{r.name}</span>
                      </div>
                      <div className="overview-system-card-bottom">
                        <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone}`}>{label}</span>
                        {r.lastOnlineAt && (
                          <span className="overview-system-meta">checked {formatRelativeTime(r.lastOnlineAt)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {resources.length > 10 && (
              <Link href="/console/systems" className="overview-systems-more">
                +{resources.length - 10} more <ArrowRight size={12} />
              </Link>
            )}
          </div>

          {/* Deployment activity */}
          {deployments.length > 1 && (
            <div className="overview-section">
              <div className="overview-section-head">
                <h2 className="overview-section-title">Deployment activity</h2>
                <span className="overview-section-note">Last {deployments.length} deploys</span>
              </div>
              <div className="console-card">
                <BarChart columns={deploysByDay(deployments)} />
                <div className="bar-chart-legend">
                  <span><i className="bar-chart-dot healthy" /> Succeeded</span>
                  <span><i className="bar-chart-dot warning" /> In progress</span>
                  <span><i className="bar-chart-dot down" /> Failed</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="overview-section">
            <div className="overview-section-head">
              <h2 className="overview-section-title">Recent activity</h2>
              <Link href="/console/timeline" className="overview-section-link">
                Open full timeline <ArrowRight size={12} />
              </Link>
            </div>
            {(activeWorkspace.deployments ?? []).length === 0 ? (
              <div className="overview-not-connected">
                <Terminal size={16} />
                <span>Nothing deployed yet — deployments will appear here once they run.</span>
              </div>
            ) : (
              <div className="activity-list">
                {activeWorkspace.deployments.slice(0, 5).map((d) => (
                  <div className="activity-row" key={d.uuid}>
                    <div className="activity-row-icon">{activityStatusIcon(d.status)}</div>
                    <div className="activity-row-body">
                      <p>
                        <strong>{d.applicationName}</strong> — {deploymentStatusLabel(d.status)}
                      </p>
                      <span className="activity-row-meta">{formatRelativeTime(d.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </ConsoleLayout>
  );
}
