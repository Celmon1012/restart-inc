// Admin-only view of the outbound pipeline: console.prospects and
// console.prospect_touches (see 20261008120000_console_outreach.sql).
//
// Prospects, research, scores and drafts are written by Claude through the
// console-outreach-mcp edge function. This page is where a person reviews
// them. Like Leads, it reads and updates the tables directly under RLS (the
// admin policies are the authorization boundary), and nothing here sends a
// message: "Open" hands the draft to the mail app or WhatsApp, and "Mark
// sent" records that the person sent it.

import { useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { consoleSchema } from "@/lib/supabase";
import { Building2, Clock, Copy, ExternalLink, Mail, Phone, Search, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { toast } from "sonner";

type ProspectStatus =
  | "new" | "researched" | "scored" | "drafted" | "contacted" | "replied"
  | "meeting" | "proposal" | "won" | "lost" | "disqualified";

interface Prospect {
  id: string;
  created_at: string;
  company: string;
  website: string | null;
  country: string | null;
  industry: string | null;
  segment: "ng_sme" | "intl_sme";
  contact_name: string | null;
  contact_role: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string;
  tier: "A" | "B" | "warm";
  status: ProspectStatus;
  research_brief: string | null;
  research_sources: string[] | null;
  fit_score: number | null;
  score_reason: string | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;
  notes: string | null;
}

interface Touch {
  id: string;
  prospect_id: string;
  created_at: string;
  channel: "email" | "whatsapp" | "linkedin" | "call" | "other";
  direction: "outbound" | "inbound";
  status: "draft" | "approved" | "sent" | "rejected" | "received";
  step: number;
  subject: string | null;
  body: string;
  classification: string | null;
  sent_at: string | null;
}

const STATUS_TABS: Array<{ key: "all" | ProspectStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "scored", label: "Scored" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "meeting", label: "Meeting" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const MOVE_TO: ProspectStatus[] = ["contacted", "replied", "meeting", "proposal", "won", "lost", "disqualified"];
const EARLY: ProspectStatus[] = ["new", "researched", "scored", "drafted"];
const FOLLOWUP_DAYS = 4;

const TONE: Record<ProspectStatus, "healthy" | "warning" | "down" | "neutral"> = {
  new: "neutral", researched: "neutral", scored: "neutral", drafted: "neutral",
  contacted: "warning", replied: "healthy", meeting: "healthy", proposal: "healthy",
  won: "healthy", lost: "down", disqualified: "down"
};

function StatusPill({ status }: { status: ProspectStatus }) {
  const tone = TONE[status];
  return (
    <span className={`system-healthy-pill ${tone === "healthy" ? "" : tone === "neutral" ? "neutral" : tone}`}>
      {status.toUpperCase()}
    </span>
  );
}

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : fallback;
}

// The device's own mail app or WhatsApp does the sending; this only opens it.
function openDraftHref(p: Prospect, t: Touch): string | null {
  if (t.channel === "email" && p.email) {
    const q = new URLSearchParams();
    if (t.subject) q.set("subject", t.subject);
    q.set("body", t.body);
    return `mailto:${p.email}?${q.toString().replace(/\+/g, "%20")}`;
  }
  if (t.channel === "whatsapp" && p.phone) {
    return `https://wa.me/${p.phone.replace(/\D/g, "")}?text=${encodeURIComponent(t.body)}`;
  }
  if (t.channel === "linkedin" && p.linkedin_url) return p.linkedin_url;
  return null;
}

function DraftCard({
  touch, prospect, onChanged, onOpenProspect
}: {
  touch: Touch;
  prospect: Prospect | undefined;
  onChanged: () => void;
  onOpenProspect: (id: string) => void;
}) {
  const [subject, setSubject] = useState(touch.subject ?? "");
  const [body, setBody] = useState(touch.body);
  const [busy, setBusy] = useState(false);
  const dirty = body !== touch.body || subject !== (touch.subject ?? "");
  const href = prospect ? openDraftHref(prospect, touch) : null;
  const blocked = prospect?.do_not_contact === true;

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      onChanged();
      toast.success(label);
    } catch (err) {
      toast.error(errMessage(err, "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run("Draft saved", async () => {
      const { error } = await consoleSchema()
        .from("prospect_touches")
        .update({ subject: subject.trim() || null, body: body.trim() })
        .eq("id", touch.id);
      if (error) throw error;
    });

  const decide = (status: "approved" | "rejected") =>
    run(status === "approved" ? "Draft approved" : "Draft rejected", async () => {
      const { error } = await consoleSchema()
        .from("prospect_touches")
        .update({ status, decided_at: new Date().toISOString() })
        .eq("id", touch.id);
      if (error) throw error;
    });

  const markSent = () =>
    run("Marked as sent", async () => {
      if (!prospect) throw new Error("Prospect not loaded");
      const now = new Date();
      const { error: touchError } = await consoleSchema()
        .from("prospect_touches")
        .update({ status: "sent", sent_at: now.toISOString(), decided_at: now.toISOString() })
        .eq("id", touch.id);
      if (touchError) throw touchError;
      const { error: prospectError } = await consoleSchema()
        .from("prospects")
        .update({
          status: EARLY.includes(prospect.status) ? "contacted" : prospect.status,
          last_contacted_at: now.toISOString(),
          next_followup_at: new Date(now.getTime() + FOLLOWUP_DAYS * 86_400_000).toISOString()
        })
        .eq("id", prospect.id);
      if (prospectError) throw prospectError;
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="console-card mb-4">
      <div className="card-top-header">
        <span className="card-kicker">
          {touch.channel.toUpperCase()} · STEP {touch.step}
          {touch.status === "approved" ? " · APPROVED" : ""}
        </span>
        {prospect && (
          <button className="dash-tab-btn" onClick={() => onOpenProspect(prospect.id)}>
            <span>
              {prospect.company}
              {prospect.contact_name ? ` · ${prospect.contact_name}` : ""}
              {prospect.fit_score !== null ? ` · ${prospect.fit_score}` : ""}
            </span>
          </button>
        )}
      </div>
      {blocked && (
        <p className="lead-brief">
          This prospect is marked do not contact{prospect?.do_not_contact_reason ? ` (${prospect.do_not_contact_reason})` : ""}. Reject the draft.
        </p>
      )}
      {touch.channel === "email" && (
        <div className="lead-note-form">
          <input
            type="text"
            aria-label="Subject"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      )}
      <div className="lead-note-form">
        <textarea aria-label="Message" rows={Math.min(14, Math.max(5, body.split("\n").length + 2))} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="lead-stage-buttons">
        <button className="dash-tab-btn" disabled={busy || !dirty || !body.trim()} onClick={save}>Save edits</button>
        <button className="dash-tab-btn" onClick={copy}><Copy size={12} /><span>Copy</span></button>
        {href && (
          <a className="dash-tab-btn" href={href} target={touch.channel === "email" ? undefined : "_blank"} rel="noreferrer">
            <ExternalLink size={12} /><span>Open</span>
          </a>
        )}
        {touch.status === "draft" && (
          <button className="dash-action-btn" disabled={busy || dirty || blocked} onClick={() => decide("approved")}>
            <span>Approve</span>
          </button>
        )}
        <button className="dash-action-btn" disabled={busy || dirty || blocked} onClick={markSent}>
          <span>Mark sent</span>
        </button>
        <button className="dash-tab-btn" disabled={busy} onClick={() => decide("rejected")}>Reject</button>
      </div>
      {dirty && <small>Save your edits before approving or marking sent.</small>}
    </div>
  );
}

export default function Prospects() {
  const [tab, setTab] = useState<"drafts" | "prospects">("drafts");
  const [statusFilter, setStatusFilter] = useState<"all" | ProspectStatus>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<{ prospects: Prospect[]; drafts: Touch[] }>(
    async (signal) => {
      const db = consoleSchema();
      const [p, d] = await Promise.all([
        db.from("prospects").select("*").order("fit_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
        db.from("prospect_touches").select("*").in("status", ["draft", "approved"]).eq("direction", "outbound").order("created_at", { ascending: true })
      ]);
      if (signal.aborted) return { prospects: [], drafts: [] };
      if (p.error) throw p.error;
      if (d.error) throw d.error;
      return { prospects: (p.data ?? []) as Prospect[], drafts: (d.data ?? []) as Touch[] };
    },
    [],
    { errorMessage: "Failed to load prospects" }
  );
  const prospects = data?.prospects ?? [];
  const drafts = data?.drafts ?? [];
  const byId = new Map(prospects.map((p) => [p.id, p]));

  const { data: touchData, loading: touchesLoading, refresh: refreshTouches } = useAsyncResource<Touch[]>(
    async (signal) => {
      if (!selectedId) return [];
      const { data: rows, error: dbError } = await consoleSchema()
        .from("prospect_touches")
        .select("*")
        .eq("prospect_id", selectedId)
        .order("created_at", { ascending: false });
      if (signal.aborted) return [];
      if (dbError) throw dbError;
      return (rows ?? []) as Touch[];
    },
    [selectedId],
    { enabled: Boolean(selectedId), errorMessage: "Failed to load messages" }
  );
  const touches = touchData ?? [];

  const needle = search.trim().toLowerCase();
  const searched = needle
    ? prospects.filter((p) =>
        [p.company, p.contact_name, p.email, p.industry, p.country].some((v) => v?.toLowerCase().includes(needle))
      )
    : prospects;
  const filtered = searched.filter((p) => statusFilter === "all" || p.status === statusFilter);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const now = new Date();
  const followUpsDue = prospects.filter(
    (p) => !p.do_not_contact && p.next_followup_at && new Date(p.next_followup_at) <= now
  ).length;
  const contacted = prospects.filter((p) => !EARLY.includes(p.status) && p.status !== "disqualified").length;
  const replied = prospects.filter((p) => ["replied", "meeting", "proposal", "won"].includes(p.status)).length;

  const reloadAll = () => {
    void refresh();
    void refreshTouches();
  };

  const patchProspect = async (id: string, patch: Partial<Prospect>, message: string) => {
    setSaving(true);
    try {
      const { error: updateError } = await consoleSchema().from("prospects").update(patch).eq("id", id);
      if (updateError) throw updateError;
      await refresh();
      toast.success(message);
    } catch (err) {
      toast.error(errMessage(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  const moveTo = (status: ProspectStatus) => {
    if (!selected) return;
    const closed = ["won", "lost", "disqualified"].includes(status);
    void patchProspect(selected.id, { status, ...(closed ? { next_followup_at: null } : {}) }, `${selected.company} moved to ${status}`);
  };

  const stopContact = () => {
    if (!selected) return;
    const reason = window.prompt(`Stop all outreach to ${selected.company}? Reason:`);
    if (!reason?.trim()) return;
    void patchProspect(
      selected.id,
      { do_not_contact: true, do_not_contact_reason: reason.trim(), next_followup_at: null },
      "Marked do not contact"
    );
  };

  const deleteProspect = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.company} and all its messages? This can't be undone.`)) return;
    setSaving(true);
    try {
      const { error: deleteError } = await consoleSchema().from("prospects").delete().eq("id", selected.id);
      if (deleteError) throw deleteError;
      setSelectedId(null);
      await refresh();
      toast.success(`${selected.company} deleted`);
    } catch (err) {
      toast.error(errMessage(err, "Delete failed"));
    } finally {
      setSaving(false);
    }
  };

  const openProspect = (id: string) => {
    setSelectedId(id);
    setTab("prospects");
    setStatusFilter("all");
  };

  const empty = prospects.length === 0;

  return (
    <ConsoleLayout area="admin" onRefresh={() => reloadAll()} isRefreshing={refreshing}>
      <StatusRegion
        message={
          loading ? "Loading prospects"
            : error ? `Could not load prospects: ${error}`
            : refreshing ? "Refreshing prospects"
            : `${prospects.length} prospect${prospects.length === 1 ? "" : "s"} loaded`
        }
      />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">SALES</span>
          <h1>Outreach</h1>
          <p>Prospects Claude has researched and scored, and the drafts waiting for your review. Nothing is sent from here.</p>
        </div>
      </div>

      {!empty && (
        <div className="cp-stats mb-6">
          <div>
            <small>DRAFTS TO REVIEW</small>
            <strong className={drafts.length ? "warn" : undefined}>{drafts.length}</strong>
            <em>{drafts.length ? "waiting for you" : "Queue is clear"}</em>
          </div>
          <div>
            <small>FOLLOW-UPS DUE</small>
            <strong className={followUpsDue ? "warn" : undefined}>{followUpsDue}</strong>
            <em>{followUpsDue ? "past their follow-up date" : "Nothing overdue"}</em>
          </div>
          <div>
            <small>CONTACTED</small>
            <strong>{contacted}</strong>
            <em>{prospects.length} prospects in total</em>
          </div>
          <div>
            <small>REPLY RATE</small>
            <strong>{contacted ? `${Math.round((replied / contacted) * 100)}%` : "—"}</strong>
            <em>{contacted ? `${replied} of ${contacted} contacted` : "No outreach yet"}</em>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={`Couldn't load prospects: ${error}`} onRetry={retry} retryLabel="Reload prospects" />}

      {loading && empty ? (
        <LoadingState label="Loading prospects…" />
      ) : empty && !error ? (
        <EmptyState
          title="No prospects yet"
          hint="Ask Claude Code to add and research prospects through the restart-outreach MCP. They appear here, with drafts to review."
        />
      ) : (
        <>
          <div className="dash-tabs-bar">
            <button className={`dash-tab-btn ${tab === "drafts" ? "active" : ""}`} onClick={() => setTab("drafts")}>
              <span>Drafts ({drafts.length})</span>
            </button>
            <button className={`dash-tab-btn ${tab === "prospects" ? "active" : ""}`} onClick={() => setTab("prospects")}>
              <span>Prospects ({prospects.length})</span>
            </button>
          </div>

          {tab === "drafts" ? (
            drafts.length === 0 ? (
              <div className="dash-empty-state">No drafts waiting. Ask Claude to draft outreach for your best-scored prospects.</div>
            ) : (
              drafts.map((t) => (
                <DraftCard
                  key={t.id}
                  touch={t}
                  prospect={byId.get(t.prospect_id)}
                  onChanged={reloadAll}
                  onOpenProspect={openProspect}
                />
              ))
            )
          ) : (
            <>
              <div className="admin-toolbar">
                <div className="workspace-search-box">
                  <Search size={13} />
                  <input
                    type="text"
                    placeholder="Search company, contact, email, industry…"
                    aria-label="Search prospects"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="dash-tabs-bar">
                {STATUS_TABS.map((s) => (
                  <button
                    key={s.key}
                    className={`dash-tab-btn ${statusFilter === s.key ? "active" : ""}`}
                    onClick={() => setStatusFilter(s.key)}
                  >
                    <span>
                      {s.label} ({s.key === "all" ? searched.length : searched.filter((p) => p.status === s.key).length})
                    </span>
                  </button>
                ))}
              </div>

              <div className="console-grid-layout leads-layout">
                <div className="console-col leads-list-col">
                  {filtered.length === 0 ? (
                    <div className="dash-empty-state">No prospects in this stage.</div>
                  ) : (
                    <div className="leads-list">
                      {filtered.map((p) => (
                        <button
                          key={p.id}
                          className={`lead-row ${selectedId === p.id ? "active" : ""}`}
                          onClick={() => setSelectedId(p.id)}
                        >
                          <div className="lead-row-main">
                            <strong>{p.company}</strong>
                            <span className="lead-row-company">
                              <Building2 size={12} />
                              {[p.contact_name, p.industry].filter(Boolean).join(" · ") || p.segment}
                            </span>
                          </div>
                          <div className="lead-row-meta">
                            <StatusPill status={p.status} />
                            <span className="lead-row-time">
                              <Clock size={11} />
                              {p.fit_score !== null ? `${p.fit_score} · ` : ""}{p.tier}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="console-col leads-detail-col">
                  {!selected ? (
                    <div className="dash-empty-state">Select a prospect to see the research and message history.</div>
                  ) : (
                    <div className="console-card lead-detail-card">
                      <div className="card-top-header">
                        <span className="card-kicker">
                          {selected.segment === "ng_sme" ? "NIGERIA" : "INTERNATIONAL"} · TIER {selected.tier.toUpperCase()}
                        </span>
                        <StatusPill status={selected.status} />
                      </div>
                      <h3 className="lead-detail-name">{selected.company}</h3>

                      {selected.do_not_contact && (
                        <p className="lead-brief">
                          Do not contact{selected.do_not_contact_reason ? `: ${selected.do_not_contact_reason}` : ""}.
                        </p>
                      )}

                      <div className="app-meta-list">
                        {selected.contact_name && (
                          <div className="app-meta-item">
                            <span className="meta-k">Contact</span>
                            <span className="meta-v">{[selected.contact_name, selected.contact_role].filter(Boolean).join(", ")}</span>
                          </div>
                        )}
                        {selected.email && (
                          <div className="app-meta-item">
                            <span className="meta-k"><Mail size={12} /> Email</span>
                            <span className="meta-v"><a href={`mailto:${selected.email}`} className="text-teal">{selected.email}</a></span>
                          </div>
                        )}
                        {selected.phone && (
                          <div className="app-meta-item">
                            <span className="meta-k"><Phone size={12} /> Phone</span>
                            <span className="meta-v"><a href={`tel:${selected.phone}`} className="text-teal">{selected.phone}</a></span>
                          </div>
                        )}
                        {selected.website && (
                          <div className="app-meta-item">
                            <span className="meta-k">Website</span>
                            <span className="meta-v">{selected.website}</span>
                          </div>
                        )}
                        {selected.fit_score !== null && (
                          <div className="app-meta-item">
                            <span className="meta-k">Fit score</span>
                            <span className="meta-v">{selected.fit_score}/100{selected.score_reason ? ` — ${selected.score_reason}` : ""}</span>
                          </div>
                        )}
                        {selected.next_followup_at && (
                          <div className="app-meta-item">
                            <span className="meta-k">Next follow-up</span>
                            <span className="meta-v">{formatDate(selected.next_followup_at)}</span>
                          </div>
                        )}
                        <div className="app-meta-item">
                          <span className="meta-k">Source</span>
                          <span className="meta-v">{selected.source}</span>
                        </div>
                      </div>

                      {selected.research_brief && (
                        <>
                          <span className="card-kicker">RESEARCH</span>
                          <p className="lead-brief" style={{ whiteSpace: "pre-wrap" }}>{selected.research_brief}</p>
                          {selected.research_sources && selected.research_sources.length > 0 && (
                            <small>
                              Sources:{" "}
                              {selected.research_sources.map((u, i) => (
                                <span key={u}>
                                  {i > 0 && ", "}
                                  <a href={u} target="_blank" rel="noreferrer" className="text-teal">{u.replace(/^https?:\/\//, "").slice(0, 40)}</a>
                                </span>
                              ))}
                            </small>
                          )}
                        </>
                      )}

                      <div className="lead-stage-actions">
                        <span className="meta-k">Move to</span>
                        <div className="lead-stage-buttons">
                          {MOVE_TO.filter((s) => s !== selected.status).map((s) => (
                            <button key={s} className="dash-tab-btn" disabled={saving} onClick={() => moveTo(s)}>{s}</button>
                          ))}
                          {!selected.do_not_contact && (
                            <button className="dash-tab-btn" disabled={saving} onClick={stopContact}>do not contact</button>
                          )}
                          <button className="dash-tab-btn" disabled={saving} onClick={() => void deleteProspect()}>
                            <Trash2 size={12} /><span>delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="lead-activity-section">
                        <span className="card-kicker">MESSAGES</span>
                        {touchesLoading && touches.length === 0 ? (
                          <LoadingState label="Loading messages…" />
                        ) : touches.length === 0 ? (
                          <div className="dash-empty-state">No messages yet.</div>
                        ) : (
                          touches.map((t) => (
                            <div key={t.id} className="console-card mb-4">
                              <div className="card-top-header">
                                <span className="card-kicker">
                                  {t.direction === "inbound" ? "REPLY" : t.status.toUpperCase()} · {t.channel.toUpperCase()}
                                  {t.direction === "outbound" ? ` · STEP ${t.step}` : ""}
                                  {t.classification ? ` · ${t.classification.replace("_", " ").toUpperCase()}` : ""}
                                </span>
                                <small>{formatDate(t.sent_at ?? t.created_at)}</small>
                              </div>
                              {t.subject && <strong>{t.subject}</strong>}
                              <p className="lead-brief" style={{ whiteSpace: "pre-wrap" }}>{t.body}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </ConsoleLayout>
  );
}
