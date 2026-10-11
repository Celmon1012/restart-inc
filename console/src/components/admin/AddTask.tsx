// Add a checklist item to a project from the Tasks page. Tasks belong to a
// milestone (console.deliverable_tasks -> console.deliverables), so this picks a
// project, then one of its milestones or a new one, then takes the task title.
// Milestones and their checklist items are visible to the client in their
// Delivery view; nothing added here is private to staff.

import { useState } from "react";
import { toast } from "sonner";
import { consoleSchema } from "@/lib/supabase";
import { loadAdminWorkspaces, loadTeamMembers } from "@/lib/admin";
import { useAsyncResource } from "@/hooks/useAsyncResource";

const NEW = "__new__";

interface Milestone {
  id: string;
  title: string;
  workspace_id: string;
  status: string;
}

export function AddTask({ onAdded }: { onAdded: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [title, setTitle] = useState("");
  // "" = the team, unassigned; "client" = the client has to do it; otherwise a team member's user id.
  const [assignTo, setAssignTo] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useAsyncResource(
    async () => {
      const [workspaces, milestonesRes, team] = await Promise.all([
        loadAdminWorkspaces(),
        consoleSchema().from("deliverables").select("id,title,workspace_id,status").order("sort_order"),
        loadTeamMembers()
      ]);
      if (milestonesRes.error) throw milestonesRes.error;
      return {
        projects: workspaces.filter((w) => !w.archived_at).map((w) => ({ id: w.id, name: w.name })),
        milestones: (milestonesRes.data ?? []) as Milestone[],
        team
      };
    },
    [open],
    { enabled: open, errorMessage: "Failed to load projects" }
  );

  const milestones = (options.data?.milestones ?? []).filter((m) => m.workspace_id === workspaceId);
  const creatingMilestone = milestoneId === NEW || (workspaceId !== "" && milestones.length === 0);
  const canSubmit = Boolean(workspaceId && title.trim() && (creatingMilestone ? newMilestone.trim() : milestoneId));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let deliverableId = milestoneId;
      if (creatingMilestone) {
        const { data, error: mErr } = await consoleSchema()
          .from("deliverables")
          .insert({ workspace_id: workspaceId, title: newMilestone.trim(), status: "in-progress", sort_order: milestones.length })
          .select("id")
          .single();
        if (mErr) throw new Error(mErr.message);
        deliverableId = data.id as string;
      }
      const { count, error: cErr } = await consoleSchema()
        .from("deliverable_tasks")
        .select("id", { count: "exact", head: true })
        .eq("deliverable_id", deliverableId);
      if (cErr) throw new Error(cErr.message);
      const { error: tErr } = await consoleSchema()
        .from("deliverable_tasks")
        .insert({
          deliverable_id: deliverableId,
          title: title.trim(),
          sort_order: count ?? 0,
          owner: assignTo === "client" ? "client" : "team",
          assignee_id: assignTo && assignTo !== "client" ? assignTo : null,
          due_at: due || null
        });
      if (tErr) throw new Error(tErr.message);

      toast.success("Task added");
      setTitle("");
      setDue("");
      if (creatingMilestone) {
        setMilestoneId(deliverableId);
        setNewMilestone("");
        void options.refresh();
      }
      await onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <button className="dash-tab-btn active" onClick={() => setOpen(true)}>Add task</button>;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}
    >
      <select
        required
        value={workspaceId}
        onChange={(e) => { setWorkspaceId(e.target.value); setMilestoneId(""); }}
        aria-label="Project"
        disabled={options.loading}
      >
        <option value="">{options.loading ? "Loading projects…" : "Project…"}</option>
        {(options.data?.projects ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {workspaceId && milestones.length > 0 && (
        <select required value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} aria-label="Milestone">
          <option value="">Milestone…</option>
          {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          <option value={NEW}>+ New milestone…</option>
        </select>
      )}
      {creatingMilestone && (
        <input
          type="text"
          required
          maxLength={120}
          placeholder={milestones.length === 0 ? "New milestone (this project has none), e.g. Maintenance" : "New milestone title"}
          value={newMilestone}
          onChange={(e) => setNewMilestone(e.target.value)}
          style={{ minWidth: 260 }}
        />
      )}

      <input type="text" required placeholder="Task…" value={title} onChange={(e) => setTitle(e.target.value)} style={{ minWidth: 240 }} autoFocus />
      <label className="admin-muted">Due <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Deadline" /></label>
      <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Assigned to">
        <option value="">Team (unassigned)</option>
        {(options.data?.team ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
        <option value="client">Client to do</option>
      </select>
      <button type="submit" className="dash-tab-btn active" disabled={busy || !canSubmit}>{busy ? "Adding…" : "Add"}</button>
      <button type="button" className="dash-tab-btn" onClick={() => { setOpen(false); setError(null); }} disabled={busy}>Close</button>
      {options.error && <span className="admin-warn" role="alert">{options.error}</span>}
      {error && <span className="admin-warn" role="alert">{error}</span>}
      <span className="admin-muted" style={{ flexBasis: "100%" }}>
        The client can see milestones and their tasks in their Delivery view. A "Client to do" task shows there as waiting on them; you tick it off when it's done.
      </span>
    </form>
  );
}
