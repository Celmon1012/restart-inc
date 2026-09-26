import { Bell, Check, Clock, History, LayoutGrid, Server, Terminal } from "lucide-react";

/* ------------------------------------------------------------------
 * Platform-section preview of the Restart Console's Delivery view.
 * A companion to the hero's ConsolePreview, not a copy of it: the
 * sidebar is the console's collapsed icon rail, and the milestones
 * follow the section's three steps (map, remove friction, create
 * capacity). Figures are illustrative; the layout is the console's.
 * ------------------------------------------------------------------ */

const RAIL = [LayoutGrid, Server, Clock, Terminal, History];

const MILESTONES = [
  { name: "Workflow & cost map", note: "18 workflows · 6 constraints logged", state: "done" },
  { name: "Order-to-invoice automation", note: "14 manual steps removed", state: "done" },
  { name: "Ops dashboard", note: "Decisions surfaced in one view", state: "active", progress: 60 },
  { name: "Billing integration", note: "Scheduled · week 9", state: "next" },
] as const;

const ACTIVITY = [
  { what: "Invoice sync deployed to production", when: "2h ago" },
  { what: "Ops dashboard preview shared", when: "Yesterday" },
  { what: "Workflow map signed off", when: "3 days ago" },
  { what: "Scope agreed: billing integration", when: "Last week" },
];

export default function DeliveryPreview() {
  return (
    <div className="dpv" role="img" aria-label="Restart Console delivery view: milestones from workflow mapping to automation and a new ops dashboard">
      <aside className="dpv-rail">
        <img src="/brand/restart-mark.png" alt="" className="dpv-mark" />
        {RAIL.map((Icon, i) => (
          <span key={i} className={i === 2 ? "active" : undefined}><Icon size={14} /></span>
        ))}
      </aside>

      <div className="dpv-main">
        <div className="dpv-top">
          <div className="dpv-tabs"><span>Overview</span><span>Systems</span><span className="active">Delivery</span></div>
          <span className="dpv-icon"><Bell size={13} /></span>
        </div>

        <div className="dpv-body">
          <div className="dpv-col">
          <span className="dpv-eyebrow">Acme Operations</span>
          <h3>Delivery</h3>

          <div className="dpv-stats">
            <div><small>HOURS SAVED</small><strong>31<span>/wk</span></strong></div>
            <div><small>STEPS REMOVED</small><strong>14</strong></div>
            <div><small>MILESTONES</small><strong>2<span>/4</span></strong></div>
          </div>

          <div className="dpv-card">
            {MILESTONES.map((m) => (
              <div key={m.name} className={`dpv-row ${m.state}`}>
                <span className="dpv-state">{m.state === "done" ? <Check size={11} strokeWidth={3} /> : null}</span>
                <span className="dpv-name">
                  {m.name}
                  <small>{m.note}</small>
                  {m.state === "active" && <i className="dpv-progress"><b style={{ width: `${m.progress}%` }} /></i>}
                </span>
                <span className="dpv-pill">{m.state === "done" ? "Done" : m.state === "active" ? `${m.progress}%` : "Next"}</span>
              </div>
            ))}
          </div>
          </div>

          {/* Desktop only: runs off the section's right edge, like the hero. */}
          <div className="dpv-col dpv-activity">
            <div className="dpv-card-head">Recent activity</div>
            <div className="dpv-card">
              {ACTIVITY.map((a) => (
                <div key={a.what} className="dpv-row">
                  <span className="dpv-dot" />
                  <span className="dpv-name">{a.what}<small>{a.when}</small></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
