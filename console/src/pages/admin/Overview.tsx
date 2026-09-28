// Admin landing page: one screen answering "what needs us today" across sales,
// delivery, support, and money. Each source loads independently, so a slow or
// failing one (Chatwoot, Lago) degrades its own tile instead of the page.

import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { OPEN_STAGES, PIPELINE_STAGES } from "@/lib/admin";
import { OPEN as OPEN_REQUEST_STATUSES, STATUS_LABEL as REQUEST_STATUS_LABEL } from "@/components/ServerRequests";
import { formatRelative } from "@/lib/format";
import { useAdminAttention } from "@/lib/adminAttention";
import { formatTotals, TotalsValue } from "./Finance";

// The full list lives on /admin/attention and in the top-bar bell.
const OVERVIEW_ATTENTION_LIMIT = 5;

function Tile({ label, value, hint, warn, href }: { label: string; value: React.ReactNode; hint: string; warn?: boolean; href: string }) {
  return (
    <Link href={href} className="cp-stat-link">
      <small>{label}</small>
      <strong className={warn ? "warn" : undefined}>{value}</strong>
      <em>{hint}</em>
    </Link>
  );
}

export default function AdminOverview() {
  const { sources, items: attention, loading: attentionLoading } = useAdminAttention();
  const { leads, delivery, support, finance } = sources;

  const leadRows = leads.data ?? [];
  const openLeads = leadRows.filter((l) => OPEN_STAGES.includes(l.status));
  const newLeads = leadRows.filter((l) => l.status === "new");
  const followUpsDue = openLeads.filter((l) => l.next_follow_up_at && new Date(l.next_follow_up_at) <= new Date());

  const d = delivery.data;
  const activeMilestones = d?.deliverables.filter((m) => m.status === "in-progress") ?? [];
  const blocked = d?.deliverables.filter((m) => m.status === "blocked") ?? [];
  const openTasks = d?.tasks.filter((t) => !t.is_done).length ?? 0;
  const openRequests = d?.requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status)) ?? [];

  const convs = support.data ?? [];
  const openTickets = convs.filter((c) => c.status === "open");

  const dash = (loading: boolean, error: string | null, v: React.ReactNode) => (loading ? "…" : error ? "!" : v);

  return (
    <ConsoleLayout area="admin">
      <div className="cp-head">
        <span className="cp-eyebrow">RESTART ADMIN</span>
        <h1>Operations Overview</h1>
        <p>Pipeline, delivery, support, and revenue across every client.</p>
      </div>

      <div className="cp-stats">
        <Tile
          label="OPEN LEADS"
          href="/admin/leads"
          value={dash(leads.loading, leads.error, openLeads.length)}
          hint={leads.error ? `Couldn't load leads: ${leads.error}` : `${newLeads.length} new · ${followUpsDue.length} follow-ups due`}
          warn={followUpsDue.length > 0}
        />
        <Tile
          label="ACTIVE MILESTONES"
          href="/admin/projects"
          value={dash(delivery.loading, delivery.error, activeMilestones.length)}
          hint={delivery.error ? "Couldn't load delivery" : `${blocked.length} blocked · ${openTasks} open tasks`}
          warn={blocked.length > 0}
        />
        <Tile
          label="OPEN TICKETS"
          href="/admin/support"
          value={dash(support.loading, support.error, openTickets.length)}
          hint={support.error ? "Couldn't reach support desk" : `${convs.length} conversations total`}
          warn={openTickets.length > 0}
        />
        <Tile
          label="MRR"
          href="/admin/finance"
          value={dash(finance.loading, finance.error, <TotalsValue totals={finance.data?.totals.mrr} />)}
          hint={finance.error ? "Couldn't reach billing" : `${formatTotals(finance.data?.totals.outstanding)} outstanding`}
          warn={Boolean(finance.data && Object.keys(finance.data.totals.overdue).length)}
        />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">
          Needs attention{attention.length > 0 && <span className="admin-muted"> · {attention.length}</span>}
        </h2>
        {attention.length === 0 ? (
          <div className="dash-empty-state">{attentionLoading ? "Checking…" : "Nothing needs attention right now."}</div>
        ) : (
          <>
            <div className="overview-attention-list">
              {attention.slice(0, OVERVIEW_ATTENTION_LIMIT).map((a) => (
                <Link href={a.href} key={a.key} className="overview-attention-row">
                  <span className="overview-attention-name">{a.text}</span>
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
            {attention.length > OVERVIEW_ATTENTION_LIMIT && (
              <Link href="/admin/attention" className="overview-section-link mt-2">
                View all {attention.length} <ArrowRight size={12} />
              </Link>
            )}
          </>
        )}
      </div>

      <div className="cp-grid admin-section">
        <div className="cp-card">
          <div className="cp-card-head">
            <span>Pipeline</span>
            <Link href="/admin/leads" className="cp-head-link">Open pipeline <ArrowRight size={11} /></Link>
          </div>
          {PIPELINE_STAGES.filter((s) => s !== "archived").map((s) => {
            const n = leadRows.filter((l) => l.status === s).length;
            const pct = leadRows.length ? (n / leadRows.length) * 100 : 0;
            return (
              <div key={s} className="cp-milestone" style={{ marginBottom: 8 }}>
                <span style={{ textTransform: "capitalize", minWidth: 90 }}>{s}</span>
                <div className="cp-progress" style={{ flex: 1, margin: "0 12px" }}><i style={{ width: `${pct}%` }} /></div>
                <span>{n}</span>
              </div>
            );
          })}
          <div className="cp-card-head cp-sub">
            <span>Latest leads</span>
          </div>
          {leadRows.slice(0, 4).map((l) => (
            <Link key={l.id} href={`/admin/leads?id=${l.id}`} className="cp-row">
              <span className="cp-name">
                {l.name}
                <small>{l.company ?? l.status} · {formatRelative(l.created_at)}</small>
              </span>
            </Link>
          ))}
          {leadRows.length === 0 && !leads.loading && <p className="cp-empty">No leads yet.</p>}
        </div>

        <div className="cp-card">
          <div className="cp-card-head">
            <span>Server requests</span>
            <Link href="/admin/requests" className="cp-head-link">Review queue <ArrowRight size={11} /></Link>
          </div>
          {openRequests.length === 0 ? (
            <p className="cp-empty">{delivery.loading ? "Loading…" : "No open requests."}</p>
          ) : (
            openRequests.slice(0, 5).map((r) => (
              <Link key={r.id} href="/admin/requests" className="cp-row">
                <span className="cp-name">
                  {r.workspace?.name ?? "Client"}
                  <small>{r.kind === "upgrade" ? "Upgrade" : "New server"} · {formatRelative(r.created_at)}</small>
                </span>
                <span className="cp-status">{REQUEST_STATUS_LABEL[r.status]}</span>
              </Link>
            ))
          )}

          <div className="cp-card-head cp-sub">
            <span>Collections</span>
            <Link href="/admin/finance" className="cp-head-link">Finance <ArrowRight size={11} /></Link>
          </div>
          {finance.error ? (
            <p className="cp-empty">Couldn't reach billing.</p>
          ) : (
            <>
              <div className="cp-milestone"><span>Collected this month</span><span>{finance.loading ? "…" : formatTotals(finance.data?.totals.collectedThisMonth)}</span></div>
              <div className="cp-milestone"><span>Outstanding</span><span>{finance.loading ? "…" : formatTotals(finance.data?.totals.outstanding)}</span></div>
              <div className="cp-milestone"><span>Overdue</span><span>{finance.loading ? "…" : formatTotals(finance.data?.totals.overdue)}</span></div>
            </>
          )}
        </div>
      </div>
    </ConsoleLayout>
  );
}
