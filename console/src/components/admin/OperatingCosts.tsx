// Restart's overhead (console.expenses) and the totals that set all costs,
// hosting included, against revenue from the Finance page. Hosting itself is
// per-deployment and lives in DeploymentMargins. Everything is folded into NGN
// (home currency); revenue in currencies other than NGN/USD/EUR is left out.

import { Fragment, useMemo, useState } from "react";
import { Link } from "wouter";
import { loadWorkspaceNames } from "@/lib/admin";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { consoleSchema } from "@/lib/supabase";
import { formatAmount, formatDate, formatPercent } from "@/lib/format";
import {
  CADENCE_LABEL,
  COST_CURRENCIES,
  EXPENSE_CATEGORIES,
  expenseInMonth,
  hostingExpenseIds,
  hostingInMonth,
  nextDue,
  monthKey,
  overheadInMonth,
  toNgn,
  totalsToNgn,
  type Books,
  type Cadence,
  type CostCurrency,
  type Expense,
  type Settings
} from "@/lib/financeBooks";
import type { FinanceOverview } from "@/pages/admin/Finance";
import { PaymentForm } from "@/components/admin/ExpensePayments";

const CATEGORIES: Record<Expense["category"], string> = EXPENSE_CATEGORIES;
type Category = Expense["category"];

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");

const emptyForm = { name: "", category: "software" as Category, amount: "", currency: "NGN" as CostCurrency, cadence: "monthly" as Cadence, start: new Date().toISOString().slice(0, 10), end: "" };

/** view "summary": expenses vs revenue (stats and the month table). view "costs": the operating expense lines. view "rates": exchange rates and cash on hand. */
export function OperatingCosts({ finance, books, refresh, view }: { finance: FinanceOverview; books: Books; refresh: () => Promise<void>; view: "summary" | "costs" | "rates" }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<Record<keyof Settings, string>>>({});

  const rates = books.settings;
  // Expenses that hold a client server's cost are hosting (cost of sales); the rest are operating expenses.
  const hostingIds = hostingExpenseIds(books);
  const operating = books.expenses.filter((e) => !hostingIds.has(e.id));
  const names = useAsyncResource(() => loadWorkspaceNames(), [], { enabled: view === "costs" });

  const calc = useMemo(() => {
    const now = new Date();
    const thisMonth = monthKey(now);
    const costNow = (m: string) => hostingInMonth(books, m) + overheadInMonth(books, m);

    // Last 6 months, oldest first. Finance's monthly series has 12 months of collected revenue.
    const months = Array.from({ length: 6 }, (_, i) => {
      const key = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1)));
      const collected = totalsToNgn(finance.monthly.find((m) => m.month === key)?.collected, rates);
      const hosting = hostingInMonth(books, key);
      const overhead = overheadInMonth(books, key);
      return { key, collected, hosting, overhead, cost: hosting + overhead, net: collected - hosting - overhead };
    });

    const recurringOverhead = operating
      .filter((e) => e.cadence !== "one_off")
      .reduce((s, e) => s + toNgn(expenseInMonth(e, thisMonth), e.currency, rates), 0);
    const runRate = hostingInMonth(books, thisMonth) + recurringOverhead;

    const last3 = months.slice(-3);
    const avgCollected = last3.reduce((s, m) => s + m.collected, 0) / 3;
    const avgCost = last3.reduce((s, m) => s + m.cost, 0) / 3;
    // What is actually billed: contracted MRR less recurring coupons (a free support period, say).
    const mrr = totalsToNgn(finance.totals.mrr, rates) - totalsToNgn(finance.totals.discount, rates);
    const burn = Math.max(0, avgCost - avgCollected);
    const byCategory = (Object.keys(CATEGORIES) as Category[])
      .map((c) => ({ c, v: operating.filter((e) => e.category === c).reduce((s, e) => s + toNgn(expenseInMonth(e, thisMonth), e.currency, rates), 0) }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v);

    return {
      thisMonth,
      runRate,
      costThisMonth: costNow(thisMonth),
      months,
      avgCollected,
      avgCost,
      mrrCoverage: runRate > 0 ? mrr / runRate : null,
      breakEvenGap: Math.max(0, runRate - mrr),
      margin3m: avgCollected > 0 ? ((avgCollected - avgCost) / avgCollected) * 100 : null,
      burn,
      runwayMonths: burn > 0 ? books.settings.cash_ngn_cents / burn : null,
      byCategory
    };
  }, [books, finance, rates, operating]);

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({ name: e.name, category: e.category, amount: String(e.amount_cents / 100), currency: e.currency, cadence: e.cadence, start: e.start_date, end: e.end_date ?? "" });
    setFormError(null);
    setShowForm(true);
  };
  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.name.trim() || !Number.isFinite(amount) || amount < 0) {
      setFormError("Enter a name and a valid amount.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const row = {
      name: form.name.trim(),
      category: form.category,
      amount_cents: Math.round(amount * 100),
      currency: form.currency,
      cadence: form.cadence,
      start_date: form.start,
      end_date: form.cadence === "one_off" ? null : form.end || null
    };
    try {
      const q = editingId ? consoleSchema().from("expenses").update(row).eq("id", editingId) : consoleSchema().from("expenses").insert(row);
      const { error: err } = await q;
      if (err) throw err;
      setShowForm(false);
      await refresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: Expense) => {
    if (!window.confirm(`Delete "${e.name}"? Past months will no longer include it.`)) return;
    const { error: err } = await consoleSchema().from("expenses").delete().eq("id", e.id);
    // 23503: payments are recorded against it. Those are kept for the audit trail, so end the cost instead.
    if (err?.code === "23503") window.alert("This cost has payments recorded against it, which are kept for the audit trail. Set an end date on it instead of deleting it.");
    else if (err) window.alert(err.message);
    else await refresh();
  };

  const saveSetting = async (key: keyof Settings, value: number) => {
    const { error: err } = await consoleSchema().from("finance_settings").update({ [key]: value }).eq("id", true);
    if (err) window.alert(err.message);
    else {
      setEdits((e) => ({ ...e, [key]: undefined }));
      await refresh();
    }
  };

  const covered = calc.mrrCoverage !== null && calc.mrrCoverage >= 1;
  const settingField = (key: "usd_ngn" | "eur_ngn", label: string) => (
    <>
      <label>
        {label}{" "}
        <input type="number" step="0.01" min="1" style={{ width: 110 }} value={edits[key] ?? String(rates[key])} onChange={(e) => setEdits({ ...edits, [key]: e.target.value })} />
      </label>
      {edits[key] !== undefined && (
        <button className="dash-tab-btn active" onClick={() => void saveSetting(key, Number(edits[key]))} disabled={!(Number(edits[key]) > 0)}>Save</button>
      )}
    </>
  );

  return (
    <>
      {view === "summary" && (
      <div className="admin-section">
        <h2 className="admin-section-title">Expenses vs revenue</h2>
        <div className="cp-stats">
          <div>
            <small>MONTHLY EXPENSES</small>
            <strong>{ngn(calc.runRate)}</strong>
            <em>hosting + recurring operating · {ngn(calc.costThisMonth)} this month</em>
          </div>
          <div>
            <small>MRR COVERS EXPENSES</small>
            <strong className={calc.mrrCoverage !== null && !covered ? "warn" : undefined}>
              {calc.mrrCoverage === null ? "—" : `${calc.mrrCoverage.toFixed(2)}×`}
            </strong>
            <em>{calc.mrrCoverage === null ? "add expenses to see this" : covered ? "recurring revenue exceeds expenses" : `${ngn(calc.breakEvenGap)} MRR short of break-even`}</em>
          </div>
          <div>
            <small>3-MONTH MARGIN</small>
            <strong className={calc.margin3m !== null && calc.margin3m < 0 ? "warn" : undefined}>
              {calc.margin3m === null ? "—" : formatPercent(calc.margin3m, 1)}
            </strong>
            <em>collected {ngn(calc.avgCollected)} vs cost {ngn(calc.avgCost)} / mo</em>
          </div>
          <div>
            <small>RUNWAY</small>
            <strong className={calc.runwayMonths !== null && calc.runwayMonths < 6 ? "warn" : undefined}>
              {calc.burn === 0 ? "Self-funding" : calc.runwayMonths === null ? "—" : `${calc.runwayMonths.toFixed(1)} mo`}
            </strong>
            <em>{calc.burn === 0 ? "collections ≥ expenses (3-mo avg)" : `${ngn(calc.burn)} net burn / mo`}</em>
          </div>
        </div>

        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Collected</th>
                <th className="num">Hosting</th>
                <th className="num">Operating</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {[...calc.months].reverse().map((m) => (
                <tr key={m.key}>
                  <td>{new Date(`${m.key}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}</td>
                  <td className="num">{ngn(m.collected)}</td>
                  <td className="num">{ngn(m.hosting)}</td>
                  <td className="num">{ngn(m.overhead)}</td>
                  <td className={`num ${m.net < 0 ? "admin-warn" : "admin-ok"}`}>{ngn(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-muted mt-2">
          All in NGN at the rates set under Settings, Rates & cash. Hosting is the server cost of client deployments; operating expenses are everything else. Annual and quarterly expenses are spread evenly across months.
        </p>
      </div>
      )}

      {view === "rates" && (
      <div className="admin-section">
        <p className="admin-muted">The exchange rates convert dollar and euro expenses and revenue into naira. Cash on hand is what runway is measured against, so update it when your balance changes.</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          {settingField("usd_ngn", "USD → NGN")}
          {settingField("eur_ngn", "EUR → NGN")}
          <label>
            Cash on hand (₦){" "}
            <input
              type="number"
              step="1"
              min="0"
              style={{ width: 150 }}
              value={edits.cash_ngn_cents ?? String(rates.cash_ngn_cents / 100)}
              onChange={(e) => setEdits({ ...edits, cash_ngn_cents: e.target.value })}
            />
          </label>
          {edits.cash_ngn_cents !== undefined && (
            <button className="dash-tab-btn active" onClick={() => void saveSetting("cash_ngn_cents", Math.round(Number(edits.cash_ngn_cents) * 100))} disabled={!(Number(edits.cash_ngn_cents) >= 0)}>Save</button>
          )}
        </div>
      </div>
      )}

      {view === "costs" && (
      <>
      <div className="admin-section">
        <h2 className="admin-section-title">Client hosting</h2>
        <p className="admin-muted">Servers run for clients. Their monthly cost is an expense like any other, so you pay and record it here. Add, edit or end a server on the Hosting page.</p>
        {books.services.filter((sv) => sv.expense_id).length === 0 ? (
          <div className="dash-empty-state">No client servers yet. <Link href="/finance/hosting" className="text-teal">Add one on Hosting</Link>.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Server</th>
                  <th>Client</th>
                  <th className="num">Amount</th>
                  <th>Next due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {books.services.filter((sv) => sv.expense_id).map((sv) => {
                  const e = books.expenses.find((x) => x.id === sv.expense_id);
                  if (!e) return null;
                  const due = nextDue(e, books.payments);
                  const overdue = due !== null && due < new Date().toISOString().slice(0, 10);
                  return (
                    <Fragment key={sv.id}>
                      <tr className={overdue ? "row-overdue" : undefined} style={due === null ? { opacity: 0.6 } : undefined}>
                        <td><strong>{sv.name}</strong><div className="admin-muted">{sv.provider === "hetzner" ? "Hetzner" : sv.provider === "contabo" ? "Contabo" : "Other"}</div></td>
                        <td>{names.data?.get(sv.workspace_id) ?? "—"}</td>
                        <td className="num">{formatAmount(e.amount_cents, e.currency)}</td>
                        <td className={overdue ? undefined : "admin-muted"}>
                          {!due ? "ended" : overdue ? (
                            <>
                              <span className="pill-overdue">OVERDUE · {Math.max(1, Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(due)) / 86_400_000))}d</span>
                              <div className="admin-muted">due {formatDate(due)}</div>
                            </>
                          ) : formatDate(due)}
                        </td>
                        <td>
                          {books.paymentsAvailable && due && <button className="dash-tab-btn active" onClick={() => setPayingId(payingId === e.id ? null : e.id)}>Mark paid</button>}
                        </td>
                      </tr>
                      {payingId === e.id && (
                        <tr>
                          <td colSpan={5}>
                            <PaymentForm books={books} expense={e} onClose={() => setPayingId(null)} onSaved={refresh} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="admin-section-title">Operating expenses</h2>
          <button className="dash-tab-btn active" onClick={startAdd}>Add expense</button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); void save(); }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}
          >
            <input type="text" required placeholder="Name (e.g. Google Workspace)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" required min="0" step="0.01" placeholder="Amount" style={{ width: 120 }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CostCurrency })}>
              {COST_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as Cadence })}>
              {Object.entries(CADENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label>{form.cadence === "one_off" ? "Date" : "From"} <input type="date" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
            {form.cadence !== "one_off" && (
              <label>Until <input type="date" min={form.start} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
            )}
            <button type="submit" className="dash-tab-btn active" disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Add"}</button>
            <button type="button" className="dash-tab-btn" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            {formError && <span className="admin-warn" role="alert">{formError}</span>}
          </form>
        )}

        {operating.length === 0 ? (
          <div className="dash-empty-state">No operating expenses yet. Add tools, internet, salaries, fees and tax, then the ratios on Overview fill in.</div>
        ) : (
          <>
            {calc.byCategory.length > 0 && (
              <p className="admin-muted" style={{ margin: "8px 0" }}>
                This month by category:{" "}
                {calc.byCategory.map((r) => `${CATEGORIES[r.c]} ${ngn(r.v)}`).join(" · ")}
              </p>
            )}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cost</th>
                    <th>Category</th>
                    <th>Cadence</th>
                    <th className="num">Amount</th>
                    <th className="num">Per month (₦)</th>
                    <th>Period</th>
                    <th>Next due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {operating.map((e) => {
                    const due = nextDue(e, books.payments);
                    const overdue = due !== null && due < new Date().toISOString().slice(0, 10);
                    return (
                    <Fragment key={e.id}>
                    <tr className={overdue ? "row-overdue" : undefined}>
                      <td><strong>{e.name}</strong></td>
                      <td>{CATEGORIES[e.category]}</td>
                      <td>{CADENCE_LABEL[e.cadence]}</td>
                      <td className="num">{formatAmount(e.amount_cents, e.currency)}</td>
                      <td className="num">{e.cadence === "one_off" ? "—" : ngn(toNgn(expenseInMonth(e, calc.thisMonth), e.currency, rates))}</td>
                      <td className="admin-muted">
                        {formatDate(e.start_date)}{e.cadence !== "one_off" && ` → ${e.end_date ? formatDate(e.end_date) : "ongoing"}`}
                      </td>
                      <td className={overdue ? undefined : "admin-muted"}>
                        {e.cadence === "one_off" ? "—" : !due ? "ended" : overdue ? (
                          <>
                            <span className="pill-overdue">OVERDUE · {Math.max(1, Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(due)) / 86_400_000))}d</span>
                            <div className="admin-muted">due {formatDate(due)}</div>
                          </>
                        ) : formatDate(due)}
                      </td>
                      <td>
                        {books.paymentsAvailable && e.cadence !== "one_off" && due && (
                          <><button className="dash-tab-btn active" onClick={() => setPayingId(payingId === e.id ? null : e.id)}>Mark paid</button>{" "}</>
                        )}
                        <button className="dash-tab-btn" onClick={() => startEdit(e)}>Edit</button>{" "}
                        <button className="dash-tab-btn" onClick={() => void remove(e)}>Delete</button>
                      </td>
                    </tr>
                    {payingId === e.id && (
                      <tr>
                        <td colSpan={8}>
                          <PaymentForm books={books} expense={e} onClose={() => setPayingId(null)} onSaved={refresh} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      </>
      )}
    </>
  );
}
