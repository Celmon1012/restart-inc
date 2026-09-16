import { useState } from "react";
import { Link } from "wouter";
import { ConsoleTopBar } from "@/components/ConsoleTopBar";
import {
  Key,
  Shield,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  RotateCw,
  ChevronLeft,
  Terminal,
  AlertTriangle,
  Lock
} from "lucide-react";
import { toast } from "sonner";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  secret: string;
  role: "READ_WRITE" | "INGESTION_ONLY" | "ADMIN";
  created: string;
  lastUsed: string;
  status: "ACTIVE" | "REVOKED";
}

export default function ApiKeyVault() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([
    {
      id: "key-prod-01",
      name: "Production Ingestion & Webhook Worker",
      prefix: "rst_live_4a91",
      secret: "rst_live_4a91fbc029837a892bce90184fa92039",
      role: "READ_WRITE",
      created: "Aug 12, 2026",
      lastUsed: "4 seconds ago",
      status: "ACTIVE"
    },
    {
      id: "key-mcp-02",
      name: "Anthropic Claude MCP Pipeline Integration",
      prefix: "rst_live_8bf2",
      secret: "rst_live_8bf2901a892b10928a38c92b81092837",
      role: "READ_WRITE",
      created: "Sep 01, 2026",
      lastUsed: "142ms ago",
      status: "ACTIVE"
    },
    {
      id: "key-telemetry-03",
      name: "Prometheus & Grafana Scraper Token",
      prefix: "rst_live_12c9",
      secret: "rst_live_12c9182bf910283746a9182ba01c89f2",
      role: "INGESTION_ONLY",
      created: "Jul 28, 2026",
      lastUsed: "12 seconds ago",
      status: "ACTIVE"
    }
  ]);

  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState<"READ_WRITE" | "INGESTION_ONLY" | "ADMIN">("READ_WRITE");

  const toggleReveal = (id: string) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (secret: string, id: string) => {
    navigator.clipboard?.writeText(secret);
    setCopiedId(id);
    toast.success("API Key secret token copied to clipboard");
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRotateKey = (id: string, name: string) => {
    const randomHex = Math.random().toString(16).substring(2, 10);
    const newSecret = `rst_live_${randomHex}${Math.random().toString(16).substring(2, 26)}`;
    setKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, secret: newSecret, prefix: `rst_live_${randomHex.substring(0, 4)}`, lastUsed: "Just now" } : k
      )
    );
    toast.success(`Rotated key secret for ${name}`);
  };

  const handleRevokeKey = (id: string, name: string) => {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: "REVOKED" } : k)));
    toast.error(`Revoked access token: ${name}`);
  };

  const handleCreateNewKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const randId = `key-custom-${Math.random().toString(16).substring(2, 6)}`;
    const randPrefix = `rst_live_${Math.random().toString(16).substring(2, 6)}`;
    const fullSecret = `${randPrefix}${Math.random().toString(16).substring(2, 26)}`;

    const newKey: ApiKeyItem = {
      id: randId,
      name: newKeyName.trim(),
      prefix: randPrefix,
      secret: fullSecret,
      role: newKeyRole,
      created: "Today, Just now",
      lastUsed: "Never",
      status: "ACTIVE"
    };

    setKeys([newKey, ...keys]);
    setRevealedKeys((prev) => ({ ...prev, [randId]: true }));
    setNewKeyName("");
    setIsCreatingKey(false);
    toast.success(`Generated new production API key: ${newKey.name}`);
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
          <span className="breadcrumb-current">API & Key Vault</span>
        </div>

        {/* Header Row */}
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">SECURE CREDENTIALS & ZERO-TRUST TOKENS</span>
            <h1>API Keys & Secret Vault</h1>
            <p>Provision, rotate, and audit machine access tokens for your dedicated cluster endpoints and MCP pipelines.</p>
          </div>
          <div className="dash-header-meta">
            <div className="meta-box">
              <span className="meta-title">VAULT STATUS</span>
              <span className="meta-val text-teal">SEALED / HSM</span>
            </div>
            <div className="meta-box">
              <span className="meta-title">ACTIVE TOKENS</span>
              <span className="meta-val text-white">{keys.filter((k) => k.status === "ACTIVE").length} Keys Live</span>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="vault-actions-bar">
          <div className="vault-notice">
            <Shield size={14} className="text-teal" />
            <span>Secrets are encrypted at rest with AES-256-GCM. Hardware key authentication required for full export.</span>
          </div>
          <button onClick={() => setIsCreatingKey(!isCreatingKey)} className="console-btn-primary">
            <Plus size={14} />
            <span>Generate New API Key</span>
          </button>
        </div>

        {/* Create Key Form Modal / Drawer */}
        {isCreatingKey && (
          <div className="create-key-drawer">
            <div className="card-top-header">
              <span className="card-kicker">GENERATE AUTHORIZED ACCESS TOKEN</span>
              <button onClick={() => setIsCreatingKey(false)} className="close-btn text-xs text-[#8491a6]">
                Cancel
              </button>
            </div>
            <form onSubmit={handleCreateNewKey} className="create-key-form">
              <div className="form-row-2col">
                <div className="form-group">
                  <label>Token Identifier / Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Staging MCP Worker or Ingestion Relay"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="console-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Scope & RBAC Permission</label>
                  <select
                    value={newKeyRole}
                    onChange={(e) => setNewKeyRole(e.target.value as any)}
                    className="console-select"
                  >
                    <option value="READ_WRITE">Full Read/Write (Cluster API)</option>
                    <option value="INGESTION_ONLY">Ingestion Only (Telemetry & Webhooks)</option>
                    <option value="ADMIN">Project Admin (Deployment Hooks & Restart)</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreatingKey(false)} className="console-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="console-btn-primary">
                  Confirm & Generate
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Keys Table Card */}
        <div className="console-card">
          <div className="card-top-header">
            <span className="card-kicker">ACTIVE API ACCESS TOKENS</span>
            <span className="meta-tag">{keys.length} REGISTERED TOKENS</span>
          </div>

          <div className="envs-table-wrapper">
            <table className="envs-table">
              <thead>
                <tr>
                  <th>KEY NAME & SCOPE</th>
                  <th>TOKEN PREFIX</th>
                  <th>SECRET VALUE</th>
                  <th>LAST ACTIVITY</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const isRevealed = revealedKeys[k.id];
                  const isRevoked = k.status === "REVOKED";
                  return (
                    <tr key={k.id} className={isRevoked ? "opacity-50" : ""}>
                      <td>
                        <div className="key-table-name">
                          <strong>{k.name}</strong>
                          <span className={`key-role-badge ${k.role.toLowerCase()}`}>{k.role}</span>
                        </div>
                      </td>
                      <td className="mono text-[#78849b]">{k.prefix}••••</td>
                      <td className="mono">
                        {isRevealed ? (
                          <span className="text-teal">{k.secret}</span>
                        ) : (
                          <span className="text-[#64748b]">••••••••••••••••••••••••••••••••</span>
                        )}
                      </td>
                      <td className="text-[12px] text-[#94a3b8]">
                        <div>{k.lastUsed}</div>
                        <div className="text-[10px] text-[#64748b]">Created {k.created}</div>
                      </td>
                      <td>
                        <span className={`status-pill-small ${k.status === "ACTIVE" ? "active" : "revoked"}`}>
                          {k.status}
                        </span>
                      </td>
                      <td className="env-actions-td">
                        {!isRevoked && (
                          <>
                            <button
                              onClick={() => toggleReveal(k.id)}
                              className="env-action-btn"
                              title={isRevealed ? "Hide Secret" : "Reveal Secret"}
                            >
                              {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              onClick={() => handleCopy(k.secret, k.id)}
                              className="env-action-btn"
                              title="Copy Secret"
                            >
                              {copiedId === k.id ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
                            </button>
                            <button
                              onClick={() => handleRotateKey(k.id, k.name)}
                              className="env-action-btn"
                              title="Rotate Secret"
                            >
                              <RotateCw size={13} />
                            </button>
                            <button
                              onClick={() => handleRevokeKey(k.id, k.name)}
                              className="env-action-btn text-rose-400 hover:text-rose-300"
                              title="Revoke Key"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Integration Instructions Card */}
        <div className="console-card mt-6">
          <div className="card-top-header">
            <span className="card-kicker">CURL / MCP CLI USAGE SNIPPET</span>
            <Terminal size={15} className="text-teal" />
          </div>
          <div className="code-snippet-box">
            <pre className="mono">
{`# Example: Authenticating against Acme Cluster Ingestion API
curl -X POST https://api.restart.ng/v1/telemetry/ingest \\
  -H "Authorization: Bearer rst_live_4a91••••••••••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{"event": "queue_heartbeat", "project": "04", "status": "nominal"}'`}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
