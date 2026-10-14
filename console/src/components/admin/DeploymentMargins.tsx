// Hosting: what a client pays for hosting against what their servers cost Restart.
//   - Hosting margin compares a client's hosting plans (dedicated-server-*) with the monthly cost
//     of their servers. That is the only place a margin means something.
//   - Services (retainers, maintenance, pods) are revenue only: their cost is people's time, which
//     isn't tracked, so they get no margin.
// A server's cost is an expense (console.expenses) linked from console.services, so it is paid,
// recorded and audited like any other expense on the Expenses page. Hetzner servers are synced
// from Coolify: a server running a client's resources with no record is offered for tracking, and a
// tracked server Coolify no longer sees is offered for ending. Contabo servers are kept by hand.

import { Fragment, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { RowMenu } from "@/components/admin/RowMenu";
import { PaymentForm } from "@/components/admin/ExpensePayments";
import { consoleSchema } from "@/lib/supabase";
import { loadWorkspaceNames, loadCoolifyProjects } from "@/lib/admin";
import { formatAmount, formatDate, formatPercent } from "@/lib/format";
import { CADENCE_LABEL, CADENCE_OPTIONS, COST_CURRENCIES, expenseInMonth, hostingExpenseIds, nextDue, toNgn, totalsToNgn, type Books, type Cadence, type CostCurrency, type Expense, type Service } from "@/lib/financeBooks";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { FinanceOverview } from "@/pages/admin/Finance";

const PROVIDER_LABEL: Record<Service["provider"], string> = { hetzner: "Hetzner", contabo: "Contabo", other: "Other" };
const DEFAULT_CURRENCY: Record<Service["provider"], CostCurrency> = { hetzner: "EUR", contabo: "USD", other: "NGN" };

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
const PROVIDER_SUFFIX = /^(.*\S)\s+\((Hetzner|Contabo)\)$/;
/** An internal server's expense is named "cp.restart.ng (Contabo)": pull the provider back out of the name. */
function splitProvider(name: string): { name: string; provider: Service["provider"] | null } {
  const m = name.match(PROVIDER_SUFFIX);
  if (!m) return { name, provider: null };
  return { name: m[1], provider: m[2] === "Hetzner" ? "hetzner" : "contabo" };
}
const cadenceShort: Record<Cadence, string> = { weekly: "/wk", monthly: "/mo", quarterly: "/qtr", annual: "/yr", one_off: "" };
const today = () => new Date().toISOString().slice(0, 10);

interface Form {
  /** A client's server (billed on to them, so it has a margin) or one of Restart's own. */
  kind: "client" | "internal";
  cadence: Cadence;
  workspaceId: string;
  name: string;
  provider: Service["provider"];
  cost: string;
  currency: CostCurrency;
  start: string;
  end: string;
  coolifyServerUuid: string;
}
const blankForm = (): Form => ({ kind: "client", cadence: "monthly", workspaceId: "", name: "", provider: "hetzner", cost: "", currency: "EUR", start: today(), end: "", coolifyServerUuid: "" });

export function DeploymentMargins({ finance, books, refresh }: { finance: FinanceOverview; books: Books; refresh: () => Promise<void> }) {
  const names = useAsyncResource(() => loadWorkspaceNames(), [], { errorMessage: "Failed to load clients" });
  // Coolify is a separate system; if it's down the margins still work, only the sync hints go.
  const coolify = useAsyncResource(() => loadCoolifyProjects(), [], { errorMessage: "Couldn't reach Coolify" });

  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "client" | "internal">("all");

  const rates = books.settings;
  const nameOf = (id: string) => names.data?.get(id) ?? "Unknown project";
  const isActive = (s: Service) => !s.ended_on || s.ended_on >= today();

  const rows = useMemo(() => {
    const lines = finance.subscriptions;
    const ids = new Set<string>(books.services.map((s) => s.workspace_id));
    for (const c of finance.clients) if (c.workspaceId && Object.keys(c.mrr).length) ids.add(c.workspaceId);
    return Array.from(ids)
      .map((id) => {
        const clientRows = finance.clients.filter((c) => c.workspaceId === id);
        const mrrTotal = clientRows.reduce((sum, c) => sum + totalsToNgn(c.mrr, rates), 0);
        // Without subscription lines (an older billing function) all revenue counts as hosting, as before.
        const hostingSale = lines
          ? lines.filter((l) => l.workspaceId === id && l.kind === "hosting").reduce((sum, l) => sum + toNgn(l.monthlyCents, l.currency, rates), 0)
          : mrrTotal;
        const discount = clientRows.reduce((sum, c) => sum + totalsToNgn(c.discount, rates), 0);
        const couponLeft = clientRows.reduce<number | null>((m, c) => (c.couponInvoicesLeft == null ? m : m === null ? c.couponInvoicesLeft : Math.min(m, c.couponInvoicesLeft)), null);
        const services = books.services.filter((s) => s.workspace_id === id);
        const cost = services.filter(isActive).reduce((sum, s) => sum + toNgn(s.monthly_cost_cents, s.currency, rates), 0);
        return {
          id, hostingSale, discount, couponLeft, cost, services,
          margin: hostingSale - cost,
          pct: hostingSale > 0 ? ((hostingSale - cost) / hostingSale) * 100 : null
        };
      })
      // Services (retainers, maintenance) aren't hosting, so a client with only those isn't listed here.
      .filter((r) => r.hostingSale > 0 || r.services.length > 0)
      .sort((a, b) => a.margin - b.margin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, finance, rates]);

  // Restart's own servers (the Coolify host, the mail server): expenses in the Hosting category that no
  // client's server record owns. They are paid and audited like any expense, and are listed here.
  const clientExpenseIds = hostingExpenseIds(books);
  const internal = books.expenses
    .filter((e) => e.category === "infrastructure" && !clientExpenseIds.has(e.id))
    .map((e) => {
      const due = nextDue(e, books.payments);
      const ended = Boolean(e.end_date && e.end_date < today());
      return { e, due, overdue: due !== null && due < today(), ended, monthly: ended ? 0 : toNgn(expenseInMonth(e, today().slice(0, 7)), e.currency, rates) };
    })
    .sort((a, b) => a.e.name.localeCompare(b.e.name));
  const internalCost = internal.reduce((s, r) => s + r.monthly, 0);

  const totals = rows.reduce((t, r) => ({ sale: t.sale + r.hostingSale, cost: t.cost + r.cost }), { sale: 0, cost: 0 });

  // Coolify sync hints.
  const liveServers = useMemo(() => {
    const m = new Map<string, { name: string; workspaceId: string | null }>();
    for (const p of coolify.data ?? []) for (const s of p.servers) m.set(s.uuid, { name: s.name, workspaceId: p.workspaceId });
    return m;
  }, [coolify.data]);
  const tracked = new Set(books.services.filter(isActive).map((s) => s.coolify_server_uuid).filter(Boolean));
  const untracked = coolify.data
    ? Array.from(liveServers, ([uuid, s]) => ({ uuid, ...s })).filter((s) => s.workspaceId && !tracked.has(s.uuid))
    : [];
  const vanished = coolify.data
    ? books.services.filter((s) => isActive(s) && s.coolify_server_uuid && !liveServers.has(s.coolify_server_uuid))
    : [];

  const openAdd = (preset: Partial<Form> = {}) => {
    setEditingId(null);
    setEditingExpenseId(null);
    setFormError(null);
    setForm({ ...blankForm(), ...preset });
  };
  const openAddInternal = () => {
    setEditingId(null);
    setEditingExpenseId(null);
    setFormError(null);
    setForm({ ...blankForm(), kind: "internal" });
  };
  const openEditInternal = (e: Expense) => {
    setEditingId(null);
    setEditingExpenseId(e.id);
    setFormError(null);
    const parts = splitProvider(e.name);
    setForm({ ...blankForm(), kind: "internal", cadence: e.cadence, name: parts.name, provider: parts.provider ?? "other", cost: String(e.amount_cents / 100), currency: e.currency, start: e.start_date, end: e.end_date ?? "" });
  };
  const openEdit = (s: Service) => {
    setEditingExpenseId(null);
    setEditingId(s.id);
    setFormError(null);
    setForm({
      kind: "client",
      cadence: "monthly",
      workspaceId: s.workspace_id,
      name: s.name,
      provider: s.provider,
      cost: String(s.monthly_cost_cents / 100),
      currency: s.currency,
      start: s.started_on,
      end: s.ended_on ?? "",
      coolifyServerUuid: s.coolify_server_uuid ?? ""
    });
  };

  const save = async () => {
    if (!form) return;
    const cost = Number(form.cost);
    if (form.kind === "internal") {
      if (!form.name.trim() || !Number.isFinite(cost) || cost < 0) {
        setFormError("Enter a name and the cost.");
        return;
      }
      setSaving(true);
      setFormError(null);
      const expenseRow = {
        name: form.provider === "other" ? form.name.trim() : `${form.name.trim()} (${PROVIDER_LABEL[form.provider]})`,
        category: "infrastructure",
        amount_cents: Math.round(cost * 100),
        currency: form.currency,
        cadence: form.cadence,
        start_date: form.start,
        end_date: form.end || null
      };
      const { error } = editingExpenseId
        ? await consoleSchema().from("expenses").update(expenseRow).eq("id", editingExpenseId)
        : await consoleSchema().from("expenses").insert(expenseRow);
      setSaving(false);
      if (error) return setFormError(error.message);
      setForm(null);
      setEditingExpenseId(null);
      await refresh();
      return;
    }
    if (!form.workspaceId || !form.name.trim() || !Number.isFinite(cost) || cost < 0) {
      setFormError("Pick a client and enter a name and monthly cost.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const row = {
      workspace_id: form.workspaceId,
      name: form.name.trim(),
      provider: form.provider,
      coolify_server_uuid: form.coolifyServerUuid || null,
      monthly_cost_cents: Math.round(cost * 100),
      currency: form.currency,
      started_on: form.start,
      ended_on: form.end || null
    };
    // The cost itself lives on a linked expense, so the server can be paid and audited like any other.
    const expenseRow = {
      name: `${form.name.trim()} (${PROVIDER_LABEL[form.provider]})`,
      category: "infrastructure",
      amount_cents: row.monthly_cost_cents,
      currency: form.currency,
      cadence: "monthly",
      start_date: form.start,
      end_date: form.end || null
    };
    try {
      if (editingId) {
        const existing = books.services.find((x) => x.id === editingId);
        if (existing?.expense_id) {
          const { error: eErr } = await consoleSchema().from("expenses").update(expenseRow).eq("id", existing.expense_id);
          if (eErr) throw eErr;
        }
        const { error } = await consoleSchema().from("services").update(row).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: exp, error: eErr } = await consoleSchema().from("expenses").insert(expenseRow).select("id").single();
        if (eErr) throw eErr;
        const { error } = await consoleSchema().from("services").insert({ ...row, expense_id: exp.id });
        if (error) {
          // Don't leave an expense behind for a server that wasn't saved.
          await consoleSchema().from("expenses").delete().eq("id", exp.id);
          throw error;
        }
      }
      setForm(null);
      await refresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const end = async (s: Service) => {
    if (s.expense_id) {
      const { error: eErr } = await consoleSchema().from("expenses").update({ end_date: today() }).eq("id", s.expense_id);
      if (eErr) return window.alert(eErr.message);
    }
    const { error } = await consoleSchema().from("services").update({ ended_on: today() }).eq("id", s.id);
    if (error) window.alert(error.message);
    else await refresh();
  };
  const endInternal = async (e: Expense) => {
    const { error } = await consoleSchema().from("expenses").update({ end_date: today() }).eq("id", e.id);
    if (error) window.alert(error.message);
    else await refresh();
  };
  const removeInternal = async (e: Expense) => {
    if (books.payments.some((p) => p.expense_id === e.id)) {
      window.alert("This server has payments recorded against it, which are kept for the audit trail. Use End instead of Delete.");
      return;
    }
    if (!window.confirm(`Delete "${e.name}" entirely? Past months will lose its cost. Use End to keep history.`)) return;
    const { error } = await consoleSchema().from("expenses").delete().eq("id", e.id);
    if (error) window.alert(error.message);
    else await refresh();
  };

  const remove = async (s: Service) => {
    // Payments recorded against its expense are kept for the audit trail, so a paid server can only be ended.
    if (s.expense_id && books.payments.some((p) => p.expense_id === s.expense_id)) {
      window.alert("This server has payments recorded against it, which are kept for the audit trail. Use End instead of Delete.");
      return;
    }
    if (!window.confirm(`Delete "${s.name}" entirely? Past months will lose its cost. Use End to keep history.`)) return;
    const { error } = await consoleSchema().from("services").delete().eq("id", s.id);
    if (error) return window.alert(error.message);
    if (s.expense_id) await consoleSchema().from("expenses").delete().eq("id", s.expense_id);
    await refresh();
  };

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ margin: "0 0 10px" }}>
        {(["all", "client", "internal"] as const).map((k) => (
          <button key={k} className={`dash-tab-btn ${scope === k ? "active" : ""}`} onClick={() => setScope(k)} aria-pressed={scope === k}>
            {k === "all" ? `All (${rows.length + internal.length})` : k === "client" ? `Client (${rows.length})` : `Internal (${internal.length})`}
          </button>
        ))}
        <span className="admin-toolbar-spacer" />
        <button className="dash-tab-btn active" onClick={() => openAdd()}>Add server</button>
      </div>

      {form && (
        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}
        >
          {!editingId && !editingExpenseId && (
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Form["kind"] })} aria-label="Whose server">
              <option value="client">Client server</option>
              <option value="internal">Internal server (Restart's own)</option>
            </select>
          )}
          {form.kind === "client" ? (
            <>
              <select required value={form.workspaceId} onChange={(e) => setForm({ ...form, workspaceId: e.target.value })}>
                <option value="">Client / project…</option>
                {Array.from(names.data ?? [], ([id, n]) => ({ id, n })).sort((a, b) => a.n.localeCompare(b.n)).map((w) => <option key={w.id} value={w.id}>{w.n}</option>)}
              </select>
              <input type="text" required placeholder="Server name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select
                value={form.provider}
                onChange={(e) => {
                  const provider = e.target.value as Service["provider"];
                  setForm({ ...form, provider, currency: editingId ? form.currency : DEFAULT_CURRENCY[provider] });
                }}
              >
                {Object.entries(PROVIDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </>
          ) : (
            <>
              <input type="text" required placeholder="Server name (e.g. cp.restart.ng)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select
                value={form.provider}
                onChange={(e) => {
                  const provider = e.target.value as Service["provider"];
                  setForm({ ...form, provider, currency: editingExpenseId ? form.currency : DEFAULT_CURRENCY[provider] });
                }}
                aria-label="Provider"
              >
                {Object.entries(PROVIDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </>
          )}
          <input type="number" required min="0" step="0.01" placeholder={form.kind === "client" ? "Monthly cost" : "Cost"} style={{ width: 120 }} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CostCurrency })}>
            {COST_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {form.kind === "internal" && (
            <select value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as Cadence })} aria-label="How often it is billed">
              {CADENCE_OPTIONS.filter((c) => c !== "one_off").map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
            </select>
          )}
          <label>From <input type="date" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
          <label>Ended <input type="date" min={form.start} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          <button type="submit" className="dash-tab-btn active" disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Add"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          {formError && <span className="admin-warn" role="alert">{formError}</span>}
        </form>
      )}

      {rows.length === 0 && internal.length === 0 ? (
        <div className="dash-empty-state">No hosting tracked yet. Add each client's server with its monthly cost and the margin appears here.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Client / project</th>
                <th>Server</th>
                <th className="num">Hosting sale</th>
                <th className="num">Server cost</th>
                <th className="num">Margin</th>
                <th>Next due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(scope === "internal" ? [] : rows).map((r) => {
                const lines = r.services.map((sv) => {
                  const expense = sv.expense_id ? books.expenses.find((e) => e.id === sv.expense_id) : undefined;
                  const due = expense ? nextDue(expense, books.payments) : null;
                  return { sv, expense, due, overdue: due !== null && due < today() };
                });
                const paying = lines.find((l) => l.expense && l.expense.id === payingId);
                return (
                  <Fragment key={r.id}>
                    <tr className={lines.some((l) => l.overdue) ? "row-overdue" : undefined}>
                      <td><span className="system-healthy-pill">CLIENT</span></td>
                      <td>
                        <strong>{nameOf(r.id)}</strong>
                        {r.discount > 0 && (
                          <span
                            className="tip tip-warn"
                            tabIndex={0}
                            aria-label="Coupon applied"
                            data-tip={`Coupon: ${ngn(r.discount)}/mo not billed${r.couponLeft !== null ? ` · ${r.couponLeft} invoice${r.couponLeft === 1 ? "" : "s"} left` : ""}`}
                          >
                            <BellRing size={14} />
                          </span>
                        )}
                      </td>
                      <td>
                        {lines.length === 0 && <span className="admin-warn">no server cost recorded</span>}
                        {lines.map((l) => (
                          <div key={l.sv.id} className="srv-line">
                            <span className={isActive(l.sv) ? undefined : "admin-muted"}>
                              <strong style={{ fontWeight: 600 }}>{l.sv.name}</strong>
                              <div className="admin-muted">{PROVIDER_LABEL[l.sv.provider]} · {formatAmount(l.sv.monthly_cost_cents, l.sv.currency)}/mo</div>
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="num">
                        {r.hostingSale > 0 ? ngn(r.hostingSale) : r.cost > 0 ? <span className="admin-danger">not billed</span> : <span className="admin-muted">—</span>}
                      </td>
                      <td className="num">{ngn(r.cost)}</td>
                      <td className={`num ${r.margin < 0 ? "admin-danger" : ""}`}>
                        {r.hostingSale > 0 || r.cost > 0 ? ngn(r.margin) : "—"}
                        {r.pct !== null && <span className={r.pct < 0 ? "admin-danger" : "admin-muted"} style={{ marginLeft: 8 }}>{formatPercent(r.pct, 0)}</span>}
                      </td>
                      <td>
                        {lines.map((l) => (
                          <div key={l.sv.id} className="srv-line">
                            {l.sv.ended_on && l.due === null ? (
                              <span className="admin-muted">ended {formatDate(l.sv.ended_on)}</span>
                            ) : l.overdue ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                                <span className="admin-muted">{formatDate(l.due as string)}</span>
                                <span className="pill-overdue">OVERDUE</span>
                              </span>
                            ) : l.due ? (
                              <span className="admin-muted">{formatDate(l.due)}</span>
                            ) : (
                              <span className="admin-muted">—</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="num">
                        {lines.map((l) => (
                          <div key={l.sv.id} className="srv-line" style={{ justifyContent: "flex-end" }}>
                            <RowMenu
                              label={`Actions for ${l.sv.name}`}
                              items={[
                                { label: "Mark paid", disabled: !books.paymentsAvailable || !l.expense || l.due === null, onClick: () => l.expense && setPayingId(payingId === l.expense.id ? null : l.expense.id) },
                                { label: "Edit", onClick: () => openEdit(l.sv) },
                                ...(isActive(l.sv) && !l.sv.ended_on ? [{ label: "End today", onClick: () => void end(l.sv) }] : []),
                                { label: "Delete", danger: true, onClick: () => void remove(l.sv) }
                              ]}
                            />
                          </div>
                        ))}
                      </td>
                    </tr>
                    {paying?.expense && (
                      <tr>
                        <td colSpan={8}>
                          <PaymentForm books={books} expense={paying.expense} onClose={() => setPayingId(null)} onSaved={refresh} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {(scope === "client" ? [] : internal).map(({ e, due, overdue, ended, monthly }) => (
                <Fragment key={e.id}>
                  <tr className={overdue ? "row-overdue" : undefined} style={ended ? { opacity: 0.6 } : undefined}>
                    <td><span className="system-healthy-pill neutral">INTERNAL</span></td>
                    <td className="admin-muted">Restart</td>
                    <td>
                      <strong style={{ fontWeight: 600 }}>{splitProvider(e.name).name}</strong>
                      <div className="admin-muted">{splitProvider(e.name).provider ? PROVIDER_LABEL[splitProvider(e.name).provider as Service["provider"]] : "Provider not set"} · {formatAmount(e.amount_cents, e.currency)}{cadenceShort[e.cadence]}</div>
                    </td>
                    <td className="num admin-muted">—</td>
                    <td className="num">{ended ? "—" : ngn(monthly)}</td>
                    <td className="num admin-muted">—</td>
                    <td>
                      {ended ? <span className="admin-muted">ended {formatDate(e.end_date as string)}</span> : overdue ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                          <span className="admin-muted">{formatDate(due as string)}</span>
                          <span className="pill-overdue">OVERDUE</span>
                        </span>
                      ) : due ? <span className="admin-muted">{formatDate(due)}</span> : <span className="admin-muted">—</span>}
                    </td>
                    <td className="num">
                      <RowMenu
                        label={`Actions for ${e.name}`}
                        items={[
                          { label: "Mark paid", disabled: !books.paymentsAvailable || due === null, onClick: () => setPayingId(payingId === e.id ? null : e.id) },
                          { label: "Edit", onClick: () => openEditInternal(e) },
                          ...(!ended ? [{ label: "End today", onClick: () => void endInternal(e) }] : []),
                          { label: "Delete", danger: true, onClick: () => void removeInternal(e) }
                        ]}
                      />
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
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><strong>Client hosting margin</strong></td>
                <td className="num">{ngn(totals.sale)}</td>
                <td className="num">{ngn(totals.cost)}</td>
                <td className="num">
                  <strong>{ngn(totals.sale - totals.cost)}</strong>
                  {totals.sale > 0 && <span className="admin-muted" style={{ marginLeft: 8 }}>{formatPercent(((totals.sale - totals.cost) / totals.sale) * 100, 0)}</span>}
                </td>
                <td colSpan={2} />
              </tr>
              {internal.length > 0 && (
                <tr>
                  <td colSpan={3}><strong>Internal servers</strong></td>
                  <td className="num admin-muted">—</td>
                  <td className="num"><strong>{ngn(internalCost)}</strong></td>
                  <td colSpan={3} className="admin-muted">cost of Restart's own servers, not billed to anyone</td>
                </tr>
              )}
              <tr>
                <td colSpan={3}><strong>All hosting cost</strong></td>
                <td className="num admin-muted">—</td>
                <td className="num"><strong>{ngn(totals.cost + internalCost)}</strong></td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {untracked.length > 0 && (
        <div className="cp-card" style={{ marginBottom: 12 }} role="status">
          <div className="cp-card-head"><span>Servers in Coolify with no cost recorded</span></div>
          {untracked.map((s) => (
            <p key={s.uuid} style={{ margin: "6px 0" }}>
              <strong>{s.name}</strong> runs {nameOf(s.workspaceId!)}.{" "}
              <button className="dash-tab-btn" onClick={() => openAdd({ workspaceId: s.workspaceId!, name: s.name, coolifyServerUuid: s.uuid })}>Add its cost</button>
            </p>
          ))}
        </div>
      )}
      {vanished.length > 0 && (
        <div className="cp-card" style={{ marginBottom: 12 }} role="status">
          <div className="cp-card-head"><span>Servers no longer running client resources in Coolify</span></div>
          {vanished.map((s) => (
            <p key={s.id} style={{ margin: "6px 0" }}>
              <strong>{s.name}</strong> ({nameOf(s.workspace_id)}) is still costing {formatAmount(s.monthly_cost_cents, s.currency)}/mo.{" "}
              <button className="dash-tab-btn" onClick={() => void end(s)}>End today</button>
            </p>
          ))}
        </div>
      )}
      {coolify.error && <p className="admin-muted">Couldn't reach Coolify, so server sync hints are off: {coolify.error}</p>}
    </div>
  );
}

