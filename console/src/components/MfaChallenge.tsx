import { useEffect, useState } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TotpFactor {
  id: string;
  status: "verified" | "unverified";
}

// Shared step for anywhere a session needs to go from aal1 -> aal2: normal
// login, OAuth login, and the password-reset/invite link all hand back an
// aal1 session even when the account has a verified TOTP factor -- Supabase
// never elevates that for you, the app has to challenge it explicitly. This
// renders just the card contents (h1/subtitle/form), not a page shell, so
// callers can drop it into whatever container fits their context.
export function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingFactor, setLoadingFactor] = useState(true);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      const verified = (data?.totp as TotpFactor[] | undefined)?.find((f) => f.status === "verified");
      if (error || !verified) {
        // Caller only renders this when getAuthenticatorAssuranceLevel says
        // aal2 is required, so a missing verified factor here means the
        // factor was just removed elsewhere -- nothing to challenge.
        onVerified();
        return;
      }
      setFactorId(verified.id);
      setLoadingFactor(false);
    });
    // onVerified is a stable setter-wrapped callback from the caller; not
    // included to avoid re-running this lookup on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length < 6) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onVerified();
  };

  if (loadingFactor) {
    return (
      <>
        <h1>One moment…</h1>
        <p className="simple-login-subtitle">Checking security requirements.</p>
      </>
    );
  }

  return (
    <>
      <h1>Verify it's you</h1>
      <p className="simple-login-subtitle">Enter the 6-digit code from your authenticator app to continue.</p>

      {error && (
        <div className="login-error-banner">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="simple-login-form">
        <div className="simple-field-group">
          <label htmlFor="mfa-code">6-digit code</label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="simple-input"
            placeholder="000000"
            maxLength={6}
            required
          />
        </div>

        <button type="submit" className="simple-submit-btn" disabled={busy || code.length < 6}>
          {busy ? (
            <span>Verifying...</span>
          ) : (
            <>
              <span>Verify</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </>
  );
}
