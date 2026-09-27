// Client profile: contact details, every project they have with us, money
// (from console-admin-finance), open invoices, their lead history, and
// support tickets across all their projects.

import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { consoleSchema } from "@/lib/supabase";
import { formatAmount, formatDate, formatRelative } from "@/lib/format";
import { CLIENT_TYPE_LABEL, ENGAGEMENT_LABEL, loadPortfolio } from "@/lib/admin";
import { moneyFor, statusFor } from "@/lib/adminClients";
import { formatTotals, loadFinanceOverview, TotalsValue } from "./Finance";
import { ClientStatusPill, loadTickets } from "./Clients";
import { ProjectStatusPill, ProgressCell } from "./Projects";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="app-meta-item">
      <span className="meta-k">{label}</span>
      <span className="meta-v">{children || <span className="admin-muted">—</span>}</span>
    </div>
  );
}

export default function AdminClientDetail(props: { clientKey?: string }) {
  const params = useParams<{ key: string }>();
  const key = props.clientKey ?? decodeURIComponent(params.key);
  const [, setLocation] = useLocation();

  const portfolio = useAsyncResource(() => loadPortfolio(), [], { errorMessage: "Failed to load client" });
  const finance = useAsyncResource(() => loadFinanceOverview(), []);
  const tickets = useAsyncResource(() => loadTickets(), []);
  const client = portfolio.data?.clients.find((c) => c.key === key) ?? null;

  const leads = useAsyncResource(
    async () => {
      if (!client?.email) return [];
      const { data, error } = await consoleSchema()
        .from("inquiries")
        .select("id,reference_id,status,created_at,source,budget_range,project_brief")
        // ilike for case-insensitive equality; escape its wildcards.
        .ilike("email", client.email.replace(/[%_\\]/g, "\\$&"))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    [client?.email],
    { enabled: Boolean(client) }
  );

  if (portfolio.loading) {
    return (
      <ConsoleLayout area="admin">
        <LoadingState label="Loading client…" />
      </ConsoleLayout>
    );
  }
  if (portfolio.error || !client) {
    return (
      <ConsoleLayout area="admin">
        <Link href="/admin/clients" className="overview-section-link mb-4"><ArrowLeft size={12} /> All clients</Link>
        {portfolio.error ? (
          <ErrorAlert message={`Couldn't load client: ${portfolio.error}`} onRetry={portfolio.retry} />
        ) : (
          <EmptyState title="Client not found" hint="The link may be out of date." />
        )}
      </ConsoleLayout>
    );
  }

  const money = moneyFor(client, finance.data);
  const ids = new Set(client.projects.map((p) => p.id));
  const projectName = new Map(client.projects.map((p) => [p.id, p.name]));
  const clientTickets = (tickets.data ?? []).filter((t) => t.workspaceId && ids.has(t.workspaceId));
  const openInvoices = (finance.data?.openInvoices ?? []).filter((i) => i.workspaceId && ids.has(i.workspaceId));
  const activeProjects = client.projects.filter((p) => p.status === "active" || p.status === "blocked").length;

  return (
    <ConsoleLayout area="admin" onRefresh={() => void portfolio.refresh()} isRefreshing={portfolio.refreshing}>
      <Link href="/admin/clients" className="overview-section-link"><ArrowLeft size={12} /> All clients</Link>
      <div className="dash-header-row mt-2">
        <div>
          <span className="dash-kicker">CLIENT</span>
          <h1>{client.name}</h1>
          <p>
            <ClientStatusPill status={statusFor(client, money)} />{" "}
            {[client.contactName, client.clientType ? CLIENT_TYPE_LABEL[client.clientType] : null, `since ${formatDate(client.since)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="cp-stats mb-6">
        <div>
          <small>PROJECTS</small>
          <strong>{client.projects.length}</strong>
          <em>{activeProjects} in progress</em>
        </div>
        <div>
          <small>MRR</small>
          <strong>{finance.loading ? "…" : <TotalsValue totals={money.mrr} />}</strong>
          <em>{finance.error ? "Billing unavailable" : `${formatTotals(money.collected)} collected`}</em>
        </div>
        <div>
          <small>OUTSTANDING</small>
          <strong className={Object.keys(money.overdue).length ? "warn" : undefined}>
            {finance.loading ? "…" : <TotalsValue totals={money.outstanding} />}
          </strong>
          <em>{openInvoices.length} unpaid invoice{openInvoices.length === 1 ? "" : "s"}</em>
        </div>
        <div>
          <small>OPEN TICKETS</small>
          <strong className={clientTickets.some((t) => t.status === "open") ? "warn" : undefined}>
            {tickets.loading ? "…" : tickets.error ? "!" : clientTickets.filter((t) => t.status === "open").length}
          </strong>
          <em>{clientTickets.length} total</em>
        </div>
      </div>

      <div className="cp-grid">
        <div className="cp-card">
          <div className="cp-card-head"><span>Contact</span></div>
          <div className="app-meta-list">
            <Field label="Name">{client.contactName}</Field>
            <Field label="Role">{client.role}</Field>
            <Field label="Email">{client.email && <a className="text-teal" href={`mailto:${client.email}`}>{client.email}</a>}</Field>
            <Field label="Website">
              {client.website && (
                <a className="text-teal" href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer">
                  {client.website}
                </a>
              )}
            </Field>
            <Field label="Type">{client.clientType ? CLIENT_TYPE_LABEL[client.clientType] ?? client.clientType : null}</Field>
          </div>
        </div>

        <div className="cp-card">
          <div className="cp-card-head"><span>Lead history</span></div>
          {leads.loading ? (
            <p className="cp-empty">Loading…</p>
          ) : (leads.data ?? []).length === 0 ? (
            <p className="cp-empty">No leads on file for this email.</p>
          ) : (
            (leads.data ?? []).map((l) => (
              <Link key={l.id} href={`/admin/leads?id=${l.id}`} className="cp-row">
                <span className="cp-name">
                  {l.reference_id}
                  <small>{[l.source.replace(/_/g, " "), l.budget_range, formatRelative(l.created_at)].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="cp-status">{l.status}</span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Projects</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Project</th><th>Status</th><th>Engagement</th><th>Milestones</th><th>Current milestone</th><th className="num">Open tasks</th><th>Started</th></tr>
            </thead>
            <tbody>
              {client.projects.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setLocation(`/admin/projects/${p.id}`)}>
                  <td><strong>{p.name}</strong></td>
                  <td><ProjectStatusPill status={p.status} /></td>
                  <td>{p.engagement_type ? ENGAGEMENT_LABEL[p.engagement_type] ?? p.engagement_type : p.tier_label ?? "—"}</td>
                  <td><ProgressCell completed={p.completed} total={p.milestones} /></td>
                  <td>{p.currentMilestone ?? <span className="admin-muted">—</span>}</td>
                  <td className="num">{p.tasksTotal ? p.tasksOpen : "—"}</td>
                  <td>{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Unpaid invoices</h2>
        {finance.loading ? (
          <div className="dash-empty-state">Loading…</div>
        ) : finance.error ? (
          <div className="dash-empty-state">Billing unavailable: {finance.error}</div>
        ) : openInvoices.length === 0 ? (
          <div className="dash-empty-state">Nothing outstanding.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Invoice</th><th>Project</th><th>Issued</th><th>Due</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {openInvoices.map((inv) => (
                  <tr key={inv.number}>
                    <td><strong>{inv.number}</strong></td>
                    <td>{inv.workspaceId ? projectName.get(inv.workspaceId) : "—"}</td>
                    <td>{formatDate(inv.issuingDate)}</td>
                    <td className={inv.overdue ? "admin-warn" : undefined}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                    <td className="num">{formatAmount(inv.totalAmountCents, inv.currency)}</td>
                    <td>
                      {inv.fileUrl && (
                        <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-teal" aria-label={`Open ${inv.number} PDF`}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Support tickets</h2>
        {tickets.loading ? (
          <div className="dash-empty-state">Loading…</div>
        ) : tickets.error ? (
          <div className="dash-empty-state">Support desk unavailable: {tickets.error}</div>
        ) : clientTickets.length === 0 ? (
          <div className="dash-empty-state">No tickets.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Project</th><th>Last message</th><th>Status</th><th>Last activity</th></tr></thead>
              <tbody>
                {clientTickets.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => setLocation(`/admin/support?id=${t.id}`)}>
                    <td>{t.workspaceId ? projectName.get(t.workspaceId) : "—"}</td>
                    <td className="wrap">{t.lastMessage ?? <span className="admin-muted">No messages</span>}</td>
                    <td className={t.status === "open" ? "admin-warn" : "admin-muted"}>{t.status}</td>
                    <td>{t.lastActivityAt ? formatRelative(t.lastActivityAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ConsoleLayout>
  );
}
