import { useState } from "react";
import { Link } from "wouter";
import { ConsoleTopBar } from "@/components/ConsoleTopBar";
import {
  Shield,
  User,
  Key,
  Smartphone,
  Lock,
  CheckCircle2,
  Clock,
  Laptop,
  Globe,
  ChevronLeft,
  Copy,
  Check,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileSecurity() {
  const { user } = useAuth();
  const isGoogleAccount = user?.app_metadata?.provider === "google";
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      ""
  );
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState("Lead Systems Operator & Project Administrator");
  const [emergencyPhone, setEmergencyPhone] = useState("+1 (555) 019-2834");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Profile security configuration updated successfully");
    }, 600);
  };

  const handleCopyFp = () => {
    navigator.clipboard?.writeText("SHA256:7b92f91a8e20f92419a77c01bba29e84d9f1091a24a0ebc21");
    setCopiedKey(true);
    toast.success("Public SSH key fingerprint copied");
    setTimeout(() => setCopiedKey(false), 1800);
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
          <span className="breadcrumb-current">Profile & Security</span>
        </div>

        {/* Header Row */}
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">IDENTITY, SESSIONS & CREDENTIAL SECURITY</span>
            <h1>Profile & Security</h1>
            <p>Manage authenticated operator identity, two-factor authentication, SSH keys, and active cluster sessions.</p>
          </div>
        </div>

        <div className="console-grid-layout">
          {/* Left Column: Personal Information & Credentials */}
          <div className="console-col">
            <div className="console-card">
              <div className="card-top-header">
                <span className="card-kicker">OPERATOR DETAILS</span>
                <span className="badge-teal">PROJECT #04 ADMIN</span>
              </div>

              <form onSubmit={handleSaveProfile} className="console-form">
                <div className="form-group">
                  <label>Full Legal Name / Operator Handle</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="console-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Authorized Work Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="console-input"
                    disabled={isGoogleAccount}
                    required
                  />
                  <span className="input-hint">
                    {isGoogleAccount
                      ? "Bound to Google Sign-In · Auto-synced"
                      : "Managed via Supabase Auth"}
                  </span>
                </div>

                <div className="form-group">
                  <label>Primary Role & Responsibilities</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="console-input"
                  />
                </div>

                <div className="form-group">
                  <label>Urgent Incident Pager Phone (SMS / Signal)</label>
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="console-input"
                  />
                  <span className="input-hint">Used strictly for P1/P2 catastrophic outages</span>
                </div>

                <button type="submit" disabled={isSaving} className="console-btn-primary">
                  {isSaving ? "Saving..." : "Save Identity Changes"}
                </button>
              </form>
            </div>

            {/* SSH & Hardware Key Vault */}
            <div className="console-card mt-6">
              <div className="card-top-header">
                <span className="card-kicker">PUBLIC KEY & HARDWARE TOKENS</span>
                <span className="status-live-pill">
                  <span className="status-dot-active" />
                  1 HARDWARE KEY ATTACHED
                </span>
              </div>

              <div className="key-item-box">
                <div className="key-item-header">
                  <div className="key-name-block">
                    <Key size={14} className="text-teal" />
                    <span className="key-title">YubiKey 5C NFC · Hardware FIDO2</span>
                  </div>
                  <span className="key-badge">ACTIVE MFA</span>
                </div>
                <p className="key-desc">Configured for zero-trust challenge verification on sensitive cluster operations.</p>
                <div className="key-meta-line">
                  <span>Added on Aug 14, 2026</span>
                  <span>Last challenged 2h ago</span>
                </div>
              </div>

              <div className="key-item-box mt-3">
                <div className="key-item-header">
                  <div className="key-name-block">
                    <Lock size={14} className="text-teal" />
                    <span className="key-title">ed25519-sk Cluster Operator Key</span>
                  </div>
                  <button onClick={handleCopyFp} className="key-copy-btn">
                    {copiedKey ? <Check size={12} className="text-teal" /> : <Copy size={12} />}
                    <span>{copiedKey ? "Copied" : "Copy Fingerprint"}</span>
                  </button>
                </div>
                <p className="key-fingerprint mono">SHA256:7b92f91a8e20f92419a77c01bba29e84d9f1091a24a0ebc21</p>
              </div>
            </div>
          </div>

          {/* Right Column: Multi-Factor & Active Sessions */}
          <div className="console-col">
            <div className="console-card">
              <div className="card-top-header">
                <span className="card-kicker">AUTHENTICATION POLICIES</span>
                <Shield size={16} className="text-teal" />
              </div>

              <div className="policy-toggle-row">
                <div>
                  <h4>Two-Factor Authentication (2FA) Enforcement</h4>
                  <p>Require a time-based authenticator app code before accessing audit streams or rotating production keys.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMfaEnabled(!mfaEnabled);
                    toast.info(mfaEnabled ? "2FA relaxed to password-only" : "2FA strictly enforced via authenticator app");
                  }}
                  className={`toggle-switch ${mfaEnabled ? "on" : "off"}`}
                  aria-pressed={mfaEnabled}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              <div className="policy-info-box mt-4">
                <div className="info-icon text-teal">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <strong>Strict Session IP Pinning Enabled</strong>
                  <p>Tokens will automatically invalidate if active IP subnet shifts unexpectedly.</p>
                </div>
              </div>
            </div>

            {/* Active Sessions List */}
            <div className="console-card mt-6">
              <div className="card-top-header">
                <span className="card-kicker">ACTIVE SESSIONS & CLUSTERS</span>
                <span className="meta-tag">2 ACTIVE NOW</span>
              </div>

              <div className="session-item">
                <div className="session-icon">
                  <Laptop size={16} className="text-teal" />
                </div>
                <div className="session-details">
                  <div className="session-title">
                    <strong>Chrome on macOS Sequoia</strong>
                    <span className="session-tag current">THIS DEVICE</span>
                  </div>
                  <span className="session-meta">Ashburn, Virginia, US · IP: 198.51.100.42</span>
                  <span className="session-time">
                    Active now · Signed in via {isGoogleAccount ? "Google" : "Email & Password"}
                  </span>
                </div>
              </div>

              <div className="session-item mt-3">
                <div className="session-icon">
                  <Smartphone size={16} className="text-blue" />
                </div>
                <div className="session-details">
                  <div className="session-title">
                    <strong>Restart Incident Pager App (iOS 19)</strong>
                    <span className="session-tag">VERIFIED</span>
                  </div>
                  <span className="session-meta">Lagos, Nigeria · IP: 102.89.23.118</span>
                  <span className="session-time">Active 42m ago · Push alert listener</span>
                </div>
                <button
                  onClick={() => toast.info("Revoked mobile session token")}
                  className="session-revoke-btn"
                >
                  Revoke
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-white/5">
                <button
                  onClick={() => toast.success("All other active sessions revoked")}
                  className="console-btn-danger w-full"
                >
                  Terminate All Other Active Sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
