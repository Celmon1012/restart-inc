import { useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ResourceIcon } from "@/components/ResourceIcon";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  getResources,
  getPrimaryApplication,
  statusMeta,
  resourceSubtitle,
  formatRelativeTime,
  RESOURCE_KIND_LABEL
} from "@/lib/resources";
import { Server, Boxes, ArrowUpRight, Info } from "lucide-react";
import { toast } from "sonner";
import { ErrorAlert, StatusRegion } from "@/components/AsyncStates";
import { ServerRequests } from "@/components/ServerRequests";

function initialTab(): "systems" | "infrastructure" {
  try {
    return new URLSearchParams(window.location.search).get("tab") === "infrastructure"
      ? "infrastructure"
      : "systems";
  } catch {
    return "systems";
  }
}

export default function Systems() {
  const { activeWorkspace, loading: workspaceLoading, error: workspaceError, refresh, isAdmin } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"systems" | "infrastructure">(initialTab);
  const resources = activeWorkspace ? getResources(activeWorkspace) : [];
  const primaryApp = activeWorkspace ? getPrimaryApplication(activeWorkspace) : undefined;

  const handleRefresh = () => {
    setIsRefreshing(true);
    refresh();
    toast.info("Refreshed system data");
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <ConsoleLayout onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <StatusRegion
        message={
          workspaceLoading || isRefreshing
            ? "Loading system data"
            : workspaceError
              ? `Could not load system data: ${workspaceError}`
              : activeWorkspace
                ? `${resources.length} systems loaded for ${activeWorkspace.name}`
                : null
        }
      />
      {workspaceLoading && !activeWorkspace ? (
        <div className="dash-empty-state">Loading your workspace…</div>
      ) : workspaceError ? (
        <ErrorAlert
          message={workspaceError}
          onRetry={() => void refresh()}
          retryLabel="Reload systems"
        />
      ) : !activeWorkspace ? (
        <div className="dash-empty-state">
          No workspace has been assigned to your account yet. Contact Restart Inc to get set up.
        </div>
      ) : (
        <>
          <div className="dash-header-row">
            <div>
              <span className="dash-kicker">SYSTEMS</span>
              <h1>Systems</h1>
              <p>What's running for {activeWorkspace.name}, and whether it's healthy.</p>
            </div>
          </div>

          <div className="dash-tabs-bar">
            <button
              className={`dash-tab-btn ${activeTab === "systems" ? "active" : ""}`}
              onClick={() => setActiveTab("systems")}
            >
              <Server size={14} />
              <span>Applications & Services ({resources.length})</span>
            </button>
            <button
              className={`dash-tab-btn ${activeTab === "infrastructure" ? "active" : ""}`}
              onClick={() => setActiveTab("infrastructure")}
            >
              <Boxes size={14} />
              <span>Infrastructure</span>
            </button>
          </div>

          {activeTab === "systems" && (
            <div className="dash-systems-list">
              {resources.length === 0 && (
                <div className="dash-empty-state">No resources deployed to this workspace's server yet.</div>
              )}
              {resources.map((resource) => {
                const { label, tone } = statusMeta(resource.status);
                return (
                  <div className="system-row" key={resource.uuid}>
                    <div className="system-status-indicator">
                      <span className={`status-dot-active ${tone === "healthy" ? "" : tone}`} />
                    </div>
                    <div className="system-info">
                      <div className="system-title-row">
                        <ResourceIcon resource={resource} size={22} className="text-teal" />
                        <h3>{resource.name}</h3>
                        <span className="system-kind-tag">{RESOURCE_KIND_LABEL[resource.kind]}</span>
                        <span className="system-version">{resource.uuid}</span>
                      </div>
                      <div className="system-meta-line">
                        <span>Server: <strong>{activeWorkspace.server?.name ?? "—"}</strong></span>
                        <span className="meta-sep">·</span>
                        <span>{resourceSubtitle(resource)}</span>
                        {resource.lastOnlineAt && (
                          <>
                            <span className="meta-sep">·</span>
                            <span>Checked: <strong>{formatRelativeTime(resource.lastOnlineAt)}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="system-actions">
                      <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone}`}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "infrastructure" && (
            <div className="dash-hosting-view">
              <ServerRequests workspace={activeWorkspace} isAdmin={isAdmin} />

              <div className="hosting-overview-grid">
                <div className="hosting-card">
                  <div className="card-top-header">
                    <span className="card-kicker">DEDICATED SERVER</span>
                    <span className="status-live-pill">
                      <span className={`status-dot-active ${activeWorkspace.server?.isReachable ? "" : "down"}`} />
                      {activeWorkspace.server ? (activeWorkspace.server.isReachable ? "REACHABLE" : "UNREACHABLE") : "NOT ASSIGNED"}
                    </span>
                  </div>
                  <div className="app-meta-list">
                    <div className="app-meta-item">
                      <span className="meta-k">Server Name / IP</span>
                      <span className="meta-v mono">
                        {activeWorkspace.server ? `${activeWorkspace.server.name} · ${activeWorkspace.server.ip}` : "—"}
                      </span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Operating System</span>
                      <span className="meta-v">{activeWorkspace.server?.os ?? "—"}</span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Architecture</span>
                      <span className="meta-v mono">{activeWorkspace.server?.arch ?? "—"}</span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Kernel</span>
                      <span className="meta-v mono">{activeWorkspace.server?.kernel ?? "—"}</span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Capacity</span>
                      <span className="meta-v">
                        {activeWorkspace.server?.cpus ?? "—"} vCPU · {activeWorkspace.server?.memoryGb ?? "—"} GB RAM
                      </span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Docker Engine</span>
                      <span className="meta-v mono">{activeWorkspace.server?.dockerVersion ?? "—"}</span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Compose Version</span>
                      <span className="meta-v mono">{activeWorkspace.server?.composeVersion ?? "N/A"}</span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Up Since</span>
                      <span className="meta-v mono">{activeWorkspace.server?.upSince ?? "—"}</span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Resources Deployed</span>
                      <span className="meta-v">
                        {resources.length} ({resources.filter((r) => r.kind === "application").length} app ·{" "}
                        {resources.filter((r) => r.kind === "database").length} db ·{" "}
                        {resources.filter((r) => r.kind === "service").length} service)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hosting-card">
                  <div className="card-top-header">
                    <span className="card-kicker">APPLICATION SPECIFICATION</span>
                  </div>
                  <div className="app-meta-list">
                    <div className="app-meta-item">
                      <span className="meta-k">FQDN / Public URL</span>
                      <span className="meta-v">
                        {primaryApp?.fqdn ? (
                          <a href={`https://${primaryApp.fqdn}`} target="_blank" rel="noreferrer" className="link-fqdn">
                            https://{primaryApp.fqdn}
                            <ArrowUpRight size={13} />
                          </a>
                        ) : (
                          "not deployed"
                        )}
                      </span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Instance UUID</span>
                      <span className="meta-v mono">{primaryApp?.uuid ?? "—"}</span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Source</span>
                      <span className="meta-v mono">
                        {primaryApp ? `${primaryApp.gitRepository}@${primaryApp.gitBranch} (${primaryApp.gitCommitSha})` : "—"}
                      </span>
                    </div>
                    <div className="app-meta-item">
                      <span className="meta-k">Build Pack</span>
                      <span className="meta-v">{primaryApp?.buildPack ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overview-not-connected">
                <Info size={16} />
                <span>Environment variable management and deployment history aren't connected yet.</span>
              </div>
            </div>
          )}
        </>
      )}
    </ConsoleLayout>
  );
}
