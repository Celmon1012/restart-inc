// Review queue for console.server_requests across every client. Clients raise
// and pay for these on their Systems tab; engineers triage them here with the
// same RequestRow editor (status, Lago invoice, note to client).

import { useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { RequestRow, OPEN, STATUS_LABEL, type ServerRequest, type Status } from "@/components/ServerRequests";
import { consoleSchema } from "@/lib/supabase";
import { loadWorkspaceNames } from "@/lib/admin";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";

type Row = ServerRequest & { workspace: { id: string; name: string } | null };

export default function AdminServerRequests() {
  const [filter, setFilter] = useState<"open" | "all" | Status>("open");

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<Row[]>(
    async (signal) => {
      const [requestsRes, names] = await Promise.all([
        consoleSchema().from("server_requests").select("*").order("created_at", { ascending: false }).limit(200),
        loadWorkspaceNames()
      ]);
      if (signal.aborted) return [];
      if (requestsRes.error) throw requestsRes.error;
      return ((requestsRes.data ?? []) as Array<ServerRequest & { workspace_id: string }>).map((r) => ({
        ...r,
        workspace: names.has(r.workspace_id) ? { id: r.workspace_id, name: names.get(r.workspace_id)! } : null
      }));
    },
    [],
    { errorMessage: "Failed to load server requests" }
  );
  const requests = data ?? [];
  const visible = requests.filter((r) => (filter === "all" ? true : filter === "open" ? OPEN.includes(r.status) : r.status === filter));
  const count = (s: Status) => requests.filter((r) => r.status === s).length;

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading server requests" : error ? `Could not load server requests: ${error}` : `${visible.length} requests shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Server Requests</h1>
          <p>Capacity requests from every client: review, quote, and track them through to done.</p>
        </div>
      </div>

      {error && <ErrorAlert message={`Couldn't load server requests: ${error}`} onRetry={retry} />}

      <div className="dash-tabs-bar">
        <button className={`dash-tab-btn ${filter === "open" ? "active" : ""}`} onClick={() => setFilter("open")}>
          Open ({requests.filter((r) => OPEN.includes(r.status)).length})
        </button>
        {(["pending_review", "awaiting_payment", "paid", "in_progress", "done"] as Status[]).map((s) => (
          <button key={s} className={`dash-tab-btn ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]} ({count(s)})
          </button>
        ))}
        <button className={`dash-tab-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          All ({requests.length})
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading server requests…" />
      ) : error ? null : requests.length === 0 ? (
        <EmptyState title="No server requests yet" hint="When a client asks for an upgrade or another server from their Systems tab, it lands here for review." />
      ) : visible.length === 0 ? (
        <div className="dash-empty-state">No requests in this view.</div>
      ) : (
        <div className="sr-list">
          {visible.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              reviewable
              clientName={r.workspace?.name}
              paymentUrl={undefined}
              onChanged={() => void refresh()}
            />
          ))}
        </div>
      )}
    </ConsoleLayout>
  );
}
