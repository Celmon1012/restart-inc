// Shared reads for the admin area. Every query here runs as the signed-in
// admin's own JWT -- console.is_admin() in RLS is what lets these return rows
// across every workspace, not anything in this file.

import { consoleSchema } from "./supabase";

export interface AdminWorkspace {
  id: string;
  name: string;
  tier_label: string | null;
  created_at: string;
  coolify_project_uuid: string | null;
  lago_customer_id: string | null;
  contact_email: string | null;
  client_type: string | null;
  engagement_type: string | null;
  qualification: string | null;
}

export async function loadAdminWorkspaces(): Promise<AdminWorkspace[]> {
  const { data, error } = await consoleSchema()
    .from("workspaces")
    .select(
      "id,name,tier_label,created_at,coolify_project_uuid,lago_customer_id,contact_email,client_type,engagement_type,qualification"
    )
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * id -> name for every workspace. Admin pages join client names in the browser
 * rather than with PostgREST resource embedding (workspace:workspaces(...)),
 * which failed in production against this self-hosted instance.
 */
export async function loadWorkspaceNames(): Promise<Map<string, string>> {
  const { data, error } = await consoleSchema().from("workspaces").select("id,name");
  if (error) throw error;
  return new Map((data ?? []).map((w) => [w.id as string, w.name as string]));
}

// Pipeline stages in funnel order, shared by the Leads board and the overview.
export const PIPELINE_STAGES = ["new", "contacted", "qualified", "won", "lost", "archived"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export const OPEN_STAGES: PipelineStage[] = ["new", "contacted", "qualified"];

/** ?key= from the current URL -- admin pages deep-link by query string. */
export function queryParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}
