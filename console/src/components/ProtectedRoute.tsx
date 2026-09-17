import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { MfaChallenge } from "./MfaChallenge";

// Signing in (password or OAuth) always hands back an aal1 session, even for
// an account with a verified TOTP factor -- Supabase doesn't gate that for
// you, the app has to check getAuthenticatorAssuranceLevel() and challenge
// it. Every entry point into the console goes through this one guard, so
// checking it here (rather than in Login.tsx) is what actually makes 2FA
// enforced instead of just enrollable.
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [aalChecked, setAalChecked] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      setLocation("/login");
    }
  }, [loading, session, setLocation]);

  useEffect(() => {
    if (!session) return;
    setAalChecked(false);
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      setNeedsMfa(!error && data.currentLevel !== data.nextLevel && data.nextLevel === "aal2");
      setAalChecked(true);
    });
  }, [session]);

  if (loading || (session && !aalChecked)) {
    return (
      <div className="auth-loading-shell">
        <span className="live-status-dot" />
        <span>Verifying session…</span>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (needsMfa) {
    return (
      <div className="simple-login-page">
        <div className="simple-login-card">
          <MfaChallenge onVerified={() => setNeedsMfa(false)} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
