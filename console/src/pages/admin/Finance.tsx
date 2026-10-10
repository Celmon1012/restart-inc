// Financial overview across every client, from console-admin-finance (the only
// thing holding LAGO_API_KEY for a cross-client read). Figures are per
// currency and never summed across currencies.

import { Fragment, useState } from "react";
import { Link } from "wouter";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { invokeFunction } from "@/lib/functions";
import { formatAmount, formatDate } from "@/lib/format";
import { ExternalLink } from "lucide-react";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { OperatingCosts } from "@/components/admin/OperatingCosts";

type Totals = Record<string, number>;

export interface FinanceOverview {
  generatedAt: string;
  totals: { collected: Totals; collectedThisMonth: Totals; outstanding: Totals; overdue: Totals; mrr: Totals };
  activeSubscriptions: number;
  billedClients: number;
  unbilledClients: number;
  invoiceCount: number;
  invoicesTruncated: boolean;
  monthly: Array<{ month: string; collected: Totals }>;
  clients: Array<{
    workspaceId: string | null;
    name: string;
    customerId: string;
    collected: Totals;
    outstanding: Totals;
    overdue: Totals;
    mrr: Totals;
    invoiceCount: number;
    lastInvoiceAt: string | null;
  }>;
  openInvoices: Array<{
    id: string;
    number: string;
    client: string;
    workspaceId: string | null;
    issuingDate: string;
    dueDate: string | null;
    paymentStatus: string;
    overdue: boolean;
    totalAmountCents: number;
    totalDueAmountCents: number;
    currency: string;
    fileUrl: string | null;
  }>;
}

export const loadFinanceOverview = () => invokeFunction<FinanceOverview>("console-admin-finance");

const nonZero = (t: Totals | undefined) => Object.entries(t ?? {}).filter(([, v]) => v !== 0);

/** "NGN 1,200,000.00 · $4,000.00", or an em dash when there's nothing. For tables and hint lines. */
export function formatTotals(t: Totals | undefined): string {
  const entries = nonZero(t);
  if (entries.length === 0) return "—";
  return entries.map(([currency, cents]) => formatAmount(cents, currency)).join(" · ");
}

/** Short form for stat tiles: "₦1.63M", "$149". Full value goes in the title. */
function formatCompact(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 2
    }).format(cents / 100);
  } catch {
    return formatAmount(cents, currency);
  }
}

/**
 * Stat-tile value: one compact line per currency, so a tile holding NGN and
 * USD stacks instead of cramming both full-precision figures onto one line.
 */
export function TotalsValue({ totals }: { totals: Totals | undefined }) {
  // NGN is the home currency (Restart invoices from Nigeria), so it leads at
  // full size; any other currency sits underneath, smaller and muted.
  const entries = nonZero(totals).sort(([a], [b]) => (a === "NGN" ? -1 : b === "NGN" ? 1 : a.localeCompare(b)));
  if (entries.length === 0) return <>—</>;
  return (
    <span className="stat-totals" title={formatTotals(totals)}>
      {entries.map(([currency, cents], i) => (
        <span key={currency} className={i === 0 ? "stat-totals-primary" : "stat-totals-secondary"}>
          {formatCompact(cents, currency)}
        </span>
      ))}
    </span>
  );
}

function MonthlyBars({ monthly, currency }: { monthly: FinanceOverview["monthly"]; currency: string }) {
  const values = monthly.map((m) => m.collected[currency] ?? 0);
  const max = Math.max(...values, 1);
  return (
    <div className="admin-bars" role="img" aria-label={`Collected revenue in ${currency}, last 12 months`}>
      {monthly.map((m, i) => {
        const label = new Date(`${m.month}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
        return (
          <div className="admin-bar" key={m.month} title={`${label}: ${formatAmount(values[i], currency)}`}>
            <i style={{ height: `${(values[i] / max) * 100}%` }} />
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminFinance() {
  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<FinanceOverview>(
    () => loadFinanceOverview(),
    [],
    { errorMessage: "Failed to load finance data" }
  );

  const today = new Date().toISOString().slice(0, 10);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const openPayForm = (id: string) => {
    setPayingId(id);
    setPaidOn(today);
    setReference("");
    setPayError(null);
  };

  const submitPayment = async (invoiceId: string) => {
    setSaving(true);
    setPayError(null);
    try {
      await invokeFunction("console-admin-record-payment", { body: { invoiceId, paidOn, reference, method: "bank_transfer" } });
      setPayingId(null);
      await refresh();
    } catch (err) {
      setPayError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [relinkResult, setRelinkResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  // Re-creates the customer's link to the Flutterwave integration in Lago. Needed after the
  // integration is deleted and re-added (its code changes), or when "Pay Now" stops working.
  const relinkPayments = async (customerId: string, name: string) => {
    if (!window.confirm(`Re-link ${name} to the Flutterwave integration in Lago?`)) return;
    setRelinkingId(customerId);
    try {
      await invokeFunction("sync-lago-payment-provider", { body: { externalCustomerId: customerId } });
      setRelinkResult((r) => ({ ...r, [customerId]: { ok: true, text: "Linked" } }));
    } catch (err) {
      setRelinkResult((r) => ({ ...r, [customerId]: { ok: false, text: (err as Error).message } }));
    } finally {
      setRelinkingId(null);
    }
  };

  const currencies = data
    ? Array.from(new Set(data.monthly.flatMap((m) => Object.keys(m.collected)).concat(Object.keys(data.totals.collected))))
    : [];

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading finance data" : error ? `Could not load finance data: ${error}` : "Finance data loaded"} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">OPERATIONS</span>
          <h1>Finance</h1>
          <p>Recurring revenue, collections, and what's still owed, across every client.</p>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading finance data from Lago…" />
      ) : error ? (
        <ErrorAlert message={`Couldn't load finance data: ${error}`} onRetry={retry} retryLabel="Reload finance data" />
      ) : !data ? null : (
        <>
          <div className="cp-stats">
            <div>
              <small>MRR</small>
              <strong><TotalsValue totals={data.totals.mrr} /></strong>
              <em>{data.activeSubscriptions} active subscription{data.activeSubscriptions === 1 ? "" : "s"}</em>
            </div>
            <div>
              <small>COLLECTED THIS MONTH</small>
              <strong><TotalsValue totals={data.totals.collectedThisMonth} /></strong>
              <em>{formatTotals(data.totals.collected)} all-time</em>
            </div>
            <div>
              <small>OUTSTANDING</small>
              <strong className={Object.keys(data.totals.outstanding).length ? "warn" : undefined}><TotalsValue totals={data.totals.outstanding} /></strong>
              <em>{data.openInvoices.length} unpaid invoice{data.openInvoices.length === 1 ? "" : "s"}</em>
            </div>
            <div>
              <small>OVERDUE</small>
              <strong className={Object.keys(data.totals.overdue).length ? "warn" : undefined}><TotalsValue totals={data.totals.overdue} /></strong>
              <em>{data.openInvoices.filter((i) => i.overdue).length} past due date</em>
            </div>
          </div>

          {data.invoicesTruncated && (
            <p className="admin-muted mt-2">Showing the most recent {data.invoiceCount} invoices; older ones aren't counted.</p>
          )}

          {currencies.length > 0 && (
            <div className="admin-section">
              <h2 className="admin-section-title">Collected revenue, last 12 months</h2>
              {currencies.map((c) => (
                <div className="cp-card mb-4" key={c}>
                  <div className="cp-card-head">
                    <span>{c}</span>
                    <em>{formatAmount(data.monthly.reduce((sum, m) => sum + (m.collected[c] ?? 0), 0), c)} in 12 months</em>
                  </div>
                  <MonthlyBars monthly={data.monthly} currency={c} />
                </div>
              ))}
            </div>
          )}

          <OperatingCosts finance={data} />

          <div className="admin-section">
            <h2 className="admin-section-title">Unpaid invoices</h2>
            {data.openInvoices.length === 0 ? (
              <div className="dash-empty-state">Nothing outstanding.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Issued</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th className="num">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.openInvoices.map((inv) => (
                      <Fragment key={inv.number}>
                      <tr>
                        <td><strong>{inv.number}</strong></td>
                        <td>{inv.client}</td>
                        <td>{formatDate(inv.issuingDate)}</td>
                        <td className={inv.overdue ? "admin-warn" : undefined}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                        <td className={inv.overdue ? "admin-warn" : "admin-muted"}>{inv.overdue ? "overdue" : inv.paymentStatus}</td>
                        <td className="num">
                          {formatAmount(inv.totalDueAmountCents, inv.currency)}
                          {inv.totalDueAmountCents < inv.totalAmountCents && <small className="admin-muted"> of {formatAmount(inv.totalAmountCents, inv.currency)}</small>}
                        </td>
                        <td>
                          {inv.fileUrl && (
                            <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-teal" aria-label={`Open ${inv.number} PDF`}>
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button className="dash-tab-btn" style={{ marginLeft: 8 }} onClick={() => openPayForm(inv.id)}>
                            Record payment
                          </button>
                        </td>
                      </tr>
                      {payingId === inv.id && (
                        <tr>
                          <td colSpan={7}>
                            <form
                              onSubmit={(e) => { e.preventDefault(); void submitPayment(inv.id); }}
                              style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                            >
                              <label>Paid on <input type="date" required value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} /></label>
                              <label>Reference <input type="text" placeholder="Bank ref / narration" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
                              <button type="submit" className="dash-tab-btn active" disabled={saving}>
                                {saving ? "Saving…" : `Mark ${formatAmount(inv.totalAmountCents, inv.currency)} paid`}
                              </button>
                              <button type="button" className="dash-tab-btn" onClick={() => setPayingId(null)} disabled={saving}>Cancel</button>
                              {payError && <span className="admin-warn" role="alert">{payError}</span>}
                            </form>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">By client</h2>
            {data.clients.length === 0 ? (
              <EmptyState title="No billed clients yet" hint="Link a workspace to its Lago customer (workspaces.lago_customer_id) and it appears here." />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th className="num">MRR</th>
                      <th className="num">Collected</th>
                      <th className="num">Outstanding</th>
                      <th className="num">Invoices</th>
                      <th>Last invoice</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map((c) => (
                      <tr key={c.customerId}>
                        <td>
                          {c.workspaceId ? (
                            <Link href={`/admin/projects/${c.workspaceId}`}><strong>{c.name}</strong></Link>
                          ) : (
                            <strong>{c.name}</strong>
                          )}
                        </td>
                        <td className="num">{formatTotals(c.mrr)}</td>
                        <td className="num">{formatTotals(c.collected)}</td>
                        <td className={`num ${Object.keys(c.overdue).length ? "admin-warn" : ""}`}>{formatTotals(c.outstanding)}</td>
                        <td className="num">{c.invoiceCount}</td>
                        <td>{c.lastInvoiceAt ? formatDate(c.lastInvoiceAt) : "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="dash-tab-btn"
                            disabled={relinkingId === c.customerId}
                            onClick={() => void relinkPayments(c.customerId, c.name)}
                          >
                            {relinkingId === c.customerId ? "Linking…" : "Re-link payments"}
                          </button>
                          {relinkResult[c.customerId] && (
                            <small className={relinkResult[c.customerId].ok ? "admin-ok" : "admin-warn"} role="status">
                              {" "}{relinkResult[c.customerId].text}
                            </small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.unbilledClients > 0 && (
              <p className="admin-muted mt-2">
                {data.unbilledClients} client workspace{data.unbilledClients === 1 ? " has" : "s have"} no Lago customer linked yet.
              </p>
            )}
          </div>
        </>
      )}
    </ConsoleLayout>
  );
}
