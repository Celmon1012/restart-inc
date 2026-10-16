// Hosting: every server Restart pays for, with where it runs and what it costs.
//   - A client's server and Restart's own are tagged CLIENT or INTERNAL; a server on one of Restart's
//     own projects counts as internal.
//   - A server can run more than one project. Its cost sits on one project's row, and the other
//     projects it also hosts are listed beside it. A dedicated server is only for a client who asks.
// A server's cost is an expense (console.expenses) linked from console.services, so it is paid,
// recorded and audited like any other expense on the Expenses page. Hetzner servers are synced
// from Coolify: a server running a client's resources with no record is offered for tracking, and a
// tracked server Coolify no longer sees is offered for ending. Contabo servers are kept by hand.

import { Fragment, useMemo, useState } from "react";
import { Link } from "wouter";
import { RowMenu } from "@/components/admin/RowMenu";
import { PaymentForm } from "@/components/admin/ExpensePayments";
import { consoleSchema } from "@/lib/supabase";
import { loadWorkspaceNames, loadCoolifyProjects, loadInternalWorkspaceIds } from "@/lib/admin";
import { formatAmount, formatDate } from "@/lib/format";
import { CADENCE_LABEL, CADENCE_OPTIONS, COST_CURRENCIES, expenseInMonth, hostingExpenseIds, nextDue, toNgn, type Books, type Cadence, type CostCurrency, type Expense, type Service } from "@/lib/financeBooks";
import { useAsyncResource } from "@/hooks/useAsyncResource";

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
const today = () => new Date().toISOString().slice(0, 10);

interface Form {
  /** A client's server (billed on to them) or one of Restart's own. */
  kind: "client" | "internal";
  cadence: Cadence;
  workspaceId: string;
  /** Other projects this server also runs. */
  alsoHosts: string[];
  name: string;
  provider: Service["provider"];
  ipAddress: string;
  cost: string;
  currency: CostCurrency;
  start: string;
  end: string;
  coolifyServerUuid: string;
}
const blankForm = (): Form => ({ kind: "client", cadence: "monthly", workspaceId: "", alsoHosts: [], name: "", provider: "hetzner", ipAddress: "", cost: "", currency: "EUR", start: today(), end: "", coolifyServerUuid: "" });

export function DeploymentMargins({ books, refresh }: { books: Books; refresh: () => Promise<void> }) {
  const names = useAsyncResource(() => loadWorkspaceNames(), [], { errorMessage: "Failed to load clients" });
  // Restart's own projects: a server on one of them is tagged INTERNAL, not CLIENT.
  const internalIds = useAsyncResource(() => loadInternalWorkspaceIds(), [], { errorMessage: "Failed to load clients" });
  const isInternalWs = (id: string) => Boolean(internalIds.data?.has(id));
  // Coolify is a separate system; if it's down the table still works, only the sync hints go.
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
  const alsoHostedBy = (serviceId: string) => books.serviceProjects.filter((p) => p.service_id === serviceId).map((p) => p.workspace_id);

  // One row per project that carries a server's cost.
  const rows = useMemo(() => {
    const ids = new Set<string>(books.services.map((s) => s.workspace_id));
    return Array.from(ids)
      .map((id) => {
        const services = books.services.filter((s) => s.workspace_id === id);
        const cost = services.filter(isActive).reduce((sum, s) => sum + toNgn(s.monthly_cost_cents, s.currency, rates), 0);
        return { id, services, cost };
      })
      .sort((a, b) => (names.data?.get(a.id) ?? "").localeCompare(names.data?.get(b.id) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, rates, names.data]);

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

  const clientRows = rows.filter((r) => !isInternalWs(r.id));
  const ownProjectRows = rows.filter((r) => isInternalWs(r.id));
  const clientCost = clientRows.reduce((sum, r) => sum + r.cost, 0);
  const ownCost = internalCost + ownProjectRows.reduce((sum, r) => sum + r.cost, 0);

  // Coolify sync hints.
  const liveServers = useMemo(() => {
    const m = new Map<string, { name: string; workspaceId: string | null; ip: string | null }>();
    for (const p of coolify.data ?? []) for (const s of p.servers) m.set(s.uuid, { name: s.name, workspaceId: p.workspaceId, ip: s.ip ?? null });
    return m;
  }, [coolify.data]);
  // A server's IP comes from Coolify when it can be matched (by its linked server, or by name), else from what was typed in.
  const ipFor = (uuid: string | null | undefined, name: string, typed: string | null | undefined) => {
    const live = uuid ? liveServers.get(uuid) : Array.from(liveServers.values()).find((s) => s.name.toLowerCase() === name.toLowerCase());
    return live?.ip ?? typed ?? null;
  };
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
  const openEditInternal = (e: Expense) => {
    setEditingId(null);
    setEditingExpenseId(e.id);
    setFormError(null);
    const parts = splitProvider(e.name);
    setForm({ ...blankForm(), kind: "internal", cadence: e.cadence, name: parts.name, provider: parts.provider ?? "other", ipAddress: e.ip_address ?? "", cost: String(e.amount_cents / 100), currency: e.currency, start: e.start_date, end: e.end_date ?? "" });
  };
  const openEdit = (s: Service) => {
    setEditingExpenseId(null);
    setEditingId(s.id);
    setFormError(null);
    setForm({
      kind: "client",
      cadence: "monthly",
      workspaceId: s.workspace_id,
      alsoHosts: alsoHostedBy(s.id),
      name: s.name,
      provider: s.provider,
      ipAddress: s.ip_address ?? "",
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
    const ip = form.ipAddress.trim() || null;
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
        ip_address: ip,
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
      setFormError("Pick a project and enter a name and monthly cost.");
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
      ip_address: ip,
      amount_cents: row.monthly_cost_cents,
      currency: form.currency,
      cadence: "monthly",
      start_date: form.start,
      end_date: form.end || null
    };
    const others = form.alsoHosts.filter((id) => id !== form.workspaceId);
    try {
      let serviceId = editingId;
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
        const { data: created, error } = await consoleSchema().from("services").insert({ ...row, expense_id: exp.id }).select("id").single();
        if (error) {
          // Don't leave an expense behind for a server that wasn't saved.
          await consoleSchema().from("expenses").delete().eq("id", exp.id);
          throw error;
        }
        serviceId = created.id as string;
      }
      // The other projects this server runs: replace the list, but only touch the table when there is something to change.
      if (serviceId && (others.length > 0 || (editingId && alsoHostedBy(editingId).length > 0))) {
        const { error: dErr } = await consoleSchema().from("service_projects").delete().eq("service_id", serviceId);
        if (dErr) throw dErr;
        if (others.length > 0) {
          const { error: iErr } = await consoleSchema().from("service_projects").insert(others.map((workspace_id) => ({ service_id: serviceId, workspace_id })));
          if (iErr) throw iErr;
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

  const where = (ip: string | null | undefined) => (ip ? ip : "IP not set");

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ margin: "0 0 10px" }}>
        {(["all", "client", "internal"] as const).map((k) => (
          <button key={k} className={`dash-tab-btn ${scope === k ? "active" : ""}`} onClick={() => setScope(k)} aria-pressed={scope === k}>
            {k === "all" ? `All (${rows.length + internal.length})` : k === "client" ? `Client (${clientRows.length})` : `Internal (${internal.length + ownProjectRows.length})`}
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
              <select required value={form.workspaceId} onChange={(e) => setForm({ ...form, workspaceId: e.target.value })} aria-label="Project that carries the cost">
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
          <input type="text" maxLength={100} placeholder="IP address (auto from Coolify)" style={{ width: 210 }} value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} />
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
          {form.kind === "client" && (
            <details>
              <summary className="admin-muted" style={{ cursor: "pointer" }}>Also runs {form.alsoHosts.length > 0 ? `(${form.alsoHosts.length})` : "other projects?"}</summary>
              <div style={{ display: "grid", gap: 4, padding: "6px 0" }}>
                {Array.from(names.data ?? [], ([id, n]) => ({ id, n }))
                  .filter((w) => w.id !== form.workspaceId)
                  .sort((a, b) => a.n.localeCompare(b.n))
                  .map((w) => (
                    <label key={w.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={form.alsoHosts.includes(w.id)}
                        onChange={(e) => setForm({ ...form, alsoHosts: e.target.checked ? [...form.alsoHosts, w.id] : form.alsoHosts.filter((id) => id !== w.id) })}
                      />
                      {w.n}
                    </label>
                  ))}
              </div>
            </details>
          )}
          <button type="submit" className="dash-tab-btn active" disabled={saving}>{saving ? "Saving…" : editingId || editingExpenseId ? "Update" : "Add"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          {formError && <span className="admin-warn" role="alert">{formError}</span>}
        </form>
      )}

      {rows.length === 0 && internal.length === 0 ? (
        <div className="dash-empty-state">No servers tracked yet. Add each server with its IP address and monthly cost.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Server</th>
                <th>Client / project</th>
                <th className="num">Server cost</th>
                <th>Next due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.filter((r) => scope === "all" || (scope === "client") === !isInternalWs(r.id)).map((r) => {
                const lines = r.services.map((sv) => {
                  const expense = sv.expense_id ? books.expenses.find((e) => e.id === sv.expense_id) : undefined;
                  const due = expense ? nextDue(expense, books.payments) : null;
                  return { sv, expense, due, overdue: due !== null && due < today() };
                });
                const paying = lines.find((l) => l.expense && l.expense.id === payingId);
                const sharedWith = Array.from(new Set(lines.flatMap((l) => alsoHostedBy(l.sv.id))));
                return (
                  <Fragment key={r.id}>
                    <tr className={lines.some((l) => l.overdue) ? "row-overdue" : undefined}>
                      <td>
                        {lines.map((l) => (
                          <div key={l.sv.id} className="srv-line">
                            <span className={isActive(l.sv) ? undefined : "admin-muted"}>
                              <strong style={{ fontWeight: 600 }}>{l.sv.name}</strong>{" "}
                              {isInternalWs(r.id) ? <span className="system-healthy-pill neutral">INTERNAL</span> : <span className="system-healthy-pill">CLIENT</span>}
                              <div className="admin-muted">{PROVIDER_LABEL[l.sv.provider]} · {where(ipFor(l.sv.coolify_server_uuid, l.sv.name, l.sv.ip_address))}</div>
                            </span>
                          </div>
                        ))}
                      </td>
                      <td>
                        <Link href={`/admin/projects/${r.id}`} className="text-teal"><strong>{nameOf(r.id)}</strong></Link>
                        {sharedWith.map((id) => (
                          <span key={id}>
                            {" + "}
                            <Link href={`/admin/projects/${id}`} className="text-teal">{nameOf(id)}</Link>
                          </span>
                        ))}
                      </td>
                      <td className="num">{ngn(r.cost)}</td>
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
                        <td colSpan={5}>
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
                    <td>
                      <strong style={{ fontWeight: 600 }}>{splitProvider(e.name).name}</strong>{" "}
                      <span className="system-healthy-pill neutral">INTERNAL</span>
                      <div className="admin-muted">{splitProvider(e.name).provider ? PROVIDER_LABEL[splitProvider(e.name).provider as Service["provider"]] : "Provider not set"} · {where(ipFor(null, splitProvider(e.name).name, e.ip_address))}</div>
                    </td>
                    <td className="admin-muted">Restart</td>
                    <td className="num">{ended ? "—" : ngn(monthly)}</td>
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
                      <td colSpan={5}>
                        <PaymentForm books={books} expense={e} onClose={() => setPayingId(null)} onSaved={refresh} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><strong>Client servers</strong></td>
                <td className="num"><strong>{ngn(clientCost)}</strong></td>
                <td colSpan={2} />
              </tr>
              {internal.length + ownProjectRows.length > 0 && (
                <tr>
                  <td colSpan={2}><strong>Internal servers</strong></td>
                  <td className="num"><strong>{ngn(ownCost)}</strong></td>
                  <td colSpan={2} className="admin-muted">Restart's own, not billed to anyone</td>
                </tr>
              )}
              <tr>
                <td colSpan={2}><strong>All hosting cost</strong></td>
                <td className="num"><strong>{ngn(clientCost + ownCost)}</strong></td>
                <td colSpan={2} />
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
