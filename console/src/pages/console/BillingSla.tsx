import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ArrowUpRight, ArrowRight, ChevronDown, ExternalLink, CreditCard, ShieldCheck, Tag, Wallet } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/lib/supabase";

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
  priceLabel,
  metaItems,
  expandedContent
}: {
  tone: Tone;
  icon?: React.ReactNode;
  title: string;
  statusLabel: string;
  priceLabel?: React.ReactNode;
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
        {priceLabel}
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

function formatAmount(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function statusTone(status: string): "healthy" | "warning" | "down" {
  const s = status.toLowerCase();
  if (s === "succeeded" || s === "finalized" || s === "active") return "healthy";
  if (s === "pending" || s === "draft") return "warning";
  return "down";
}

const PROVIDER_LABEL: Record<string, string> = {
  stripe: "Stripe",
  gocardless: "GoCardless",
  adyen: "Adyen",
  cashfree: "Cashfree",
};

export default function BillingSla() {
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke(`console-billing?workspace_id=${activeWorkspace.id}`)
      .then(({ data: result, error: fnError }) => {
        if (cancelled) return;
        if (fnError) throw fnError;
        if (result?.error) throw new Error(result.error);
        setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load billing data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  const primarySubscription = data?.subscriptions?.find((s) => s.status === "active") ?? data?.subscriptions?.[0];

  return (
    <ConsoleLayout>
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">SUBSCRIPTION & INVOICES</span>
            <h1>Billing</h1>
            <p>{activeWorkspace ? `Plan and invoice history for ${activeWorkspace.name}.` : "Loading workspace…"}</p>
          </div>
        </div>

        {loading ? (
          <div className="dash-empty-state">Loading billing data…</div>
        ) : error ? (
          <div className="dash-empty-state">Couldn't load billing data: {error}</div>
        ) : !data?.billingConfigured ? (
          <div className="dash-empty-state">
            Billing isn't set up for this workspace yet.{" "}
            <a href="mailto:billing@restart.ng" className="text-teal">
              Contact billing@restart.ng
            </a>{" "}
            to get it configured.
          </div>
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
                      ? `Active since ${new Date(primarySubscription.startedAt).toLocaleDateString()}`
                      : "Plan details for this workspace."}
                  </p>
                </div>

                {primarySubscription.amountCents !== null && primarySubscription.currency && (
                  <div className="sla-billing-box">
                    <span className="b-label">
                      {primarySubscription.interval ? primarySubscription.interval.toUpperCase() : "RECURRING"} PLAN PRICE
                    </span>
                    <div className="b-price">
                      <span className="val">
                        {formatAmount(primarySubscription.amountCents, primarySubscription.currency)}
                      </span>
                    </div>
                    <Link
                      href="/console/systems?tab=infrastructure"
                      className="overview-section-link mt-4 w-full justify-center"
                    >
                      <span>Need more capacity? Manage on Systems</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="console-grid-layout mt-6">
              <div className="console-col">
                {data.subscriptions && data.subscriptions.length > 0 && (
                  <div className="console-card">
                    <div className="card-top-header">
                      <span className="card-kicker">ALL SUBSCRIPTIONS</span>
                    </div>
                    <div className="sla-metrics-list">
                      {data.subscriptions.map((sub) => (
                        <BillingDetailCard
                          key={sub.planCode}
                          tone={statusTone(sub.status)}
                          title={sub.planName}
                          statusLabel={sub.status.toUpperCase()}
                          priceLabel={
                            sub.amountCents !== null && sub.currency ? (
                              <span className="billing-detail-price">
                                {formatAmount(sub.amountCents, sub.currency)}
                                {sub.interval && <span className="text-[#78849b]"> /{sub.interval}</span>}
                              </span>
                            ) : undefined
                          }
                          metaItems={[
                            sub.startedAt
                              ? `Started ${new Date(sub.startedAt).toLocaleDateString()}`
                              : "Start date unavailable"
                          ]}
                          expandedContent={
                            <>
                              <div className="billing-detail-expanded-row">
                                <span>Plan code</span>
                                <span className="mono">{sub.planCode}</span>
                              </div>
                              <div className="billing-detail-expanded-row">
                                <span>Billing interval</span>
                                <span>{sub.interval ?? "—"}</span>
                              </div>
                              <div className="billing-detail-expanded-actions">
                                <Link href="/console/systems?tab=infrastructure" className="overview-section-link">
                                  <span>Manage capacity</span>
                                  <ArrowRight size={12} />
                                </Link>
                                <a href="mailto:billing@restart.ng" className="overview-section-link">
                                  <span>Contact billing</span>
                                  <ArrowUpRight size={12} />
                                </a>
                              </div>
                            </>
                          }
                        />
                      ))}
                    </div>

                    {data.appliedCoupons && data.appliedCoupons.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                        {data.appliedCoupons.map((c) => {
                          const endsAround = estimatedCouponEnd(c);
                          return (
                            <BillingDetailCard
                              key={c.code}
                              tone="healthy"
                              icon={<Tag size={13} className="text-teal" />}
                              title={c.name}
                              statusLabel={c.status.toUpperCase()}
                              metaItems={[
                                ...(primarySubscription ? [`Applies to ${primarySubscription.planName}`] : []),
                                describeCoupon(c),
                                ...(endsAround ? [`Ends around ${endsAround.toLocaleDateString()}`] : [])
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
                    )}
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
                  <div className="card-top-header">
                    <span className="card-kicker">INVOICE HISTORY</span>
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
                              <span className="inv-date">{new Date(inv.issuingDate).toLocaleDateString()}</span>
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
          </>
        )}
    </ConsoleLayout>
  );
}
