import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/lib/supabase";
import { MfaChallenge } from "./MfaChallenge";

// Signing in (password or OAuth) always hands back an aal1 session, even for
// an account with a verified TOTP factor -- Supabase doesn't gate that for
// you, the app has to check getAuthenticatorAssuranceLevel() and challenge
// it. Every entry point into the console goes through this one guard, so
// checking it here (rather than in Login.tsx) is what actually makes 2FA
// enforced instead of just enrollable.
//
// It's also where a brand-new account (no workspace yet) gets sent to
// onboarding, so no console page ever renders "no workspace assigned".
// /onboarding itself passes allowWithoutWorkspace to skip that redirect.
export function ProtectedRoute({
  children,
  allowWithoutWorkspace = false
}: {
  children: React.ReactNode;
  allowWithoutWorkspace?: boolean;
}) {
  const { session, loading } = useAuth();
  const { loaded: workspaceLoaded, needsOnboarding, error: workspaceError } = useWorkspace();
  const [, setLocation] = useLocation();
  const [aalChecked, setAalChecked] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      setLocation("/login");
    }
  }, [loading, session, setLocation]);

  useEffect(() => {
    if (!allowWithoutWorkspace && needsOnboarding) {
      setLocation("/onboarding");
    }
  }, [allowWithoutWorkspace, needsOnboarding, setLocation]);

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

  // Hold the page until the first workspace load settles, so a new account
  // doesn't see a flash of the empty console before the onboarding redirect.
  if ((!workspaceLoaded && !workspaceError) || (!allowWithoutWorkspace && needsOnboarding)) {
    return (
      <div className="auth-loading-shell">
        <span className="live-status-dot" />
        <span>Loading your workspace…</span>
      </div>
    );
  }

  return <>{children}</>;
}
