// Link a console project to its Lago customer (workspaces.lago_customer_id).
// Candidates come from console-admin-finance (?customers=1), which holds the
// Lago key. After linking, the customer is re-linked to the Flutterwave
// integration so "Pay Now" works, the same call as Finance's "Re-link payments".

import { useState } from "react";
import { consoleSchema } from "@/lib/supabase";
import { invokeFunction } from "@/lib/functions";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { ErrorAlert, LoadingState } from "@/components/AsyncStates";

interface LagoCustomer {
  externalId: string;
  name: string | null;
  email: string | null;
}

export function LinkBilling({
  workspaceId,
  linkedCustomerId,
  takenCustomerIds,
  onChanged
}: {
  workspaceId: string;
  linkedCustomerId: string | null;
  /** Lago customers already linked to other projects. */
  takenCustomerIds: Set<string>;
  onChanged: () => Promise<void> | void;
}) {
  const customers = useAsyncResource(
    async () => (await invokeFunction<{ customers: LagoCustomer[] }>("console-admin-finance", { query: "customers=1" })).customers ?? [],
    [],
    { errorMessage: "Failed to load Lago customers" }
  );
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const setLink = async (customerId: string | null) => {
    const { error } = await consoleSchema().rpc("admin_set_workspace_billing", {
      p_workspace_id: workspaceId,
      p_lago_customer_id: customerId
    });
    if (error) throw new Error(error.message);
  };

  const link = async () => {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      await setLink(selected);
      // Linking succeeded; a failed payments re-link is reported but doesn't undo it.
      let text = "Linked.";
      let ok = true;
      try {
        await invokeFunction("sync-lago-payment-provider", { body: { externalCustomerId: selected } });
        text = "Linked, and payments connected.";
      } catch (err) {
        ok = false;
        text = `Linked, but connecting payments failed: ${(err as Error).message}. Retry with Re-link payments on Finance.`;
      }
      setMessage({ ok, text });
      setSelected("");
      await onChanged();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm("Unlink billing from this project? Its invoices stay in Lago but stop showing here and in Finance.")) return;
    setBusy(true);
    setMessage(null);
    try {
      await setLink(null);
      await onChanged();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (linkedCustomerId) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "8px 0 16px" }}>
        <span className="admin-muted">Linked to Lago customer <strong>{linkedCustomerId}</strong></span>
        <button className="dash-tab-btn" onClick={() => void unlink()} disabled={busy}>Unlink</button>
        {message && <span className={message.ok ? "admin-ok" : "admin-warn"} role="status">{message.text}</span>}
      </div>
    );
  }

  if (customers.loading) return <LoadingState label="Loading Lago customers…" />;
  if (customers.error) return <ErrorAlert message={`Couldn't load Lago customers: ${customers.error}`} onRetry={customers.retry} />;

  const available = (customers.data ?? []).filter((c) => !takenCustomerIds.has(c.externalId));
  return (
    <div className="cp-card" style={{ margin: "8px 0 16px" }}>
      <div className="cp-card-head"><span>Link billing</span></div>
      {available.length === 0 ? (
        <p className="admin-muted">No unlinked Lago customers. Create the customer in Lago first, then come back.</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void link(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select required value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Lago customer">
            <option value="">Choose a Lago customer…</option>
            {available.map((c) => (
              <option key={c.externalId} value={c.externalId}>
                {c.name ?? c.externalId}{c.email ? ` · ${c.email}` : ""} ({c.externalId})
              </option>
            ))}
          </select>
          <button type="submit" className="dash-tab-btn active" disabled={busy || !selected}>{busy ? "Linking…" : "Link"}</button>
        </form>
      )}
      {message && <p className={message.ok ? "admin-ok" : "admin-warn"} role="status">{message.text}</p>}
    </div>
  );
}
