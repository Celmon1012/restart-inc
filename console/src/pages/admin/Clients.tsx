// Every client -- the organisation or person behind one or more projects --
// with contact details, project count, delivery, money, and open tickets.
// Clicking a row opens the client profile (ClientDetail).

import { useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { invokeFunction } from "@/lib/functions";
import { formatDate } from "@/lib/format";
import { CLIENT_TYPE_LABEL, loadPortfolio } from "@/lib/admin";
import { CLIENT_STATUS_LABEL, moneyFor, statusFor, type ClientStatus } from "@/lib/adminClients";
import { formatTotals, loadFinanceOverview } from "./Finance";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AddClient } from "@/components/admin/AddClient";

const STATUS_TONE: Record<ClientStatus, string> = { active: "", scoping: "warning", idle: "neutral" };

export function ClientStatusPill({ status }: { status: ClientStatus }) {
  return <span className={`system-healthy-pill ${STATUS_TONE[status]}`}>{CLIENT_STATUS_LABEL[status].toUpperCase()}</span>;
}

export const loadTickets = async () =>
  (await invokeFunction<{ conversations: Array<{ id: string; workspaceId?: string; status: string; lastMessage: string | null; lastActivityAt: number | null }> }>(
    "console-support-data"
  )).conversations ?? [];

export default function AdminClients() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ClientStatus>("all");

  const portfolio = useAsyncResource(() => loadPortfolio(), [], { errorMessage: "Failed to load clients" });
  // Money and tickets are enrichment from external systems; the list renders
  // without them and fills in when they arrive.
  const { canFinance } = useWorkspace();
  const finance = useAsyncResource(() => loadFinanceOverview(), [], { enabled: canFinance });
  const tickets = useAsyncResource(() => loadTickets(), []);

  const rows = (portfolio.data?.clients ?? []).map((c) => {
    const money = moneyFor(c, finance.data);
    const ids = new Set(c.projects.map((p) => p.id));
    return {
      client: c,
      money,
      status: statusFor(c, money),
      openTickets: (tickets.data ?? []).filter((t) => t.workspaceId && ids.has(t.workspaceId) && t.status === "open").length
    };
  });
  const needle = search.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (!needle || [r.client.name, r.client.contactName, r.client.email, ...r.client.projects.map((p) => p.name)].some((v) => v?.toLowerCase().includes(needle)))
  );
  const count = (s: ClientStatus) => rows.filter((r) => r.status === s).length;
  const money = (v: string) => (finance.loading ? "…" : finance.error ? "—" : v);

  return (
    <ConsoleLayout area="admin" onRefresh={() => void portfolio.refresh()} isRefreshing={portfolio.refreshing}>
      <StatusRegion message={portfolio.loading ? "Loading clients" : portfolio.error ? `Could not load clients: ${portfolio.error}` : `${visible.length} clients shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">ADMIN</span>
          <h1>Clients</h1>
          <p>Who we work for, their projects, what they're worth, and what they're waiting on.</p>
        </div>
        <AddClient />
      </div>

      {portfolio.error && <ErrorAlert message={`Couldn't load clients: ${portfolio.error}`} onRetry={portfolio.retry} />}
      {finance.error && <p className="admin-muted mb-4">Billing figures unavailable: {finance.error}</p>}

      <div className="admin-toolbar">
        {(["all", "active", "scoping", "idle"] as const).map((f) => (
          <button key={f} className={`dash-tab-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? `All (${rows.length})` : `${CLIENT_STATUS_LABEL[f]} (${count(f)})`}
          </button>
        ))}
        <span className="admin-toolbar-spacer" />
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search clients, contacts, projects…" aria-label="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {portfolio.loading ? (
        <LoadingState label="Loading clients…" />
      ) : portfolio.error ? null : rows.length === 0 ? (
        <EmptyState title="No clients yet" hint="Clients appear once they finish onboarding in the console." />
      ) : visible.length === 0 ? (
        <div className="dash-empty-state">No clients match this view.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Status</th>
                <th className="num">Projects</th>
                <th className="num">MRR</th>
                <th className="num">Outstanding</th>
                <th className="num">Open tickets</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ client: c, money: m, status, openTickets }) => {
                const active = c.projects.filter((p) => p.status === "active" || p.status === "blocked").length;
                return (
                  <tr key={c.key} className="clickable" onClick={() => setLocation(`/admin/clients/${encodeURIComponent(c.key)}`)}>
                    <td>
                      <strong>{c.name}</strong>
                      <div className="admin-muted">{c.clientType ? CLIENT_TYPE_LABEL[c.clientType] ?? c.clientType : "—"}</div>
                    </td>
                    <td>
                      {c.contactName ?? <span className="admin-muted">—</span>}
                      <div className="admin-muted">{c.email ?? "—"}</div>
                    </td>
                    <td><ClientStatusPill status={status} /></td>
                    <td className="num">
                      {c.projects.length}
                      {active > 0 && <div className="admin-muted">{active} active</div>}
                    </td>
                    <td className="num">{money(formatTotals(m.mrr))}</td>
                    <td className={`num ${Object.keys(m.overdue).length ? "admin-warn" : ""}`}>{money(formatTotals(m.outstanding))}</td>
                    <td className={`num ${openTickets ? "admin-warn" : ""}`}>{tickets.loading ? "…" : tickets.error ? "—" : openTickets}</td>
                    <td>{formatDate(c.since)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ConsoleLayout>
  );
}
