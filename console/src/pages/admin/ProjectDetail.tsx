// One project, everything about it: brief and engagement details, the linked
// lead, milestones (MilestoneEditor), server requests, support tickets, and
// billing. Each tab loads on its own so a slow external system (Chatwoot,
// Lago) only affects its tab.

import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { MilestoneEditor } from "@/components/admin/MilestoneEditor";
import { InfraCard } from "@/components/admin/InfraCard";
import { RequestRow, type ServerRequest } from "@/components/ServerRequests";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { consoleSchema } from "@/lib/supabase";
import { invokeFunction } from "@/lib/functions";
import { formatAmount, formatDate, formatRelative } from "@/lib/format";
import { CLIENT_TYPE_LABEL, ENGAGEMENT_LABEL, loadPortfolio, queryParam } from "@/lib/admin";
import { ProjectStatusPill, ProgressCell } from "./Projects";
import { ProjectActions } from "@/components/admin/ProjectActions";
import { LinkBilling } from "@/components/admin/LinkBilling";

type Tab = "overview" | "milestones" | "requests" | "support" | "billing";

interface Conversation {
  id: string;
  workspaceId?: string;
  status: string;
  lastMessage: string | null;
  lastActivityAt: number | null;
}

interface Billing {
  billingConfigured: boolean;
  customer?: { name: string | null; paymentProvider: string | null } | null;
  subscriptions?: Array<{ planCode: string; planName: string; status: string; amountCents: number | null; currency: string | null; interval: string | null; startedAt: string | null }>;
  invoices?: Array<{ number: string; issuingDate: string; paymentStatus: string; totalAmountCents: number; currency: string; fileUrl: string | null }>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="app-meta-item">
      <span className="meta-k">{label}</span>
      <span className="meta-v">{children || <span className="admin-muted">—</span>}</span>
    </div>
  );
}

export default function AdminProjectDetail(props: { id?: string }) {
  const params = useParams<{ id: string }>();
  const id = props.id ?? params.id;
  const [tab, setTab] = useState<Tab>(() => {
    const t = queryParam("tab");
    return t === "milestones" || t === "requests" || t === "support" || t === "billing" ? t : "overview";
  });

  const portfolio = useAsyncResource(() => loadPortfolio({ includeArchived: true }), [id], { errorMessage: "Failed to load project" });
  const project = portfolio.data?.projects.find((p) => p.id === id) ?? null;
  const client = portfolio.data?.clients.find((c) => c.projects.some((p) => p.id === id)) ?? null;

  const leads = useAsyncResource(
    async () => {
      if (!project?.contact_email) return [];
      const { data, error } = await consoleSchema()
        .from("inquiries")
        .select("id,reference_id,name,company,status,created_at,source")
        // ilike for case-insensitive equality; escape its wildcards.
        .ilike("email", project.contact_email.replace(/[%_\\]/g, "\\$&"))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    [project?.contact_email],
    { enabled: Boolean(project) }
  );

  const requests = useAsyncResource<ServerRequest[]>(
    async () => {
      const { data, error } = await consoleSchema().from("server_requests").select("*").eq("workspace_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServerRequest[];
    },
    [id],
    { enabled: tab === "requests" }
  );

  const support = useAsyncResource(
    async () => {
      const res = await invokeFunction<{ conversations: Conversation[] }>("console-support-data");
      return (res.conversations ?? []).filter((c) => c.workspaceId === id);
    },
    [id],
    { enabled: tab === "support" || tab === "overview" }
  );

  const billing = useAsyncResource<Billing>(
    () => invokeFunction<Billing>("console-billing", { query: `workspace_id=${id}` }),
    [id],
    { enabled: tab === "billing" }
  );

  if (portfolio.loading) {
    return (
      <ConsoleLayout area="admin">
        <LoadingState label="Loading project…" />
      </ConsoleLayout>
    );
  }
  if (portfolio.error || !project) {
    return (
      <ConsoleLayout area="admin">
        <Link href="/admin/projects" className="overview-section-link mb-4"><ArrowLeft size={12} /> All projects</Link>
        {portfolio.error ? (
          <ErrorAlert message={`Couldn't load project: ${portfolio.error}`} onRetry={portfolio.retry} />
        ) : (
          <EmptyState title="Project not found" hint="It may have been deleted, or the link is wrong." />
        )}
      </ConsoleLayout>
    );
  }

  const ob = project.onboarding ?? {};
  const openTickets = (support.data ?? []).filter((c) => c.status === "open").length;
  const TABS: Array<{ key: Tab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "milestones", label: `Milestones (${project.milestones})` },
    { key: "requests", label: `Server requests${project.openRequests ? ` (${project.openRequests} open)` : ""}` },
    { key: "support", label: "Support" },
    { key: "billing", label: "Billing" }
  ];

  return (
    <ConsoleLayout area="admin" onRefresh={() => void portfolio.refresh()} isRefreshing={portfolio.refreshing}>
      <Link href="/admin/projects" className="overview-section-link"><ArrowLeft size={12} /> All projects</Link>
      <div className="dash-header-row mt-2">
        <div>
          <span className="dash-kicker">
            {client ? <Link href={`/admin/clients/${encodeURIComponent(client.key)}`}>{client.name}</Link> : "PROJECT"}
          </span>
          <h1>{project.name}</h1>
          <p>
            <ProjectStatusPill status={project.status} />{" "}
            {project.engagement_type ? ENGAGEMENT_LABEL[project.engagement_type] ?? project.engagement_type : project.tier_label ?? ""}
            {project.currentMilestone ? ` · Now: ${project.currentMilestone}` : ""}
            {project.archived_at ? " · Archived" : ""}
          </p>
        </div>
        <ProjectActions id={project.id} name={project.name} archivedAt={project.archived_at} onChanged={portfolio.refresh} />
      </div>

      <div className="cp-stats mb-6">
        <div>
          <small>MILESTONES</small>
          <strong>{project.milestones ? <>{project.completed}<span>/{project.milestones}</span></> : "—"}</strong>
          <em>{project.blocked ? `${project.blocked} blocked` : project.currentMilestone ?? "None in progress"}</em>
        </div>
        <div>
          <small>OPEN TASKS</small>
          <strong>{project.tasksOpen}</strong>
          <em>of {project.tasksTotal} checklist items</em>
        </div>
        <div>
          <small>SERVER REQUESTS</small>
          <strong className={project.openRequests ? "warn" : undefined}>{project.openRequests}</strong>
          <em>open</em>
        </div>
        <div>
          <small>OPEN TICKETS</small>
          <strong className={openTickets ? "warn" : undefined}>{support.loading ? "…" : support.error ? "!" : openTickets}</strong>
          <em>{support.error ? "Couldn't reach support desk" : `${support.data?.length ?? 0} total`}</em>
        </div>
      </div>

      <div className="dash-tabs-bar">
        {TABS.map((t) => (
          <button key={t.key} className={`dash-tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="cp-grid">
          <div className="cp-card">
            <div className="cp-card-head"><span>Engagement</span></div>
            <div className="app-meta-list">
              <Field label="Engagement">{project.engagement_type ? ENGAGEMENT_LABEL[project.engagement_type] : project.tier_label}</Field>
              <Field label="Qualification">{project.qualification}</Field>
              <Field label="Budget">{ob.budget}</Field>
              <Field label="Timeline">{ob.timeline}</Field>
              <Field label="Milestone progress"><ProgressCell completed={project.completed} total={project.milestones} /></Field>
              <Field label="Next due">{project.nextDue ? formatDate(project.nextDue) : null}</Field>
              <Field label="Started">{formatDate(project.created_at)}</Field>
            </div>
            {ob.brief && (
              <>
                <div className="cp-card-head cp-sub"><span>Brief</span></div>
                <p className="lead-brief">{ob.brief}</p>
              </>
            )}
          </div>

          <div className="cp-card">
            <div className="cp-card-head">
              <span>Client</span>
              {client && (
                <Link href={`/admin/clients/${encodeURIComponent(client.key)}`} className="cp-head-link">
                  Client profile <ArrowRight size={11} />
                </Link>
              )}
            </div>
            <div className="app-meta-list">
              <Field label="Organisation">{client?.name}</Field>
              <Field label="Contact">{client?.contactName}{client?.role ? ` · ${client.role}` : ""}</Field>
              <Field label="Email">{project.contact_email && <a className="text-teal" href={`mailto:${project.contact_email}`}>{project.contact_email}</a>}</Field>
              <Field label="Type">{client?.clientType ? CLIENT_TYPE_LABEL[client.clientType] ?? client.clientType : null}</Field>
              <Field label="Website">{client?.website && <a className="text-teal" href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer">{client.website}</a>}</Field>
              <Field label="Billing">{project.lago_customer_id ? `Lago · ${project.lago_customer_id}` : "Not set up"}</Field>
            </div>

            <div className="cp-card-head cp-sub"><span>Leads from this contact</span></div>
            {leads.loading ? (
              <p className="cp-empty">Loading…</p>
            ) : (leads.data ?? []).length === 0 ? (
              <p className="cp-empty">No leads on file for this email.</p>
            ) : (
              (leads.data ?? []).map((l) => (
                <Link key={l.id} href={`/admin/leads?id=${l.id}`} className="cp-row">
                  <span className="cp-name">
                    {l.reference_id}
                    <small>{l.source.replace(/_/g, " ")} · {formatRelative(l.created_at)}</small>
                  </span>
                  <span className="cp-status">{l.status}</span>
                </Link>
              ))
            )}
          </div>

          <InfraCard
            workspaceId={project.id}
            workspaceName={project.name}
            coolifyProjectUuid={project.coolify_project_uuid}
            onChanged={() => void portfolio.refresh()}
          />
        </div>
      )}

      {tab === "milestones" && <MilestoneEditor workspaceId={project.id} onChanged={() => void portfolio.refresh()} />}

      {tab === "requests" &&
        (requests.loading ? (
          <LoadingState label="Loading server requests…" />
        ) : requests.error ? (
          <ErrorAlert message={`Couldn't load server requests: ${requests.error}`} onRetry={requests.retry} />
        ) : (requests.data ?? []).length === 0 ? (
          <EmptyState title="No server requests" hint="Requests this client raises from their Systems tab appear here." />
        ) : (
          <div className="sr-list">
            {(requests.data ?? []).map((r) => (
              <RequestRow key={r.id} request={r} reviewable paymentUrl={undefined} onChanged={() => { void requests.refresh(); void portfolio.refresh(); }} />
            ))}
          </div>
        ))}

      {tab === "support" &&
        (support.loading ? (
          <LoadingState label="Loading tickets…" />
        ) : support.error ? (
          <ErrorAlert message={`Couldn't load tickets: ${support.error}`} onRetry={support.retry} />
        ) : (support.data ?? []).length === 0 ? (
          <EmptyState title="No support tickets" hint="Tickets opened from this project's Help & Support page appear here." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Last message</th><th>Status</th><th>Last activity</th><th /></tr>
              </thead>
              <tbody>
                {(support.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="wrap">{c.lastMessage ?? <span className="admin-muted">No messages</span>}</td>
                    <td className={c.status === "open" ? "admin-warn" : "admin-muted"}>{c.status}</td>
                    <td>{c.lastActivityAt ? formatRelative(c.lastActivityAt) : "—"}</td>
                    <td><Link href={`/admin/support?id=${c.id}`} className="text-teal">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "billing" && (
        <LinkBilling
          workspaceId={project.id}
          linkedCustomerId={project.lago_customer_id}
          takenCustomerIds={new Set((portfolio.data?.projects ?? []).filter((p) => p.id !== project.id && p.lago_customer_id).map((p) => p.lago_customer_id!))}
          onChanged={async () => {
            await portfolio.refresh();
            billing.retry();
          }}
        />
      )}

      {tab === "billing" &&
        (billing.loading ? (
          <LoadingState label="Loading billing from Lago…" />
        ) : billing.error ? (
          <ErrorAlert message={`Couldn't load billing: ${billing.error}`} onRetry={billing.retry} />
        ) : !billing.data?.billingConfigured ? (
          <EmptyState title="Billing isn't set up" hint="Pick this project's Lago customer above to see its plan and invoices." />
        ) : (
          <>
            <h2 className="admin-section-title">Subscriptions</h2>
            {(billing.data.subscriptions ?? []).length === 0 ? (
              <div className="dash-empty-state mb-6">No active subscriptions.</div>
            ) : (
              <div className="admin-table-wrap mb-6">
                <table className="admin-table">
                  <thead><tr><th>Plan</th><th>Status</th><th className="num">Price</th><th>Since</th></tr></thead>
                  <tbody>
                    {(billing.data.subscriptions ?? []).map((s) => (
                      <tr key={s.planCode + s.startedAt}>
                        <td><strong>{s.planName}</strong></td>
                        <td>{s.status}</td>
                        <td className="num">{s.amountCents != null && s.currency ? `${formatAmount(s.amountCents, s.currency)} / ${s.interval ?? "period"}` : "—"}</td>
                        <td>{s.startedAt ? formatDate(s.startedAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h2 className="admin-section-title">Invoices</h2>
            {(billing.data.invoices ?? []).length === 0 ? (
              <div className="dash-empty-state">No invoices yet.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Invoice</th><th>Issued</th><th>Payment</th><th className="num">Amount</th><th /></tr></thead>
                  <tbody>
                    {(billing.data.invoices ?? []).map((inv) => (
                      <tr key={inv.number}>
                        <td><strong>{inv.number}</strong></td>
                        <td>{formatDate(inv.issuingDate)}</td>
                        <td className={inv.paymentStatus === "succeeded" ? "admin-ok" : "admin-warn"}>{inv.paymentStatus}</td>
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
          </>
        ))}
    </ConsoleLayout>
  );
}
