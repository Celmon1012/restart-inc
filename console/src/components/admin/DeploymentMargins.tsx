// Margin per client deployment: what the workspace pays (Lago MRR) against what
// its servers cost Restart (console.services). Hetzner servers are synced from
// Coolify: a server running a client's resources with no service row is offered
// for tracking, and a tracked server Coolify no longer sees is offered for
// ending. Contabo servers have no Coolify link and are kept by hand.

import { useMemo, useState } from "react";
import { consoleSchema } from "@/lib/supabase";
import { loadWorkspaceNames, loadCoolifyProjects } from "@/lib/admin";
import { formatAmount, formatDate, formatPercent } from "@/lib/format";
import { COST_CURRENCIES, toNgn, totalsToNgn, type Books, type CostCurrency, type Service } from "@/lib/financeBooks";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { FinanceOverview } from "@/pages/admin/Finance";

const PROVIDER_LABEL: Record<Service["provider"], string> = { hetzner: "Hetzner", contabo: "Contabo", other: "Other" };
const DEFAULT_CURRENCY: Record<Service["provider"], CostCurrency> = { hetzner: "EUR", contabo: "USD", other: "NGN" };

const ngn = (cents: number) => formatAmount(Math.round(cents), "NGN");
const today = () => new Date().toISOString().slice(0, 10);

interface Form {
  workspaceId: string;
  name: string;
  provider: Service["provider"];
  cost: string;
  currency: CostCurrency;
  start: string;
  end: string;
  coolifyServerUuid: string;
}
const blankForm = (): Form => ({ workspaceId: "", name: "", provider: "hetzner", cost: "", currency: "EUR", start: today(), end: "", coolifyServerUuid: "" });

export function DeploymentMargins({ finance, books, refresh }: { finance: FinanceOverview; books: Books; refresh: () => Promise<void> }) {
  const names = useAsyncResource(() => loadWorkspaceNames(), [], { errorMessage: "Failed to load clients" });
  // Coolify is a separate system; if it's down the margins still work, only the sync hints go.
  const coolify = useAsyncResource(() => loadCoolifyProjects(), [], { errorMessage: "Couldn't reach Coolify" });

  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rates = books.settings;
  const nameOf = (id: string) => names.data?.get(id) ?? "Unknown project";
  const isActive = (s: Service) => !s.ended_on || s.ended_on >= today();

  const rows = useMemo(() => {
    const ids = new Set<string>(books.services.map((s) => s.workspace_id));
    for (const c of finance.clients) if (c.workspaceId && Object.keys(c.mrr).length) ids.add(c.workspaceId);
    return Array.from(ids)
      .map((id) => {
        const revenue = finance.clients.filter((c) => c.workspaceId === id).reduce((sum, c) => sum + totalsToNgn(c.mrr, rates), 0);
        const services = books.services.filter((s) => s.workspace_id === id);
        const cost = services.filter(isActive).reduce((sum, s) => sum + toNgn(s.monthly_cost_cents, s.currency, rates), 0);
        return { id, revenue, cost, margin: revenue - cost, pct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null, services };
      })
      .sort((a, b) => a.margin - b.margin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, finance, rates]);

  const totals = rows.reduce((t, r) => ({ revenue: t.revenue + r.revenue, cost: t.cost + r.cost }), { revenue: 0, cost: 0 });

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
    setFormError(null);
    setForm({ ...blankForm(), ...preset });
  };
  const openEdit = (s: Service) => {
    setEditingId(s.id);
    setFormError(null);
    setForm({
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
    try {
      const q = editingId ? consoleSchema().from("services").update(row).eq("id", editingId) : consoleSchema().from("services").insert(row);
      const { error } = await q;
      if (error) throw error;
      setForm(null);
      await refresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const end = async (s: Service) => {
    const { error } = await consoleSchema().from("services").update({ ended_on: today() }).eq("id", s.id);
    if (error) window.alert(error.message);
    else await refresh();
  };
  const remove = async (s: Service) => {
    if (!window.confirm(`Delete "${s.name}" entirely? Past months will lose its cost. Use End to keep history.`)) return;
    const { error } = await consoleSchema().from("services").delete().eq("id", s.id);
    if (error) window.alert(error.message);
    else await refresh();
  };

  return (
    <div className="admin-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="admin-section-title">Deployments: sale vs server cost</h2>
        <button className="dash-tab-btn active" onClick={() => openAdd()}>Add server</button>
      </div>

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

      {form && (
        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}
        >
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
          <input type="number" required min="0" step="0.01" placeholder="Monthly cost" style={{ width: 120 }} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CostCurrency })}>
            {COST_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label>From <input type="date" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
          <label>Ended <input type="date" min={form.start} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          <button type="submit" className="dash-tab-btn active" disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Add"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          {formError && <span className="admin-warn" role="alert">{formError}</span>}
        </form>
      )}

      {rows.length === 0 ? (
        <div className="dash-empty-state">No deployments tracked yet. Add each client's server with its monthly cost and margin appears here.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client / project</th>
                <th className="num">Sale (MRR)</th>
                <th className="num">Server cost</th>
                <th className="num">Margin</th>
                <th className="num">%</th>
                <th>Servers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{nameOf(r.id)}</strong></td>
                  <td className="num">{ngn(r.revenue)}</td>
                  <td className="num">{ngn(r.cost)}</td>
                  <td className={`num ${r.margin < 0 ? "admin-warn" : ""}`}>{ngn(r.margin)}</td>
                  <td className={`num ${r.pct !== null && r.pct < 0 ? "admin-warn" : ""}`}>{r.pct === null ? "—" : formatPercent(r.pct, 0)}</td>
                  <td>
                    {r.services.length === 0 && <span className="admin-warn">no server cost recorded</span>}
                    {r.services.map((s) => (
                      <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className={isActive(s) ? undefined : "admin-muted"}>
                          {s.name} · {PROVIDER_LABEL[s.provider]} · {formatAmount(s.monthly_cost_cents, s.currency)}/mo
                          {s.ended_on ? ` · ended ${formatDate(s.ended_on)}` : ""}
                        </span>
                        <button className="dash-tab-btn" onClick={() => openEdit(s)}>Edit</button>
                        {isActive(s) && !s.ended_on && <button className="dash-tab-btn" onClick={() => void end(s)}>End</button>}
                        <button className="dash-tab-btn" onClick={() => void remove(s)}>Delete</button>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Gross profit</strong></td>
                <td className="num">{ngn(totals.revenue)}</td>
                <td className="num">{ngn(totals.cost)}</td>
                <td className="num"><strong>{ngn(totals.revenue - totals.cost)}</strong></td>
                <td className="num">{totals.revenue > 0 ? formatPercent(((totals.revenue - totals.cost) / totals.revenue) * 100, 0) : "—"}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="admin-muted mt-2">
        Sale is each client's monthly recurring revenue from billing; cost is their active servers at the current rates. A server ended mid-month is prorated by day in the monthly figures. Contabo servers aren't in Coolify, so end them here by hand.
      </p>
    </div>
  );
}

