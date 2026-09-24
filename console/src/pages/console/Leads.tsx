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

import { useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ActivityTimeline, type AgentActivity } from "@/components/ActivityTimeline";
import { useAuth } from "@/contexts/AuthContext";
import { consoleSchema, supabase } from "@/lib/supabase";
import { Mail, Building2, Clock, Send } from "lucide-react";
import { formatDate } from "@/lib/format";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { toast } from "sonner";

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
  const [stageFilter, setStageFilter] = useState<"all" | InquiryStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);

  // Both resources load through the shared hook, which supplies retry(),
  // race-safe cancellation, and one loading/error contract per resource
  // instead of the two hand-rolled effects this page used to carry.
  const {
    data: inquiryData,
    loading,
    error,
    retry: retryInquiries,
    refresh: refreshInquiries,
    refreshing,
  } = useAsyncResource<Inquiry[]>(
    async (signal) => {
      const { data, error: dbError } = await consoleSchema()
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });
      if (signal.aborted) return [];
      if (dbError) throw dbError;
      return data ?? [];
    },
    [],
    { errorMessage: "Failed to load inquiries" }
  );
  const inquiries = inquiryData ?? [];
  // Named so the existing call sites (stage change, note, proposal decisions)
  // keep re-reading after a write without knowing about the hook.
  const loadInquiries = refreshInquiries;

  // The selected lead's thread is its own resource keyed by selection, so
  // switching leads aborts the previous request rather than letting it race.
  const { data: activityData, loading: activitiesLoading, refresh: refreshActivities } =
    useAsyncResource<InquiryActivity[]>(
      async (signal) => {
        if (!selectedId) return [];
        const { data, error: dbError } = await consoleSchema()
          .from("inquiry_activities")
          .select("*")
          .eq("inquiry_id", selectedId)
          .order("created_at", { ascending: true });
        if (signal.aborted) return [];
        if (dbError) throw dbError;
        return data ?? [];
      },
      [selectedId],
      { enabled: Boolean(selectedId), errorMessage: "Failed to load activity" }
    );
  const activities = activityData ?? [];
  const loadActivities = refreshActivities;

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
      void loadActivities();
      toast.success(`Moved to ${next}`);
    } catch (err) {
      // A failed write is not a failed load. It must not replace the page's
      // data state, so it reports through a toast and leaves the loaded list
      // on screen -- the alert channel is reserved for the load itself.
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
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
      void loadActivities();
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
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
      void loadActivities();
      toast.success("Follow-up sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send follow-up email");
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
      void loadActivities();
      toast.success("Proposal rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject proposal");
    }
  };

  return (
    <ConsoleLayout onRefresh={() => void refreshInquiries()} isRefreshing={refreshing}>
      <StatusRegion
        message={
          loading
            ? "Loading leads"
            : error
              ? `Could not load leads: ${error}`
              : refreshing
                ? "Refreshing leads"
                : `${inquiries.length} lead${inquiries.length === 1 ? "" : "s"} loaded`
        }
      />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">LEADS</span>
          <h1>Leads</h1>
          <p>Inquiries from the marketing site, and what we're doing about them.</p>
        </div>
      </div>

      {error && <ErrorAlert message={`Couldn't load leads: ${error}`} onRetry={retryInquiries} retryLabel="Reload leads" />}

      {loading && inquiries.length === 0 ? (
        <LoadingState label="Loading leads…" />
      ) : inquiries.length === 0 ? (
        <EmptyState
          title="No leads yet"
          hint="Every enquiry submitted through the website lands here, with its own activity thread you can triage and leave notes on."
        />
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
