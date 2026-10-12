// Staff who aren't owners (Ops, Finance) must have two-factor sign-in set up before they can use
// the staff areas: those areas hold client work and company finances. Owners are not blocked here
// (they already sign in with the admin account); turn it on for yourself under Profile & security.
// A UX gate: someone without a second factor is shown how to add one instead of the page.

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function StaffMfaGate({ children }: { children: ReactNode }) {
  const { isOwner } = useWorkspace();
  const [state, setState] = useState<"checking" | "ok" | "missing">(isOwner ? "ok" : "checking");

  useEffect(() => {
    if (isOwner) {
      setState("ok");
      return;
    }
    let cancelled = false;
    setState("checking");
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (cancelled) return;
      const hasVerified = (data?.totp ?? []).some((f) => f.status === "verified");
      // If the check itself fails, keep the door closed rather than guess.
      setState(!error && hasVerified ? "ok" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  if (state === "ok") return <>{children}</>;
  if (state === "checking") {
    return (
      <div className="auth-loading-shell">
        <span className="live-status-dot" />
        <span>Checking your sign-in security…</span>
      </div>
    );
  }
  return (
    <div className="simple-login-page">
      <div className="simple-login-card" style={{ textAlign: "center" }}>
        <ShieldCheck size={28} style={{ color: "var(--teal)", marginBottom: 12 }} />
        <h1 style={{ fontSize: "1.25rem", marginBottom: 8 }}>Set up two-factor sign-in</h1>
        <p className="admin-muted" style={{ marginBottom: 16 }}>
          This area holds client work and company finances, so team accounts need a second sign-in step. It takes a minute with an authenticator app.
        </p>
        <Link href="/profile" className="dash-tab-btn active">Set it up</Link>
      </div>
    </div>
  );
}
