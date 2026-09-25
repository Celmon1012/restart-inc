import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import type { Workspace, WorkspaceSummary } from "@/lib/resources";

export interface WorkspaceContextType {
  workspaces: WorkspaceSummary[];
  activeWorkspace: Workspace | null;
  // Mirrors auth.jwt() app_metadata.is_admin (see console.is_admin() in the
  // console_admin_visibility migration). console-data is the only place
  // that already computes this server-side, so it's threaded through here
  // rather than re-derived -- this is a UX-only gate for nav/routes, never
  // the real authorization boundary (RLS on console.* tables is).
  isAdmin: boolean;
  // A signed-in, non-admin account with no workspace membership at all --
  // routed to /onboarding to create one instead of an empty console.
  needsOnboarding: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  setActiveWorkspaceId: (id: string) => void;
  refresh: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (workspaceId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      // console-data reads the workspace_id off the query string, not the
      // POST body invoke() normally sends -- appending it to the function
      // name is the standard supabase-js way to do that.
      const path = workspaceId ? `console-data?workspace_id=${workspaceId}` : "console-data";
      const { data, error: fnError } = await supabase.functions.invoke(path);
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setWorkspaces(data?.workspaces ?? []);
      setActiveWorkspace(data?.active ?? null);
      setIsAdmin(Boolean(data?.isAdmin));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setIsAdmin(false);
      setLoaded(false);
      setLoading(false);
      return;
    }
    load(requestedId);
  }, [authLoading, session, requestedId, load]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isAdmin,
        needsOnboarding: loaded && !error && !isAdmin && workspaces.length === 0,
        loaded,
        loading,
        error,
        setActiveWorkspaceId: setRequestedId,
        refresh: () => load(requestedId),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
