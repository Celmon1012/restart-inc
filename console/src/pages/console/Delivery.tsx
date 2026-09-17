import { useEffect, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { consoleSchema } from "@/lib/supabase";
import type { Deliverable } from "@/lib/deliverables";

const STATUS_LABEL: Record<Deliverable["status"], string> = {
  "not-started": "NOT STARTED",
  "in-progress": "IN PROGRESS",
  completed: "COMPLETED",
  blocked: "BLOCKED"
};

const STATUS_CYCLE: Deliverable["status"][] = ["not-started", "in-progress", "completed", "blocked"];

export default function Delivery() {
  const { activeWorkspace, isAdmin } = useWorkspace();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: dbError } = await consoleSchema()
          .from("deliverables")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .order("sort_order", { ascending: true });
        if (dbError) throw dbError;
        setDeliverables(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load delivery data");
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  const handleStatusChange = async (id: string, status: Deliverable["status"]) => {
    const { error: updateError } = await consoleSchema().from("deliverables").update({ status }).eq("id", id);
    if (!updateError) load();
  };

  return (
    <ConsoleLayout>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Delivery</h1>
          <p>What's shipped, and what we're building right now.</p>
        </div>
      </div>

      {loading ? (
        <div className="dash-empty-state">Loading delivery milestones…</div>
      ) : error ? (
        <div className="dash-empty-state">Couldn't load delivery data: {error}</div>
      ) : deliverables.length === 0 ? (
        <div className="dash-empty-state">No delivery milestones recorded for this workspace yet.</div>
      ) : (
        <div className="dash-sprints-view">
          {deliverables.map((milestone, idx) => (
            <div className={`sprint-card ${milestone.status === "in-progress" ? "in-progress" : ""}`} key={milestone.id}>
              <div className={`sprint-status-tag ${milestone.status === "in-progress" ? "active" : ""}`}>
                {STATUS_LABEL[milestone.status]} · MILESTONE {String(idx + 1).padStart(2, "0")}
              </div>
              <h4>{milestone.title}</h4>
              {milestone.description && <p>{milestone.description}</p>}
              {milestone.meta && <div className="sprint-meta">{milestone.meta}</div>}
              {isAdmin && (
                <div className="lead-stage-buttons mt-4">
                  {STATUS_CYCLE.filter((s) => s !== milestone.status).map((s) => (
                    <button key={s} className="dash-tab-btn" onClick={() => handleStatusChange(milestone.id, s)}>
                      {STATUS_LABEL[s].toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ConsoleLayout>
  );
}
