// VAT position: VAT collected on invoices (from Lago, the tax portion of each
// payment) less what has been remitted (console.vat_remittances). NGN only.
// Revenue figures elsewhere on Finance are ex-VAT; this is the money that is
// held for the tax authority rather than earned.

import { useState } from "react";
import { consoleSchema } from "@/lib/supabase";
import { formatAmount, formatDate } from "@/lib/format";
import { ErrorAlert, LoadingState } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { FinanceOverview } from "@/pages/admin/Finance";

interface Remittance {
  id: string;
  paid_on: string;
  amount_cents: number;
  reference: string | null;
  note: string | null;
}

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
const today = () => new Date().toISOString().slice(0, 10);

export function VatPanel({ finance }: { finance: FinanceOverview }) {
  const { data, loading, error, retry, refresh } = useAsyncResource<Remittance[]>(
    async () => {
      const { data: rows, error: err } = await consoleSchema().from("vat_remittances").select("id,paid_on,amount_cents,reference,note").order("paid_on", { ascending: false });
      if (err) throw err;
      return (rows ?? []).map((r) => ({ ...r, amount_cents: Number(r.amount_cents) })) as Remittance[];
    },
    [],
    { errorMessage: "Failed to load VAT remittances" }
  );
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(today());
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Loading VAT…" />;
  if (error) return <ErrorAlert message={`Couldn't load VAT: ${error}`} onRetry={retry} retryLabel="Reload VAT" />;

  const collected = finance.totals.vatCollected?.NGN ?? 0;
  const thisMonth = finance.totals.vatCollectedThisMonth?.NGN ?? 0;
  const remitted = (data ?? []).reduce((s, r) => s + r.amount_cents, 0);
  const owed = collected - remitted;
  const otherCurrencies = Object.keys(finance.totals.vatCollected ?? {}).filter((c) => c !== "NGN");

  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Enter the amount paid.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const { error: err } = await consoleSchema().from("vat_remittances").insert({ paid_on: paidOn, amount_cents: Math.round(value * 100), reference: reference.trim() || null });
    setSaving(false);
    if (err) return setFormError(err.message);
    setOpen(false);
    setAmount("");
    setReference("");
    await refresh();
  };

  const remove = async (r: Remittance) => {
    if (!window.confirm(`Delete the ${ngn(r.amount_cents)} remittance of ${formatDate(r.paid_on)}?`)) return;
    const { error: err } = await consoleSchema().from("vat_remittances").delete().eq("id", r.id);
    if (err) window.alert(err.message);
    else await refresh();
  };

  return (
    <div className="admin-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="admin-section-title">VAT</h2>
        <button className="dash-tab-btn active" onClick={() => setOpen(true)}>Log remittance</button>
      </div>
      <div className="cp-stats">
        <div>
          <small>VAT OWED</small>
          <strong className={owed > 0 ? "warn" : undefined}>{ngn(owed)}</strong>
          <em>collected less remitted</em>
        </div>
        <div>
          <small>COLLECTED THIS MONTH</small>
          <strong>{ngn(thisMonth)}</strong>
          <em>VAT inside payments received</em>
        </div>
        <div>
          <small>COLLECTED ALL-TIME</small>
          <strong>{ngn(collected)}</strong>
          <em>from invoices in billing</em>
        </div>
        <div>
          <small>REMITTED</small>
          <strong>{ngn(remitted)}</strong>
          <em>{(data ?? []).length} payment{(data ?? []).length === 1 ? "" : "s"} logged</em>
        </div>
      </div>

      {open && (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
          <label>Paid on <input type="date" required max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></label>
          <input type="number" required min="0.01" step="0.01" placeholder="Amount (₦)" style={{ width: 140 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input type="text" placeholder="Reference / period" value={reference} onChange={(e) => setReference(e.target.value)} />
          <button type="submit" className="dash-tab-btn active" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          {formError && <span className="admin-warn" role="alert">{formError}</span>}
        </form>
      )}

      {(data ?? []).length > 0 && (
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead><tr><th>Paid on</th><th>Reference</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.paid_on)}</td>
                  <td className="admin-muted">{r.reference ?? "—"}</td>
                  <td className="num">{ngn(r.amount_cents)}</td>
                  <td><button className="dash-tab-btn" onClick={() => void remove(r)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-muted mt-2">
        Revenue everywhere on this page is ex-VAT. VAT is read from your Lago invoices, so it only appears once a VAT rate is applied in Lago.
        {otherCurrencies.length > 0 && ` VAT in ${otherCurrencies.join(", ")} isn't included here.`}
      </p>
    </div>
  );
}
