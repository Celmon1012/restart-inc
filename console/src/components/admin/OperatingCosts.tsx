// Restart's own operating costs, set against revenue from the Finance page.
// Costs live in console.expenses; the USD->NGN rate and cash balance in
// console.finance_settings. Everything is folded into NGN (home currency) for
// the ratios; revenue in currencies other than NGN/USD is left out.

import { useMemo, useState } from "react";
import { consoleSchema } from "@/lib/supabase";
import { formatAmount, formatDate, formatPercent } from "@/lib/format";
import { ErrorAlert, LoadingState } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { FinanceOverview } from "@/pages/admin/Finance";

const CATEGORIES = {
  infrastructure: "Infrastructure",
  software: "Software & tools",
  people: "People",
  marketing: "Marketing",
  legal_tax: "Legal & tax",
  banking_fees: "Banking & fees",
  other: "Other"
} as const;
type Category = keyof typeof CATEGORIES;
type Cadence = "monthly" | "quarterly" | "annual" | "one_off";
const CADENCE_LABEL: Record<Cadence, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", one_off: "One-off" };

interface Expense {
  id: string;
  name: string;
  category: Category;
  amount_cents: number;
  currency: "NGN" | "USD";
  cadence: Cadence;
  start_date: string;
  end_date: string | null;
  notes: string | null;
}
interface Settings {
  usd_ngn: number;
  cash_ngn_cents: number;
}
interface CostData {
  expenses: Expense[];
  settings: Settings;
}

async function loadCosts(): Promise<CostData> {
  const [exp, set] = await Promise.all([
    consoleSchema().from("expenses").select("id,name,category,amount_cents,currency,cadence,start_date,end_date,notes").order("start_date", { ascending: false }),
    consoleSchema().from("finance_settings").select("usd_ngn,cash_ngn_cents").eq("id", true).maybeSingle()
  ]);
  if (exp.error) throw exp.error;
  if (set.error) throw set.error;
  const s = set.data;
  return {
    // bigint comes back as a number from PostgREST; numeric as a string in some setups.
    expenses: (exp.data ?? []).map((e) => ({ ...e, amount_cents: Number(e.amount_cents) })) as Expense[],
    settings: { usd_ngn: Number(s?.usd_ngn ?? 1500), cash_ngn_cents: Number(s?.cash_ngn_cents ?? 0) }
  };
}

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");

const toNgn = (cents: number, currency: string, rate: number) => (currency === "NGN" ? cents : currency === "USD" ? cents * rate : 0);

/** Revenue totals ({NGN: kobo, USD: cents}) folded into kobo. */
const totalsToNgn = (t: Record<string, number> | undefined, rate: number) =>
  Object.entries(t ?? {}).reduce((sum, [c, v]) => sum + toNgn(v, c, rate), 0);

/** What an expense costs in the given month ("YYYY-MM"), in its own currency's minor units. */
function costInMonth(e: Expense, month: string): number {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`; // string compare against ISO dates; any day <= 31 sorts correctly
  if (e.start_date > monthEnd) return 0;
  if (e.end_date && e.end_date < monthStart) return 0;
  if (e.cadence === "one_off") return e.start_date.slice(0, 7) === month ? e.amount_cents : 0;
  if (e.cadence === "quarterly") return e.amount_cents / 3;
  if (e.cadence === "annual") return e.amount_cents / 12;
  return e.amount_cents;
}

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

const emptyForm = { name: "", category: "infrastructure" as Category, amount: "", currency: "NGN" as "NGN" | "USD", cadence: "monthly" as Cadence, start: new Date().toISOString().slice(0, 10), end: "" };

export function OperatingCosts({ finance }: { finance: FinanceOverview }) {
  const { data, loading, error, retry, refresh } = useAsyncResource<CostData>(() => loadCosts(), [], { errorMessage: "Failed to load operating costs" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState<string | null>(null);
  const [cashInput, setCashInput] = useState<string | null>(null);

  const rate = data?.settings.usd_ngn ?? 1500;

  const calc = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const thisMonth = monthKey(now);
    const costFor = (month: string) => data.expenses.reduce((s, e) => s + toNgn(costInMonth(e, month), e.currency, rate), 0);
    const recurringNow = data.expenses
      .filter((e) => e.cadence !== "one_off")
      .reduce((s, e) => s + toNgn(costInMonth(e, thisMonth), e.currency, rate), 0);

    // Last 6 months, oldest first. Finance's monthly series has 12 months of collected revenue.
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
      const key = monthKey(d);
      const collected = totalsToNgn(finance.monthly.find((m) => m.month === key)?.collected, rate);
      const cost = costFor(key);
      return { key, collected, cost, net: collected - cost };
    });

    const last3 = months.slice(-3);
    const avgCollected = last3.reduce((s, m) => s + m.collected, 0) / 3;
    const avgCost = last3.reduce((s, m) => s + m.cost, 0) / 3;
    const mrr = totalsToNgn(finance.totals.mrr, rate);
    const burn = Math.max(0, avgCost - avgCollected);
    const byCategory = (Object.keys(CATEGORIES) as Category[])
      .map((c) => ({
        c,
        v: data.expenses.filter((e) => e.category === c).reduce((s, e) => s + toNgn(costInMonth(e, thisMonth), e.currency, rate), 0)
      }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v);

    return {
      thisMonth,
      recurringNow,
      costThisMonth: months[months.length - 1].cost,
      months,
      avgCollected,
      avgCost,
      mrr,
      mrrCoverage: recurringNow > 0 ? mrr / recurringNow : null,
      breakEvenGap: Math.max(0, recurringNow - mrr),
      margin3m: avgCollected > 0 ? ((avgCollected - avgCost) / avgCollected) * 100 : null,
      burn,
      runwayMonths: burn > 0 ? data.settings.cash_ngn_cents / burn : null,
      byCategory
    };
  }, [data, finance, rate]);

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
      end_date: form.end || null
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
    if (err) window.alert(err.message);
    else await refresh();
  };

  const saveSettings = async (patch: Partial<Settings>) => {
    const { error: err } = await consoleSchema().from("finance_settings").update(patch).eq("id", true);
    if (err) window.alert(err.message);
    else {
      setRateInput(null);
      setCashInput(null);
      await refresh();
    }
  };

  if (loading) return <LoadingState label="Loading operating costs…" />;
  if (error) return <ErrorAlert message={`Couldn't load operating costs: ${error}`} onRetry={retry} retryLabel="Reload costs" />;
  if (!data || !calc) return null;

  const empty = data.expenses.length === 0;
  const covered = calc.mrrCoverage !== null && calc.mrrCoverage >= 1;

  return (
    <>
      <div className="admin-section">
        <h2 className="admin-section-title">Operating costs vs revenue</h2>
        <div className="cp-stats">
          <div>
            <small>MONTHLY RUN-RATE COST</small>
            <strong>{ngn(calc.recurringNow)}</strong>
            <em>recurring, {calc.thisMonth} · {ngn(calc.costThisMonth)} incl. one-offs</em>
          </div>
          <div>
            <small>MRR COVERS COSTS</small>
            <strong className={calc.mrrCoverage !== null && !covered ? "warn" : undefined}>
              {calc.mrrCoverage === null ? "—" : `${calc.mrrCoverage.toFixed(2)}×`}
            </strong>
            <em>{calc.mrrCoverage === null ? "add costs to see this" : covered ? "recurring revenue exceeds costs" : `${ngn(calc.breakEvenGap)} MRR short of break-even`}</em>
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
            <em>{calc.burn === 0 ? "collections ≥ costs (3-mo avg)" : `${ngn(calc.burn)} net burn / mo`}</em>
          </div>
        </div>

        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Collected</th>
                <th className="num">Operating cost</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {[...calc.months].reverse().map((m) => (
                <tr key={m.key}>
                  <td>{formatDate(`${m.key}-01T00:00:00Z`).replace(/^1 /, "")}</td>
                  <td className="num">{ngn(m.collected)}</td>
                  <td className="num">{ngn(m.cost)}</td>
                  <td className={`num ${m.net < 0 ? "admin-warn" : "admin-ok"}`}>{ngn(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-muted mt-2">
          All in NGN. USD figures convert at the rate below; revenue in other currencies is excluded. Annual and quarterly costs are spread evenly across months.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <label>
            USD → NGN{" "}
            <input
              type="number"
              step="0.01"
              min="1"
              style={{ width: 110 }}
              value={rateInput ?? String(data.settings.usd_ngn)}
              onChange={(e) => setRateInput(e.target.value)}
            />
          </label>
          {rateInput !== null && (
            <button className="dash-tab-btn active" onClick={() => void saveSettings({ usd_ngn: Number(rateInput) })} disabled={!(Number(rateInput) > 0)}>Save rate</button>
          )}
          <label>
            Cash on hand (₦){" "}
            <input
              type="number"
              step="1"
              min="0"
              style={{ width: 150 }}
              value={cashInput ?? String(data.settings.cash_ngn_cents / 100)}
              onChange={(e) => setCashInput(e.target.value)}
            />
          </label>
          {cashInput !== null && (
            <button className="dash-tab-btn active" onClick={() => void saveSettings({ cash_ngn_cents: Math.round(Number(cashInput) * 100) })} disabled={!(Number(cashInput) >= 0)}>Save cash</button>
          )}
        </div>
      </div>

      <div className="admin-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="admin-section-title">Cost lines</h2>
          <button className="dash-tab-btn active" onClick={startAdd}>Add cost</button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); void save(); }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}
          >
            <input type="text" required placeholder="Name (e.g. Hetzner CX42)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" required min="0" step="0.01" placeholder="Amount" style={{ width: 120 }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as "NGN" | "USD" })}>
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
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

        {empty ? (
          <div className="dash-empty-state">No costs yet. Add hosting, tools, salaries, fees and tax, then the ratios above fill in.</div>
        ) : (
          <>
            {calc.byCategory.length > 0 && (
              <p className="admin-muted" style={{ margin: "8px 0" }}>
                This month by category:{" "}
                {calc.byCategory.map((r) => `${CATEGORIES[r.c]} ${ngn(r.v)} (${Math.round((r.v / calc.costThisMonth) * 100)}%)`).join(" · ")}
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
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e) => (
                    <tr key={e.id}>
                      <td><strong>{e.name}</strong></td>
                      <td>{CATEGORIES[e.category]}</td>
                      <td>{CADENCE_LABEL[e.cadence]}</td>
                      <td className="num">{formatAmount(e.amount_cents, e.currency)}</td>
                      <td className="num">{e.cadence === "one_off" ? "—" : ngn(toNgn(costInMonth(e, calc.thisMonth), e.currency, rate))}</td>
                      <td className="admin-muted">
                        {formatDate(e.start_date)}{e.cadence !== "one_off" && ` → ${e.end_date ? formatDate(e.end_date) : "ongoing"}`}
                      </td>
                      <td>
                        <button className="dash-tab-btn" onClick={() => startEdit(e)}>Edit</button>{" "}
                        <button className="dash-tab-btn" onClick={() => void remove(e)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
