// Restart's overhead (console.expenses) and the totals that set all costs,
// hosting included, against revenue from the Finance page. Hosting itself is
// per-deployment and lives in DeploymentMargins. Everything is folded into NGN
// (home currency); revenue in currencies other than NGN/USD/EUR is left out.

import { Fragment, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { loadWorkspaceNames } from "@/lib/admin";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { consoleSchema } from "@/lib/supabase";
import { formatAmount, formatDate } from "@/lib/format";
import {
  CADENCE_LABEL,
  CADENCE_OPTIONS,
  COST_CURRENCIES,
  EXPENSE_CATEGORIES,
  expenseInMonth,
  hostingExpenseIds,
  hostingInMonth,
  nextDue,
  serviceInMonth,
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
import { RowMenu } from "@/components/admin/RowMenu";
import { MultiSelectFilter } from "@/components/admin/MultiSelectFilter";
import { ExpenseCharts, categoryColor, type ChartItem } from "@/components/admin/ExpenseCharts";
import { formatNairaCompact } from "@/lib/format";

const CATEGORIES: Record<Expense["category"], string> = EXPENSE_CATEGORIES;
type Category = Expense["category"];

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");

const emptyForm = { name: "", vendor: "", category: "software" as Category, amount: "", currency: "NGN" as CostCurrency, cadence: "monthly" as Cadence, start: new Date().toISOString().slice(0, 10), end: "" };

/** view "summary": expenses vs revenue (stats and the month table). view "costs": the operating expense lines. view "rates": exchange rates and cash on hand. */
export function OperatingCosts({ finance, books, refresh, view }: { finance: FinanceOverview; books: Books; refresh: () => Promise<void>; view: "costs" | "rates" }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  // Ticked categories; null means all of them, so a category added later shows up without a click.
  const [catSel, setCatSel] = useState<Category[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<Record<keyof Settings, string>>>({});

  const rates = books.settings;
  const [, setLocation] = useLocation();
  // Expenses that hold a client server's cost are hosting (cost of sales); the rest are operating expenses.
  const hostingIds = hostingExpenseIds(books);
  // Hosting, client servers and Restart's own, is managed on the Hosting page, so it is not listed here too.
  const operating = books.expenses.filter((e) => !hostingIds.has(e.id) && e.category !== "infrastructure");
  const names = useAsyncResource(() => loadWorkspaceNames(), [], { enabled: view === "costs" });

  // Only the current month is needed here; the Overview does its own roll-ups (lib/financeSummary).
  const calc = useMemo(() => ({ thisMonth: monthKey(new Date()) }), []);

  // The category filter, the table and the charts all read from here.
  // Hosting is an expense too: client servers and Restart's own, this month. The Hosting page manages them;
  // here they count in the totals, the filter and the charts, and show as one row that opens that page.
  const hostingItems = [
    ...books.services.map((sv) => ({ id: sv.id, name: sv.name, monthly: toNgn(serviceInMonth(sv, calc.thisMonth), sv.currency, rates) })),
    ...books.expenses
      .filter((e) => e.category === "infrastructure" && !hostingIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.name.replace(/\s+\((Hetzner|Contabo)\)$/, ""), monthly: toNgn(expenseInMonth(e, calc.thisMonth), e.currency, rates) }))
  ].filter((h) => h.monthly > 0);
  const hostingTotal = hostingItems.reduce((sum, h) => sum + h.monthly, 0);
  const hostingDue = [
    ...books.services.map((sv) => (sv.expense_id ? books.expenses.find((e) => e.id === sv.expense_id) : undefined)),
    ...books.expenses.filter((e) => e.category === "infrastructure" && !hostingIds.has(e.id))
  ]
    .map((e) => (e ? nextDue(e, books.payments) : null))
    .filter((d): d is string => d !== null)
    .sort()[0] ?? null;

  const monthlyOf = (list: Expense[]) => list.reduce((sum, e) => sum + toNgn(expenseInMonth(e, calc.thisMonth), e.currency, rates), 0);
  const presentCategories = (Object.keys(CATEGORIES) as Category[]).filter((c) => (c === "infrastructure" ? hostingItems.length > 0 : operating.some((e) => e.category === c)));
  const showHosting = (catSel ?? presentCategories).includes("infrastructure") && hostingItems.length > 0;
  const ticked = catSel ?? presentCategories;
  const visibleExpenses = operating.filter((e) => ticked.includes(e.category));
  const chartItems: ChartItem[] = [
    ...visibleExpenses.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      categoryLabel: CATEGORIES[e.category],
      monthly: toNgn(expenseInMonth(e, calc.thisMonth), e.currency, rates)
    })),
    // All servers are one line in the charts too, the same as the row in the table.
    ...(showHosting ? [{ id: "servers", name: `Servers (${hostingItems.length})`, category: "infrastructure", categoryLabel: CATEGORIES.infrastructure, monthly: hostingTotal }] : [])
  ];

  // Vendors already used, offered as suggestions so the same one is spelled the same way each time.
  const vendors = Array.from(new Set(books.expenses.map((e) => e.vendor).filter((v): v is string => Boolean(v)))).sort();

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({ name: e.name, vendor: e.vendor ?? "", category: e.category, amount: String(e.amount_cents / 100), currency: e.currency, cadence: e.cadence, start: e.start_date, end: e.end_date ?? "" });
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
      vendor: form.vendor.trim() || null,
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="admin-section-title">Operating expenses</h2>
          <button className="dash-tab-btn active" onClick={startAdd}>Add expense</button>
        </div>
        <p className="admin-muted" style={{ margin: "4px 0 0" }}>Servers and hosting, for clients and for Restart itself, are on the <Link href="/finance/hosting" className="text-teal">Hosting</Link> page.</p>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); void save(); }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}
          >
            <input type="text" required placeholder="Name (e.g. Google Workspace)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input type="text" list="expense-vendors" maxLength={120} placeholder="Vendor (e.g. Namecheap)" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            <datalist id="expense-vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
              {Object.entries(CATEGORIES).filter(([k]) => k !== "infrastructure").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" required min="0" step="0.01" placeholder="Amount" style={{ width: 120 }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CostCurrency })}>
              {COST_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as Cadence })}>
              {CADENCE_OPTIONS.concat(CADENCE_OPTIONS.includes(form.cadence) ? [] : [form.cadence]).map((k) => <option key={k} value={k}>{CADENCE_LABEL[k]}</option>)}
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

        {operating.length === 0 && hostingItems.length === 0 ? (
          <div className="dash-empty-state">No operating expenses yet. Add tools, internet, salaries, fees and tax, then the ratios on Overview fill in.</div>
        ) : (
          <>
            <div className="admin-toolbar" style={{ margin: "10px 0" }}>
              <MultiSelectFilter
                label="Categories"
                allLabel="All categories"
                options={presentCategories
                  .map((c) => ({ value: c, label: CATEGORIES[c], swatch: categoryColor(c), total: c === "infrastructure" ? hostingTotal : monthlyOf(operating.filter((e) => e.category === c)) }))
                  .sort((x, y) => y.total - x.total)
                  .map((o) => ({ value: o.value, label: o.label, swatch: o.swatch, detail: formatNairaCompact(o.total) }))}
                selected={ticked}
                onChange={(next) => setCatSel(next.length === presentCategories.length ? null : (next as Category[]))}
              />
            </div>
            <div className="exp-layout">
            <div style={{ minWidth: 0 }}>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Expense</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Cadence</th>
                    <th className="num">Amount</th>
                    <th className="num">Per month</th>
                    <th>Next due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleExpenses
                    .map((e) => {
                      const due = nextDue(e, books.payments);
                      const overdue = due !== null && due < new Date().toISOString().slice(0, 10);
                      return (
                        <Fragment key={e.id}>
                          <tr className={overdue ? "row-overdue" : undefined}>
                            <td><strong>{e.name}</strong></td>
                            <td className="admin-muted">{e.vendor ?? "—"}</td>
                            <td>{CATEGORIES[e.category]}</td>
                            <td className="admin-muted">
                              {CADENCE_LABEL[e.cadence]}
                              {e.cadence !== "one_off" && e.end_date && <div>until {formatDate(e.end_date)}</div>}
                            </td>
                            <td className="num">{formatAmount(e.amount_cents, e.currency)}</td>
                            <td className="num">{e.cadence === "one_off" ? "—" : ngn(toNgn(expenseInMonth(e, calc.thisMonth), e.currency, rates))}</td>
                            <td className={overdue ? undefined : "admin-muted"}>
                              {e.cadence === "one_off" ? "—" : !due ? "ended" : overdue ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                                  <span className="admin-muted">{formatDate(due)}</span>
                                  <span className="pill-overdue">OVERDUE · {Math.max(1, Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(due)) / 86_400_000))}d</span>
                                </span>
                              ) : formatDate(due)}
                            </td>
                            <td className="num">
                              <RowMenu
                                label={`Actions for ${e.name}`}
                                items={[
                                  { label: "Mark paid", disabled: !books.paymentsAvailable || e.cadence === "one_off" || !due, onClick: () => setPayingId(payingId === e.id ? null : e.id) },
                                  { label: "Edit", onClick: () => startEdit(e) },
                                  { label: "Delete", danger: true, onClick: () => void remove(e) }
                                ]}
                              />
                            </td>
                          </tr>
                          {payingId === e.id && (
                            <tr>
                              <td colSpan={7}>
                                <PaymentForm books={books} expense={e} onClose={() => setPayingId(null)} onSaved={refresh} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  {showHosting && (
                    <tr className="clickable" onClick={() => setLocation("/finance/hosting")}>
                      <td>
                        <strong>Servers</strong>
                      </td>
                      <td>{CATEGORIES.infrastructure}</td>
                      <td className="admin-muted">Monthly</td>
                      <td className="num admin-muted">—</td>
                      <td className="num">{ngn(hostingTotal)}</td>
                      <td className="admin-muted">{hostingDue ? formatDate(hostingDue) : "—"}</td>
                      <td className="num" onClick={(ev) => ev.stopPropagation()}>
                        <RowMenu label="Actions for hosting" items={[{ label: "Open Hosting", onClick: () => setLocation("/finance/hosting") }]} />
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}><strong>Total per month</strong></td>
                    <td className="num"><strong>{ngn(visibleExpenses.filter((e) => e.cadence !== "one_off").reduce((sum, e) => sum + toNgn(expenseInMonth(e, calc.thisMonth), e.currency, rates), 0) + (showHosting ? hostingTotal : 0))}</strong></td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            {visibleExpenses.length === 0 && <div className="dash-empty-state">No categories ticked. Open the filter and tick one or more.</div>}
            </div>
            <aside className="exp-charts" aria-label="Charts of this month's operating costs">
              <ExpenseCharts items={chartItems} />
            </aside>
            </div>
          </>
        )}
      </div>
      </>
      )}
    </>
  );
}
