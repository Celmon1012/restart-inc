import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Shield, Key, ArrowRight, Lock, CheckCircle2, Server, Eye, EyeOff, Sparkles, AlertCircle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage("Please enter your work email");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/dashboard");
    }, 600);
  };

  const handleDemoLogin = () => {
    setEmail("operator@acme-logistics.internal");
    setPassword("••••••••••••••••");
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/dashboard");
    }, 400);
  };

  return (
    <div className="login-page-shell">
      {/* Top Header */}
      <header className="login-top-bar">
        <Link href="/" className="site-logo">
          <span className="restart-mark" />
          <span>RESTART<span className="logo-dot">.</span></span>
        </Link>
        <div className="login-security-tag">
          <Shield size={13} className="text-teal" />
          <span>Encrypted Session · TLS 1.3 · Hardware Keyvault</span>
        </div>
        <Link href="/" className="back-to-site-link">
          ← Back to Site
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="login-main-container">
        <div className="login-card">
          <div className="login-card-badge">
            <span className="live-status-dot" />
            <span>CLIENT OPERATIONS CONSOLE · v2.4</span>
          </div>

          <div className="login-card-header">
            <h1>Sign In to Client Console</h1>
            <p>Access active production telemetry, SLA uptime monitors, and architecture delivery logs.</p>
          </div>

          {errorMessage && (
            <div className="login-error-banner">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-input-group">
              <label htmlFor="login-email">Authorized Work Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="operator@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                required
              />
            </div>

            <div className="login-input-group">
              <div className="login-label-row">
                <label htmlFor="login-password">Access Key / Token</label>
                <a href="#reset" onClick={(e) => { e.preventDefault(); alert("Key recovery instructions sent to domain administrator."); }} className="forgot-key-link">
                  Request Key Reset
                </a>
              </div>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="toggle-password-btn"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="login-meta-row">
              <label className="remember-checkbox-label">
                <input type="checkbox" defaultChecked />
                <span>Keep session active (30d)</span>
              </label>
              <span className="sso-hint">SSO / Okta Enabled</span>
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <span>Authenticating Credentials...</span>
              ) : (
                <>
                  <span>Authenticate & Enter Console</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="login-divider">
              <span>OR TEST OPERATOR ENVIRONMENT</span>
            </div>

            <button type="button" onClick={handleDemoLogin} className="login-demo-btn">
              <Sparkles size={14} className="text-teal" />
              <span>1-Click Operator Demo Access</span>
            </button>
          </form>

          <div className="login-card-footer">
            <div className="login-footer-item">
              <Server size={13} />
              <span>Dedicated Tenant Isolation</span>
            </div>
            <div className="login-footer-item">
              <CheckCircle2 size={13} />
              <span>99.99% Uptime Verified</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
