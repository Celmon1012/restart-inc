import { useState } from "react";
import { Link, useLocation } from "wouter";
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
  Sliders
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"systems" | "sprints" | "logs">("systems");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleLogout = () => {
    setLocation("/login");
  };

  return (
    <div className="dash-shell">
      {/* Obsidian Console Top Navigation */}
      <header className="dash-top-bar">
        <div className="dash-top-left">
          <Link href="/" className="site-logo">
            <span className="restart-mark" />
            <span>RESTART<span className="logo-dot">.</span></span>
          </Link>
          <div className="dash-tag">
            <span>OPERATOR CONSOLE</span>
          </div>
          <div className="dash-org-badge">
            <span className="org-dot" />
            <span className="org-name">Acme Global Logistics</span>
            <span className="org-pod">Pod #04 · Senior Dedicated</span>
          </div>
        </div>

        <div className="dash-top-right">
          <div className="dash-status-pill">
            <span className="pulse-dot" />
            <span>3 SYSTEMS LIVE · 99.994% UPTIME</span>
          </div>

          <button onClick={handleRefresh} className={`dash-icon-btn ${isRefreshing ? "spin" : ""}`} title="Refresh Telemetry">
            <RefreshCw size={15} />
          </button>

          <Link href="/start-project" className="dash-action-btn">
            <span>Request New Sprint</span>
            <ArrowUpRight size={14} />
          </Link>

          <button onClick={handleLogout} className="dash-logout-btn" title="Sign out of Console">
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="dash-main container">
        {/* Console Header Banner */}
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">INFRASTRUCTURE TELEMETRY & DELIVERY HUD</span>
            <h1>Production Systems Overview</h1>
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
            <span>Active Production Systems (3)</span>
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

        {/* Tab 1: Active Systems */}
        {activeTab === "systems" && (
          <div className="dash-systems-list">
            <div className="system-row">
              <div className="system-status-indicator">
                <span className="status-dot-active" />
              </div>
              <div className="system-info">
                <div className="system-title-row">
                  <h3>Dedicated Private Cloud Core</h3>
                  <span className="system-badge">BARE-METAL INFRASTRUCTURE</span>
                  <span className="system-version">v3.12.4</span>
                </div>
                <p>Bare-metal cluster migration running with redundant hot-standby nodes and automatic failover.</p>
                <div className="system-metrics-inline">
                  <span>CPU Load: <strong>26%</strong></span>
                  <span>Memory: <strong>41.8 GB / 128 GB</strong></span>
                  <span>Disk I/O: <strong>0.12ms</strong></span>
                  <span>Failover SLA: <strong>Active</strong></span>
                </div>
              </div>
              <div className="system-actions">
                <span className="system-healthy-pill">HEALTHY</span>
              </div>
            </div>

            <div className="system-row">
              <div className="system-status-indicator">
                <span className="status-dot-active" />
              </div>
              <div className="system-info">
                <div className="system-title-row">
                  <h3>Claude & Anthropic MCP Agent Pipeline</h3>
                  <span className="system-badge">AI SYSTEMS ENGINE</span>
                  <span className="system-version">v2.1.0</span>
                </div>
                <p>Deterministic evaluation harnesses with semantic caching and pgvector hybrid search clusters.</p>
                <div className="system-metrics-inline">
                  <span>Eval Accuracy: <strong>99.4%</strong></span>
                  <span>Cache Hit Rate: <strong>68.2%</strong></span>
                  <span>Token Cost Reduction: <strong>-48%</strong></span>
                  <span>P99 Latency: <strong>142ms</strong></span>
                </div>
              </div>
              <div className="system-actions">
                <span className="system-healthy-pill">OPTIMAL</span>
              </div>
            </div>

            <div className="system-row">
              <div className="system-status-indicator">
                <span className="status-dot-active" />
              </div>
              <div className="system-info">
                <div className="system-title-row">
                  <h3>High-Volume Shopify Plus Event Consumer</h3>
                  <span className="system-badge">COMMERCE INFRASTRUCTURE</span>
                  <span className="system-version">v1.8.6</span>
                </div>
                <p>Idempotent queue consumers handling burst traffic without dropping orders or double-billing.</p>
                <div className="system-metrics-inline">
                  <span>Queue Depth: <strong>0</strong></span>
                  <span>Processed (24h): <strong>1.48M events</strong></span>
                  <span>Dunning Recovery: <strong>+38%</strong></span>
                  <span>NDPA Compliance: <strong>Verified</strong></span>
                </div>
              </div>
              <div className="system-actions">
                <span className="system-healthy-pill">ONLINE</span>
              </div>
            </div>
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
              <span className="terminal-title">restart-syslog://acme-logistics-core/prod/telemetry.stream</span>
              <span className="terminal-live-badge">LIVE STREAM</span>
            </div>
            <div className="terminal-body">
              <p><span className="t-time">[14:52:01.034]</span> <span className="t-ok">INFO</span> Cluster healthcheck complete. 12/12 worker nodes responding (0.8ms average heartbeat).</p>
              <p><span className="t-time">[14:52:15.221]</span> <span className="t-ok">INFO</span> Shopify webhook burst: 4,120 orders dispatched to idempotent queue cluster.</p>
              <p><span className="t-time">[14:52:15.480]</span> <span className="t-ok">INFO</span> Queue backlog resolved in 259ms. Zero dropped jobs recorded.</p>
              <p><span className="t-time">[14:52:30.892]</span> <span className="t-info">SYSTEM</span> pgvector index compaction triggered. Background vacuum finished cleanly.</p>
              <p><span className="t-time">[14:52:44.102]</span> <span className="t-ok">INFO</span> Anthropic MCP agent pipeline eval score: 99.4% pass across 420 deterministic test cases.</p>
              <p><span className="t-time">[14:53:01.551]</span> <span className="t-ok">INFO</span> Database replica lag: 0.00ms. Storage volume replication verified.</p>
              <p><span className="t-time">[14:53:18.904]</span> <span className="t-ok">INFO</span> Uptime SLA counter: 99.994% rolling 30-day compliance maintained.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
