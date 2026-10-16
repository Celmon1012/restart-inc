// Review queue for console.server_requests across every client. Clients raise and pay for these
// on their Systems tab; engineers triage them here: one table, a row menu, and the same review
// editor (status, Lago invoice, note to client) opening under the row.

import { Fragment, useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { RowMenu } from "@/components/admin/RowMenu";
import { OPEN, RequestReviewForm, STATUS_LABEL, STATUS_TONE, requestSummary, type ServerRequest, type Status } from "@/components/ServerRequests";
import { consoleSchema } from "@/lib/supabase";
import { loadWorkspaceNames } from "@/lib/admin";
import { formatRelative } from "@/lib/format";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";

type Row = ServerRequest & { workspace: { id: string; name: string } | null };

const TONE_CLASS: Record<string, string> = { healthy: "", warning: "warning", down: "down", muted: "" };

export default function AdminServerRequests() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"open" | "all" | Status>("open");
  const [client, setClient] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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
  const clients = Array.from(new Map(requests.filter((r) => r.workspace).map((r) => [r.workspace!.id, r.workspace!.name])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const needle = search.trim().toLowerCase();
  const visible = requests.filter(
    (r) =>
      (filter === "all" ? true : filter === "open" ? OPEN.includes(r.status) : r.status === filter) &&
      (client === "all" || r.workspace?.id === client) &&
      (!needle || [r.workspace?.name, requestSummary(r), r.reason, r.engineer_note].some((v) => v?.toLowerCase().includes(needle)))
  );
  const openCount = requests.filter((r) => OPEN.includes(r.status)).length;
  const awaitingReview = requests.filter((r) => r.status === "pending_review").length;

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

      {!loading && requests.length > 0 && (
        <div className="task-strip auto">
          {(["pending_review", "awaiting_payment", "paid", "in_progress", "done"] as Status[]).map((s) => (
            <button key={s} type="button" className={`task-strip-tile sr-${s} ${filter === s ? "active" : ""}`} onClick={() => setFilter(filter === s ? "open" : s)} aria-pressed={filter === s}>
              <span><strong>{requests.filter((r) => r.status === s).length}</strong> {STATUS_LABEL[s]}</span>
              <em>{s === "pending_review" ? (awaitingReview ? "an engineer needs to look" : "nothing waiting") : s === "awaiting_payment" ? "quoted, not yet paid" : `of ${requests.length} requests`}</em>
            </button>
          ))}
        </div>
      )}

      <div className="admin-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Status">
          <option value="open">Open ({openCount})</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          <option value="all">All statuses</option>
        </select>
        <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
          <option value="all">All clients</option>
          {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <span className="admin-toolbar-spacer" />
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search clients, specs, notes…" aria-label="Search requests" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading server requests…" />
      ) : error ? null : requests.length === 0 ? (
        <EmptyState title="No server requests yet" hint="When a client asks for an upgrade or another server from their Systems tab, it lands here for review." />
      ) : visible.length === 0 ? (
        <div className="dash-empty-state">No requests in this view.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table tasks-compact">
            <thead>
              <tr>
                <th>Client</th>
                <th>Request</th>
                <th>Status</th>
                <th>Raised</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <Fragment key={r.id}>
                  <tr className={r.status === "pending_review" ? "clickable" : undefined} onClick={() => r.status === "pending_review" && setReviewingId(reviewingId === r.id ? null : r.id)}>
                    <td><strong>{r.workspace?.name ?? "—"}</strong></td>
                    <td className="task-name" title={[requestSummary(r), r.reason && `“${r.reason}”`, r.engineer_note && `Engineer: ${r.engineer_note}`].filter(Boolean).join(" · ")}>
                      <strong>{r.kind === "upgrade" ? "Upgrade server" : "Add a server"}</strong>
                      <span className="admin-muted"> · {requestSummary(r)}{r.reason ? ` · “${r.reason}”` : ""}{r.engineer_note ? ` · Engineer: ${r.engineer_note}` : ""}</span>
                    </td>
                    <td><span className={`cp-status ${TONE_CLASS[STATUS_TONE[r.status]]}`}>{STATUS_LABEL[r.status].toUpperCase()}</span></td>
                    <td className="admin-muted">{formatRelative(r.created_at)}</td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        label={`Actions for ${r.workspace?.name ?? "request"}`}
                        items={[
                          { label: "Review", onClick: () => setReviewingId(reviewingId === r.id ? null : r.id) },
                          ...(r.workspace ? [{ label: "Open project", onClick: () => setLocation(`/admin/projects/${r.workspace!.id}`) }] : [])
                        ]}
                      />
                    </td>
                  </tr>
                  {reviewingId === r.id && (
                    <tr>
                      <td colSpan={5}>
                        <RequestReviewForm request={r} onCancel={() => setReviewingId(null)} onSaved={() => { setReviewingId(null); void refresh(); }} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="admin-muted">{visible.length} of {requests.length} requests · {openCount} open</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ConsoleLayout>
  );
}
