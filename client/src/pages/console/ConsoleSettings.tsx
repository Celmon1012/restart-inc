import { useState } from "react";
import { Link } from "wouter";
import { ConsoleTopBar } from "@/components/ConsoleTopBar";
import {
  Sliders,
  Bell,
  Shield,
  ChevronLeft,
  Check,
  Zap,
  Cpu,
  Terminal,
  RefreshCw,
  Volume2,
  Mail,
  Database
} from "lucide-react";
import { toast } from "sonner";

export default function ConsoleSettings() {
  const [telemetryInterval, setTelemetryInterval] = useState("5000");
  const [logRetentionDays, setLogRetentionDays] = useState("90");
  const [alertSeverity, setAlertSeverity] = useState("p1-only");
  const [notifySlack, setNotifySlack] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoCompaction, setAutoCompaction] = useState(true);
  const [themeMode, setThemeMode] = useState("obsidian-pure");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Console preferences saved to cluster project configuration");
    }, 600);
  };

  return (
    <div className="dash-shell">
      <ConsoleTopBar />

      <main className="dash-main container">
        {/* Breadcrumb Back Link */}
        <div className="console-breadcrumb">
          <Link href="/dashboard" className="breadcrumb-back">
            <ChevronLeft size={14} />
            <span>Back to Dashboard</span>
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Console Settings</span>
        </div>

        {/* Header Row */}
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">PREFERENCES, ALERTS & TELEMETRY STREAM TUNING</span>
            <h1>Console Preferences</h1>
            <p>Customize live telemetry refresh rates, incident alert dispatches, and operator HUD presentation.</p>
          </div>
          <div className="dash-header-meta">
            <div className="meta-box">
              <span className="meta-title">CONFIG TARGET</span>
              <span className="meta-val text-teal">PROJECT #04 DEDICATED</span>
            </div>
            <div className="meta-box">
              <span className="meta-title">NODE LATENCY</span>
              <span className="meta-val text-white">0.8ms P50</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveSettings}>
          <div className="console-grid-layout">
            {/* Col 1: Telemetry & Ingestion Tuning */}
            <div className="console-col">
              <div className="console-card">
                <div className="card-top-header">
                  <span className="card-kicker">STREAM & TELEMETRY SAMPLING</span>
                  <Zap size={15} className="text-teal" />
                </div>

                <div className="form-group">
                  <label>Live Audit Polling Frequency</label>
                  <select
                    value={telemetryInterval}
                    onChange={(e) => setTelemetryInterval(e.target.value)}
                    className="console-select"
                  >
                    <option value="1000">1,000ms (High Fidelity · High Bandwidth)</option>
                    <option value="5000">5,000ms (Recommended Production Default)</option>
                    <option value="15000">15,000ms (Low Overhead)</option>
                    <option value="manual">Manual Refresh Only</option>
                  </select>
                  <span className="input-hint">Controls websocket/heartbeat query cycle on /dashboard</span>
                </div>

                <div className="form-group">
                  <label>Audit Log Retention Horizon</label>
                  <select
                    value={logRetentionDays}
                    onChange={(e) => setLogRetentionDays(e.target.value)}
                    className="console-select"
                  >
                    <option value="30">30 Days (Standard Audit)</option>
                    <option value="90">90 Days (Enterprise Regulatory Default)</option>
                    <option value="365">365 Days (Full ISO / SOC2 Archive)</option>
                  </select>
                </div>

                <div className="policy-toggle-row mt-4 pt-3 border-t border-white/5">
                  <div>
                    <h4>Automated pgvector Index Compaction</h4>
                    <p>Trigger background vacuum and dead tuple recycling nightly at 03:00 UTC.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoCompaction(!autoCompaction)}
                    className={`toggle-switch ${autoCompaction ? "on" : "off"}`}
                    aria-pressed={autoCompaction}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Visual Display Theme */}
              <div className="console-card mt-6">
                <div className="card-top-header">
                  <span className="card-kicker">THEME & PRESENTATION</span>
                  <span className="badge-teal">OBSIDIAN BRAND</span>
                </div>

                <div className="form-group">
                  <label>Console Visual Tone</label>
                  <div className="theme-selector-grid">
                    {[
                      { id: "obsidian-pure", label: "Pure Obsidian", desc: "#030304 OLED black with cyan-teal indicators" },
                      { id: "obsidian-graphite", label: "Obsidian Slate", desc: "#080a0f subtle deep slate background" },
                    ].map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setThemeMode(t.id)}
                        className={`theme-opt-box ${themeMode === t.id ? "active" : ""}`}
                      >
                        <div className="theme-opt-head">
                          <strong>{t.label}</strong>
                          {themeMode === t.id && <Check size={14} className="text-teal" />}
                        </div>
                        <p>{t.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Col 2: Alerting & Dispatch Routing */}
            <div className="console-col">
              <div className="console-card">
                <div className="card-top-header">
                  <span className="card-kicker">INCIDENT ESCALATION & PAGING</span>
                  <Bell size={15} className="text-teal" />
                </div>

                <div className="form-group">
                  <label>Minimum Alert Severity Threshold</label>
                  <select
                    value={alertSeverity}
                    onChange={(e) => setAlertSeverity(e.target.value)}
                    className="console-select"
                  >
                    <option value="all">All Warnings (Info, Degraded, Critical)</option>
                    <option value="degraded">Degraded + Critical (P2 & P1)</option>
                    <option value="p1-only">Critical Outages Only (P1 & SLA Breaches)</option>
                  </select>
                </div>

                <div className="notification-channels-list mt-4">
                  <div className="policy-toggle-row">
                    <div className="flex items-center gap-3">
                      <div className="chan-icon"><Mail size={14} className="text-teal" /></div>
                      <div>
                        <h4>Email Notification Broadcast</h4>
                        <p className="text-[12px] text-[#78849b]">operator@acme-logistics.internal</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyEmail(!notifyEmail)}
                      className={`toggle-switch ${notifyEmail ? "on" : "off"}`}
                      aria-pressed={notifyEmail}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>

                  <div className="policy-toggle-row mt-3">
                    <div className="flex items-center gap-3">
                      <div className="chan-icon"><Zap size={14} className="text-teal" /></div>
                      <div>
                        <h4>Slack / Teams Incident Webhook</h4>
                        <p className="text-[12px] text-[#78849b]">#ops-production-alerts</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifySlack(!notifySlack)}
                      className={`toggle-switch ${notifySlack ? "on" : "off"}`}
                      aria-pressed={notifySlack}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>

                  <div className="policy-toggle-row mt-3">
                    <div className="flex items-center gap-3">
                      <div className="chan-icon"><Volume2 size={14} className="text-teal" /></div>
                      <div>
                        <h4>Audible HUD Pager Chimes</h4>
                        <p className="text-[12px] text-[#78849b]">Play subtle tone on SLA warning</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`toggle-switch ${soundEnabled ? "on" : "off"}`}
                      aria-pressed={soundEnabled}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Project Specific Metadata */}
              <div className="console-card mt-6">
                <div className="card-top-header">
                  <span className="card-kicker">ASSIGNED PROJECT ROUTING</span>
                  <span className="meta-tag">COMMITTED INFRASTRUCTURE</span>
                </div>
                <div className="pod-meta-table">
                  <div className="pod-row">
                    <span className="pod-k">Assigned Project:</span>
                    <span className="pod-v font-bold text-white">Project #04 · Senior Dedicated</span>
                  </div>
                  <div className="pod-row">
                    <span className="pod-k">Lead Architect:</span>
                    <span className="pod-v text-teal">Ademola Usuf (Senior Systems Lead)</span>
                  </div>
                  <div className="pod-row">
                    <span className="pod-k">Primary Target SLA:</span>
                    <span className="pod-v text-white font-mono">99.994% Rolling 30d</span>
                  </div>
                  <div className="pod-row">
                    <span className="pod-k">Committed Response:</span>
                    <span className="pod-v text-white">&lt;15 min P1 Escalation</span>
                  </div>
                </div>

                <div className="mt-5">
                  <button type="submit" disabled={isSaving} className="console-btn-primary w-full">
                    {isSaving ? "Saving..." : "Apply & Save Settings"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
