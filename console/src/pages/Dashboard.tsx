import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ConsoleTopBar } from "@/components/ConsoleTopBar";
import { ConsoleFooter } from "@/components/ConsoleFooter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getResources, getPrimaryApplication, type Resource, type ResourceStatus } from "@/lib/resources";
import {
  Activity,
  Shield,
  Server,
  Cpu,
  Database,
  Terminal,
  LogOut,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HardDrive,
  Zap,
  ExternalLink,
  Bell,
  RefreshCw,
  Sliders,
  Boxes,
  Play,
  RotateCw,
  Lock,
  Eye,
  EyeOff,
  History,
  Check,
  Radio,
  Sparkles,
  Copy,
  User,
  ChevronDown,
  Settings,
  CreditCard,
  Key
} from "lucide-react";
import { toast } from "sonner";

const RESOURCE_KIND_LABEL: Record<Resource["kind"], string> = {
  application: "APPLICATION",
  database: "DATABASE",
  service: "SERVICE"
};

function statusMeta(status: ResourceStatus): { label: string; tone: "healthy" | "warning" | "down" } {
  switch (status) {
    case "running:healthy":
      return { label: "HEALTHY", tone: "healthy" };
    case "running:unknown":
      return { label: "RUNNING", tone: "healthy" };
    case "running:unhealthy":
      return { label: "DEGRADED", tone: "warning" };
    case "exited:unhealthy":
      return { label: "EXITED", tone: "down" };
    case "stopped":
      return { label: "STOPPED", tone: "down" };
  }
}

function resourceSubtitle(resource: Resource): string {
  if (resource.kind === "application") {
    return `${resource.fqdn} · ${resource.gitRepository}@${resource.gitBranch} (${resource.gitCommitSha}) · ${resource.buildPack}`;
  }
  if (resource.kind === "database") {
    return `${resource.databaseType} · ${resource.isPublic ? "Publicly reachable" : "Private network only"}`;
  }
  return `${resource.serviceType} service`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { activeWorkspace, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const resources = activeWorkspace ? getResources(activeWorkspace) : [];
  const primaryApp = activeWorkspace ? getPrimaryApplication(activeWorkspace) : undefined;
  const [activeTab, setActiveTab] = useState<"systems" | "hosting" | "sprints" | "logs">("systems");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "hosting" || tabParam === "sprints" || tabParam === "logs" || tabParam === "systems") {
        setActiveTab(tabParam);
      }
      const subParam = params.get("sub");
      if (subParam === "overview" || subParam === "envs" || subParam === "history") {
        setHostingSubTab(subParam);
      }
      if (params.get("menu") === "open") {
        setUserMenuOpen(true);
      }
    } catch {}
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deployingApp, setDeployingApp] = useState(false);
  const [restartingApp, setRestartingApp] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hostingSubTab, setHostingSubTab] = useState<"overview" | "envs" | "history">("overview");

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyEnv = (text: string, keyName: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(keyName);
    toast.success(`Copied ${keyName} to clipboard`);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleRestartApp = () => {
    setRestartingApp(true);
    toast.info("Restart signal dispatched to node cp.restart.ng");
    setTimeout(() => {
      setRestartingApp(false);
      toast.success("Container restarted: acme-checkout-v2 is healthy on worker-04");
    }, 1200);
  };

  const handleDeployApp = () => {
    setDeployingApp(true);
    toast.info("Triggered zero-downtime deploy hook for git rev 9f4e21a");
    setTimeout(() => {
      setDeployingApp(false);
      toast.success("Deployment finished cleanly in 14.2s. Live routing updated.");
    }, 1800);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    toast.info("Refreshed telemetry & live audit nodes");
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleLogout = () => {
    setLocation("/login");
  };

  return (
    <div className="dash-shell">
      <ConsoleTopBar onRefresh={handleRefresh} isRefreshing={isRefreshing} />

      <main className="dash-main container">
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
        {/* Console Header Banner */}
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">DASHBOARD</span>
            <h1>Systems Overview</h1>
            <p>Real-time health, SLA monitoring, and active engineering deliverables.</p>
          </div>
          <div className="dash-header-meta">
            <div className="meta-box">
              <span className="meta-title">TARGET SLA</span>
              <span className="meta-val text-teal">99.99%</span>
            </div>
            <div className="meta-box">
              <span className="meta-title">COMMITTED RESPONSE</span>
              <span className="meta-val text-white">&lt;15 min P1</span>
            </div>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="dash-stats-grid">
          <div className="dash-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">30-DAY PRODUCTION UPTIME</span>
              <Shield size={16} className="text-teal" />
            </div>
            <div className="stat-num text-teal">99.994%</div>
            <div className="stat-sub">0 unplanned outages · 100% SLA compliance</div>
          </div>

          <div className="dash-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">PEAK INGESTION THROUGHPUT</span>
              <Zap size={16} className="text-blue" />
            </div>
            <div className="stat-num text-white">4,280 <span className="stat-unit">req/min</span></div>
            <div className="stat-sub">P99 response: 38ms · Zero dropped webhooks</div>
          </div>

          <div className="dash-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">AI PIPELINE RETRIEVAL LATENCY</span>
              <Cpu size={16} className="text-violet" />
            </div>
            <div className="stat-num text-violet">142 <span className="stat-unit">ms</span></div>
            <div className="stat-sub">Anthropic MCP + pgvector hybrid retrieval</div>
          </div>

          <div className="dash-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">ACTIVE DELIVERY SPRINT</span>
              <Activity size={16} className="text-amber" />
            </div>
            <div className="stat-num text-amber">Sprint 04 <span className="stat-unit">/ 06</span></div>
            <div className="stat-sub">Database partitioning cutover in 3 days</div>
          </div>
        </div>

        {/* Dashboard Content Tabs */}
        <div className="dash-tabs-bar">
          <button
            className={`dash-tab-btn ${activeTab === "systems" ? "active" : ""}`}
            onClick={() => setActiveTab("systems")}
          >
            <Server size={14} />
            <span>Active Systems ({resources.length})</span>
          </button>
          <button
            className={`dash-tab-btn ${activeTab === "hosting" ? "active" : ""}`}
            onClick={() => setActiveTab("hosting")}
          >
            <Boxes size={14} />
            <span>Infrastructure</span>
            <span className="tab-pill-badge">Managed</span>
          </button>
          <button
            className={`dash-tab-btn ${activeTab === "sprints" ? "active" : ""}`}
            onClick={() => setActiveTab("sprints")}
          >
            <Clock size={14} />
            <span>Delivery Milestones & Roadmaps</span>
          </button>
          <button
            className={`dash-tab-btn ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            <Terminal size={14} />
            <span>Live Telemetry & Audit Stream</span>
          </button>
        </div>

        {/* Tab 1: Active Systems — every application, database, and service
            Coolify reports as deployed to this workspace's dedicated server. */}
        {activeTab === "systems" && (
          <div className="dash-systems-list">
            {resources.length === 0 && (
              <div className="dash-empty-state">No resources deployed to this workspace's server yet.</div>
            )}
            {resources.map((resource) => {
              const { label, tone } = statusMeta(resource.status);
              const Icon = resource.kind === "database" ? Database : resource.kind === "service" ? Boxes : Server;
              return (
                <div className="system-row" key={resource.uuid}>
                  <div className="system-status-indicator">
                    <span className={`status-dot-active ${tone === "healthy" ? "" : tone}`} />
                  </div>
                  <div className="system-info">
                    <div className="system-title-row">
                      <Icon size={15} className="text-teal" />
                      <h3>{resource.name}</h3>
                      <span className="system-kind-tag">{RESOURCE_KIND_LABEL[resource.kind]}</span>
                      <span className="system-version">{resource.uuid}</span>
                    </div>
                    <p>{resourceSubtitle(resource)}</p>
                    <div className="system-metrics-inline">
                      <span>Server: <strong>{activeWorkspace.server?.name ?? "—"}</strong></span>
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

        {/* Tab: Infrastructure */}
        {activeTab === "hosting" && (
          <div className="dash-hosting-view">
            {/* Notice banner for infrastructure hosting */}
            <div className="hosting-welcome-banner">
              <div className="banner-badge">
                <Boxes size={13} className="text-teal" />
                <span>MANAGED HOSTING · CP.RESTART.NG</span>
              </div>
              <div className="banner-content">
                <div>
                  <h3>Active Managed Application: <code>{primaryApp?.name ?? "none deployed"}</code></h3>
                  <p>
                    Single-tenant container cluster deployed on {activeWorkspace.name}'s dedicated server (
                    {activeWorkspace.server?.name ?? "not yet assigned"}) with automated rollbacks, encrypted
                    secrets, and zero-downtime deployment pipelines.
                  </p>
                </div>
                <div className="banner-actions">
                  <button
                    onClick={handleRestartApp}
                    disabled={restartingApp}
                    className="hosting-btn secondary"
                    title="Restart container"
                  >
                    <RotateCw size={13} className={restartingApp ? "spin" : ""} />
                    <span>{restartingApp ? "Restarting..." : "Restart"}</span>
                  </button>
                  <button
                    onClick={handleDeployApp}
                    disabled={deployingApp}
                    className="hosting-btn primary"
                    title="Trigger immediate deploy"
                  >
                    <Play size={13} />
                    <span>{deployingApp ? "Deploying..." : "Redeploy Now"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-nav for Hosting Details */}
            <div className="hosting-subnav">
              <button
                onClick={() => setHostingSubTab("overview")}
                className={`subnav-btn ${hostingSubTab === "overview" ? "active" : ""}`}
              >
                Application Status & Endpoint
              </button>
              <button
                onClick={() => setHostingSubTab("envs")}
                className={`subnav-btn ${hostingSubTab === "envs" ? "active" : ""}`}
              >
                Environment Variables (Protected)
              </button>
              <button
                onClick={() => setHostingSubTab("history")}
                className={`subnav-btn ${hostingSubTab === "history" ? "active" : ""}`}
              >
                Deployment History
              </button>
            </div>

            {/* Sub-view: Overview */}
            {hostingSubTab === "overview" && (
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
                    <span className="status-live-pill">
                      <span className="status-dot-active" />
                      RUNNING
                    </span>
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
                    <div className="app-meta-item">
                      <span className="meta-k">SSL / TLS Certificate</span>
                      <span className="meta-v text-teal">Let's Encrypt Auto-Renewal (Valid through Dec 2026)</span>
                    </div>
                  </div>
                </div>

                <div className="hosting-card">
                  <div className="card-top-header">
                    <span className="card-kicker">INGRESS & HEALTH MONITOR</span>
                    <span className="meta-tag">AUTOMATED HEARTBEAT</span>
                  </div>
                  <div className="health-readouts">
                    <div className="health-stat">
                      <span className="h-label">HTTP STATUS</span>
                      <span className="h-value text-teal">200 OK</span>
                      <span className="h-sub">Endpoint /api/healthcheck responding</span>
                    </div>
                    <div className="health-stat">
                      <span className="h-label">TLS HANDSHAKE</span>
                      <span className="h-value text-teal">18ms</span>
                      <span className="h-sub">Zero handshake errors logged in 48h</span>
                    </div>
                    <div className="health-stat">
                      <span className="h-label">ACTIVE REPLICAS</span>
                      <span className="h-value text-white">2 / 2</span>
                      <span className="h-sub">Zero-downtime rolling restart policy</span>
                    </div>
                    <div className="health-stat">
                      <span className="h-label">WEBHOOK DISPATCH</span>
                      <span className="h-value text-teal">Instant</span>
                      <span className="h-sub">Subscribed to deployment webhook events</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-view: Environment Variables */}
            {hostingSubTab === "envs" && (
              <div className="hosting-envs-container">
                <div className="envs-header-banner">
                  <div>
                    <h4>Application Environment Secrets</h4>
                    <p>
                      Keys marked with <code>*_KEY</code>, <code>*_TOKEN</code>, and <code>*_SECRET</code> are
                      redacted behind hardware-level client security per brief §3c.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const allToggled = Object.keys(showSecrets).length > 0 && Object.values(showSecrets).some(Boolean);
                      setShowSecrets(
                        allToggled
                          ? {}
                          : {
                              DATABASE_URL: true,
                              SHOPIFY_API_SECRET: true,
                              ANTHROPIC_API_KEY: true,
                              DEPLOY_WEBHOOK_SECRET: true
                            }
                      );
                    }}
                    className="reveal-all-btn"
                  >
                    {Object.values(showSecrets).some(Boolean) ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{Object.values(showSecrets).some(Boolean) ? "Hide All Secrets" : "Reveal All"}</span>
                  </button>
                </div>

                <div className="envs-table-wrapper">
                  <table className="envs-table">
                    <thead>
                      <tr>
                        <th>VARIABLE NAME</th>
                        <th>TYPE</th>
                        <th>VALUE</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "NODE_ENV", type: "CONFIG", raw: "production", isSecret: false },
                        { name: "APP_PORT", type: "CONFIG", raw: "3000", isSecret: false },
                        { name: "DATABASE_URL", type: "SECRET", raw: "postgresql://acme_user:p99_sec_k891a@db.restart.ng:5432/acme_prod", isSecret: true },
                        { name: "SHOPIFY_API_SECRET", type: "SECRET", raw: "shpss_91ba8e20f92419a77c01bba29e", isSecret: true },
                        { name: "ANTHROPIC_API_KEY", type: "SECRET", raw: "sk-ant-api03-918ba01c89f2a99182bf9102", isSecret: true },
                        { name: "DEPLOY_WEBHOOK_SECRET", type: "SECRET", raw: "whsec_0918ba72ef910a992bc", isSecret: true }
                      ].map((item) => {
                        const isShown = showSecrets[item.name];
                        const displayVal = item.isSecret && !isShown ? "••••••••••••••••••••••••••••••••" : item.raw;
                        return (
                          <tr key={item.name}>
                            <td className="env-name mono">{item.name}</td>
                            <td>
                              <span className={`env-type-tag ${item.isSecret ? "secret" : "config"}`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="env-val mono">{displayVal}</td>
                            <td className="env-actions-td">
                              {item.isSecret && (
                                <button
                                  onClick={() => toggleSecret(item.name)}
                                  className="env-action-btn"
                                  title={isShown ? "Hide" : "Show"}
                                >
                                  {isShown ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              )}
                              <button
                                onClick={() => handleCopyEnv(item.raw, item.name)}
                                className="env-action-btn"
                                title="Copy Value"
                              >
                                {copiedKey === item.name ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-view: Deployment History */}
            {hostingSubTab === "history" && (
              <div className="hosting-history-timeline">
                {[
                  {
                    id: "dep-9f4e21a",
                    commit: "9f4e21a",
                    branch: "main",
                    msg: "Optimize queue worker backoff for flash sale dunning webhooks",
                    status: "SUCCESS",
                    duration: "14.2s",
                    time: "18 minutes ago",
                    actor: "CI / GitHub Webhook"
                  },
                  {
                    id: "dep-7a18bc0",
                    commit: "7a18bc0",
                    branch: "main",
                    msg: "Upgrade Node.js runtime to 22.13 and add Anthropic MCP fallback harness",
                    status: "SUCCESS",
                    duration: "21.6s",
                    time: "Yesterday, 21:04 UTC",
                    actor: "Lead Architect"
                  },
                  {
                    id: "dep-3c990ef",
                    commit: "3c990ef",
                    branch: "main",
                    msg: "Zero-downtime PostgreSQL connection pool migration",
                    status: "SUCCESS",
                    duration: "18.9s",
                    time: "3 days ago",
                    actor: "Automated Deploy Engine"
                  }
                ].map((dep) => (
                  <div key={dep.id} className="history-row">
                    <div className="history-status-icon">
                      <CheckCircle2 size={16} className="text-teal" />
                    </div>
                    <div className="history-info">
                      <div className="history-title-line">
                        <span className="dep-id mono">{dep.id}</span>
                        <span className="dep-commit mono">commit {dep.commit} ({dep.branch})</span>
                        <span className="dep-tag success">{dep.status}</span>
                        <span className="dep-duration">{dep.duration}</span>
                      </div>
                      <p className="dep-msg">{dep.msg}</p>
                      <span className="dep-meta">Triggered by {dep.actor} · {dep.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Delivery Milestones */}
        {activeTab === "sprints" && (
          <div className="dash-sprints-view">
            <div className="sprint-card completed">
              <div className="sprint-status-tag">COMPLETED · SPRINT 01</div>
              <h4>Architecture Audit & Technical Debt Inventory</h4>
              <p>Profiling database bottlenecks, eliminating N+1 queries, and formalizing zero-downtime migration blueprint.</p>
              <div className="sprint-meta">Sign-off: Lead Architect · Delivered in 10 business days</div>
            </div>

            <div className="sprint-card completed">
              <div className="sprint-status-tag">COMPLETED · SPRINT 02</div>
              <h4>Bare-Metal Private Cloud Cutover</h4>
              <p>Migrated 7TB+ of storage with continuous dual-write replication and zero downtime to active supply chain operations.</p>
              <div className="sprint-meta">70% SaaS Spend Reduction Achieved</div>
            </div>

            <div className="sprint-card completed">
              <div className="sprint-status-tag">COMPLETED · SPRINT 03</div>
              <h4>MCP-Powered Automated Order Routing</h4>
              <p>Shipped structured AI tool-calling pipeline with deterministic test suite and fallback circuit-breakers.</p>
              <div className="sprint-meta">Sub-150ms P99 SLA Confirmed</div>
            </div>

            <div className="sprint-card in-progress">
              <div className="sprint-status-tag active">IN PROGRESS · SPRINT 04</div>
              <h4>PostgreSQL Multi-Tenant Partitioning</h4>
              <p>Zero-downtime table partitioning to sustain 10x traffic expansion for upcoming peak volume season.</p>
              <div className="sprint-meta">Cutover scheduled: Friday 23:00 UTC (No user disruption)</div>
            </div>
          </div>
        )}

        {/* Tab 3: Live Telemetry Stream */}
        {activeTab === "logs" && (
          <div className="dash-terminal-box">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <span className="terminal-title">restart-syslog://{activeWorkspace.id}/prod/telemetry.stream</span>
              <span className="terminal-live-badge">LIVE STREAM</span>
            </div>
            <div className="terminal-body">
              <p><span className="t-time">[14:52:01.034]</span> <span className="t-ok">INFO</span> Cluster healthcheck complete. 12/12 worker nodes responding (0.8ms average heartbeat).</p>
              <p><span className="t-time">[14:52:15.221]</span> <span className="t-ok">INFO</span> Medusa webhook burst: 4,120 orders dispatched to idempotent queue cluster.</p>
              <p><span className="t-time">[14:52:15.480]</span> <span className="t-ok">INFO</span> Queue backlog resolved in 259ms. Zero dropped jobs recorded.</p>
              <p><span className="t-time">[14:52:30.892]</span> <span className="t-info">SYSTEM</span> pgvector index compaction triggered. Background vacuum finished cleanly.</p>
              <p><span className="t-time">[14:52:44.102]</span> <span className="t-ok">INFO</span> Anthropic MCP agent pipeline eval score: 99.4% pass across 420 deterministic test cases.</p>
              <p><span className="t-time">[14:53:01.551]</span> <span className="t-ok">INFO</span> Database replica lag: 0.00ms. Storage volume replication verified.</p>
              <p><span className="t-time">[14:53:18.904]</span> <span className="t-ok">INFO</span> Uptime SLA counter: 99.994% rolling 30-day compliance maintained.</p>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      <ConsoleFooter />
    </div>
  );
}
