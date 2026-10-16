// The Domains page body. A domain is an expense in the Domains category (name = the domain, vendor =
// the registrar, workspace_id = the client project, empty for Restart's own), billed yearly.

import { toast } from "sonner";
import { confirmAction } from "@/components/confirmAction";
import { Fragment, useState } from "react";
import { Link } from "wouter";
import { RowMenu } from "@/components/admin/RowMenu";
import { PaymentForm } from "@/components/admin/ExpensePayments";
import { consoleSchema } from "@/lib/supabase";
import { loadWorkspaceNames } from "@/lib/admin";
import { formatAmount, formatDate } from "@/lib/format";
import { COST_CURRENCIES, nextDue, toNgn, type Books, type CostCurrency, type Expense } from "@/lib/financeBooks";
import { useAsyncResource } from "@/hooks/useAsyncResource";

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
const today = () => new Date().toISOString().slice(0, 10);
const DEFAULT_REGISTRARS = ["Namecheap", "Upperlink"];
const YEARLY_FACTOR = { annual: 1, monthly: 12, quarterly: 4, weekly: 52, one_off: 1 } as const;

interface Form {
  workspaceId: string;
  domain: string;
  registrar: string;
  cost: string;
  currency: CostCurrency;
  start: string;
  end: string;
}
const blankForm = (): Form => ({ workspaceId: "", domain: "", registrar: "", cost: "", currency: "USD", start: today(), end: "" });

export function DomainsPanel({ books, refresh }: { books: Books; refresh: () => Promise<void> }) {
  const names = useAsyncResource(() => loadWorkspaceNames(), [], { errorMessage: "Failed to load clients" });
  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rates = books.settings;
  const registrars = Array.from(
    new Set([...DEFAULT_REGISTRARS, ...books.expenses.filter((e) => e.category === "domains").map((e) => e.vendor).filter((v): v is string => Boolean(v))])
  ).sort();

  const all = books.expenses
    .filter((e) => e.category === "domains")
    .map((e) => {
      const ended = Boolean(e.end_date && e.end_date < today());
      const due = ended ? null : nextDue(e, books.payments);
      const days = due ? Math.round((Date.parse(due) - Date.parse(today())) / 86_400_000) : null;
      return {
        e,
        ended,
        due,
        days,
        overdue: due !== null && due < today(),
        yearly: ended ? 0 : toNgn(e.amount_cents * YEARLY_FACTOR[e.cadence], e.currency, rates),
      };
    })
    .sort((a, b) => (a.ended === b.ended ? (a.due ?? "9999").localeCompare(b.due ?? "9999") : a.ended ? 1 : -1));
  const nameOf = (id: string | null | undefined) => (id ? names.data?.get(id) ?? "Unknown project" : "Restart");

  const openAdd = () => {
    setEditingId(null);
    setFormError(null);
    setForm(blankForm());
  };
  const openEdit = (e: Expense) => {
    setEditingId(e.id);
    setFormError(null);
    setForm({
      workspaceId: e.workspace_id ?? "",
      domain: e.name,
      registrar: e.vendor ?? "",
      cost: String(e.amount_cents / 100),
      currency: e.currency,
      start: e.start_date,
      end: e.end_date ?? ""
    });
  };

  const save = async () => {
    if (!form) return;
    const cost = Number(form.cost);
    if (!form.domain.trim() || !Number.isFinite(cost) || cost < 0) return setFormError("Enter the domain and its yearly cost.");
    setSaving(true);
    setFormError(null);
    const row = {
      name: form.domain.trim().toLowerCase(),
      vendor: form.registrar.trim() || null,
      category: "domains",
      amount_cents: Math.round(cost * 100),
      currency: form.currency,
      cadence: "annual",
      start_date: form.start,
      end_date: form.end || null,
      workspace_id: form.workspaceId || null
    };
    const { error } = editingId ? await consoleSchema().from("expenses").update(row).eq("id", editingId) : await consoleSchema().from("expenses").insert(row);
    setSaving(false);
    if (error) return setFormError(error.message);
    setForm(null);
    setEditingId(null);
    await refresh();
  };

  const endToday = async (e: Expense) => {
    const { error } = await consoleSchema().from("expenses").update({ end_date: today() }).eq("id", e.id);
    if (error) toast.error(error.message);
    else await refresh();
  };
  const remove = async (e: Expense) => {
    if (books.payments.some((p) => p.expense_id === e.id)) {
      toast.error("This domain has payments recorded against it, which are kept for the audit trail. Use End instead of Delete.");
      return;
    }
    if (!(await confirmAction({ title: "Delete domain?", description: `Delete "${e.name}" entirely? Past months will lose its cost. Use End to keep history.`, confirmLabel: "Delete" }))) return;
    const { error } = await consoleSchema().from("expenses").delete().eq("id", e.id);
    if (error) toast.error(error.message);
    else await refresh();
  };

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ margin: "0 0 10px" }}>
        <span className="admin-muted">{all.length} domain{all.length === 1 ? "" : "s"}</span>
        <span className="admin-toolbar-spacer" />
        <button className="dash-tab-btn active" onClick={openAdd}>Add domain</button>
      </div>

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
          <input type="text" required placeholder="Domain (e.g. kumoda.io)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          <input type="text" list="domain-registrars" maxLength={120} placeholder="Registrar (e.g. Namecheap)" value={form.registrar} onChange={(e) => setForm({ ...form, registrar: e.target.value })} />
          <datalist id="domain-registrars">{registrars.map((r) => <option key={r} value={r} />)}</datalist>
          <select value={form.workspaceId} onChange={(e) => setForm({ ...form, workspaceId: e.target.value })} aria-label="Client or project">
            <option value="">Restart (no project)</option>
            {Array.from(names.data ?? [], ([id, n]) => ({ id, n })).sort((a, b) => a.n.localeCompare(b.n)).map((w) => <option key={w.id} value={w.id}>{w.n}</option>)}
          </select>
          <input type="number" required min="0" step="0.01" placeholder="Cost per year" style={{ width: 130 }} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CostCurrency })}>
            {COST_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label>Term starts <input type="date" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
          <label>Ended <input type="date" min={form.start} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          <button type="submit" className="dash-tab-btn active" disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Add"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          {formError && <span className="admin-warn" role="alert">{formError}</span>}
        </form>
      )}

      {all.length === 0 ? (
        <div className="dash-empty-state">No domains yet. Add each domain with its registrar, yearly cost and the date its current term starts, and the renewal date appears here.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Client / project</th>
                <th>Registrar</th>
                <th className="num">Per year</th>
                <th>Renews</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {all.map(({ e, ended, due, days, overdue }) => (
                <Fragment key={e.id}>
                  <tr className={overdue ? "row-overdue" : undefined} style={ended ? { opacity: 0.6 } : undefined}>
                    <td>
                      <strong>{e.name}</strong>
                    </td>
                    <td className="admin-muted">
                      {e.workspace_id ? <Link href={`/admin/projects/${e.workspace_id}`} className="text-teal">{nameOf(e.workspace_id)}</Link> : nameOf(e.workspace_id)}
                    </td>
                    <td className="admin-muted">{e.vendor ?? "Not set"}</td>
                    <td className="num">{formatAmount(e.amount_cents, e.currency)}</td>
                    <td>
                      {ended ? (
                        <span className="admin-muted">ended {formatDate(e.end_date as string)}</span>
                      ) : overdue ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                          <span className="admin-muted">{formatDate(due as string)}</span>
                          <span className="pill-overdue">OVERDUE</span>
                        </span>
                      ) : due ? (
                        <span className={days !== null && days <= 60 ? "admin-warn" : "admin-muted"}>
                          {formatDate(due)}{days !== null && days <= 60 ? ` · ${days}d` : ""}
                        </span>
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td className="num">
                      <RowMenu
                        label={`Actions for ${e.name}`}
                        items={[
                          { label: "Mark paid", disabled: !books.paymentsAvailable || due === null, onClick: () => setPayingId(payingId === e.id ? null : e.id) },
                          { label: "Edit", onClick: () => openEdit(e) },
                          ...(!ended ? [{ label: "End today", onClick: () => void endToday(e) }] : []),
                          { label: "Delete", danger: true, onClick: () => void remove(e) }
                        ]}
                      />
                    </td>
                  </tr>
                  {payingId === e.id && (
                    <tr>
                      <td colSpan={6}>
                        <PaymentForm books={books} expense={e} onClose={() => setPayingId(null)} onSaved={refresh} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><strong>Total per year</strong></td>
                <td className="num"><strong>{ngn(all.reduce((s, r) => s + r.yearly, 0))}</strong></td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
