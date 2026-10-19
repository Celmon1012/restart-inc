// Money in: every payment received from a client, one row each, with the VAT inside it and the
// net-of-VAT total that Overview counts as "collected". Data comes from Lago through console-admin-finance.

import { useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { FinancePage } from "@/components/admin/FinancePage";
import { formatAmount, formatDate } from "@/lib/format";
import { formatTotals } from "@/pages/admin/Finance";
import { downloadCsv } from "@/lib/csv";

const addTo = (t: Record<string, number>, currency: string, cents: number) => {
  t[currency] = (t[currency] ?? 0) + cents;
  return t;
};
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default function FinanceReceived() {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState("all");
  const [client, setClient] = useState("all");
  const [search, setSearch] = useState("");

  return (
    <FinancePage title="Received" description="Every payment received from clients, and the VAT inside it." needs={["finance"]}>
      {({ finance: data }) => {
        const received = data.paymentsReceived ?? [];
        const months = Array.from(new Set(received.map((p) => p.date.slice(0, 7)))).sort().reverse();
        const clients = Array.from(new Set(received.map((p) => p.client))).sort();
        const needle = search.trim().toLowerCase();
        const rows = received.filter(
          (p) =>
            (month === "all" || p.date.startsWith(month)) &&
            (client === "all" || p.client === client) &&
            (!needle || [p.client, p.invoiceNumber, p.reference ?? ""].some((v) => v.toLowerCase().includes(needle)))
        );
        const total = rows.reduce<Record<string, number>>((t, p) => addTo(t, p.currency, p.amountCents), {});
        const vat = rows.reduce<Record<string, number>>((t, p) => addTo(t, p.currency, p.vatCents), {});
        const net = rows.reduce<Record<string, number>>((t, p) => addTo(t, p.currency, p.amountCents - p.vatCents), {});

        return (
          <div className="admin-section">
            <div className="admin-toolbar">
              <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
                <option value="all">All months</option>
                {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
              </select>
              <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
                <option value="all">All clients</option>
                {clients.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="admin-toolbar-spacer" />
              <div className="workspace-search-box">
                <Search size={13} />
                <input type="text" placeholder="Search client, invoice or reference…" aria-label="Search payments received" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button
                className="dash-tab-btn"
                disabled={rows.length === 0}
                onClick={() =>
                  downloadCsv(
                    `restart-payments-received-${today}.csv`,
                    ["date", "client", "invoice", "source", "reference", "amount", "vat_included", "net_ex_vat", "currency"],
                    rows.map((p) => [p.date, p.client, p.invoiceNumber, p.kind === "payment" ? "payment" : "marked paid", p.reference ?? "", p.amountCents / 100, p.vatCents / 100, (p.amountCents - p.vatCents) / 100, p.currency])
                  )
                }
              >
                Export CSV
              </button>
            </div>

            {data.paymentsReceived === undefined ? (
              <div className="dash-empty-state">This list needs the latest finance function; it appears once that has been redeployed.</div>
            ) : rows.length === 0 ? (
              <div className="dash-empty-state">No payments received in this view.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table tasks-compact">
                  <thead>
                    <tr><th>Date</th><th>Client</th><th>Invoice</th><th>Source</th><th className="num">VAT included</th><th className="num">Amount</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.date)}</td>
                        <td>{p.workspaceId ? <Link href={`/admin/projects/${p.workspaceId}`} className="text-teal">{p.client}</Link> : p.client}</td>
                        <td><strong>{p.invoiceNumber}</strong></td>
                        <td className="admin-muted">{p.kind === "payment" ? "Payment" : "Marked paid"}{p.reference ? ` · ${p.reference}` : ""}</td>
                        <td className="num admin-muted">{p.vatCents > 0 ? formatAmount(p.vatCents, p.currency) : "—"}</td>
                        <td className="num">{formatAmount(p.amountCents, p.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}><strong>{rows.length} payment{rows.length === 1 ? "" : "s"} · total received</strong></td>
                      <td className="num"><strong>{formatTotals(total)}</strong></td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="admin-muted">VAT included</td>
                      <td className="num admin-muted">{formatTotals(vat)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5}><strong>Net of VAT (what Overview counts as collected)</strong></td>
                      <td className="num"><strong>{formatTotals(net)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      }}
    </FinancePage>
  );
}
