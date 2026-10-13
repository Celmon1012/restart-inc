// Create a client project from Ops, for clients with no onboarding and no
// Coolify project (e.g. WordPress maintenance retainers). On success it opens
// the new project on its Billing tab so the Lago customer can be linked.

import { useState } from "react";
import { useLocation } from "wouter";
import { consoleSchema } from "@/lib/supabase";
import { CLIENT_TYPE_LABEL, ENGAGEMENT_LABEL } from "@/lib/admin";
import { applyTemplate, templateFor } from "@/lib/projectTemplates";
import { toast } from "sonner";

const blank = { name: "", email: "", engagement: "operate", service: "", clientType: "", useTemplate: true };

export function AddClient() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await consoleSchema().rpc("admin_create_client_project", {
        p_name: form.name,
        p_contact_email: form.email,
        p_engagement_type: form.engagement,
        p_service: form.service || null,
        p_client_type: form.clientType || null
      });
      if (err) throw new Error(err.message);
      const template = form.useTemplate ? templateFor(form.engagement) : null;
      if (template) {
        try {
          await applyTemplate(data as string, template, { existingCount: 0, hasActive: false });
        } catch (templateErr) {
          // The project exists; only the starter milestones failed. Say so and carry on.
          toast.error(`Project created, but the starter milestones couldn't be added: ${(templateErr as Error).message}`);
        }
      }
      setLocation(`/admin/projects/${data as string}?tab=billing`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!open) return <button className="dash-tab-btn active" onClick={() => setOpen(true)}>Add client</button>;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
    >
      <input type="text" required minLength={2} maxLength={80} placeholder="Client / project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input type="email" required placeholder="Contact email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <select value={form.engagement} onChange={(e) => setForm({ ...form, engagement: e.target.value })} aria-label="Engagement">
        {Object.entries(ENGAGEMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input type="text" maxLength={80} placeholder="Service (e.g. WordPress maintenance)" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
      <select value={form.clientType} onChange={(e) => setForm({ ...form, clientType: e.target.value })} aria-label="Client type">
        <option value="">Client type…</option>
        {Object.entries(CLIENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {templateFor(form.engagement) && (
        <label className="admin-muted" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={form.useTemplate} onChange={(e) => setForm({ ...form, useTemplate: e.target.checked })} />
          Add the {ENGAGEMENT_LABEL[form.engagement] ?? form.engagement} milestones
        </label>
      )}
      <button type="submit" className="dash-tab-btn active" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
      <button type="button" className="dash-tab-btn" onClick={() => { setOpen(false); setError(null); }} disabled={busy}>Cancel</button>
      {error && <span className="admin-warn" role="alert">{error}</span>}
    </form>
  );
}
