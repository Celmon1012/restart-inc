import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConsoleTopBar } from "@/components/ConsoleTopBar";
import { ConsoleFooter } from "@/components/ConsoleFooter";
import { ChevronLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/lib/supabase";

interface BillingSubscription {
  planCode: string;
  status: string;
  startedAt: string | null;
}

interface BillingInvoice {
  number: string;
  issuingDate: string;
  status: string;
  paymentStatus: string;
  totalAmountCents: number;
  currency: string;
  fileUrl: string | null;
}

interface BillingData {
  billingConfigured: boolean;
  subscriptions?: BillingSubscription[];
  invoices?: BillingInvoice[];
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

  return (
    <div className="dash-shell">
      <ConsoleTopBar />

      <main className="dash-main container">
        <div className="console-breadcrumb">
          <Link href="/dashboard" className="breadcrumb-back">
            <ChevronLeft size={14} />
            <span>Back to Dashboard</span>
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Billing</span>
        </div>

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
          <div className="console-grid-layout mt-6">
            <div className="console-col">
              <div className="console-card">
                <div className="card-top-header">
                  <span className="card-kicker">SUBSCRIPTION</span>
                </div>

                {!data.subscriptions || data.subscriptions.length === 0 ? (
                  <p className="key-desc">No active subscription.</p>
                ) : (
                  <div className="sla-metrics-list">
                    {data.subscriptions.map((sub) => {
                      const tone = statusTone(sub.status);
                      return (
                        <div className="sla-metric-row" key={sub.planCode}>
                          <div>
                            <strong>{sub.planCode}</strong>
                            <p>{sub.startedAt ? `Started ${new Date(sub.startedAt).toLocaleDateString()}` : ""}</p>
                          </div>
                          <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone}`}>
                            {sub.status.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
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
        )}
      </main>

      <ConsoleFooter />
    </div>
  );
}
