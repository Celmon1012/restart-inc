import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, ArrowRight, Lock, CheckCircle2, Server, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { MARKETING_URL } from "@/lib/site";

export default function Login() {
  const [, setLocation] = useLocation();
  const { signInWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter your work email and password");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    const { error } = await signInWithPassword(email, password);
    setIsLoading(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setLocation("/dashboard");
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMessage("");
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMessage(error);
      setIsGoogleLoading(false);
    }
    // On success, Supabase redirects the browser to Google, so no further action here.
  };

  return (
    <div className="login-page-shell">
      {/* Top Header */}
      <header className="login-top-bar">
        <a href={MARKETING_URL} className="site-logo">
          <span className="restart-mark" />
          <span>RESTART<span className="logo-dot">.</span></span>
        </a>
        <div className="login-security-tag">
          <Shield size={13} className="text-teal" />
          <span>Encrypted Session · TLS 1.3</span>
        </div>
        <a href={MARKETING_URL} className="back-to-site-link">
          ← Back to Site
        </a>
      </header>

      {/* Main Login Card */}
      <main className="login-main-container">
        <div className="login-card">
          <div className="login-card-badge">
            <span className="live-status-dot" />
            <span>CLIENT DASHBOARD</span>
          </div>

          <div className="login-card-header">
            <h1>Sign In to Your Dashboard</h1>
            <p>Access active production telemetry, SLA uptime monitors, and architecture delivery logs.</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="login-error-banner">
              <AlertCircle size={15} />
              <span>Auth is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</span>
            </div>
          )}

          {errorMessage && (
            <div className="login-error-banner">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="login-google-btn"
            disabled={isGoogleLoading || isLoading || !isSupabaseConfigured}
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            <span>{isGoogleLoading ? "Redirecting to Google…" : "Continue with Google"}</span>
          </button>

          <div className="login-divider">
            <span>OR SIGN IN WITH EMAIL</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-input-group">
              <label htmlFor="login-email">Work Email</label>
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
                <label htmlFor="login-password">Password</label>
                <a href="#reset" onClick={(e) => { e.preventDefault(); alert("Password reset instructions will be sent to your email."); }} className="forgot-key-link">
                  Forgot Password?
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
                  required
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

            <button type="submit" className="login-submit-btn" disabled={isLoading || isGoogleLoading || !isSupabaseConfigured}>
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="login-card-footer">
            <div className="login-footer-item">
              <Lock size={13} />
              <span>Managed by Supabase Auth</span>
            </div>
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
