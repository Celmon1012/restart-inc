// Money in: unpaid invoices (record a payment received by bank transfer) and the revenue
// position of every billed client. Data comes from Lago through console-admin-finance.

import { Fragment, useState } from "react";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";
import { FinancePage } from "@/components/admin/FinancePage";
import { RowMenu } from "@/components/admin/RowMenu";
import { EmptyState } from "@/components/AsyncStates";
import { invokeFunction } from "@/lib/functions";
import { formatAmount, formatDate } from "@/lib/format";
import { formatTotals } from "@/pages/admin/Finance";
import { downloadCsv } from "@/lib/csv";

export default function FinanceInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [relinkResult, setRelinkResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  const openPayForm = (id: string) => {
    setPayingId(id);
    setPaidOn(today);
    setReference("");
    setPayError(null);
  };

  const submitPayment = async (invoiceId: string, reload: () => Promise<void>) => {
    setSaving(true);
    setPayError(null);
    try {
      await invokeFunction("console-admin-record-payment", { body: { invoiceId, paidOn, reference, method: "bank_transfer" } });
      setPayingId(null);
      await reload();
    } catch (err) {
      setPayError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <FinancePage title="Invoices" description="What clients owe, what they've paid, and revenue per client." needs={["finance"]}>
      {({ finance: data, reloadAll }) => (
        <>
          {data.invoicesTruncated && (
            <p className="admin-muted">Showing the most recent {data.invoiceCount} invoices; older ones aren't counted.</p>
          )}

          {data.openInvoices.length + data.clients.length > 0 && (
            <div className="task-strip four">
              <div className="task-strip-tile iv-unpaid" role="group" aria-label="Unpaid">
                <span><strong>{data.openInvoices.filter((i) => !i.overdue && i.totalDueAmountCents >= i.totalAmountCents).length}</strong> Unpaid</span>
                <em>not yet due</em>
              </div>
              <div className="task-strip-tile iv-partial" role="group" aria-label="Partially paid">
                <span><strong>{data.openInvoices.filter((i) => i.totalDueAmountCents < i.totalAmountCents).length}</strong> Partially paid</span>
                <em>part-paid, balance owing</em>
              </div>
              <div className="task-strip-tile iv-overdue" role="group" aria-label="Overdue">
                <span><strong>{data.openInvoices.filter((i) => i.overdue).length}</strong> Overdue</span>
                <em>past their due date</em>
              </div>
              <div className="task-strip-tile iv-paid" role="group" aria-label="Collected">
                <span><strong>{data.clients.reduce((n, c) => n + c.invoiceCount, 0) - data.openInvoices.length}</strong> Settled</span>
                <em>of {data.clients.reduce((n, c) => n + c.invoiceCount, 0)} invoices</em>
              </div>
            </div>
          )}

          <div className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="admin-section-title">Unpaid invoices</h2>
              <button
                className="dash-tab-btn"
                disabled={data.openInvoices.length === 0}
                onClick={() =>
                  downloadCsv(
                    `restart-unpaid-invoices-${today}.csv`,
                    ["invoice", "client", "issued", "due", "status", "amount_due", "total", "currency"],
                    data.openInvoices.map((i) => [i.number, i.client, i.issuingDate, i.dueDate ?? "", i.overdue ? "overdue" : i.paymentStatus, i.totalDueAmountCents / 100, i.totalAmountCents / 100, i.currency])
                  )
                }
              >
                Export CSV
              </button>
            </div>
            {data.openInvoices.length === 0 ? (
              <div className="dash-empty-state">Nothing outstanding.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table tasks-compact">
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
                          <td className={inv.overdue ? "admin-danger" : undefined}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                          <td>{inv.overdue ? <span className="pill-overdue">OVERDUE</span> : <span className="admin-muted">{inv.paymentStatus}</span>}</td>
                          <td className="num">
                            {formatAmount(inv.totalDueAmountCents, inv.currency)}
                            {inv.totalDueAmountCents < inv.totalAmountCents && <small className="admin-muted"> of {formatAmount(inv.totalAmountCents, inv.currency)}</small>}
                          </td>
                          <td className="num">
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                              {inv.fileUrl && (
                                <a
                                  href={inv.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-teal"
                                  aria-label={`Open ${inv.number} PDF`}
                                  style={{ display: "inline-flex", alignItems: "center" }}
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              <button className="dash-tab-btn" onClick={() => openPayForm(inv.id)}>
                                Record payment
                              </button>
                            </div>
                          </td>
                        </tr>
                        {payingId === inv.id && (
                          <tr>
                            <td colSpan={7}>
                              <form
                                onSubmit={(e) => { e.preventDefault(); void submitPayment(inv.id, reloadAll); }}
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
                  <tfoot>
                    <tr>
                      <td colSpan={5}><strong>{data.openInvoices.length} unpaid · {data.openInvoices.filter((i) => i.overdue).length} overdue</strong></td>
                      <td className="num"><strong>{formatTotals(data.openInvoices.reduce<Record<string, number>>((t, i) => ({ ...t, [i.currency]: (t[i.currency] ?? 0) + i.totalDueAmountCents }), {}))}</strong></td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">By client</h2>
            {data.clients.length === 0 ? (
              <EmptyState title="No billed clients yet" hint="Link a project to its billing customer (Ops, the project's Billing tab) and it appears here." />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table tasks-compact">
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
                        <td className="num">
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                          {relinkResult[c.customerId] && (
                            <small className={relinkResult[c.customerId].ok ? "admin-ok" : "admin-warn"} role="status">
                              {relinkResult[c.customerId].text}
                            </small>
                          )}
                          <RowMenu
                            label={`More actions for ${c.name}`}
                            items={[
                              {
                                label: relinkingId === c.customerId ? "Linking…" : "Re-link payments",
                                disabled: relinkingId === c.customerId,
                                onClick: () => void relinkPayments(c.customerId, c.name)
                              }
                            ]}
                          />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><strong>{data.clients.length} billed clients</strong></td>
                      <td className="num"><strong>{formatTotals(data.clients.reduce<Record<string, number>>((t, c) => { for (const [k, v] of Object.entries(c.mrr)) t[k] = (t[k] ?? 0) + (v as number); return t; }, {}))}</strong></td>
                      <td className="num"><strong>{formatTotals(data.clients.reduce<Record<string, number>>((t, c) => { for (const [k, v] of Object.entries(c.collected)) t[k] = (t[k] ?? 0) + (v as number); return t; }, {}))}</strong></td>
                      <td className="num"><strong>{formatTotals(data.clients.reduce<Record<string, number>>((t, c) => { for (const [k, v] of Object.entries(c.outstanding)) t[k] = (t[k] ?? 0) + (v as number); return t; }, {}))}</strong></td>
                      <td className="num"><strong>{data.clients.reduce((n, c) => n + c.invoiceCount, 0)}</strong></td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {data.unbilledClients > 0 && (
              <p className="admin-muted mt-2">
                {data.unbilledClients} client project{data.unbilledClients === 1 ? " has" : "s have"} no billing customer linked yet.
              </p>
            )}
          </div>
        </>
      )}
    </FinancePage>
  );
}
