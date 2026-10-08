// Shared rendering for the follow-up agent's audit trail -- used by both
// Leads (console.inquiry_activities) and Delivery (console.deliverable_
// activities). The two tables share this exact shape (see the
// console_deliverable_activities migration's comment on why), so this is
// one real abstraction over two concrete consumers, not a speculative one.

import { useState } from "react";
import { Bot, User as UserIcon, Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export interface AgentActivity {
  id: string;
  created_at: string;
  actor: "admin" | "agent";
  activity_type:
    | "note"
    | "stage_change"
    | "agent_auto_action"
    | "agent_proposal"
    | "email_sent"
    | "whatsapp_sent"
    | "whatsapp_received";
  body: string | null;
  payload: Record<string, unknown> | null;
  status: "proposed" | "approved" | "rejected" | "complete";
}

function ActivityItem({
  activity,
  onApprove,
  onReject
}: {
  activity: AgentActivity;
  onApprove: (activity: AgentActivity, subject: string, body: string) => Promise<void>;
  onReject: (activity: AgentActivity) => Promise<void>;
}) {
  const isAgent = activity.actor === "agent";
  const isPendingProposal = activity.activity_type === "agent_proposal" && activity.status === "proposed";
  const [subject, setSubject] = useState(String(activity.payload?.subject ?? ""));
  const [draft, setDraft] = useState(String(activity.payload?.body ?? ""));
  const [busy, setBusy] = useState(false);

  const label =
    activity.activity_type === "stage_change"
      ? "changed stage"
      : activity.activity_type === "agent_auto_action"
        ? "took an automatic action"
        : activity.activity_type === "agent_proposal"
          ? "proposed an update"
          : activity.activity_type === "email_sent"
            ? "sent an email"
            : activity.activity_type === "whatsapp_sent"
              ? "sent a WhatsApp message"
              : activity.activity_type === "whatsapp_received"
                ? "received a WhatsApp message"
                : "added a note";

  return (
    <div className="activity-item">
      <div className={`activity-item-icon ${isAgent ? "agent" : ""}`}>
        {isAgent ? <Bot size={13} /> : <UserIcon size={13} />}
      </div>
      <div className="activity-item-body">
        <div className="activity-item-head">
          <strong>{isAgent ? "Agent" : "Admin"}</strong>
          <span>{label}</span>
          {activity.activity_type === "agent_proposal" && (
            <span className={`system-healthy-pill ${activity.status === "proposed" ? "warning" : ""}`}>
              {activity.status.toUpperCase()}
            </span>
          )}
          <span className="activity-item-time">{formatDateTime(activity.created_at)}</span>
        </div>
        {activity.body && <p>{activity.body}</p>}
        {activity.activity_type === "agent_proposal" && activity.payload?.subject ? (
          <div className="activity-proposal-draft">
            <span className="meta-k">Subject</span>
            {isPendingProposal ? (
              <input
                className="console-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={busy}
              />
            ) : (
              <p>{String(activity.payload.subject)}</p>
            )}
            <span className="meta-k">Draft</span>
            {isPendingProposal ? (
              <textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy} />
            ) : (
              <p>{String(activity.payload.body ?? "")}</p>
            )}
            {isPendingProposal && (
              <div className="lead-stage-buttons mt-2">
                <button
                  className="dash-action-btn"
                  disabled={busy || !subject.trim() || !draft.trim()}
                  onClick={async () => {
                    setBusy(true);
                    await onApprove(activity, subject.trim(), draft.trim());
                    setBusy(false);
                  }}
                >
                  <Check size={13} />
                  <span>Approve & Send</span>
                </button>
                <button
                  className="dash-tab-btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onReject(activity);
                    setBusy(false);
                  }}
                >
                  <X size={13} />
                  <span>Reject</span>
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityTimeline({
  activities,
  loading,
  onApprove,
  onReject
}: {
  activities: AgentActivity[];
  loading: boolean;
  onApprove: (activity: AgentActivity, subject: string, body: string) => Promise<void>;
  onReject: (activity: AgentActivity) => Promise<void>;
}) {
  if (loading) return <div className="dash-empty-state">Loading activity…</div>;
  if (activities.length === 0) return <div className="dash-empty-state">No activity yet.</div>;
  return (
    <div className="activity-timeline">
      {activities.map((a) => (
        <ActivityItem key={a.id} activity={a} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  );
}
