// Money in: every invoice in one table, with its status (draft, unpaid, partially paid, overdue,
// paid) and the revenue position of every billed client. Record a payment received by bank transfer
// from the row. Data comes from Lago through console-admin-finance.

import { Fragment, useState } from "react";
import { Link } from "wouter";
import { ExternalLink, Search } from "lucide-react";
import { FinancePage } from "@/components/admin/FinancePage";
import { RowMenu } from "@/components/admin/RowMenu";
import { EmptyState } from "@/components/AsyncStates";
import { invokeFunction } from "@/lib/functions";
import { formatAmount, formatDate } from "@/lib/format";
import { formatTotals } from "@/pages/admin/Finance";
import { downloadCsv } from "@/lib/csv";
import type { InvoiceRow, InvoiceState } from "@/lib/financeOverview";

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
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [relinkResult, setRelinkResult] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [year, setYear] = useState("all");
  const [search, setSearch] = useState("");

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
                      {shown.map((inv) => {
                        const owing = inv.state === "unpaid" || inv.state === "partial" || inv.state === "overdue";
                        return (
                          <Fragment key={inv.id}>
                            <tr className={inv.state === "overdue" ? "row-overdue" : undefined}>
                              <td><strong>{inv.number}</strong></td>
                              <td>
                                {inv.workspaceId ? <Link href={`/admin/projects/${inv.workspaceId}`} className="text-teal">{inv.client}</Link> : inv.client}
                              </td>
                              <td className="admin-muted">{formatDate(inv.issuingDate)}</td>
                              <td className={inv.state === "overdue" ? "admin-danger" : "admin-muted"}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                              <td><StatePill state={inv.state} /></td>
                              <td className="num">
                                {formatAmount(inv.totalAmountCents, inv.currency)}
                                {inv.state !== "paid" && inv.state !== "draft" && inv.paidAmountCents > 0 && (
                                  <small className="admin-muted"> · {formatAmount(inv.paidAmountCents, inv.currency)} paid</small>
                                )}
                              </td>
                              <td className="num">
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                                  {inv.fileUrl && (
                                    <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-teal" aria-label={`Open ${inv.number} PDF`} style={{ display: "inline-flex", alignItems: "center" }}>
                                      <ExternalLink size={14} />
                                    </a>
                                  )}
                                  {owing && (
                                    <button className="dash-tab-btn" onClick={() => openPayForm(inv.id)}>Record payment</button>
                                  )}
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
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5}><strong>{shown.length} of {all.length} invoices · total invoiced</strong></td>
                        <td className="num"><strong>{formatTotals(sumFor(shown.filter((i) => i.state !== "draft"), (i) => i.totalAmountCents))}</strong></td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={5} className="admin-muted">Paid</td>
                        <td className="num admin-muted">{formatTotals(sumFor(shown.filter((i) => i.state !== "draft"), (i) => i.paidAmountCents))}</td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={5}><strong>Owing</strong></td>
                        <td className="num"><strong>{formatTotals(sumFor(shown.filter((i) => i.state !== "draft"), (i) => i.totalDueAmountCents))}</strong></td>
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
