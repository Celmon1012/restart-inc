// The team: who has a staff role, and what it lets them see. Owner only.
//   Owner    everything: Ops, Finance, Sales, infrastructure, this page
//   Ops      clients, projects, tasks, support, server requests
//   Finance  costs, payments, accounts, VAT, invoices
// People are invited by email (console-admin-team creates the account and sends the invitation).
// Listing people and changing roles go straight to the database as the owner, which checks the
// owner role itself (console.admin_list_staff, console.admin_set_staff_roles).

import { confirmAction } from "@/components/confirmAction";
import { useState } from "react";
import { toast } from "sonner";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { RowMenu } from "@/components/admin/RowMenu";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useAuth } from "@/contexts/AuthContext";
import { consoleSchema } from "@/lib/supabase";
import { invokeFunction } from "@/lib/functions";
import { formatRelative } from "@/lib/format";

type Role = "owner" | "ops" | "finance";
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", ops: "Ops", finance: "Finance" };
const ROLE_DETAIL: Record<Role, string> = {
  owner: "Everything: Ops, Finance, sales, infrastructure, and this page.",
  ops: "Clients, projects, milestones and tasks, support and server requests. No finance.",
  finance: "Costs, payments, accounts, VAT and invoices. No client work or support."
};

interface Member {
  user_id: string;
  email: string;
  roles: Role[];
  last_sign_in_at: string | null;
  confirmed: boolean;
  /** An owner through the account's sign-in settings (app_metadata), which this page can't change. */
  owner_by_claim?: boolean;
}

function RoleChecks({ value, onChange, disabled }: { value: Role[]; onChange: (next: Role[]) => void; disabled?: boolean }) {
  return (
    <span style={{ display: "inline-flex", gap: 14, flexWrap: "wrap" }}>
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
        <label key={r} style={{ display: "inline-flex", gap: 6, alignItems: "center" }} title={ROLE_DETAIL[r]}>
          <input
            type="checkbox"
            checked={value.includes(r)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))}
          />
          {ROLE_LABEL[r]}
        </label>
      ))}
    </span>
  );
}

export default function AdminTeam() {
  const { user } = useAuth();
  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<Member[]>(
    async () => {
      const { data: rows, error: err } = await consoleSchema().rpc("admin_list_staff");
      if (err) throw err;
      return (rows ?? []) as Member[];
    },
    [],
    { errorMessage: "Failed to load the team" }
  );
  const members = data ?? [];

  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>(["ops"]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<Role[]>([]);

  const invite = async () => {
    if (roles.length === 0) return setFormError("Choose at least one role.");
    setBusy(true);
    setFormError(null);
    try {
      const res = await invokeFunction<{ invited: boolean; email: string }>("console-admin-team", { body: { action: "invite", email, roles } });
      toast.success(res.invited ? `Invitation sent to ${res.email}` : `${res.email} already had an account; roles updated`);
      setInviting(false);
      setEmail("");
      setRoles(["ops"]);
      await refresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveRoles = async (m: Member, next: Role[]) => {
    const { error: err } = await consoleSchema().rpc("admin_set_staff_roles", { p_user_id: m.user_id, p_roles: next });
    if (err) {
      toast.error(err.message);
      return false;
    }
    toast.success(next.length === 0 ? `${m.email} no longer has team access` : "Roles updated");
    await refresh();
    return true;
  };

  const remove = async (m: Member) => {
    if (!(await confirmAction({ title: "Remove team access?", description: `Remove ${m.email}'s team access? Their account stays, but they lose Ops and Finance.`, confirmLabel: "Remove" }))) return;
    await saveRoles(m, []);
  };

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading the team" : error ? `Could not load the team: ${error}` : `${members.length} team members`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">SETTINGS</span>
          <h1>Team</h1>
          <p>Who can sign in to the staff areas, and what each role can see.</p>
        </div>
        <button className="dash-tab-btn active" onClick={() => { setInviting(true); setFormError(null); }}>Invite teammate</button>
      </div>

      <div className="cp-stats mb-6" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <div key={r}>
            <small>{ROLE_LABEL[r].toUpperCase()}</small>
            <strong style={{ fontSize: "1.25rem" }}>{members.filter((m) => m.roles.includes(r)).length}</strong>
            <em>{ROLE_DETAIL[r]}</em>
          </div>
        ))}
      </div>

      {inviting && (
        <form
          onSubmit={(e) => { e.preventDefault(); void invite(); }}
          className="cp-card"
          style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: 16, marginBottom: 16 }}
        >
          <div className="cp-card-head" style={{ flexBasis: "100%" }}><span>Invite a teammate</span></div>
          <input type="email" required placeholder="Their email address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ minWidth: 280 }} autoFocus />
          <RoleChecks value={roles} onChange={setRoles} />
          <button type="submit" className="dash-tab-btn active" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</button>
          <button type="button" className="dash-tab-btn" onClick={() => setInviting(false)} disabled={busy}>Cancel</button>
          {formError && <span className="admin-warn" role="alert">{formError}</span>}
          <span className="admin-muted" style={{ flexBasis: "100%" }}>
            They get an email to set a password. Ops and Finance accounts must set up two-factor sign-in before they can open their area.
          </span>
        </form>
      )}

      {loading ? (
        <LoadingState label="Loading the team…" />
      ) : error ? (
        <ErrorAlert message={`Couldn't load the team: ${error}`} onRetry={retry} retryLabel="Reload team" />
      ) : members.length === 0 ? (
        <EmptyState title="No team members yet" hint="Invite someone and give them a role." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Roles</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.user_id === user?.id;
                return (
                  <tr key={m.user_id}>
                    <td>
                      <strong>{m.email}</strong>
                      {isSelf && <span className="admin-muted"> · you</span>}
                      {m.owner_by_claim && <div className="admin-muted">owner through sign-in settings</div>}
                      {!m.confirmed && <div className="admin-warn">invited, not accepted yet</div>}
                    </td>
                    <td className="wrap">
                      {editingId === m.user_id ? (
                        <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <RoleChecks value={editRoles} onChange={setEditRoles} />
                          <button className="dash-tab-btn active" onClick={() => void saveRoles(m, editRoles).then((ok) => ok && setEditingId(null))}>Save</button>
                          <button className="dash-tab-btn" onClick={() => setEditingId(null)}>Cancel</button>
                        </span>
                      ) : (
                        m.roles.map((r) => (
                          <span key={r} className="system-healthy-pill" style={{ marginRight: 6 }}>{ROLE_LABEL[r].toUpperCase()}</span>
                        ))
                      )}
                    </td>
                    <td className="admin-muted">{m.last_sign_in_at ? formatRelative(m.last_sign_in_at) : "never"}</td>
                    <td className="num">
                      {!isSelf && !m.owner_by_claim && (
                        <RowMenu
                          label={`Actions for ${m.email}`}
                          items={[
                            { label: "Change roles", onClick: () => { setEditingId(m.user_id); setEditRoles(m.roles); } },
                            { label: "Remove team access", danger: true, onClick: () => void remove(m) }
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ConsoleLayout>
  );
}
