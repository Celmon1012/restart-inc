import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { Sparkline } from "@/components/Sparkline";
import { ArrowUpRight, ArrowRight, ChevronDown, ExternalLink, CreditCard, ShieldCheck, Tag, Wallet } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/lib/supabase";
import { formatAmount, formatDate } from "@/lib/format";
import { ErrorAlert, StatusRegion } from "@/components/AsyncStates";
import { EmptyState, LoadingState } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";

type Tone = "healthy" | "warning" | "down";

// Shared by subscriptions and applied coupons so both read as one pattern:
// tone-tinted card, a clickable header, a meta line, and a detail panel that
// only renders once opened -- room to grow without cluttering the default
// view (more fields/actions land here as they come up).
function BillingDetailCard({
  tone,
  icon,
  title,
  statusLabel,
  metaItems,
  expandedContent
}: {
  tone: Tone;
  icon?: React.ReactNode;
  title: string;
  statusLabel: string;
  metaItems: string[];
  expandedContent?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toneClass = tone === "healthy" ? "" : tone;
  return (
    <div className={`billing-detail-card ${toneClass}`}>
      <button type="button" className="billing-detail-head" onClick={() => setOpen((o) => !o)}>
        {icon}
        <strong className="billing-detail-title">{title}</strong>
        <span className={`system-healthy-pill ${toneClass}`}>{statusLabel}</span>
        <ChevronDown size={14} className={`billing-chevron ${open ? "open" : ""}`} />
      </button>
      {metaItems.length > 0 && (
        <div className="billing-detail-meta">
          {metaItems.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      )}
      {open && expandedContent && <div className="billing-detail-expanded">{expandedContent}</div>}
    </div>
  );
}

interface BillingSubscription {
  planCode: string;
  planName: string;
  status: string;
  startedAt: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
}

interface BillingInvoice {
  number: string;
  issuingDate: string;
  status: string;
  paymentStatus: string;
  totalAmountCents: number;
  currency: string;
  fileUrl: string | null;
  paymentUrl: string | null;
}

interface BillingCustomer {
  externalId: string;
  name: string | null;
  paymentProvider: string | null;
}

interface AppliedCoupon {
  name: string;
  code: string;
  status: string;
  frequency: string;
  durationTotal: number | null;
  durationRemaining: number | null;
  percentageRate: string | null;
  amountCents: number | null;
  amountCurrency: string | null;
}

// Lago tracks progress in months remaining, not a calendar end date, so this
// is a projection from "today," not a value Lago reports directly -- good
// enough to say "around," not precise enough to promise an exact day.
function estimatedCouponEnd(c: AppliedCoupon): Date | null {
  if (c.durationRemaining === null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + c.durationRemaining);
  return d;
}

interface BillingData {
  billingConfigured: boolean;
  customer?: BillingCustomer | null;
  subscriptions?: BillingSubscription[];
  invoices?: BillingInvoice[];
  appliedCoupons?: AppliedCoupon[];
}

function describeCoupon(c: AppliedCoupon): string {
  const value = c.percentageRate
    ? `${c.percentageRate}% off`
    : c.amountCents !== null && c.amountCurrency
      ? `${formatAmount(c.amountCents, c.amountCurrency)} off`
      : "Discount";
  if (c.durationTotal && c.durationRemaining !== null) {
    const used = c.durationTotal - c.durationRemaining;
    return `${value} — month ${Math.max(used, 0) + 1} of ${c.durationTotal}`;
  }
  return value;
}

function statusTone(status: string): "healthy" | "warning" | "down" {
  const s = status.toLowerCase();
  if (s === "succeeded" || s === "finalized" || s === "active") return "healthy";
  if (s === "pending" || s === "draft") return "warning";
  return "down";
}

// Lago's subscription object doesn't hand back a clean "next charge" date
// directly, but a yearly/monthly/etc. subscription renews on the same
// day-of-period as it started -- so this is a real calculation, not a
// guess, and it matches what Lago's own dashboard shows for a fixed-term
// subscription (confirmed against a real yearly sub: computed date lined
// up with Lago's displayed end date exactly).
function computeRenewalDate(startedAt: string | null, interval: string | null): Date | null {
  if (!startedAt || !interval) return null;
  const start = new Date(startedAt);
  if (isNaN(start.getTime())) return null;
  const stepMonths: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };
  const now = new Date();
  if (interval === "weekly") {
    const next = new Date(start);
    while (next <= now) next.setDate(next.getDate() + 7);
    return next;
  }
  const months = stepMonths[interval];
  if (!months) return null;
  const next = new Date(start);
  while (next <= now) next.setMonth(next.getMonth() + months);
  return next;
}

// Which subscription a coupon actually discounts isn't in the applied-coupon
// payload -- Lago ties coupons to the customer, not a specific subscription,
// in this API. Matching by a shared word in the name (e.g. "DevOps" coupon
// <-> "DevOps Retainer" subscription) is a heuristic, not a guarantee; when
// nothing matches, falling back to the workspace's primary subscription is
// still the best available guess.
function matchSubscriptionForCoupon(
  coupon: AppliedCoupon,
  subscriptions: BillingSubscription[],
  fallback: BillingSubscription | undefined
): BillingSubscription | undefined {
  const firstWord = coupon.name.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstWord) {
    const match = subscriptions.find((s) => s.planName.toLowerCase().includes(firstWord));
    if (match) return match;
  }
  return fallback;
}

const PROVIDER_LABEL: Record<string, string> = {
  stripe: "Stripe",
  gocardless: "GoCardless",
  adyen: "Adyen",
  cashfree: "Cashfree",
};

export default function BillingSla() {
  const { activeWorkspace } = useWorkspace();

  // Billing loads through the shared hook. This page previously hand-rolled the
  // most careful version of the pattern in the console -- its own `cancelled`
  // guard and a `nonce` to force a re-run from the retry button -- which is
  // exactly the machinery the shared hook now provides for every page.
  const {
    data,
    loading,
    error,
    retry: reload,
    refresh: refreshBilling,
    refreshing,
  } = useAsyncResource<BillingData>(
    async (signal) => {
      if (!activeWorkspace) throw new Error("No workspace selected");
      const { data: result, error: fnError } = await supabase.functions.invoke(
        `console-billing?workspace_id=${activeWorkspace.id}`
      );
      if (signal.aborted) throw new Error("cancelled");
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      return result as BillingData;
    },
    [activeWorkspace?.id],
    { enabled: Boolean(activeWorkspace), errorMessage: "Failed to load billing data" }
  );

  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const primarySubscription = data?.subscriptions?.find((s) => s.status === "active") ?? data?.subscriptions?.[0];
  const renewalDate = primarySubscription
    ? computeRenewalDate(primarySubscription.startedAt, primarySubscription.interval)
    : null;

  return (
    <ConsoleLayout>
      <StatusRegion
        message={
          loading
            ? "Loading billing data"
            : error
              ? `Could not load billing data: ${error}`
              : "Billing data loaded"
        }
      />
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">SUBSCRIPTION & INVOICES</span>
            <h1>Billing</h1>
            <p>{activeWorkspace ? `Plan and invoice history for ${activeWorkspace.name}.` : "Loading workspace…"}</p>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading billing data…" />
        ) : error ? (
          <ErrorAlert message={error} onRetry={reload} retryLabel="Reload billing" />
        ) : !data?.billingConfigured ? (
          <EmptyState
            title="Billing isn't set up for this workspace yet"
            hint="Plans, invoices, and coupons will appear here once billing is configured. You can ask us to set it up now."
            action={
              <a href="mailto:billing@restart.ng" className="console-retry-btn">
                Contact billing@restart.ng
              </a>
            }
          />
        ) : (
          <>
            {primarySubscription && (
              <div className="sla-hero-banner">
                <div className="sla-tier-info">
                  <div className="sla-badge">
                    <ShieldCheck size={14} className="text-teal" />
                    <span>{primarySubscription.status.toUpperCase()} SUBSCRIPTION</span>
                  </div>
                  <h2>{primarySubscription.planName}</h2>
                  <p>
                    {primarySubscription.startedAt
                      ? `Active since ${formatDate(primarySubscription.startedAt)}`
                      : "Plan details for this workspace."}
                  </p>
                </div>

                {primarySubscription.amountCents !== null && primarySubscription.currency && (
                  <div
                    className="sla-billing-box sla-billing-box-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setPriceModalOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setPriceModalOpen(true);
                    }}
                  >
                    <span className="b-label">{renewalDate ? "RENEWS" : "NEXT CHARGE"}</span>
                    <div className="b-price">
                      <span className="val">{renewalDate ? formatDate(renewalDate) : "—"}</span>
                    </div>
                    <span className="overview-section-link mt-2">
                      <span>View price & server details</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="console-grid-layout mt-6">
              <div className="console-col">
                {data.subscriptions && data.subscriptions.length > 0 && (
                  <div className="console-card">
                    <div className="card-top-header card-top-header-spaced">
                      <span className="card-kicker card-kicker-lg">ALL SUBSCRIPTIONS</span>
                    </div>
                    <div className="sla-metrics-list">
                      {data.subscriptions.map((sub) => (
                        <BillingDetailCard
                          key={sub.planCode}
                          tone={statusTone(sub.status)}
                          title={sub.planName}
                          statusLabel={sub.status.toUpperCase()}
                          metaItems={[
                            sub.startedAt
                              ? `Started ${formatDate(sub.startedAt)}`
                              : "Start date unavailable"
                          ]}
                          expandedContent={
                            <>
                              <div className="billing-detail-expanded-row">
                                <span>Plan code</span>
                                <span className="mono">{sub.planCode}</span>
                              </div>
                              {sub.amountCents !== null && sub.currency && (
                                <div className="billing-detail-expanded-row">
                                  <span>Amount</span>
                                  <span>
                                    {formatAmount(sub.amountCents, sub.currency)}
                                    {sub.interval && ` / ${sub.interval}`}
                                  </span>
                                </div>
                              )}
                              <div className="billing-detail-expanded-actions">
                                {/* Only server plans have anything to show on the Systems page --
                                    a retainer/labor plan has no infrastructure to view, so linking
                                    there unconditionally was misleading (confirmed 2026-09-18). */}
                                {sub.planCode.startsWith("dedicated-server-") && (
                                  <Link href="/console/systems?tab=infrastructure" className="overview-section-link">
                                    <span>View server details</span>
                                    <ArrowRight size={12} />
                                  </Link>
                                )}
                                <a href="mailto:billing@restart.ng" className="overview-section-link">
                                  <span>Contact billing</span>
                                  <ArrowUpRight size={12} />
                                </a>
                              </div>
                            </>
                          }
                        />
                      ))}

                      {data.appliedCoupons?.map((c) => {
                        const endsAround = estimatedCouponEnd(c);
                        const appliesTo = matchSubscriptionForCoupon(c, data.subscriptions ?? [], primarySubscription);
                        return (
                          <BillingDetailCard
                            key={c.code}
                            tone="healthy"
                            icon={<Tag size={13} className="text-teal" />}
                            title={c.name}
                            statusLabel={c.status.toUpperCase()}
                            metaItems={[
                              ...(appliesTo ? [`Applies to ${appliesTo.planName}`] : []),
                              describeCoupon(c),
                              ...(endsAround ? [`Ends around ${formatDate(endsAround)}`] : [])
                            ]}
                            expandedContent={
                              <div className="billing-detail-expanded-row">
                                <span>Coupon code</span>
                                <span className="mono">{c.code}</span>
                              </div>
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={`console-card ${data.subscriptions && data.subscriptions.length > 0 ? "mt-6" : ""}`}>
                  <div className="card-top-header">
                    <span className="card-kicker">PAYMENT METHOD</span>
                    <CreditCard size={15} className="text-teal" />
                  </div>

                  {data.customer?.paymentProvider ? (
                    <div className="payment-method-box">
                      <div className="pm-icon">
                        <CreditCard size={20} className="text-white" />
                      </div>
                      <div className="pm-details">
                        <strong>
                          {PROVIDER_LABEL[data.customer.paymentProvider] ?? data.customer.paymentProvider}
                        </strong>
                        <span>Connected as the payment provider for this account</span>
                      </div>
                      <span className="badge-teal">CONNECTED</span>
                    </div>
                  ) : (
                    <p className="key-desc">No payment method on file. Contact billing to add one.</p>
                  )}
                </div>
              </div>

              <div className="console-col">
                <div className="console-card">
                  <div className="card-top-header card-top-header-spaced">
                    <span className="card-kicker card-kicker-lg">INVOICE HISTORY</span>
                    {data.invoices && data.invoices.length > 1 && (
                      <div className="invoice-trend">
                        <Sparkline
                          // Lago returns invoices newest-first; reverse so the chart reads oldest to newest, left to right.
                          values={[...data.invoices].reverse().map((inv) => inv.totalAmountCents)}
                          className="text-teal"
                        />
                        <span className="invoice-trend-label">Last {data.invoices.length} invoices</span>
                      </div>
                    )}
                  </div>

                  {!data.invoices || data.invoices.length === 0 ? (
                    <p className="key-desc">No invoices yet.</p>
                  ) : (
                    <div className="invoices-list">
                      {data.invoices.map((inv) => {
                        const tone = statusTone(inv.paymentStatus === "pending" ? inv.paymentStatus : inv.status);
                        return (
                          <div key={inv.number} className="invoice-row">
                            <div className="inv-left">
                              <div className="inv-title">
                                <strong>{inv.number}</strong>
                                <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone}`}>
                                  {inv.paymentStatus.toUpperCase()}
                                </span>
                              </div>
                              <span className="inv-date">{formatDate(inv.issuingDate)}</span>
                            </div>
                            <div className="inv-right">
                              <span className="inv-amount">{formatAmount(inv.totalAmountCents, inv.currency)}</span>
                              {inv.paymentUrl && (
                                <a
                                  href={inv.paymentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="dash-action-btn"
                                  style={{ padding: "6px 12px", fontSize: "12px" }}
                                >
                                  <Wallet size={13} />
                                  <span>Pay Now</span>
                                </a>
                              )}
                              {inv.fileUrl && (
                                <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="inv-dl-btn">
                                  <ExternalLink size={13} />
                                  <span>PDF</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center text-[12px] text-[#78849b]">
                    <span>Questions about an invoice?</span>
                    <a href="mailto:billing@restart.ng" className="text-teal hover:underline flex items-center gap-1">
                      Contact Billing Team
                      <ArrowUpRight size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {priceModalOpen && primarySubscription && (
              <div className="confirm-dialog-overlay" onClick={() => setPriceModalOpen(false)}>
                <div className="confirm-dialog-card" onClick={(e) => e.stopPropagation()}>
                  <h3>{primarySubscription.planName}</h3>
                  <div className="billing-detail-expanded">
                    {primarySubscription.amountCents !== null && primarySubscription.currency && (
                      <div className="billing-detail-expanded-row">
                        <span>Price</span>
                        <span className="mono">
                          {formatAmount(primarySubscription.amountCents, primarySubscription.currency)}
                          {primarySubscription.interval && ` / ${primarySubscription.interval}`}
                        </span>
                      </div>
                    )}
                    {primarySubscription.startedAt && (
                      <div className="billing-detail-expanded-row">
                        <span>Started</span>
                        <span>{formatDate(primarySubscription.startedAt)}</span>
                      </div>
                    )}
                    {renewalDate && (
                      <div className="billing-detail-expanded-row">
                        <span>Renews</span>
                        <span>{formatDate(renewalDate)}</span>
                      </div>
                    )}
                    {activeWorkspace?.server && (
                      <>
                        <div className="billing-detail-expanded-row">
                          <span>Server</span>
                          <span className="mono">{activeWorkspace.server.name}</span>
                        </div>
                        <div className="billing-detail-expanded-row">
                          <span>Capacity</span>
                          <span>
                            {activeWorkspace.server.cpus ?? "—"} vCPU · {activeWorkspace.server.memoryGb ?? "—"} GB RAM
                          </span>
                        </div>
                      </>
                    )}
                    <div className="billing-detail-expanded-actions">
                      <Link href="/console/systems?tab=infrastructure" className="overview-section-link">
                        <span>Manage capacity</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="console-btn-secondary mt-4 w-full justify-center"
                    onClick={() => setPriceModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </ConsoleLayout>
  );
}
