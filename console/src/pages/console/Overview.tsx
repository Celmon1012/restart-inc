import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getResources, statusMeta, deploymentStatusLabel, deploymentTone, formatRelativeTime, RESOURCE_KIND_LABEL } from "@/lib/resources";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { consoleSchema } from "@/lib/supabase";
import { getCurrentDeliverable, type Deliverable } from "@/lib/deliverables";
import type { BarChartColumn } from "@/components/BarChart";
import { CheckCircle2, AlertTriangle, ArrowRight, Clock, Terminal, Rocket, XCircle, Loader2 } from "lucide-react";
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

// Compact stacked bars matching the marketing-site console preview: one bar
// per day, segment colour by deploy outcome, day label on hover.
function DeployBars({ columns }: { columns: BarChartColumn[] }) {
  const totals = columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0));
  const max = Math.max(1, ...totals);
  return (
    <div className="cp-bars" role="img" aria-label={`Deploys per day: ${columns.map((c, i) => `${c.label} ${totals[i]}`).join(", ")}`}>
      {columns.map((col, i) => (
        <i key={col.label} title={`${col.label}: ${totals[i]} deploy${totals[i] === 1 ? "" : "s"}`} style={{ height: `${Math.max((totals[i] / max) * 100, 6)}%` }}>
          {col.segments.filter((s) => s.value > 0).map((s) => (
            <b key={s.tone} className={s.tone} style={{ flexGrow: s.value }} />
          ))}
        </i>
      ))}
    </div>
  );
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
  const deliveryPct = deliverables.length ? Math.round((completedMilestones / deliverables.length) * 100) : 0;

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
          <div className="cp-head">
            <span className="cp-eyebrow">{activeWorkspace.name}</span>
            <h1>Systems Overview</h1>
            <p>{headline} — every system, deploy, and delivery milestone in one place.</p>
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
                <Link href="/support" className="overview-section-link">
                  Ask a question now <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}

          <div className="cp-stats">
            <div>
              <small>SYSTEMS</small>
              <strong>{resources.length}</strong>
              <em>{resources.length === 0 ? "None deployed yet" : attention.length === 0 ? "All healthy" : `${attention.length} need attention`}</em>
            </div>
            <div>
              <small>NEEDS ATTENTION</small>
              <strong className={attention.length ? "warn" : undefined}>{attention.length}</strong>
              <em>{attention.length === 0 ? "Nothing flagged" : `${warningCount} warning · ${downCount} down`}</em>
            </div>
            <div>
              <small>DELIVERY</small>
              <strong>{deliverables.length === 0 ? "—" : <>{completedMilestones}<span>/{deliverables.length}</span></>}</strong>
              <em>{currentMilestone ? currentMilestone.title : "No active milestone"}</em>
            </div>
            <div>
              <small>DEPLOYS</small>
              <strong>{deployments.length}</strong>
              <em>{deployments.length === 0 ? "None yet" : `${deploysLast24h} in last 24h`}</em>
            </div>
          </div>

          <div className="cp-grid">
            <div className="cp-card cp-systems">
              <div className="cp-card-head">
                <span>Systems</span>
                {resources.length > 0 && (
                  <em className={attention.length ? "warn" : undefined}>
                    {attention.length === 0 ? "All healthy" : `${attention.length} need attention`}
                  </em>
                )}
              </div>
              {resources.length === 0 ? (
                <p className="cp-empty">No resources deployed to this workspace's server yet.</p>
              ) : (
                resources.slice(0, 6).map((r) => {
                  const { label, tone } = statusMeta(r.status);
                  return (
                    <Link href="/systems" key={r.uuid} className="cp-row">
                      <i className={`cp-dot ${tone}`} />
                      <span className="cp-name">
                        {r.name}
                        <small>
                          {RESOURCE_KIND_LABEL[r.kind].toLowerCase()}
                          {r.lastOnlineAt ? ` · checked ${formatRelativeTime(r.lastOnlineAt)}` : ""}
                        </small>
                      </span>
                      <span className={`cp-status ${tone}`}>{label}</span>
                    </Link>
                  );
                })
              )}
              {resources.length > 6 && (
                <Link href="/systems" className="cp-more">
                  +{resources.length - 6} more <ArrowRight size={12} />
                </Link>
              )}
            </div>

            <div className="cp-card cp-deploys">
              <div className="cp-card-head">
                <span>Deployment activity</span>
                {deployments.length > 0 && <em>Last {deployments.length} deploys</em>}
              </div>
              {deployments.length === 0 ? (
                <p className="cp-empty">Deployments appear here once they run.</p>
              ) : (
                <DeployBars columns={deploysByDay(deployments)} />
              )}

              <div className="cp-card-head cp-sub">
                <span>Current delivery</span>
                <Link href="/delivery" className="cp-head-link">All milestones <ArrowRight size={11} /></Link>
              </div>
              {deliverablesError ? (
                <div className="cp-empty cp-error">
                  <span>Couldn't read delivery milestones.</span>
                  <button type="button" className="console-retry-btn" onClick={retryDeliverables}>Retry</button>
                </div>
              ) : deliverables.length === 0 ? (
                <p className="cp-empty">No delivery milestones yet.</p>
              ) : (
                <>
                  <div className="cp-progress"><i style={{ width: `${deliveryPct}%` }} /></div>
                  <div className="cp-milestone">
                    <span>{currentMilestone ? currentMilestone.title : "All milestones complete"}</span>
                    <span>{deliveryPct}%</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {attention.length > 0 && (
            <div className="overview-section">
              <h2 className="overview-section-title">Needs attention</h2>
              <div className="overview-attention-list">
                {attention.map((r) => {
                  const { label } = statusMeta(r.status);
                  return (
                    <Link href="/systems" key={r.uuid} className="overview-attention-row">
                      <AlertTriangle size={15} className="text-amber" />
                      <span className="overview-attention-name">{r.name}</span>
                      <span className="overview-attention-status">{label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="overview-section">
            <div className="overview-section-head">
              <h2 className="overview-section-title">Recent activity</h2>
              <Link href="/timeline" className="overview-section-link">
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
