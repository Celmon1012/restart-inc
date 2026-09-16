import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConsoleTopBar } from "@/components/ConsoleTopBar";
import { ConsoleFooter } from "@/components/ConsoleFooter";
import { Shield, ShieldOff, ChevronLeft, Smartphone, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface TotpFactor {
  id: string;
  status: "verified" | "unverified";
  friendly_name?: string | null;
}

export default function ProfileSecurity() {
  const { user } = useAuth();
  const isGoogleAccount = user?.app_metadata?.provider === "google";

  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      ""
  );
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState((user?.user_metadata?.role as string | undefined) || "");
  const [phone, setPhone] = useState((user?.user_metadata?.phone as string | undefined) || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [mfaSupported, setMfaSupported] = useState(true);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  const [terminatingOthers, setTerminatingOthers] = useState(false);

  const loadFactors = async () => {
    setLoadingFactors(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      // A GoTrue instance with MFA disabled errors here rather than
      // returning an empty list — treat that as "not supported", not a bug.
      setMfaSupported(false);
    } else {
      setFactors((data?.totp as TotpFactor[]) ?? []);
    }
    setLoadingFactors(false);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updates: { data: Record<string, string>; email?: string } = {
        data: { full_name: fullName, role, phone },
      };
      if (!isGoogleAccount && email !== user?.email) {
        updates.email = email;
      }
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      toast.success(
        updates.email
          ? "Profile updated. Check your inbox to confirm the new email address."
          : "Profile updated."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleStartEnroll = async () => {
    setMfaBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setEnrolling({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start 2FA enrollment");
    } finally {
      setMfaBusy(false);
    }
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolling) return;
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.factorId,
        code: verifyCode,
      });
      if (error) throw error;
      toast.success("2FA enabled");
      setEnrolling(null);
      setVerifyCode("");
      await loadFactors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setMfaBusy(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (enrolling) {
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    }
    setEnrolling(null);
    setVerifyCode("");
  };

  const handleRemoveFactor = async (factorId: string) => {
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("2FA disabled");
      await loadFactors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setMfaBusy(false);
    }
  };

  // The toggle is the single control for the whole flow: off -> on starts
  // enrollment (QR appears below, still unverified until the code is
  // confirmed); on -> off disables the existing verified factor.
  const handleToggleMfa = () => {
    if (mfaBusy || !mfaSupported) return;
    if (verifiedFactor) {
      handleRemoveFactor(verifiedFactor.id);
    } else if (enrolling) {
      handleCancelEnroll();
    } else {
      handleStartEnroll();
    }
  };

  const handleTerminateOthers = async () => {
    setTerminatingOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success("Signed out of all other sessions");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign out other sessions");
    } finally {
      setTerminatingOthers(false);
    }
  };

  const verifiedFactor = factors.find((f) => f.status === "verified");
  const mfaOn = Boolean(verifiedFactor) || Boolean(enrolling);

  return (
    <div className="dash-shell">
      <ConsoleTopBar />

      <main className="dash-main container">
        <div className="console-breadcrumb">
          <Link href="/dashboard" className="breadcrumb-back">
            <ChevronLeft size={14} />
            <span>Back to Dashboard</span>
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Profile & Security</span>
        </div>

        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">IDENTITY & CREDENTIAL SECURITY</span>
            <h1>Profile & Security</h1>
            <p>Manage your account identity, password, and two-factor authentication.</p>
          </div>
        </div>

        <div className="console-grid-layout">
          {/* Left Column: Identity & Password */}
          <div className="console-col">
            <div className="console-card">
              <div className="card-top-header">
                <span className="card-kicker">ACCOUNT DETAILS</span>
              </div>

              <form onSubmit={handleSaveProfile} className="console-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="console-input"
                    required
                  />
                  {isGoogleAccount && (
                    <span className="input-hint">Google may resync this from your profile on next sign-in.</span>
                  )}
                </div>

                <div className="form-group">
                  <label>Email</label>
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
                      ? "Bound to Google Sign-In — change it in your Google account instead."
                      : "Changing this sends a confirmation link to the new address."}
                  </span>
                </div>

                <div className="form-group">
                  <label>Role & Responsibilities</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="console-input"
                    placeholder="e.g. Lead Systems Operator"
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="console-input"
                    placeholder="+1 555 000 0000"
                  />
                </div>

                <button type="submit" disabled={savingProfile} className="console-btn-primary">
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>

            <div className="console-card mt-6">
              <div className="card-top-header">
                <span className="card-kicker">PASSWORD</span>
              </div>

              <form onSubmit={handleChangePassword} className="console-form">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="console-input"
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="console-input"
                    required
                  />
                </div>
                <button type="submit" disabled={savingPassword} className="console-btn-primary">
                  {savingPassword ? "Updating..." : "Update Password"}
                </button>
                {isGoogleAccount && (
                  <span className="input-hint">
                    Setting a password lets you also sign in with email, in addition to Google.
                  </span>
                )}
              </form>
            </div>
          </div>

          {/* Right Column: 2FA & Sessions */}
          <div className="console-col">
            <div className="console-card">
              <div className="card-top-header">
                <span className="card-kicker">TWO-FACTOR AUTHENTICATION</span>
                <Shield size={16} className="text-teal" />
              </div>

              {loadingFactors ? (
                <p className="key-desc">Checking status…</p>
              ) : !mfaSupported ? (
                <div className="policy-info-box">
                  <div className="info-icon">
                    <ShieldOff size={16} />
                  </div>
                  <div>
                    <strong>2FA isn't enabled on this instance</strong>
                    <p>Ask an administrator to enable TOTP in the Supabase Auth settings.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="policy-toggle-row">
                    <div>
                      <h4>Two-Factor Authentication (2FA)</h4>
                      <p>
                        {verifiedFactor
                          ? "An authenticator app code is required at sign-in."
                          : "Require a time-based authenticator app code at sign-in."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleMfa}
                      disabled={mfaBusy}
                      className={`toggle-switch ${mfaOn ? "on" : "off"}`}
                      aria-pressed={mfaOn}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>

                  {enrolling && (
                    <form onSubmit={handleVerifyEnroll} className="console-form mt-4 pt-4 border-t border-white/5">
                      <p className="key-desc">Scan this with your authenticator app, then enter the 6-digit code.</p>
                      <div className="mfa-qr-box">
                        <img src={enrolling.qrCode} alt="2FA QR code" />
                      </div>
                      <div className="form-group">
                        <label>Can't scan it? Enter this key manually</label>
                        <p className="key-fingerprint mono">{enrolling.secret}</p>
                      </div>
                      <div className="form-group">
                        <label>6-digit code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value)}
                          className="console-input"
                          placeholder="000000"
                          maxLength={6}
                          required
                        />
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="submit" disabled={mfaBusy} className="console-btn-primary">
                          {mfaBusy ? "Verifying..." : "Verify & Enable"}
                        </button>
                        <button type="button" onClick={handleCancelEnroll} className="console-btn-danger">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>

            <div className="console-card mt-6">
              <div className="card-top-header">
                <span className="card-kicker">THIS ACCOUNT</span>
              </div>

              <div className="session-item">
                <div className="session-icon">
                  <Smartphone size={16} className="text-teal" />
                </div>
                <div className="session-details">
                  <div className="session-title">
                    <strong>{user?.email}</strong>
                    <span className="session-tag current">
                      {isGoogleAccount ? "Google" : "Email & Password"}
                    </span>
                  </div>
                  <span className="session-meta">
                    Account created {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                  </span>
                  <span className="session-time">
                    Last sign-in {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/5">
                <button
                  onClick={handleTerminateOthers}
                  disabled={terminatingOthers}
                  className="console-btn-danger w-full"
                >
                  <LogOut size={13} />
                  <span>{terminatingOthers ? "Signing out..." : "Sign Out Everywhere Else"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConsoleFooter />
    </div>
  );
}
