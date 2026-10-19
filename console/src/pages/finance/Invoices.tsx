// Money in: every invoice in one table, with its status (draft, unpaid, partially paid, overdue,
// paid) and the revenue position of every billed client. Record a payment received by bank transfer
// from the row. Data comes from Lago through console-admin-finance.

import { confirmAction } from "@/components/confirmAction";
import { Fragment, useState } from "react";
import { Link } from "wouter";
import { ChevronsLeft, ChevronsRight, ExternalLink, Search, X } from "lucide-react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { FinancePage } from "@/components/admin/FinancePage";
import { RowMenu } from "@/components/admin/RowMenu";
import { EmptyState } from "@/components/AsyncStates";
import { invokeFunction } from "@/lib/functions";
import { formatAmount, formatDate } from "@/lib/format";
import { formatTotals } from "@/pages/admin/Finance";
import { downloadCsv } from "@/lib/csv";
import type { InvoiceDetail, InvoiceRow, InvoiceState } from "@/lib/financeOverview";

const STATE_LABEL: Record<InvoiceState, string> = { unpaid: "Unpaid", partial: "Partially paid", overdue: "Overdue", paid: "Paid", draft: "Draft" };
const STATES: InvoiceState[] = ["unpaid", "partial", "overdue", "paid", "draft"];
const STATE_NOTE: Record<InvoiceState, string> = {
  unpaid: "not yet due",
  partial: "part-paid, balance owing",
  overdue: "past their due date",
  paid: "settled in full",
  draft: "not sent yet"
};
// "owing" is the three states where money is still due.
type Filter = "all" | "owing" | InvoiceState;

function StatePill({ state }: { state: InvoiceState }) {
  if (state === "overdue") return <span className="pill-overdue">OVERDUE</span>;
  const tone = state === "paid" ? "" : state === "draft" ? "neutral" : "warning";
  return <span className={`system-healthy-pill ${tone}`}>{STATE_LABEL[state].toUpperCase()}</span>;
}

const addTo = (t: Record<string, number>, currency: string, cents: number) => {
  t[currency] = (t[currency] ?? 0) + cents;
  return t;
};

export default function FinanceInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  // What was received, in whole currency units (naira), not kobo.
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [relinkResult, setRelinkResult] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [year, setYear] = useState("all");
  const [search, setSearch] = useState("");
  // The invoice open in the side panel, and whether the list beside it is folded away.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [listHidden, setListHidden] = useState(false);
  const [tab, setTab] = useState<"invoice" | "payments">("invoice");
  const detail = useAsyncResource(
    async () => (await invokeFunction<{ invoice: InvoiceDetail }>("console-admin-finance", { query: `invoice=${encodeURIComponent(detailId as string)}` })).invoice,
    [detailId],
    { enabled: Boolean(detailId), errorMessage: "Failed to load the invoice" }
  );

  const openPayForm = (id: string, dueCents: number) => {
    setPayingId(id);
    setPaidOn(today);
    setAmount(String(dueCents / 100));
    setReference("");
    setPayError(null);
  };

  const submitPayment = async (invoiceId: string, reload: () => Promise<void>) => {
    const received = Math.round(Number(amount) * 100);
    if (!Number.isFinite(received) || received <= 0) {
      setPayError("Enter the amount received.");
      return;
    }
    setSaving(true);
    setPayError(null);
    try {
      await invokeFunction("console-admin-record-payment", { body: { invoiceId, amountCents: received, paidOn, reference, method: "bank_transfer" } });
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
    if (!(await confirmAction({ title: "Re-link payments?", description: `Re-link ${name} to the Flutterwave integration in Lago?`, confirmLabel: "Re-link", tone: "default" }))) return;
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
    <FinancePage title="Invoices" description="Every invoice and where it stands, and revenue per client." needs={["finance"]}>
      {({ finance: data, reloadAll }) => {
        // Before the finance function is redeployed only the unpaid invoices come back; show those.
        const all: InvoiceRow[] =
          data.allInvoices ??
          data.openInvoices.map((i) => ({
            id: i.id,
            number: i.number,
            client: i.client,
            workspaceId: i.workspaceId,
            issuingDate: i.issuingDate,
            dueDate: i.dueDate,
            state: (i.overdue ? "overdue" : i.totalDueAmountCents < i.totalAmountCents ? "partial" : "unpaid") as InvoiceState,
            totalAmountCents: i.totalAmountCents,
            paidAmountCents: i.totalAmountCents - i.totalDueAmountCents,
            totalDueAmountCents: i.totalDueAmountCents,
            currency: i.currency,
            fileUrl: i.fileUrl
          }));
        const years = Array.from(new Set(all.map((i) => i.issuingDate.slice(0, 4)))).sort().reverse();
        const clients = Array.from(new Set(all.map((i) => i.client))).sort();
        const needle = search.trim().toLowerCase();
        const shown = all.filter(
          (i) =>
            (filter === "all" || (filter === "owing" ? ["unpaid", "partial", "overdue"].includes(i.state) : i.state === filter)) &&
            (clientFilter === "all" || i.client === clientFilter) &&
            (year === "all" || i.issuingDate.startsWith(year)) &&
            (!needle || [i.number, i.client].some((v) => v.toLowerCase().includes(needle)))
        );
        const count = (s: InvoiceState) => all.filter((i) => i.state === s).length;
        const sumFor = (list: InvoiceRow[], pick: (i: InvoiceRow) => number) => list.reduce<Record<string, number>>((t, i) => addTo(t, i.currency, pick(i)), {});

        return (
          <>
            {data.invoicesTruncated && (
              <p className="admin-muted">Showing the most recent {data.invoiceCount} invoices; older ones aren't counted.</p>
            )}

            {all.length > 0 && (
              <div className="task-strip">
                {STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`task-strip-tile iv-${s} ${filter === s ? "active" : ""}`}
                    onClick={() => setFilter(filter === s ? "all" : s)}
                    aria-pressed={filter === s}
                  >
                    <span><strong>{count(s)}</strong> {STATE_LABEL[s]}</span>
                    <em>{s === "draft" || s === "paid" ? STATE_NOTE[s] : formatTotals(sumFor(all.filter((i) => i.state === s), (i) => i.totalDueAmountCents)) + " owing"}</em>
                  </button>
                ))}
              </div>
            )}

            <div className="admin-section">
              <div className="admin-toolbar">
                <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Status">
                  <option value="all">All invoices ({all.length})</option>
                  <option value="owing">Owing ({count("unpaid") + count("partial") + count("overdue")})</option>
                  {STATES.map((s) => <option key={s} value={s}>{STATE_LABEL[s]} ({count(s)})</option>)}
                </select>
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Client">
                  <option value="all">All clients</option>
                  {clients.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
                  <option value="all">All years</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="admin-toolbar-spacer" />
                <div className="workspace-search-box">
                  <Search size={13} />
                  <input type="text" placeholder="Search invoices or clients…" aria-label="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button
                  className="dash-tab-btn"
                  disabled={shown.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `restart-invoices-${today}.csv`,
                      ["invoice", "client", "issued", "due", "status", "total", "paid", "owing", "currency"],
                      shown.map((i) => [i.number, i.client, i.issuingDate, i.dueDate ?? "", STATE_LABEL[i.state], i.totalAmountCents / 100, i.paidAmountCents / 100, i.totalDueAmountCents / 100, i.currency])
                    )
                  }
                >
                  Export CSV
                </button>
              </div>

              {all.length === 0 ? (
                <div className="dash-empty-state">No invoices yet.</div>
              ) : shown.length === 0 ? (
                <div className="dash-empty-state">No invoices match this view.</div>
              ) : (
                <div className={`inv-split ${detailId ? "open" : ""} ${listHidden ? "list-hidden" : ""}`}>
                  {!(detailId && listHidden) && (
                    <div className="admin-table-wrap">
                      <table className="admin-table tasks-compact">
                        <thead>
                          <tr>
                            <th>Invoice</th>
                            <th>Client</th>
                            {!detailId && <th>Issued</th>}
                            {!detailId && <th>Due</th>}
                            <th>Status</th>
                            <th className="num">Amount</th>
                            {!detailId && <th />}
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((inv) => {
                            const owing = inv.state === "unpaid" || inv.state === "partial" || inv.state === "overdue";
                            return (
                              <tr
                                key={inv.id}
                                className={`clickable ${inv.state === "overdue" ? "row-overdue" : ""} ${detailId === inv.id ? "selected" : ""}`}
                                onClick={() => { setDetailId(detailId === inv.id ? null : inv.id); setTab("invoice"); setPayingId(null); }}
                              >
                                <td><strong>{inv.number}</strong></td>
                                <td className="task-name">
                                  {inv.workspaceId && !detailId ? <Link href={`/admin/projects/${inv.workspaceId}`} className="text-teal" onClick={(e) => e.stopPropagation()}>{inv.client}</Link> : inv.client}
                                </td>
                                {!detailId && <td className="admin-muted">{formatDate(inv.issuingDate)}</td>}
                                {!detailId && <td className={inv.state === "overdue" ? "admin-danger" : "admin-muted"}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>}
                                <td><StatePill state={inv.state} /></td>
                                <td className="num">
                                  {formatAmount(inv.totalAmountCents, inv.currency)}
                                  {!detailId && inv.state !== "paid" && inv.state !== "draft" && inv.paidAmountCents > 0 && (
                                    <small className="admin-muted"> · {formatAmount(inv.paidAmountCents, inv.currency)} paid</small>
                                  )}
                                </td>
                                {!detailId && (
                                  <td className="num" onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                                      {inv.fileUrl && (
                                        <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-teal" aria-label={`Open ${inv.number} PDF`} style={{ display: "inline-flex", alignItems: "center" }}>
                                          <ExternalLink size={14} />
                                        </a>
                                      )}
                                      {owing && (
                                        <button className="dash-tab-btn" onClick={() => { setDetailId(inv.id); setTab("invoice"); openPayForm(inv.id, inv.totalDueAmountCents); }}>Record payment</button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={detailId ? 3 : 5}><strong>{shown.length} of {all.length} invoices · total invoiced</strong></td>
                            <td className="num"><strong>{formatTotals(sumFor(shown.filter((i) => i.state !== "draft"), (i) => i.totalAmountCents))}</strong></td>
                            {!detailId && <td />}
                          </tr>
                          <tr>
                            <td colSpan={detailId ? 3 : 5} className="admin-muted">Paid</td>
                            <td className="num admin-muted">{formatTotals(sumFor(shown.filter((i) => i.state !== "draft"), (i) => i.paidAmountCents))}</td>
                            {!detailId && <td />}
                          </tr>
                          <tr>
                            <td colSpan={detailId ? 3 : 5}><strong>Owing</strong></td>
                            <td className="num"><strong>{formatTotals(sumFor(shown.filter((i) => i.state !== "draft"), (i) => i.totalDueAmountCents))}</strong></td>
                            {!detailId && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {detailId && (() => {
                    const row = all.find((i) => i.id === detailId);
                    const inv = detail.data;
                    const owing = row ? row.state === "unpaid" || row.state === "partial" || row.state === "overdue" : false;
                    return (
                      <aside className="inv-panel" aria-label="Invoice detail">
                        <div className="inv-panel-head">
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <strong className="inv-panel-title">{row?.number ?? "Invoice"}</strong>
                            {row && <StatePill state={row.state} />}
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            {(inv?.fileUrl ?? row?.fileUrl) && (
                              <a className="dash-tab-btn" href={(inv?.fileUrl ?? row?.fileUrl) as string} target="_blank" rel="noreferrer">
                                <ExternalLink size={13} /> <span>PDF</span>
                              </a>
                            )}
                            {row && owing && (
                              <button className="dash-tab-btn active" onClick={() => openPayForm(row.id, row.totalDueAmountCents)}>Record payment</button>
                            )}
                            <button className="dash-tab-btn" onClick={() => setListHidden(!listHidden)} aria-label={listHidden ? "Show the invoice list" : "Hide the invoice list"} title={listHidden ? "Show the list" : "Hide the list"}>
                              {listHidden ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
                            </button>
                            <button className="dash-tab-btn" onClick={() => { setDetailId(null); setListHidden(false); setPayingId(null); }} aria-label="Close the detail panel" title="Close">
                              <X size={14} />
                            </button>
                          </div>
                        </div>

                        {row && payingId === row.id && (
                          <form
                            onSubmit={(e) => { e.preventDefault(); void submitPayment(row.id, async () => { await reloadAll(); await detail.refresh(); }); }}
                            className="inv-pay-form"
                          >
                            <label>Amount received <input type="number" required min="0.01" step="0.01" style={{ width: 150 }} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                            <label>Paid on <input type="date" required value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} /></label>
                            <label>Reference <input type="text" placeholder="Bank ref / narration" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
                            <button type="submit" className="dash-tab-btn active" disabled={saving}>
                              {saving ? "Saving…" : `Record ${formatAmount(Math.round((Number(amount) || 0) * 100), row.currency)} payment`}
                            </button>
                            <span className="admin-muted">{formatAmount(row.totalDueAmountCents, row.currency)} owing</span>
                            <button type="button" className="dash-tab-btn" onClick={() => setPayingId(null)} disabled={saving}>Cancel</button>
                            {payError && <span className="admin-warn" role="alert">{payError}</span>}
                          </form>
                        )}

                        <div className="inv-tabs" role="tablist">
                          <button role="tab" aria-selected={tab === "invoice"} className={tab === "invoice" ? "active" : ""} onClick={() => setTab("invoice")}>Invoice</button>
                          <button role="tab" aria-selected={tab === "payments"} className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}>Payments{inv ? ` (${inv.payments.length})` : ""}</button>
                        </div>

                        {detail.loading ? (
                          <p className="admin-muted">Loading the invoice…</p>
                        ) : detail.error || !inv ? (
                          <p className="admin-warn" role="alert">Couldn't load the invoice: {detail.error ?? "not found"}</p>
                        ) : tab === "payments" ? (
                          inv.payments.length === 0 ? (
                            <p className="admin-muted">No payments recorded against this invoice yet.</p>
                          ) : (
                            <table className="admin-table tasks-compact">
                              <thead><tr><th>Date</th><th>Status</th><th className="num">Amount</th></tr></thead>
                              <tbody>
                                {inv.payments.map((p, idx) => (
                                  <tr key={idx}>
                                    <td>{p.date ? formatDate(p.date) : "—"}</td>
                                    <td className="admin-muted">{p.status || "—"}</td>
                                    <td className="num">{formatAmount(p.amountCents, inv.currency)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )
                        ) : (
                          <div className="inv-body">
                            <div className="inv-parties">
                              <div>
                                <span className="admin-muted">Bill to</span>
                                <strong>{inv.customer.legalName ?? inv.customer.name ?? row?.client}</strong>
                                {inv.customer.address.map((l) => <div key={l}>{l}</div>)}
                                {inv.customer.taxId && <div className="admin-muted">Tax ID {inv.customer.taxId}</div>}
                                {inv.customer.email && <div className="admin-muted">{inv.customer.email}</div>}
                              </div>
                              <div className="inv-dates">
                                <div><span className="admin-muted">Invoice date</span> <strong>{formatDate(inv.issuingDate)}</strong></div>
                                <div><span className="admin-muted">Due date</span> <strong>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</strong></div>
                              </div>
                            </div>

                            <table className="admin-table tasks-compact">
                              <thead>
                                <tr><th>#</th><th>Item</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Tax</th><th className="num">Amount</th></tr>
                              </thead>
                              <tbody>
                                {inv.lines.map((l, idx) => (
                                  <tr key={idx}>
                                    <td className="admin-muted">{idx + 1}</td>
                                    <td className="wrap">
                                      <strong>{l.description}</strong>
                                      {l.detail && <div className="admin-muted">{l.detail}</div>}
                                    </td>
                                    <td className="num">{l.units}</td>
                                    <td className="num">{formatAmount(Math.round(l.rateCents), inv.currency)}</td>
                                    <td className="num admin-muted">{l.taxRate}%</td>
                                    <td className="num">{formatAmount(l.amountCents, inv.currency)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div className="inv-totals">
                              <div><span>Sub total</span><strong>{formatAmount(inv.subtotalCents, inv.currency)}</strong></div>
                              {inv.taxes.map((t) => (
                                <div key={t.name + t.rate}><span>{t.name} {t.rate}%</span><strong>{formatAmount(t.amountCents, inv.currency)}</strong></div>
                              ))}
                              {inv.taxes.length === 0 && inv.taxesCents > 0 && <div><span>Tax</span><strong>{formatAmount(inv.taxesCents, inv.currency)}</strong></div>}
                              {inv.discountsCents > 0 && <div><span>Discounts and credits</span><strong>−{formatAmount(inv.discountsCents, inv.currency)}</strong></div>}
                              <div className="grand"><span>Total</span><strong>{formatAmount(inv.totalCents, inv.currency)}</strong></div>
                              {inv.paidCents > 0 && <div><span>Paid</span><strong>{formatAmount(inv.paidCents, inv.currency)}</strong></div>}
                              <div className={inv.dueCents > 0 ? "due" : ""}><span>Amount due</span><strong>{formatAmount(inv.dueCents, inv.currency)}</strong></div>
                            </div>
                          </div>
                        )}
                      </aside>
                    );
                  })()}
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
                            {c.workspaceId ? <Link href={`/admin/projects/${c.workspaceId}`}><strong>{c.name}</strong></Link> : <strong>{c.name}</strong>}
                          </td>
                          <td className="num">{formatTotals(c.mrr)}</td>
                          <td className="num">{formatTotals(c.collected)}</td>
                          <td className={`num ${Object.keys(c.overdue).length ? "admin-warn" : ""}`}>{formatTotals(c.outstanding)}</td>
                          <td className="num">{c.invoiceCount}</td>
                          <td className="admin-muted">{c.lastInvoiceAt ? formatDate(c.lastInvoiceAt) : "—"}</td>
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
        );
      }}
    </FinancePage>
  );
}
