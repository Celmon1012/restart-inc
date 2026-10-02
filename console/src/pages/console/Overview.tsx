import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getResources, statusMeta, deploymentStatusLabel, formatRelativeTime, RESOURCE_KIND_LABEL } from "@/lib/resources";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { consoleSchema } from "@/lib/supabase";
import { getCurrentDeliverable, type Deliverable } from "@/lib/deliverables";
import { invokeFunction } from "@/lib/functions";
import { formatAmount, formatDate } from "@/lib/format";
import { CheckCircle2, AlertTriangle, ArrowRight, Clock, Rocket, XCircle, Loader2, Receipt, MessageSquare } from "lucide-react";
import { toast } from "sonner";

// "Waiting on you" is built from the two places where the next move is the
// client's: an unpaid invoice (Lago) and a support thread where Restart spoke
// last (Chatwoot). Each source loads and fails on its own so one outage never
// reads as "nothing waiting".
interface WaitingInvoice {
  number: string;
  issuingDate: string;
  status: string;
  paymentStatus: string;
  totalAmountCents: number;
  totalDueAmountCents: number;
  currency: string;
  paymentUrl: string | null;
}

interface WaitingConversation {
  id: string;
  workspaceId?: string;
  awaitingClient?: boolean;
  lastMessage: string | null;
  lastActivityAt: number | null;
}

type OverviewTab = "shipped" | "waiting";

function activityStatusIcon(status: string) {
  if (status === "finished") return <CheckCircle2 size={15} className="text-teal" />;
  if (status === "failed") return <XCircle size={15} className="text-rose" />;
  if (status === "in_progress" || status === "running" || status === "queued") {
    return <Loader2 size={15} className="text-amber" />;
  }
  return <Rocket size={15} className="text-teal" />;
}

export default function Overview() {
  const { user } = useAuth();
  const { activeWorkspace, loading: workspaceLoading, error: workspaceError, refresh } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const resources = activeWorkspace ? getResources(activeWorkspace) : [];
  const attention = resources.filter((r) => statusMeta(r.status).tone !== "healthy");
  const downCount = attention.filter((r) => statusMeta(r.status).tone === "down").length;
  const warningCount = attention.length - downCount;
  const deployments = activeWorkspace?.deployments ?? [];
  const deploysLast24h = deployments.filter(
    (d) => Date.now() - new Date(d.createdAt).getTime() < 24 * 60 * 60 * 1000
  ).length;

  // Deliverables load through the shared hook so a failed read is reported and
  // retryable. This previously swallowed every error into an empty array, which
  // rendered exactly like "no milestones" -- the dashboard told an operator they
  // had no delivery milestones when the truth was that we could not read them.
  const {
    data: deliverableData,
    error: deliverablesError,
    retry: retryDeliverables,
  } = useAsyncResource<Deliverable[]>(
    async (signal) => {
      if (!activeWorkspace) return [];
      const { data, error: dbError } = await consoleSchema()
        .from("deliverables")
        .select("*")
        .eq("workspace_id", activeWorkspace.id);
      if (signal.aborted) return [];
      if (dbError) throw dbError;
      return data ?? [];
    },
    [activeWorkspace?.id],
    { enabled: Boolean(activeWorkspace), errorMessage: "Failed to load delivery milestones" }
  );
  const deliverables = deliverableData ?? [];

  const {
    data: invoiceData,
    error: invoicesError,
    retry: retryInvoices,
  } = useAsyncResource<WaitingInvoice[]>(
    async (signal) => {
      if (!activeWorkspace) return [];
      const data = await invokeFunction<{ invoices?: WaitingInvoice[] }>("console-billing", {
        query: `workspace_id=${activeWorkspace.id}`,
      });
      if (signal.aborted) return [];
      return data.invoices ?? [];
    },
    [activeWorkspace?.id],
    { enabled: Boolean(activeWorkspace), errorMessage: "Failed to check invoices" }
  );

  const {
    data: conversationData,
    error: conversationsError,
    retry: retryConversations,
  } = useAsyncResource<WaitingConversation[]>(
    async (signal) => {
      const data = await invokeFunction<{ conversations?: WaitingConversation[] }>("console-support-data");
      if (signal.aborted) return [];
      return data.conversations ?? [];
    },
    [],
    { errorMessage: "Failed to check support threads" }
  );

  // A draft invoice isn't billable yet, and a voided one never will be --
  // only a finalized invoice that hasn't succeeded is actually owed.
  const unpaidInvoices = (invoiceData ?? []).filter(
    (inv) => inv.status === "finalized" && inv.paymentStatus !== "succeeded"
  );
  // console-support-data returns every thread RLS allows (all clients, for an
  // admin), so scope to the workspace on screen.
  const awaitingReplies = (conversationData ?? []).filter(
    (c) => c.awaitingClient && (!c.workspaceId || c.workspaceId === activeWorkspace?.id)
  );
  const waitingCount = unpaidInvoices.length + awaitingReplies.length;

  // Open on whatever needs the client first; once they pick a tab, keep it.
  const [pickedTab, setPickedTab] = useState<OverviewTab | null>(null);
  const tab: OverviewTab = pickedTab ?? (waitingCount > 0 ? "waiting" : "shipped");

  // Derived from the loaded milestones, so they must sit after the hook rather
  // than above it.
  const currentMilestone = getCurrentDeliverable(deliverables);
  const completedMilestones = deliverables.filter((d) => d.status === "completed").length;
  const deliveryPct = deliverables.length ? Math.round((completedMilestones / deliverables.length) * 100) : 0;

  const handleRefresh = () => {
    setIsRefreshing(true);
    refresh();
    toast.info("Refreshed workspace data");
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const headline =
    resources.length === 0
      ? "Getting your workspace set up"
      : attention.length === 0
        ? "Your systems are healthy"
        : attention.length === 1
          ? "One system needs your attention"
          : `${attention.length} systems need your attention`;

  return (
    <ConsoleLayout onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <StatusRegion
        message={
          workspaceLoading
            ? "Loading your workspace"
            : workspaceError
              ? `Could not load workspace data: ${workspaceError}`
              : deliverablesError
                ? `${resources.length} systems loaded; delivery milestones could not be read`
                : `${resources.length} systems and ${deliverables.length} delivery milestones loaded`
        }
      />
      {workspaceLoading && !activeWorkspace ? (
        <LoadingState label="Loading your workspace…" />
      ) : workspaceError ? (
        <ErrorAlert
          message={workspaceError}
          onRetry={() => void refresh()}
          retryLabel="Reload dashboard"
        />
      ) : !activeWorkspace ? (
        <EmptyState
          title="No workspace assigned yet"
          hint="No workspace has been assigned to your account. Contact Restart Inc to get set up, or start a project from the marketing site."
        />
      ) : (
        <>
          <div className="cp-head">
            <span className="cp-eyebrow">{activeWorkspace.name}</span>
            <h1>Systems Overview</h1>
            <p>{headline} — every system, deploy, and delivery milestone in one place.</p>
          </div>

          {activeWorkspace.provisioning && (
            <div className="overview-provisioning-card">
              <div className="overview-card-icon">
                <Clock size={16} className="text-amber" />
              </div>
              <div>
                <h3>Your workspace is set up. Infrastructure comes next.</h3>
                <p>
                  A Restart engineer reviews your answers and replies to {user?.email} with a fit assessment and
                  proposed scope. Your dedicated server, systems, and delivery milestones appear here once the
                  engagement starts.
                </p>
                <Link href="/support" className="overview-section-link">
                  Ask a question now <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}

          <div className="cp-stats">
            <div>
              <small>SYSTEMS</small>
              <strong>{resources.length}</strong>
              <em>{resources.length === 0 ? "None deployed yet" : attention.length === 0 ? "All healthy" : `${attention.length} need attention`}</em>
            </div>
            <div>
              <small>NEEDS ATTENTION</small>
              <strong className={attention.length ? "warn" : undefined}>{attention.length}</strong>
              <em>{attention.length === 0 ? "Nothing flagged" : `${warningCount} warning · ${downCount} down`}</em>
            </div>
            <div>
              <small>DELIVERY</small>
              <strong>{deliverables.length === 0 ? "—" : <>{completedMilestones}<span>/{deliverables.length}</span></>}</strong>
              <em>{currentMilestone ? currentMilestone.title : "No active milestone"}</em>
            </div>
            <div>
              <small>DEPLOYS</small>
              <strong>{deployments.length}</strong>
              <em>{deployments.length === 0 ? "None yet" : `${deploysLast24h} in last 24h`}</em>
            </div>
          </div>

          <div className="cp-grid">
            <div className="cp-card cp-systems">
              <div className="cp-card-head">
                <span>Systems</span>
                {resources.length > 0 && (
                  <em className={attention.length ? "warn" : undefined}>
                    {attention.length === 0 ? "All healthy" : `${attention.length} need attention`}
                  </em>
                )}
              </div>
              {resources.length === 0 ? (
                <p className="cp-empty">No resources deployed to this workspace's server yet.</p>
              ) : (
                resources.slice(0, 6).map((r) => {
                  const { label, tone } = statusMeta(r.status);
                  return (
                    <Link href="/systems" key={r.uuid} className="cp-row">
                      <i className={`cp-dot ${tone}`} />
                      <span className="cp-name">
                        {r.name}
                        <small>
                          {RESOURCE_KIND_LABEL[r.kind].toLowerCase()}
                          {r.lastOnlineAt ? ` · checked ${formatRelativeTime(r.lastOnlineAt)}` : ""}
                        </small>
                      </span>
                      <span className={`cp-status ${tone}`}>{label}</span>
                    </Link>
                  );
                })
              )}
              {resources.length > 6 && (
                <Link href="/systems" className="cp-more">
                  +{resources.length - 6} more <ArrowRight size={12} />
                </Link>
              )}
            </div>

            <div className="cp-card cp-deploys">
              <div className="cp-card-head cp-switch-head">
                <div className="cp-switch" role="tablist" aria-label="Recent work and open items">
                  <button
                    type="button"
                    role="tab"
                    id="cp-tab-shipped"
                    aria-selected={tab === "shipped"}
                    aria-controls="cp-panel"
                    className={tab === "shipped" ? "active" : undefined}
                    onClick={() => setPickedTab("shipped")}
                  >
                    What shipped
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="cp-tab-waiting"
                    aria-selected={tab === "waiting"}
                    aria-controls="cp-panel"
                    className={tab === "waiting" ? "active" : undefined}
                    onClick={() => setPickedTab("waiting")}
                  >
                    Waiting on you
                    {waitingCount > 0 && <span className="cp-tab-count">{waitingCount}</span>}
                  </button>
                </div>
                {tab === "shipped" && (
                  <Link href="/timeline" className="cp-head-link">Timeline <ArrowRight size={11} /></Link>
                )}
              </div>

              <div id="cp-panel" role="tabpanel" aria-labelledby={tab === "shipped" ? "cp-tab-shipped" : "cp-tab-waiting"}>
                {tab === "shipped" ? (
                  deployments.length === 0 ? (
                    <p className="cp-empty">Nothing shipped yet. Each release appears here once it deploys.</p>
                  ) : (
                    <div className="cp-list">
                      {deployments.slice(0, 5).map((d) => (
                        <div className="cp-item" key={d.uuid}>
                          <span className="cp-item-icon">{activityStatusIcon(d.status)}</span>
                          <span className="cp-item-body">
                            <span className="cp-item-title">{d.commitMessage || `Deployed ${d.applicationName}`}</span>
                            <small>
                              {d.applicationName}
                              {d.commitSha ? ` · ${d.commitSha}` : ""}
                              {d.status !== "finished" ? ` · ${deploymentStatusLabel(d.status)}` : ""}
                              {` · ${formatRelativeTime(d.createdAt)}`}
                            </small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="cp-list">
                    {unpaidInvoices.map((inv) => (
                      <div className="cp-item" key={inv.number}>
                        <span className="cp-item-icon"><Receipt size={15} className={inv.paymentStatus === "failed" ? "text-rose" : "text-amber"} /></span>
                        <span className="cp-item-body">
                          <span className="cp-item-title">
                            {inv.paymentStatus === "failed" ? "Payment failed" : "Invoice to pay"} · {formatAmount(inv.totalDueAmountCents, inv.currency)}
                          </span>
                          <small>{inv.number} · issued {formatDate(inv.issuingDate)}</small>
                        </span>
                        {inv.paymentUrl ? (
                          <a href={inv.paymentUrl} target="_blank" rel="noopener noreferrer" className="cp-item-action">Pay now</a>
                        ) : (
                          <Link href="/billing" className="cp-item-action">View</Link>
                        )}
                      </div>
                    ))}
                    {awaitingReplies.map((c) => (
                      <div className="cp-item" key={c.id}>
                        <span className="cp-item-icon"><MessageSquare size={15} className="text-amber" /></span>
                        <span className="cp-item-body">
                          <span className="cp-item-title">Reply needed on a support thread</span>
                          <small>
                            {c.lastMessage ? `"${c.lastMessage}"` : "Restart replied"}
                            {c.lastActivityAt ? ` · ${formatRelativeTime(new Date(c.lastActivityAt).toISOString())}` : ""}
                          </small>
                        </span>
                        <Link href="/support" className="cp-item-action">Reply</Link>
                      </div>
                    ))}
                    {invoicesError && (
                      <div className="cp-empty cp-error">
                        <span>Couldn't check invoices.</span>
                        <button type="button" className="console-retry-btn" onClick={retryInvoices}>Retry</button>
                      </div>
                    )}
                    {conversationsError && (
                      <div className="cp-empty cp-error">
                        <span>Couldn't check support threads.</span>
                        <button type="button" className="console-retry-btn" onClick={retryConversations}>Retry</button>
                      </div>
                    )}
                    {waitingCount === 0 && !invoicesError && !conversationsError && (
                      <p className="cp-empty">Nothing waiting on you. Invoices to pay and support replies show up here.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="cp-card-head cp-sub">
                <span>Current delivery</span>
                <Link href="/delivery" className="cp-head-link">All milestones <ArrowRight size={11} /></Link>
              </div>
              {deliverablesError ? (
                <div className="cp-empty cp-error">
                  <span>Couldn't read delivery milestones.</span>
                  <button type="button" className="console-retry-btn" onClick={retryDeliverables}>Retry</button>
                </div>
              ) : deliverables.length === 0 ? (
                <p className="cp-empty">No delivery milestones yet.</p>
              ) : (
                <>
                  <div className="cp-progress"><i style={{ width: `${deliveryPct}%` }} /></div>
                  <div className="cp-milestone">
                    <span>{currentMilestone ? currentMilestone.title : "All milestones complete"}</span>
                    <span>{deliveryPct}%</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {attention.length > 0 && (
            <div className="overview-section">
              <h2 className="overview-section-title">Needs attention</h2>
              <div className="overview-attention-list">
                {attention.map((r) => {
                  const { label } = statusMeta(r.status);
                  return (
                    <Link href="/systems" key={r.uuid} className="overview-attention-row">
                      <AlertTriangle size={15} className="text-amber" />
                      <span className="overview-attention-name">{r.name}</span>
                      <span className="overview-attention-status">{label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </ConsoleLayout>
  );
}
