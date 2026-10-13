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

import { Fragment, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ActivityTimeline, type AgentActivity } from "@/components/ActivityTimeline";
import { useAuth } from "@/contexts/AuthContext";
import { consoleSchema, supabase } from "@/lib/supabase";
import { Mail, Phone, Send, Search, LayoutList, Columns3 } from "lucide-react";
import { RowMenu } from "@/components/admin/RowMenu";
import { PIPELINE_STAGES, OPEN_STAGES, queryParam, type PipelineStage } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { toast } from "sonner";

type InquiryStatus = PipelineStage;

interface Inquiry {
  id: string;
  created_at: string;
  reference_id: string;
  source: string;
  name: string;
  email: string;
  company: string | null;
  phone?: string | null;
  whatsapp_opt_in?: boolean;
  whatsapp_opted_out_at?: string | null;
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
  // ?id= deep-links a lead from the admin overview.
  const [selectedId, setSelectedId] = useState<string | null>(() => queryParam("id"));
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
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

  const needle = search.trim().toLowerCase();
  const searched = needle
    ? inquiries.filter((i) =>
        [i.name, i.email, i.company, i.reference_id, i.project_brief]
          .some((v) => v?.toLowerCase().includes(needle))
      )
    : inquiries;
  const isDue = (i: Inquiry) => OPEN_STAGES.includes(i.status) && Boolean(i.next_follow_up_at) && new Date(i.next_follow_up_at as string) <= new Date();
  const sources = Array.from(new Set(inquiries.map((i) => i.source))).sort();
  const filtered = searched
    .filter((i) => stageFilter === "all" || i.status === stageFilter)
    .filter((i) => sourceFilter === "all" || i.source === sourceFilter)
    .filter((i) => !dueOnly || isDue(i));
  const openCount = inquiries.filter((i) => OPEN_STAGES.includes(i.status)).length;
  const wonCount = inquiries.filter((i) => i.status === "won").length;
  const closedCount = wonCount + inquiries.filter((i) => i.status === "lost").length;
  const followUpsDue = inquiries.filter(
    (i) => OPEN_STAGES.includes(i.status) && i.next_follow_up_at && new Date(i.next_follow_up_at) <= new Date()
  ).length;
  const selected = inquiries.find((i) => i.id === selectedId) ?? null;

  // Board drags show the new column immediately; the override clears once the
  // refreshed list (or a failed write) settles it.
  const [stageOverrides, setStageOverrides] = useState<Record<string, InquiryStatus>>({});
  const [dragOver, setDragOver] = useState<InquiryStatus | null>(null);
  const stageOf = (i: Inquiry) => stageOverrides[i.id] ?? i.status;

  const handleStageChange = async (next: InquiryStatus, target: Inquiry | null = selected) => {
    if (!target || !user || target.status === next) return;
    setStageSaving(true);
    setStageOverrides((o) => ({ ...o, [target.id]: next }));
    const previous = target.status;
    try {
      const { error: updateError } = await consoleSchema()
        .from("inquiries")
        .update({ status: next })
        .eq("id", target.id);
      if (updateError) throw updateError;
      await consoleSchema()
        .from("inquiry_activities")
        .insert({
          inquiry_id: target.id,
          actor: "admin",
          actor_user_id: user.id,
          activity_type: "stage_change",
          body: `${previous} → ${next}`,
          payload: { from: previous, to: next }
        });
      await loadInquiries();
      if (target.id === selectedId) void loadActivities();
      toast.success(`${target.name} moved to ${next}`);
    } catch (err) {
      // A failed write is not a failed load. It must not replace the page's
      // data state, so it reports through a toast and leaves the loaded list
      // on screen -- the alert channel is reserved for the load itself.
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setStageOverrides(({ [target.id]: _, ...rest }) => rest);
      setStageSaving(false);
    }
  };

  const handleDeleteLead = async (target: Inquiry | null = selected) => {
    if (!target) return;
    if (!window.confirm(`Delete ${target.name} (${target.company ?? target.email}) and its activity? This can't be undone.`)) return;
    setStageSaving(true);
    try {
      const { error: deleteError } = await consoleSchema().from("inquiries").delete().eq("id", target.id);
      if (deleteError) throw deleteError;
      if (target.id === selectedId) setSelectedId(null);
      await loadInquiries();
      toast.success(`${target.name} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete lead");
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
    <ConsoleLayout area="admin" onRefresh={() => void refreshInquiries()} isRefreshing={refreshing}>
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
          <span className="dash-kicker">SALES</span>
          <h1>Leads & Pipeline</h1>
          <p>Inquiries from the marketing site, and what we're doing about them.</p>
        </div>
      </div>

      {inquiries.length > 0 && (
        <div className="cp-stats mb-6">
          <div>
            <small>OPEN PIPELINE</small>
            <strong>{openCount}</strong>
            <em>new, contacted, or qualified</em>
          </div>
          <div>
            <small>FOLLOW-UPS DUE</small>
            <strong className={followUpsDue ? "warn" : undefined}>{followUpsDue}</strong>
            <em>{followUpsDue ? "past their follow-up date" : "Nothing overdue"}</em>
          </div>
          <div>
            <small>WON</small>
            <strong>{wonCount}</strong>
            <em>{inquiries.length} leads all-time</em>
          </div>
          <div>
            <small>WIN RATE</small>
            <strong>{closedCount ? `${Math.round((wonCount / closedCount) * 100)}%` : "—"}</strong>
            <em>{closedCount ? `of ${closedCount} closed leads` : "No closed leads yet"}</em>
          </div>
        </div>
      )}

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
          <div className="admin-toolbar">
            <div className="workspace-search-box">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search name, email, company, reference…"
                aria-label="Search leads"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as "all" | InquiryStatus)} aria-label="Stage">
              {STAGE_TABS.map((tab) => (
                <option key={tab.key} value={tab.key}>
                  {tab.label} ({tab.key === "all" ? searched.length : searched.filter((i) => i.status === tab.key).length})
                </option>
              ))}
            </select>
            {sources.length > 1 && (
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label="Source">
                <option value="all">All sources</option>
                {sources.map((src) => <option key={src} value={src}>{src.replace(/_/g, " ")}</option>)}
              </select>
            )}
            <label className="admin-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} /> Follow-up due
            </label>
            <span className="admin-toolbar-spacer" />
            <button
              className={`dash-tab-btn ${view === "list" ? "active" : ""}`}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <LayoutList size={13} />
              <span>List</span>
            </button>
            <button
              className={`dash-tab-btn ${view === "board" ? "active" : ""}`}
              onClick={() => setView("board")}
              aria-pressed={view === "board"}
            >
              <Columns3 size={13} />
              <span>Board</span>
            </button>
          </div>

          {view === "board" ? (
            <div className="admin-board">
              {PIPELINE_STAGES.map((stage) => {
                const cards = searched.filter((i) => stageOf(i) === stage);
                const tone = STAGE_TONE[stage];
                return (
                  <div
                    className={`admin-board-col ${dragOver === stage ? "drag-over" : ""}`}
                    key={stage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOver !== stage) setDragOver(stage);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(null);
                      const lead = inquiries.find((i) => i.id === e.dataTransfer.getData("text/plain"));
                      if (lead && stageOf(lead) !== stage) void handleStageChange(stage, lead);
                    }}
                  >
                    <div className={`admin-board-col-head ${tone}`}>
                      <span>{stage}</span>
                      <span>{cards.length}</span>
                    </div>
                    {cards.length === 0 ? (
                      <div className="admin-board-empty">Empty</div>
                    ) : (
                      cards.map((i) => (
                        <button
                          key={i.id}
                          className="admin-board-card"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", i.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragOver(null)}
                          title="Drag to another stage, or click to open"
                          onClick={() => {
                            setSelectedId(i.id);
                            setStageFilter("all");
                            setView("list");
                          }}
                        >
                          <strong>{i.name}</strong>
                          <span>{i.company ?? i.email}</span>
                          <span>{[i.budget_range, formatDate(i.created_at)].filter(Boolean).join(" · ")}</span>
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
          <>
          {filtered.length === 0 ? (
            <div className="dash-empty-state">No leads match this view.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Source</th>
                    <th>Stage</th>
                    <th>Budget</th>
                    <th>Follow-up</th>
                    <th>Received</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <Fragment key={i.id}>
                      <tr className="clickable" onClick={() => setSelectedId(selectedId === i.id ? null : i.id)}>
                        <td>
                          <strong>{i.name}</strong>
                          <div className="admin-muted">{i.company ?? i.email}</div>
                        </td>
                        <td className="admin-muted">{i.source.replace(/_/g, " ")}</td>
                        <td><StagePill status={i.status} /></td>
                        <td className="admin-muted">{i.budget_range ?? i.service_tier ?? "—"}</td>
                        <td className={isDue(i) ? "admin-danger" : "admin-muted"}>{i.next_follow_up_at ? formatDate(i.next_follow_up_at) : "—"}</td>
                        <td className="admin-muted">{formatDate(i.created_at)}</td>
                        <td className="num" onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            label={`Actions for ${i.name}`}
                            items={[
                              { label: selectedId === i.id ? "Close details" : "Open details", onClick: () => setSelectedId(selectedId === i.id ? null : i.id) },
                              ...PIPELINE_STAGES.filter((st) => st !== i.status).map((st) => ({ label: `Move to ${st}`, onClick: () => void handleStageChange(st, i), disabled: stageSaving })),
                              { label: "Delete", danger: true, onClick: () => void handleDeleteLead(i), disabled: stageSaving }
                            ]}
                          />
                        </td>
                      </tr>
                      {selectedId === i.id && selected && (
                        <tr>
                          <td colSpan={7}>
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
                    {selected.phone && (
                      <div className="app-meta-item">
                        <span className="meta-k">
                          <Phone size={12} /> Phone
                        </span>
                        <span className="meta-v">
                          <a href={`tel:${selected.phone}`} className="text-teal">
                            {selected.phone}
                          </a>
                          {selected.whatsapp_opted_out_at && <span>{" · "}WhatsApp stopped</span>}
                          {selected.whatsapp_opt_in && (
                            <>
                              {" · "}
                              <a
                                href={`https://wa.me/${selected.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-teal"
                              >
                                WhatsApp OK
                              </a>
                            </>
                          )}
                        </span>
                      </div>
                    )}
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
                    <span className="meta-k">Stage</span>
                    <select value={selected.status} disabled={stageSaving} onChange={(e) => void handleStageChange(e.target.value as InquiryStatus)} aria-label="Stage">
                      {PIPELINE_STAGES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
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
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
          )}
        </>
      )}
    </ConsoleLayout>
  );
}
