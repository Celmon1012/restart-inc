// Rename / archive a console project. Archiving only hides it from the Ops
// lists: billing, servers, deliverables and the client's access are untouched.

import { useState } from "react";
import { consoleSchema } from "@/lib/supabase";

export function ProjectActions({
  id,
  name,
  archivedAt,
  onChanged
}: {
  id: string;
  name: string;
  archivedAt: string | null;
  onChanged: () => Promise<void> | void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await fn();
      if (err) throw new Error(err.message);
      setRenaming(false);
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rename = () => {
    const next = value.trim();
    if (!next || next === name) {
      setRenaming(false);
      return;
    }
    void run(() => consoleSchema().rpc("admin_rename_workspace", { p_workspace_id: id, p_name: next }));
  };

  const toggleArchive = () => {
    if (!archivedAt && !window.confirm(`Archive ${name}? It's hidden from Projects and Clients. Billing, servers and the client's access aren't affected, and you can restore it any time.`)) return;
    void run(() => consoleSchema().rpc("admin_set_workspace_archived", { p_workspace_id: id, p_archived: !archivedAt }));
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {renaming ? (
        <form onSubmit={(e) => { e.preventDefault(); rename(); }} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="text" autoFocus maxLength={120} aria-label="Project name" value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit" className="dash-tab-btn active" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => { setRenaming(false); setValue(name); }} disabled={busy}>Cancel</button>
        </form>
      ) : (
        <button className="dash-tab-btn" onClick={() => { setValue(name); setRenaming(true); }} disabled={busy}>Rename</button>
      )}
      <button className="dash-tab-btn" onClick={toggleArchive} disabled={busy}>{archivedAt ? "Restore" : "Archive"}</button>
      {error && <span className="admin-warn" role="alert">{error}</span>}
    </div>
  );
}
