import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { deploymentStatusLabel, formatRelativeTime } from "@/lib/resources";
import { Rocket, CheckCircle2, XCircle, Loader2, Terminal } from "lucide-react";

function statusIcon(status: string) {
  if (status === "finished") return <CheckCircle2 size={16} className="text-teal" />;
  if (status === "failed") return <XCircle size={16} className="text-rose" />;
  if (status === "in_progress" || status === "running" || status === "queued") {
    return <Loader2 size={16} className="text-amber" />;
  }
  return <Rocket size={16} className="text-teal" />;
}

export default function Activity() {
  const { activeWorkspace, loading, error } = useWorkspace();
  const deployments = activeWorkspace?.deployments ?? [];

  return (
    <ConsoleLayout>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">ACTIVITY</span>
          <h1>Activity</h1>
          <p>Deployments to your systems, most recent first.</p>
        </div>
      </div>

      {loading && !activeWorkspace ? (
        <div className="dash-empty-state">Loading your workspace…</div>
      ) : error ? (
        <div className="dash-empty-state">Couldn't load activity: {error}</div>
      ) : deployments.length === 0 ? (
        <div className="overview-not-connected large">
          <Terminal size={20} />
          <div>
            <h3>Nothing deployed yet</h3>
            <p>Once your first deploy runs, it'll show up here.</p>
          </div>
        </div>
      ) : (
        <div className="activity-list">
          {deployments.map((d) => (
            <div className="activity-row" key={d.uuid}>
              <div className="activity-row-icon">{statusIcon(d.status)}</div>
              <div className="activity-row-body">
                <p>
                  <strong>{d.applicationName}</strong> — {deploymentStatusLabel(d.status)}
                  {d.commitSha && <span className="mono activity-commit"> · {d.commitSha}</span>}
                </p>
                <span className="activity-row-meta">
                  {formatRelativeTime(d.createdAt)} · triggered by {d.trigger === "webhook" ? "git push" : d.trigger}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="activity-note">Security events and team changes aren't connected yet — deploys only, for now.</p>
    </ConsoleLayout>
  );
}
