// Admin-only CRM surface for console.inquiries. Direct RLS-protected reads
// via consoleSchema() rather than an edge function proxy -- there's no
// external secret involved (see the console_inquiries migration and
// console-data's own comment on when a proxy is actually needed), so
// Postgres itself is the authorization boundary here, same as every other
// direct-table page would be.
//
// The activity timeline renders 'agent_auto_action'/'agent_proposal' rows
// from console-agent-run (see supabase/functions/console-agent-run).
// Rejecting a proposal is a plain RLS-protected update, done straight from
// here -- no secret involved. Approving one calls console-agent-send,
// since that's the only step allowed to hold RESEND_API_KEY and actually
// contact the prospect.

import { useEffect, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ActivityTimeline, type AgentActivity } from "@/components/ActivityTimeline";
import { useAuth } from "@/contexts/AuthContext";
import { consoleSchema, supabase } from "@/lib/supabase";
import { Mail, Building2, Clock, Send } from "lucide-react";
import { formatDate } from "@/lib/format";

type InquiryStatus = "new" | "contacted" | "qualified" | "won" | "lost" | "archived";

interface Inquiry {
  id: string;
  created_at: string;
  reference_id: string;
  source: string;
  name: string;
  email: string;
  company: string | null;
  service_tier: string | null;
  budget_range: string | null;
  project_stage: string | null;
  target_timeline: string | null;
  project_brief: string | null;
  status: InquiryStatus;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
}

interface InquiryActivity extends AgentActivity {
  inquiry_id: string;
}

const STAGE_TABS: Array<{ key: "all" | InquiryStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "archived", label: "Archived" }
];

const STAGE_TONE: Record<InquiryStatus, "healthy" | "warning" | "down" | "neutral"> = {
  new: "neutral",
  contacted: "warning",
  qualified: "healthy",
  won: "healthy",
  lost: "down",
  archived: "neutral"
};

function StagePill({ status }: { status: InquiryStatus }) {
  const tone = STAGE_TONE[status];
  return (
    <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone === "neutral" ? "neutral" : tone}`}>
      {status.toUpperCase()}
    </span>
  );
}


export default function Leads() {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<"all" | InquiryStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<InquiryActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);

  const loadInquiries = () => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: dbError } = await consoleSchema()
          .from("inquiries")
          .select("*")
          .order("created_at", { ascending: false });
        if (dbError) throw dbError;
        setInquiries(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load inquiries");
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  const loadActivities = (inquiryId: string) => {
    setActivitiesLoading(true);
    (async () => {
      try {
        const { data, error: dbError } = await consoleSchema()
          .from("inquiry_activities")
          .select("*")
          .eq("inquiry_id", inquiryId)
          .order("created_at", { ascending: true });
        if (dbError) throw dbError;
        setActivities(data ?? []);
      } catch {
        setActivities([]);
      } finally {
        setActivitiesLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (selectedId) loadActivities(selectedId);
  }, [selectedId]);

  const filtered = inquiries.filter((i) => stageFilter === "all" || i.status === stageFilter);
  const selected = inquiries.find((i) => i.id === selectedId) ?? null;

  const handleStageChange = async (next: InquiryStatus) => {
    if (!selected || !user) return;
    setStageSaving(true);
    const previous = selected.status;
    try {
      const { error: updateError } = await consoleSchema()
        .from("inquiries")
        .update({ status: next })
        .eq("id", selected.id);
      if (updateError) throw updateError;
      await consoleSchema()
        .from("inquiry_activities")
        .insert({
          inquiry_id: selected.id,
          actor: "admin",
          actor_user_id: user.id,
          activity_type: "stage_change",
          body: `${previous} → ${next}`,
          payload: { from: previous, to: next }
        });
      loadInquiries();
      loadActivities(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setStageSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!selected || !user || !noteDraft.trim()) return;
    setSavingNote(true);
    try {
      const { error: insertError } = await consoleSchema()
        .from("inquiry_activities")
        .insert({
          inquiry_id: selected.id,
          actor: "admin",
          actor_user_id: user.id,
          activity_type: "note",
          body: noteDraft.trim()
        });
      if (insertError) throw insertError;
      setNoteDraft("");
      loadActivities(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleApproveProposal = async (activity: AgentActivity, subject: string, body: string) => {
    if (!selected) return;
    try {
      const { data, error: fnError } = await supabase.functions.invoke("console-agent-send", {
        body: { activity_id: activity.id, subject, body }
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      loadActivities(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send follow-up email");
    }
  };

  const handleRejectProposal = async (activity: AgentActivity) => {
    if (!selected || !user) return;
    try {
      const { error: updateError } = await consoleSchema()
        .from("inquiry_activities")
        .update({ status: "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
        .eq("id", activity.id);
      if (updateError) throw updateError;
      loadActivities(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject proposal");
    }
  };

  return (
    <ConsoleLayout onRefresh={loadInquiries} isRefreshing={loading}>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">LEADS</span>
          <h1>Leads</h1>
          <p>Inquiries from the marketing site, and what we're doing about them.</p>
        </div>
      </div>

      {error && <div className="dash-empty-state">Couldn't load leads: {error}</div>}

      {loading && inquiries.length === 0 ? (
        <div className="dash-empty-state">Loading leads…</div>
      ) : (
        <>
          <div className="dash-tabs-bar">
            {STAGE_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`dash-tab-btn ${stageFilter === tab.key ? "active" : ""}`}
                onClick={() => setStageFilter(tab.key)}
              >
                <span>
                  {tab.label} (
                  {tab.key === "all" ? inquiries.length : inquiries.filter((i) => i.status === tab.key).length})
                </span>
              </button>
            ))}
          </div>

          <div className="console-grid-layout leads-layout">
            <div className="console-col leads-list-col">
              {filtered.length === 0 ? (
                <div className="dash-empty-state">No leads in this stage.</div>
              ) : (
                <div className="leads-list">
                  {filtered.map((inquiry) => (
                    <button
                      key={inquiry.id}
                      className={`lead-row ${selectedId === inquiry.id ? "active" : ""}`}
                      onClick={() => setSelectedId(inquiry.id)}
                    >
                      <div className="lead-row-main">
                        <strong>{inquiry.name}</strong>
                        <span className="lead-row-company">
                          {inquiry.company ? <Building2 size={12} /> : null}
                          {inquiry.company ?? inquiry.email}
                        </span>
                      </div>
                      <div className="lead-row-meta">
                        <StagePill status={inquiry.status} />
                        <span className="lead-row-time">
                          <Clock size={11} />
                          {formatDate(inquiry.created_at)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="console-col leads-detail-col">
              {!selected ? (
                <div className="dash-empty-state">Select a lead to see details and activity.</div>
              ) : (
                <div className="console-card lead-detail-card">
                  <div className="card-top-header">
                    <span className="card-kicker">{selected.reference_id}</span>
                    <StagePill status={selected.status} />
                  </div>

                  <h3 className="lead-detail-name">{selected.name}</h3>
                  <div className="app-meta-list">
                    <div className="app-meta-item">
                      <span className="meta-k">
                        <Mail size={12} /> Email
                      </span>
                      <span className="meta-v">
                        <a href={`mailto:${selected.email}`} className="text-teal">
                          {selected.email}
                        </a>
                      </span>
                    </div>
                    {selected.company && (
                      <div className="app-meta-item">
                        <span className="meta-k">Company</span>
                        <span className="meta-v">{selected.company}</span>
                      </div>
                    )}
                    {selected.service_tier && (
                      <div className="app-meta-item">
                        <span className="meta-k">Service tier</span>
                        <span className="meta-v">{selected.service_tier}</span>
                      </div>
                    )}
                    {selected.budget_range && (
                      <div className="app-meta-item">
                        <span className="meta-k">Budget</span>
                        <span className="meta-v">{selected.budget_range}</span>
                      </div>
                    )}
                    {selected.target_timeline && (
                      <div className="app-meta-item">
                        <span className="meta-k">Timeline</span>
                        <span className="meta-v">{selected.target_timeline}</span>
                      </div>
                    )}
                  </div>

                  {selected.project_brief && <p className="lead-brief">{selected.project_brief}</p>}

                  <div className="lead-stage-actions">
                    <span className="meta-k">Move to</span>
                    <div className="lead-stage-buttons">
                      {(["new", "contacted", "qualified", "won", "lost", "archived"] as InquiryStatus[])
                        .filter((s) => s !== selected.status)
                        .map((s) => (
                          <button
                            key={s}
                            className="dash-tab-btn"
                            disabled={stageSaving}
                            onClick={() => handleStageChange(s)}
                          >
                            {s}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="lead-activity-section">
                    <span className="card-kicker">ACTIVITY</span>
                    <ActivityTimeline
                      activities={activities}
                      loading={activitiesLoading}
                      onApprove={handleApproveProposal}
                      onReject={handleRejectProposal}
                    />

                    <div className="lead-note-form">
                      <textarea
                        placeholder="Add a note…"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={3}
                      />
                      <button
                        className="dash-action-btn"
                        disabled={savingNote || !noteDraft.trim()}
                        onClick={handleAddNote}
                      >
                        <Send size={13} />
                        <span>Add note</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </ConsoleLayout>
  );
}
