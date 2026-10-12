// The accounts business costs are paid from: bank accounts, cards, cash floats and wallets.
// Each has the details you'd need to recognise it on a statement: the bank, the account name
// as it appears there, and the account number. Add, edit and retire (retired accounts keep
// their payment history and drop out of the "Paid from" list). Admin-only (RLS).

import { useState } from "react";
import { RowMenu } from "@/components/admin/RowMenu";
import { consoleSchema } from "@/lib/supabase";
import { formatAmount } from "@/lib/format";
import { COST_CURRENCIES, type Account, type Books, type CostCurrency } from "@/lib/financeBooks";

const KIND_LABEL: Record<Account["kind"], string> = { bank: "Bank account", card: "Card", cash: "Cash", wallet: "Wallet" };
const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");

interface Form {
  name: string;
  kind: Account["kind"];
  currency: CostCurrency;
  bank_name: string;
  account_name: string;
  account_number: string;
  note: string;
}
const blank: Form = { name: "", kind: "bank", currency: "NGN", bank_name: "", account_name: "", account_number: "", note: "" };

export function AccountsPanel({ books, refresh }: { books: Books; refresh: () => Promise<void> }) {
  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!books.paymentsAvailable) {
    return <p className="admin-muted">Accounts aren't set up yet. Run the expense payments migration (20261012120000) and reload.</p>;
  }

  const paidOut = (id: string) =>
    books.payments.filter((p) => p.account_id === id && !p.voided_at).reduce((s, p) => s + p.amount_ngn_cents, 0);

  const openAdd = () => {
    setEditingId(null);
    setForm(blank);
    setError(null);
  };
  const openEdit = (a: Account) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      kind: a.kind,
      currency: a.currency,
      bank_name: a.bank_name ?? "",
      account_name: a.account_name ?? "",
      account_number: a.account_number ?? "",
      note: a.note ?? ""
    });
    setError(null);
  };

  const save = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const row = {
      name: form.name.trim(),
      kind: form.kind,
      currency: form.currency,
      bank_name: form.bank_name.trim() || null,
      account_name: form.account_name.trim() || null,
      account_number: form.account_number.trim() || null,
      note: form.note.trim() || null
    };
    const q = editingId ? consoleSchema().from("finance_accounts").update(row).eq("id", editingId) : consoleSchema().from("finance_accounts").insert(row);
    const { error: err } = await q;
    setSaving(false);
    if (err) {
      setError(/bank_name|account_name|account_number/.test(err.message) ? "The account details columns are missing. Run the account details migration (20261012130000), then try again." : err.message);
      return;
    }
    setForm(null);
    setEditingId(null);
    await refresh();
  };

  const toggle = async (a: Account) => {
    const { error: err } = await consoleSchema().from("finance_accounts").update({ active: !a.active }).eq("id", a.id);
    if (err) window.alert(err.message);
    else await refresh();
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="dash-tab-btn active" onClick={openAdd}>Add account</button>
      </div>

      {form && (
        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          className="cp-card"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16, padding: 16 }}
        >
          <div className="cp-card-head" style={{ flexBasis: "100%" }}><span>{editingId ? "Edit account" : "New account"}</span></div>
          <input type="text" required placeholder="Label (e.g. GTBank NGN current)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ minWidth: 240 }} />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Account["kind"] })} aria-label="Type">
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CostCurrency })} aria-label="Currency">
            {COST_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" placeholder="Bank (e.g. Guaranty Trust Bank)" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} style={{ minWidth: 220 }} />
          <input type="text" placeholder="Account name at the bank" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} style={{ minWidth: 240 }} />
          <input type="text" inputMode="numeric" placeholder="Account number" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} style={{ minWidth: 160 }} />
          <input type="text" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ minWidth: 220 }} />
          <button type="submit" className="dash-tab-btn active" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add account"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => { setForm(null); setEditingId(null); setError(null); }} disabled={saving}>Cancel</button>
          {error && <span className="admin-warn" role="alert">{error}</span>}
        </form>
      )}

      {books.accounts.length === 0 ? (
        <div className="dash-empty-state">No accounts yet. Add each bank account, card and cash float you pay business expenses from, with its account number.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Bank</th>
                <th>Account name</th>
                <th>Account number</th>
                <th className="num">Paid out (₦)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {books.accounts.map((a) => (
                <tr key={a.id} style={a.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    <strong>{a.name}</strong>
                    <div className="admin-muted">{KIND_LABEL[a.kind]} · {a.currency}{a.active ? "" : " · retired"}</div>
                    {a.note && <div className="admin-muted">{a.note}</div>}
                  </td>
                  <td>{a.bank_name ?? <span className="admin-muted">—</span>}</td>
                  <td>{a.account_name ?? <span className="admin-muted">—</span>}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{a.account_number ?? <span className="admin-muted">—</span>}</td>
                  <td className="num">{ngn(paidOut(a.id))}</td>
                  <td className="num">
                    <RowMenu
                      label={`Actions for ${a.name}`}
                      items={[
                        { label: "Edit", onClick: () => openEdit(a) },
                        { label: a.active ? "Retire" : "Restore", danger: a.active, onClick: () => void toggle(a) }
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
