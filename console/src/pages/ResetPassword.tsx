import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { MARKETING_URL } from "@/lib/site";

// Destination for both invite links and "forgot password" recovery links —
// GoTrue hands the browser a fresh session in the URL either way, and both
// cases need exactly the same thing from the user: set a password. There's
// no meaningful difference between "set your first password" and "reset
// your password" from here.
export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }
    setIsSaving(true);
    setErrorMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setLocation("/dashboard");
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
          {loading ? (
            <>
              <h1>One moment…</h1>
              <p className="simple-login-subtitle">Verifying your link.</p>
            </>
          ) : !session ? (
            <>
              <h1>Link expired</h1>
              <p className="simple-login-subtitle">
                This invite or reset link is invalid or has already been used. Request a new one from the login
                page.
              </p>
              <a href="/login" className="simple-submit-btn" style={{ marginTop: "16px" }}>
                <span>Back to Login</span>
                <ArrowRight size={16} />
              </a>
            </>
          ) : (
            <>
              <h1>Set your password</h1>
              <p className="simple-login-subtitle">Choose a password to finish signing in to your console.</p>

              {errorMessage && (
                <div className="login-error-banner">
                  <AlertCircle size={15} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="simple-login-form">
                <div className="simple-field-group">
                  <label htmlFor="new-password">New Password</label>
                  <div className="simple-input-wrap">
                    <Lock size={15} className="simple-input-icon" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
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

                <div className="simple-field-group">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <div className="simple-input-wrap">
                    <Lock size={15} className="simple-input-icon" />
                    <input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="simple-input"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="simple-submit-btn" disabled={isSaving}>
                  {isSaving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <span>Set Password & Continue</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
