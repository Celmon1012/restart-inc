// Every client workspace with its engagement shape and delivery progress, and
// jump-off links into Projects. Direct RLS reads as the admin.

import { useState } from "react";
import { useLocation } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { consoleSchema } from "@/lib/supabase";
import { loadAdminWorkspaces, type AdminWorkspace } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { Search } from "lucide-react";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";

interface ClientRow extends AdminWorkspace {
  milestones: number;
  completed: number;
  blocked: number;
  current: string | null;
}

const ENGAGEMENT_LABEL: Record<string, string> = {
  build: "Build",
  scale: "Fix / scale",
  operate: "Operate",
  ai: "AI",
  advisory: "Advisory",
  exploring: "Exploring"
};

export default function AdminClients() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<ClientRow[]>(
    async (signal) => {
      const [workspaces, deliverablesRes] = await Promise.all([
        loadAdminWorkspaces(),
        consoleSchema().from("deliverables").select("workspace_id,title,status,sort_order").order("sort_order")
      ]);
      if (signal.aborted) return [];
      if (deliverablesRes.error) throw deliverablesRes.error;
      const rows = deliverablesRes.data ?? [];
      return workspaces.map((w) => {
        const mine = rows.filter((d) => d.workspace_id === w.id);
        return {
          ...w,
          milestones: mine.length,
          completed: mine.filter((d) => d.status === "completed").length,
          blocked: mine.filter((d) => d.status === "blocked").length,
          current: mine.find((d) => d.status === "in-progress")?.title ?? null
        };
      });
    },
    [],
    { errorMessage: "Failed to load clients" }
  );
  const clients = data ?? [];
  const needle = search.trim().toLowerCase();
  const visible = clients.filter((c) => !needle || [c.name, c.contact_email, c.tier_label].some((v) => v?.toLowerCase().includes(needle)));

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading clients" : error ? `Could not load clients: ${error}` : `${visible.length} clients shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">ADMIN</span>
          <h1>Clients</h1>
          <p>Every client workspace, what they engaged us for, and where delivery stands.</p>
        </div>
      </div>

      {error && <ErrorAlert message={`Couldn't load clients: ${error}`} onRetry={retry} />}

      <div className="admin-toolbar">
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search clients…" aria-label="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading clients…" />
      ) : clients.length === 0 ? (
        <EmptyState title="No clients yet" hint="Client workspaces appear here once they're created through onboarding or by an admin." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Engagement</th>
                <th>Qualification</th>
                <th>Delivery</th>
                <th>Current milestone</th>
                <th>Infra</th>
                <th>Billing</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => setLocation(`/admin/projects?workspace=${c.id}`)}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.contact_email && <div className="admin-muted">{c.contact_email}</div>}
                  </td>
                  <td>{c.engagement_type ? ENGAGEMENT_LABEL[c.engagement_type] ?? c.engagement_type : c.tier_label ?? "—"}</td>
                  <td>{c.qualification ?? "—"}</td>
                  <td className={c.blocked ? "admin-warn" : undefined}>
                    {c.milestones === 0 ? "—" : `${c.completed}/${c.milestones}`}
                    {c.blocked ? ` · ${c.blocked} blocked` : ""}
                  </td>
                  <td>{c.current ?? <span className="admin-muted">—</span>}</td>
                  <td className={c.coolify_project_uuid ? "admin-ok" : "admin-muted"}>{c.coolify_project_uuid ? "Linked" : "Pending"}</td>
                  <td className={c.lago_customer_id ? "admin-ok" : "admin-muted"}>{c.lago_customer_id ? "Linked" : "Not set up"}</td>
                  <td>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ConsoleLayout>
  );
}
