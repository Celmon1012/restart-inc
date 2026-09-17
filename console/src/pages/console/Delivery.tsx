import { ConsoleLayout } from "@/components/ConsoleLayout";
import { DELIVERY_MILESTONES } from "@/lib/delivery";

export default function Delivery() {
  return (
    <ConsoleLayout>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">DELIVERY</span>
          <h1>Delivery</h1>
          <p>What's shipped, and what we're building right now.</p>
        </div>
      </div>

      <div className="dash-sprints-view">
        {DELIVERY_MILESTONES.map((milestone) => (
          <div
            className={`sprint-card ${milestone.status === "completed" ? "completed" : "in-progress"}`}
            key={milestone.id}
          >
            <div className={`sprint-status-tag ${milestone.status === "in-progress" ? "active" : ""}`}>
              {milestone.status === "completed" ? "COMPLETED" : "IN PROGRESS"} · MILESTONE {String(milestone.order).padStart(2, "0")}
            </div>
            <h4>{milestone.title}</h4>
            <p>{milestone.description}</p>
            <div className="sprint-meta">{milestone.meta}</div>
          </div>
        ))}
      </div>
    </ConsoleLayout>
  );
}
