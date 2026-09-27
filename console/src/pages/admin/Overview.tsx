// Admin landing page: one screen answering "what needs us today" across sales,
// delivery, support, and money. Each source loads independently, so a slow or
// failing one (Chatwoot, Lago) degrades its own tile instead of the page.

import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { consoleSchema } from "@/lib/supabase";
import { invokeFunction } from "@/lib/functions";
import { OPEN_STAGES, PIPELINE_STAGES, loadWorkspaceNames, type PipelineStage } from "@/lib/admin";
import { OPEN as OPEN_REQUEST_STATUSES, STATUS_LABEL as REQUEST_STATUS_LABEL, type Status as RequestStatus } from "@/components/ServerRequests";
import { formatDate, formatRelative } from "@/lib/format";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { loadFinanceOverview, formatTotals, TotalsValue } from "./Finance";

interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  status: PipelineStage;
  created_at: string;
  next_follow_up_at: string | null;
}

interface ConversationSummary {
  id: string;
  workspaceName: string | null;
  status: string;
  lastMessage: string | null;
  lastActivityAt: number | null;
}

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
  const leads = useAsyncResource<LeadRow[]>(async () => {
    const { data, error } = await consoleSchema()
      .from("inquiries")
      .select("id,name,company,status,created_at,next_follow_up_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, []);

  const delivery = useAsyncResource(async () => {
    const [deliverables, tasks, requests, names] = await Promise.all([
      consoleSchema().from("deliverables").select("id,title,status,due_at,workspace_id"),
      consoleSchema().from("deliverable_tasks").select("id,is_done"),
      consoleSchema().from("server_requests").select("id,status,kind,created_at,workspace_id").order("created_at", { ascending: false }),
      loadWorkspaceNames()
    ]);
    for (const r of [deliverables, tasks, requests]) if (r.error) throw r.error;
    const ws = (id: string) => (names.has(id) ? { id, name: names.get(id)! } : null);
    return {
      deliverables: (deliverables.data ?? []).map((d) => ({ ...d, workspace: ws(d.workspace_id) })) as Array<{
        id: string;
        title: string;
        status: string;
        due_at: string | null;
        workspace: { id: string; name: string } | null;
      }>,
      tasks: tasks.data ?? [],
      requests: (requests.data ?? []).map((r) => ({ ...r, workspace: ws(r.workspace_id) })) as Array<{
        id: string;
        status: RequestStatus;
        kind: string;
        created_at: string;
        workspace: { name: string } | null;
      }>
    };
  }, []);

  const support = useAsyncResource(
    async () => (await invokeFunction<{ conversations: ConversationSummary[] }>("console-support-data")).conversations ?? [],
    []
  );
  const finance = useAsyncResource(() => loadFinanceOverview(), []);

  const leadRows = leads.data ?? [];
  const openLeads = leadRows.filter((l) => OPEN_STAGES.includes(l.status));
  const newLeads = leadRows.filter((l) => l.status === "new");
  const followUpsDue = openLeads.filter((l) => l.next_follow_up_at && new Date(l.next_follow_up_at) <= new Date());

  const d = delivery.data;
  const activeMilestones = d?.deliverables.filter((m) => m.status === "in-progress") ?? [];
  const blocked = d?.deliverables.filter((m) => m.status === "blocked") ?? [];
  const overdueMilestones =
    d?.deliverables.filter((m) => m.status !== "completed" && m.due_at && new Date(m.due_at) < new Date()) ?? [];
  const openTasks = d?.tasks.filter((t) => !t.is_done).length ?? 0;
  const openRequests = d?.requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status)) ?? [];
  const pendingReview = openRequests.filter((r) => r.status === "pending_review");

  const convs = support.data ?? [];
  const openTickets = convs.filter((c) => c.status === "open");

  const dash = (loading: boolean, error: string | null, v: React.ReactNode) => (loading ? "…" : error ? "!" : v);

  const attention = [
    ...blocked.map((m) => ({ key: `b-${m.id}`, text: `${m.workspace?.name ?? "Client"}: “${m.title}” is blocked`, href: `/admin/projects/${m.workspace?.id ?? ""}` })),
    ...overdueMilestones
      .filter((m) => m.status !== "blocked")
      .map((m) => ({ key: `o-${m.id}`, text: `${m.workspace?.name ?? "Client"}: “${m.title}” was due ${formatDate(m.due_at)}`, href: `/admin/projects/${m.workspace?.id ?? ""}` })),
    ...pendingReview.map((r) => ({ key: `r-${r.id}`, text: `${r.workspace?.name ?? "Client"} requested ${r.kind === "upgrade" ? "a server upgrade" : "a new server"} ${formatRelative(r.created_at)}`, href: "/admin/requests" })),
    ...followUpsDue.map((l) => ({ key: `l-${l.id}`, text: `Follow-up due: ${l.name}${l.company ? ` (${l.company})` : ""}`, href: `/admin/leads?id=${l.id}` })),
    ...openTickets.map((c) => ({ key: `t-${c.id}`, text: `Open ticket from ${c.workspaceName ?? "a client"}: ${c.lastMessage ?? "no message"}`, href: `/admin/support?id=${c.id}` })),
    ...(finance.data?.openInvoices.filter((i) => i.overdue) ?? []).map((i) => ({ key: `i-${i.number}`, text: `Invoice ${i.number} (${i.client}) is overdue`, href: "/admin/finance" }))
  ];

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
          hint={leads.error ? "Couldn't load leads" : `${newLeads.length} new · ${followUpsDue.length} follow-ups due`}
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
        <h2 className="admin-section-title">Needs attention</h2>
        {attention.length === 0 ? (
          <div className="dash-empty-state">
            {leads.loading || delivery.loading || support.loading || finance.loading ? "Checking…" : "Nothing needs attention right now."}
          </div>
        ) : (
          <div className="overview-attention-list">
            {attention.slice(0, 12).map((a) => (
              <Link href={a.href} key={a.key} className="overview-attention-row">
                <span className="overview-attention-name">{a.text}</span>
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
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
