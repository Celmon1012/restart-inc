import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      setLocation("/login");
    }
  }, [loading, session, setLocation]);

  if (loading) {
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

  return <>{children}</>;
}
