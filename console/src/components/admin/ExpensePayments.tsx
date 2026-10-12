// Payments against expenses: the audit trail behind the monthly cost figures.
//  - PaymentForm: mark a recurring cost paid (a renewal) or log a one-off expense.
//  - ExpensePayments: the accounts money is paid from, the payments recorded, voiding a
//    mistaken entry (never an edit or a delete) and a CSV export for the accountant.
// Writes go to console.expense_payments / finance_accounts under the admin's own JWT;
// a database trigger refuses any change to a payment except voiding it.

import { useState } from "react";
import { toast } from "sonner";
import { consoleSchema } from "@/lib/supabase";
import { formatAmount, formatDate } from "@/lib/format";
import {
  COST_CURRENCIES,
  EXPENSE_CATEGORIES,
  nextDue,
  periodEndFor,
  type Books,
  type CostCurrency,
  type Expense,
  type ExpensePayment
} from "@/lib/financeBooks";

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
const today = () => new Date().toISOString().slice(0, 10);

/** Mark a recurring expense paid (pass `expense`), or log a one-off expense (omit it). */
export function PaymentForm({ books, expense, onClose, onSaved }: { books: Books; expense?: Expense; onClose: () => void; onSaved: () => Promise<void> }) {
  const accounts = books.accounts.filter((a) => a.active);
  const due = expense ? nextDue(expense, books.payments) : null;
  const recurring = Boolean(expense && expense.cadence !== "one_off");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Expense["category"]>("other");
  const [paidOn, setPaidOn] = useState(today());
  const [currency, setCurrency] = useState<CostCurrency>(expense?.currency ?? "NGN");
  const [amount, setAmount] = useState(expense ? String(expense.amount_cents / 100) : "");
  const rateFor = (c: CostCurrency) => (c === "USD" ? books.settings.usd_ngn : c === "EUR" ? books.settings.eur_ngn : 1);
  const [fx, setFx] = useState(String(rateFor(expense?.currency ?? "NGN")));
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [vat, setVat] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const fxNum = Number(fx);
  const ngnCost = Number.isFinite(amountNum) && Number.isFinite(fxNum) ? Math.round(amountNum * 100 * fxNum) : 0;

  const submit = async () => {
    if (!(amountNum > 0) || !(fxNum > 0)) return setError("Enter the amount paid and the exchange rate.");
    if (!expense && !name.trim()) return setError("Enter what the expense is for.");
    if (accounts.length > 0 && !accountId) return setError("Choose the account it was paid from.");
    setBusy(true);
    setError(null);
    try {
      let expenseId = expense?.id;
      if (!expenseId) {
        const { data, error: eErr } = await consoleSchema()
          .from("expenses")
          .insert({ name: name.trim(), category, amount_cents: Math.round(amountNum * 100), currency, cadence: "one_off", start_date: paidOn })
          .select("id")
          .single();
        if (eErr) throw new Error(eErr.message);
        expenseId = data.id as string;
      }
      const { error: pErr } = await consoleSchema()
        .from("expense_payments")
        .insert({
          expense_id: expenseId,
          account_id: accountId || null,
          paid_on: paidOn,
          period_end: recurring && due && expense ? periodEndFor(due, expense.cadence as Exclude<Expense["cadence"], "one_off">) : null,
          amount_cents: Math.round(amountNum * 100),
          currency,
          fx_rate: fxNum,
          amount_ngn_cents: ngnCost,
          vat_cents: vat ? Math.round(Number(vat) * 100) : 0,
          reference: reference.trim() || null,
          note: note.trim() || null
        });
      if (pErr) {
        // Don't leave a one-off expense behind with no payment against it.
        if (!expense && expenseId) await consoleSchema().from("expenses").delete().eq("id", expenseId);
        throw new Error(pErr.message);
      }
      toast.success(expense ? "Payment recorded" : "Expense logged");
      await onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "8px 0" }}
    >
      {expense ? (
        <strong>{expense.name}</strong>
      ) : (
        <>
          <input type="text" required placeholder="What for (e.g. Airtel 5G)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value as Expense["category"])} aria-label="Category">
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </>
      )}
      <label className="admin-muted">Paid on <input type="date" required max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></label>
      <input type="number" required min="0.01" step="0.01" placeholder="Amount" style={{ width: 120 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select
        value={currency}
        onChange={(e) => { const c = e.target.value as CostCurrency; setCurrency(c); setFx(String(rateFor(c))); }}
        aria-label="Currency"
        disabled={Boolean(expense)}
      >
        {COST_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {currency !== "NGN" && (
        <label className="admin-muted">₦ per {currency} <input type="number" min="0.0001" step="0.0001" style={{ width: 100 }} value={fx} onChange={(e) => setFx(e.target.value)} /></label>
      )}
      {accounts.length > 0 ? (
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Paid from" required>
          <option value="">Paid from…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
        </select>
      ) : (
        <span className="admin-muted">Add an account below to record where it was paid from.</span>
      )}
      <input type="number" min="0" step="0.01" placeholder="VAT on receipt (optional)" style={{ width: 170 }} value={vat} onChange={(e) => setVat(e.target.value)} />
      <input type="text" placeholder="Reference / receipt no." value={reference} onChange={(e) => setReference(e.target.value)} />
      <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" className="dash-tab-btn active" disabled={busy}>{busy ? "Saving…" : expense ? "Record payment" : "Log expense"}</button>
      <button type="button" className="dash-tab-btn" onClick={onClose} disabled={busy}>Cancel</button>
      <span className="admin-muted" style={{ flexBasis: "100%" }}>
        ₦ cost: {ngnCost > 0 ? ngn(ngnCost) : "—"}
        {recurring && due && expense ? ` · covers ${formatDate(due)} to ${formatDate(periodEndFor(due, expense.cadence as Exclude<Expense["cadence"], "one_off">))}` : ""}
      </span>
      {error && <span className="admin-warn" role="alert">{error}</span>}
    </form>
  );
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExpensePayments({ books, refresh }: { books: Books; refresh: () => Promise<void> }) {
  const [logging, setLogging] = useState(false);
  const [showVoided, setShowVoided] = useState(false);
  const [month, setMonth] = useState("");
  if (!books.paymentsAvailable) {
    return (
      <div className="admin-section">
        <p className="admin-muted">Payment records aren't set up yet. Run the expense payments migration (20261012120000) and reload.</p>
      </div>
    );
  }

  const expenseById = new Map(books.expenses.map((e) => [e.id, e]));
  const accountById = new Map(books.accounts.map((a) => [a.id, a]));
  const live = books.payments.filter((p) => !p.voided_at);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const paidThisMonth = live.filter((p) => p.paid_on.startsWith(thisMonth));
  const months = Array.from(new Set(books.payments.map((p) => p.paid_on.slice(0, 7)))).sort().reverse();
  const visible = books.payments.filter((p) => (showVoided || !p.voided_at) && (!month || p.paid_on.startsWith(month)));

  const voidPayment = async (p: ExpensePayment) => {
    const reason = window.prompt(`Void this ${ngn(p.amount_ngn_cents)} payment of ${formatDate(p.paid_on)}? It stays on record, marked void. Reason:`);
    if (!reason || !reason.trim()) return;
    const { error } = await consoleSchema().from("expense_payments").update({ voided_at: new Date().toISOString(), void_reason: reason.trim() }).eq("id", p.id);
    if (error) window.alert(error.message);
    else await refresh();
  };

  const exportCsv = () => {
    const header = ["paid_on", "expense", "category", "amount", "currency", "fx_rate", "amount_ngn", "vat", "account", "reference", "period_end", "note", "recorded_at", "status", "void_reason"];
    const rows = books.payments
      .slice()
      .sort((a, b) => a.paid_on.localeCompare(b.paid_on))
      .map((p) => {
        const e = expenseById.get(p.expense_id);
        return [
          p.paid_on, e?.name, e ? EXPENSE_CATEGORIES[e.category] : "", p.amount_cents / 100, p.currency, p.fx_rate, p.amount_ngn_cents / 100, p.vat_cents / 100,
          p.account_id ? accountById.get(p.account_id)?.name : "", p.reference, p.period_end, p.note, p.created_at, p.voided_at ? "void" : "paid", p.void_reason
        ].map(csvCell).join(",");
      });
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restart-expense-payments-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-section">
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="dash-tab-btn" onClick={exportCsv} disabled={books.payments.length === 0}>Export CSV</button>
          <button className="dash-tab-btn active" onClick={() => setLogging(true)}>Log expense</button>
        </div>
      </div>
      {logging && <PaymentForm books={books} onClose={() => setLogging(false)} onSaved={refresh} />}

      <p style={{ margin: "8px 0" }}>
        Paid this month: <strong>{ngn(paidThisMonth.reduce((s, p) => s + p.amount_ngn_cents, 0))}</strong>
        {books.accounts.length > 0 && (
          <span className="admin-muted">
            {" · "}
            {books.accounts
              .map((a) => ({ a, total: paidThisMonth.filter((p) => p.account_id === a.id).reduce((s, p) => s + p.amount_ngn_cents, 0) }))
              .filter((r) => r.total > 0)
              .map((r) => `${r.a.name} ${ngn(r.total)}`)
              .join(" · ") || "no payments yet this month"}
          </span>
        )}
      </p>

      <div className="admin-toolbar">
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          <option value="">All months</option>
          {months.map((m) => <option key={m} value={m}>{new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
        </select>
        <label className="admin-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Show voided
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="dash-empty-state">No payments recorded{month ? " for this month" : " yet"}. Use Mark paid on a recurring expense, or Log expense for a one-off.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Paid on</th>
                <th>Expense</th>
                <th>Account</th>
                <th>Reference</th>
                <th className="num">Amount</th>
                <th className="num">₦ cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const e = expenseById.get(p.expense_id);
                return (
                  <tr key={p.id} style={p.voided_at ? { opacity: 0.55 } : undefined}>
                    <td>{formatDate(p.paid_on)}</td>
                    <td>
                      <strong style={p.voided_at ? { textDecoration: "line-through" } : undefined}>{e?.name ?? "Expense"}</strong>
                      {p.voided_at && <div className="admin-warn">void · {p.void_reason}</div>}
                      {p.period_end && !p.voided_at && <div className="admin-muted">covers to {formatDate(p.period_end)}</div>}
                    </td>
                    <td className="admin-muted">{p.account_id ? accountById.get(p.account_id)?.name ?? "—" : "—"}</td>
                    <td className="admin-muted">{p.reference ?? "—"}</td>
                    <td className="num">{formatAmount(p.amount_cents, p.currency)}{p.vat_cents > 0 && <small className="admin-muted"> incl. VAT {formatAmount(p.vat_cents, p.currency)}</small>}</td>
                    <td className="num">{ngn(p.amount_ngn_cents)}</td>
                    <td>{!p.voided_at && <button className="dash-tab-btn" onClick={() => void voidPayment(p)}>Void</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
