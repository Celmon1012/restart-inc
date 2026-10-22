// Admin landing page: one screen answering "what needs us today" across sales,
// delivery, support, and money. Each source loads independently, so a slow or
// failing one (Chatwoot, Lago) degrades its own tile instead of the page.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { Sparkline } from "@/components/Sparkline";
import { TrendBars } from "@/components/admin/TrendBars";
import { loadPortfolio, OPEN_STAGES, PIPELINE_STAGES } from "@/lib/admin";
import { OPEN as OPEN_REQUEST_STATUSES, STATUS_LABEL as REQUEST_STATUS_LABEL } from "@/components/ServerRequests";
import { formatNairaCompact, formatNumber, formatRelative } from "@/lib/format";
import { useAdminAttention } from "@/lib/adminAttention";
import { arpuNgn, buildWindow, countByBucket, paymentsByBucket, percentChange, RANGES, type RangeKey } from "@/lib/platformStats";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatTotals, TotalsValue } from "./Finance";

function Tile({ label, value, hint, warn, href, spark, delta }: { label: string; value: React.ReactNode; hint: string; warn?: boolean; href: string; spark?: number[]; delta?: number | null }) {
  return (
    <Link href={href} className="cp-stat-link">
      <small>{label}</small>
      <strong className={warn ? "warn" : undefined}>{value}</strong>
      <em>
        {delta !== undefined && delta !== null && delta !== 0 && <span className={`cp-delta ${delta > 0 ? "up" : "down"}`}>{delta > 0 ? "↑" : "↓"} {Math.abs(delta)}% </span>}
        {hint}
      </em>
      {spark && <Sparkline values={spark} width={60} height={24} className="cp-spark" />}
    </Link>
  );
}

export default function AdminOverview() {
  const { isOwner, canOps, canFinance } = useWorkspace();
  const { sources } = useAdminAttention();
  const { leads, delivery, support, finance } = sources;
  const portfolio = useAsyncResource(() => loadPortfolio(), [canOps], { enabled: canOps });

  const [range, setRange] = useState<RangeKey>("30d");
  const win = useMemo(() => buildWindow(range), [range]);
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;
  const leadsInRange = useMemo(() => countByBucket(win, (leads.data ?? []).map((l) => l.created_at)), [win, leads.data]);
  const projectsInRange = useMemo(() => countByBucket(win, (portfolio.data?.projects ?? []).map((p) => p.created_at)), [win, portfolio.data]);
  const payments = useMemo(() => paymentsByBucket(win, finance.data?.paymentsReceived ?? []), [win, finance.data]);
  const collectedDelta = percentChange(payments.current.NGN ?? 0, payments.previous.NGN ?? 0);
  const arpu = arpuNgn(finance.data);

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
      <div className="cp-head cp-head-row">
        <div>
          <span className="cp-eyebrow">RESTART ADMIN</span>
          <h1>Operations Overview</h1>
          <p>Pipeline, delivery, support, and revenue across every client.</p>
        </div>
        <div className="cp-range" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.key} type="button" className={`dash-tab-btn${range === r.key ? " active" : ""}`} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-stats">
        {isOwner && (
          <Tile
            label="OPEN LEADS"
            href="/admin/leads"
            value={dash(leads.loading, leads.error, openLeads.length)}
            hint={leads.error ? `Couldn't load leads: ${leads.error}` : `${newLeads.length} new · ${followUpsDue.length} follow-ups due`}
            warn={followUpsDue.length > 0}
          />
        )}
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
        {canFinance && (
          <Tile
            label="MRR"
            href="/finance"
            value={dash(finance.loading, finance.error, <TotalsValue totals={finance.data?.totals.mrr} />)}
            hint={finance.error ? "Couldn't reach billing" : `${formatTotals(finance.data?.totals.outstanding)} outstanding`}
            warn={Boolean(finance.data && Object.keys(finance.data.totals.overdue).length)}
          />
        )}
      </div>

      <div className="cp-stats admin-section">
        {canFinance && (
          <Tile
            label={`COLLECTED · ${rangeLabel.toUpperCase()}`}
            href="/finance/received"
            value={dash(finance.loading, finance.error, <TotalsValue totals={payments.current} />)}
            hint={`vs ${formatTotals(payments.previous)} before`}
            spark={payments.series}
            delta={collectedDelta}
          />
        )}
        {canFinance && (
          <Tile
            label="ACTIVE SUBSCRIPTIONS"
            href="/finance"
            value={dash(finance.loading, finance.error, formatNumber(finance.data?.activeSubscriptions))}
            hint={arpu === null ? `${finance.data?.billedClients ?? 0} billed clients` : `ARPU ${formatNairaCompact(arpu)} · ${finance.data?.billedClients} billed clients`}
          />
        )}
        {isOwner && (
          <Tile
            label={`NEW LEADS · ${rangeLabel.toUpperCase()}`}
            href="/admin/leads"
            value={dash(leads.loading, leads.error, leadsInRange.current)}
            hint={`vs ${leadsInRange.previous} before`}
            spark={leadsInRange.series}
            delta={percentChange(leadsInRange.current, leadsInRange.previous)}
          />
        )}
        {canOps && (
          <Tile
            label={`NEW PROJECTS · ${rangeLabel.toUpperCase()}`}
            href="/admin/projects"
            value={dash(portfolio.loading, portfolio.error, projectsInRange.current)}
            hint={`vs ${projectsInRange.previous} before${portfolio.data ? ` · ${portfolio.data.clients.length} clients` : ""}`}
            spark={projectsInRange.series}
            delta={percentChange(projectsInRange.current, projectsInRange.previous)}
          />
        )}
      </div>

      <div className="cp-grid cp-grid-even admin-section">
        {canFinance && (
          <div className="cp-card">
            <div className="cp-card-head">
              <span>Collected</span>
              <span className="cp-head-note">{rangeLabel} · naira{win.size === 7 ? " · weekly" : ""}</span>
            </div>
            {finance.error ? (
              <p className="cp-empty">Couldn't reach billing.</p>
            ) : finance.loading ? (
              <p className="cp-empty">Loading…</p>
            ) : (
              <TrendBars
                buckets={win.buckets}
                series={[{ name: "Collected", color: "var(--series-1)", values: payments.series }]}
                format={(v) => (v === 0 ? "₦0" : formatNairaCompact(v))}
                empty={`No naira payments in the last ${rangeLabel}.`}
              />
            )}
          </div>
        )}
        {(isOwner || canOps) && (
          <div className="cp-card">
            <div className="cp-card-head">
              <span>New leads and projects</span>
              <span className="cp-head-note">{rangeLabel}{win.size === 7 ? " · weekly" : ""}</span>
            </div>
            <TrendBars
              buckets={win.buckets}
              series={[
                ...(isOwner ? [{ name: "Leads", color: "var(--series-1)", values: leadsInRange.series }] : []),
                ...(canOps ? [{ name: "Projects", color: "var(--series-3)", values: projectsInRange.series }] : [])
              ]}
              format={formatNumber}
              whole
              empty={`No new leads or projects in the last ${rangeLabel}.`}
            />
          </div>
        )}
      </div>

      <div className="cp-grid admin-section">
        {isOwner && (
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
        )}

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

          {canFinance && (<>
          <div className="cp-card-head cp-sub">
            <span>Collections</span>
            <Link href="/finance" className="cp-head-link">Finance <ArrowRight size={11} /></Link>
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
          </>)}
        </div>
      </div>
    </ConsoleLayout>
  );
}
