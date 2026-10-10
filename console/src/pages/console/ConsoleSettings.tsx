import { Link } from "wouter";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function ConsoleSettings() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const server = activeWorkspace?.server;

  return (
    <ConsoleLayout>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">SETTINGS</span>
          <h1>Settings</h1>
          <p>Your account and workspace details.</p>
        </div>
      </div>

      <div className="settings-tab-panel">
        <div className="console-card">
          <div className="card-top-header">
            <span className="card-kicker">ACCOUNT</span>
          </div>
          <div className="pod-meta-table">
            <div className="pod-row">
              <span className="pod-k">Signed in as:</span>
              <span className="pod-v text-white">{user?.email ?? "—"}</span>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/profile" className="overview-section-link">
              <span>Profile, password & two-factor</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="console-card mt-6">
          <div className="card-top-header">
            <span className="card-kicker">WORKSPACE</span>
          </div>
          <div className="pod-meta-table">
            <div className="pod-row">
              <span className="pod-k">Workspace:</span>
              <span className="pod-v text-white">{activeWorkspace?.name ?? "—"}</span>
            </div>
            <div className="pod-row">
              <span className="pod-k">Dedicated server:</span>
              <span className="pod-v text-white font-mono">{server ? server.name : "Not assigned"}</span>
            </div>
            {server && (
              <div className="pod-row">
                <span className="pod-k">Capacity:</span>
                <span className="pod-v text-white">
                  {server.cpus ?? "—"} vCPU · {server.memoryGb ?? "—"} GB RAM
                </span>
              </div>
            )}
          </div>
          <div className="mt-4">
            <Link href="/systems?tab=infrastructure" className="overview-section-link">
              <span>Server details</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="console-card mt-6">
          <div className="card-top-header">
            <span className="card-kicker">NOTIFICATIONS</span>
          </div>
          <p className="key-desc">
            Invoice and overdue-payment emails go to the billing contact on your account. To change who receives
            them, or anything else about your plan, get in touch.
          </p>
          <div className="mt-4">
            <a href="mailto:billing@restart.ng" className="overview-section-link">
              <span>Contact billing</span>
              <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </ConsoleLayout>
  );
}
