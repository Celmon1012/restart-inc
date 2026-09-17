import { useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getResources, statusMeta, type Resource } from "@/lib/resources";
import { getCurrentMilestone } from "@/lib/delivery";
import { CheckCircle2, AlertTriangle, ArrowRight, Server, Database, Boxes, Clock, Terminal } from "lucide-react";
import { toast } from "sonner";

const KIND_ICON: Record<Resource["kind"], typeof Server> = {
  application: Server,
  database: Database,
  service: Boxes
};

export default function Overview() {
  const { activeWorkspace, loading: workspaceLoading, error: workspaceError, refresh } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const resources = activeWorkspace ? getResources(activeWorkspace) : [];
  const attention = resources.filter((r) => statusMeta(r.status).tone !== "healthy");
  const currentMilestone = getCurrentMilestone();

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
      {workspaceLoading && !activeWorkspace ? (
        <div className="dash-empty-state">Loading your workspace…</div>
      ) : workspaceError ? (
        <div className="dash-empty-state">Couldn't load workspace data: {workspaceError}</div>
      ) : !activeWorkspace ? (
        <div className="dash-empty-state">
          No workspace has been assigned to your account yet. Contact Restart Inc to get set up.
        </div>
      ) : (
        <>
          <div className="dash-header-row">
            <div>
              <span className="dash-kicker">OVERVIEW</span>
              <h1>{headline}</h1>
              <p>Here's the state of {activeWorkspace.name}'s systems and delivery right now.</p>
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
            {currentMilestone ? (
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
                {resources.map((r) => {
                  const { label, tone } = statusMeta(r.status);
                  const Icon = KIND_ICON[r.kind];
                  return (
                    <div className="overview-system-card" key={r.uuid}>
                      <Icon size={15} className="text-teal" />
                      <span className="overview-system-name">{r.name}</span>
                      <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone}`}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="overview-section">
            <div className="overview-section-head">
              <h2 className="overview-section-title">Recent activity</h2>
              <Link href="/console/activity" className="overview-section-link">
                Open activity log <ArrowRight size={12} />
              </Link>
            </div>
            <div className="overview-not-connected">
              <Terminal size={16} />
              <span>Activity history isn't connected yet — deployments and security events will appear here.</span>
            </div>
          </div>
        </>
      )}
    </ConsoleLayout>
  );
}
