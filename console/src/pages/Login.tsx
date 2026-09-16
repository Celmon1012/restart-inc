import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Github, Lock, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { MARKETING_URL } from "@/lib/site";

export default function Login() {
  const [, setLocation] = useLocation();
  const { signInWithPassword, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
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

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setErrorMessage("");
    const { error } = await signInWithOAuth(provider);
    if (error) {
      setErrorMessage(error);
      setOauthLoading(null);
    }
    // On success, Supabase redirects the browser away, so no further action here.
  };

  return (
    <div className="simple-login-shell">
      <header className="simple-login-topbar">
        <a href={MARKETING_URL} className="site-logo" aria-label="Restart home">
          <span className="restart-mark" aria-hidden="true"><span /></span>
          <span>RESTART<span className="logo-dot">.</span></span>
        </a>
        <a href={MARKETING_URL} className="squeeze-back-link">
          <ArrowLeft size={14} /> Back to Site
        </a>
      </header>

      <div className="simple-login-page">
      <div className="simple-login-card">
        <h1>Welcome back</h1>
        <p className="simple-login-subtitle">Enter your credentials to access your console.</p>

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

        <div className="simple-oauth-row">
          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            className="simple-oauth-btn"
            disabled={oauthLoading !== null || isLoading || !isSupabaseConfigured}
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            <span>{oauthLoading === "google" ? "Redirecting…" : "Log in with Google"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin("github")}
            className="simple-oauth-btn"
            disabled={oauthLoading !== null || isLoading || !isSupabaseConfigured}
          >
            <Github size={16} />
            <span>{oauthLoading === "github" ? "Redirecting…" : "Log in with GitHub"}</span>
          </button>
        </div>

        <div className="simple-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit} className="simple-login-form">
          <div className="simple-field-group">
            <label htmlFor="login-email">Email Address</label>
            <div className="simple-input-wrap">
              <Mail size={15} className="simple-input-icon" />
              <input
                id="login-email"
                type="email"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="simple-input"
                required
              />
            </div>
          </div>

          <div className="simple-field-group">
            <div className="simple-label-row">
              <label htmlFor="login-password">Password</label>
              <a href="#reset" onClick={(e) => { e.preventDefault(); alert("Password reset instructions will be sent to your email."); }} className="simple-forgot-link">
                Forgot Password?
              </a>
            </div>
            <div className="simple-input-wrap">
              <Lock size={15} className="simple-input-icon" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="simple-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="simple-toggle-password-btn"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" className="simple-submit-btn" disabled={isLoading || oauthLoading !== null || !isSupabaseConfigured}>
            {isLoading ? (
              <span>Signing In...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="simple-login-footer">
          Don't have an account? <a href={`${MARKETING_URL}/start-project`}>Request Access</a>
        </p>
      </div>
      </div>
    </div>
  );
}
