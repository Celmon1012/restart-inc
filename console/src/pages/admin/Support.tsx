// Admin support desk: every client's tickets in one inbox. Same Chatwoot-proxy
// model as the client's Help & Support page -- no message content is stored in
// Postgres; everything goes through the console-support-* functions, which are
// the only things holding CHATWOOT_API_ACCESS_TOKEN.
//
// Admin-only here, and nowhere in the client console: private notes (the
// function returns them only to admins), agent-drafted reply approval, internal
// notes, and resolve/reopen.

import { useEffect, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { invokeFunction } from "@/lib/functions";
import { supabase } from "@/lib/supabase";
import { Clock, Send, Check, X, Lock, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { queryParam } from "@/lib/admin";
import { toast } from "sonner";

interface ConversationSummary {
  id: string;
  workspaceId?: string;
  workspaceName: string | null;
  status: string;
  lastMessage: string | null;
  lastActivityAt: number | null;
}

// Chatwoot message_type: 0 = incoming (client), 1 = outgoing (Restart), 2 = activity, 3 = template.
interface ChatwootMessage {
  id: number;
  content: string;
  message_type: 0 | 1 | 2 | 3;
  private: boolean;
  created_at: number;
}

interface Proposal {
  id: string;
  body: string;
  status: "proposed" | "approved" | "rejected";
}

type StatusFilter = "open" | "pending" | "resolved" | "all";

const STATUS_TONE: Record<string, string> = { open: "warning", pending: "neutral", resolved: "", snoozed: "neutral" };

export default function AdminSupport() {
  const [selectedId, setSelectedId] = useState<string | null>(() => queryParam("id"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [asNote, setAsNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [proposalDraft, setProposalDraft] = useState("");

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource<ConversationSummary[]>(
    async (signal) => {
      const res = await invokeFunction<{ conversations: ConversationSummary[] }>("console-support-data");
      if (signal.aborted) return [];
      return res.conversations ?? [];
    },
    [],
    { errorMessage: "Failed to load conversations" }
  );
  const conversations = (data ?? []).slice().sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));

  const { data: threadData, loading: threadLoading, refresh: refreshThread } = useAsyncResource<{
    conversation: { messages: ChatwootMessage[]; status: string };
    proposal: Proposal | null;
  }>(
    async (signal) => {
      const res = await invokeFunction<{ conversation: { messages: ChatwootMessage[]; status: string }; proposal: Proposal | null }>(
        "console-support-data",
        { query: `conversation_id=${selectedId}` }
      );
      if (signal.aborted) throw new Error("cancelled");
      return res;
    },
    [selectedId],
    { enabled: Boolean(selectedId), errorMessage: "Failed to load conversation" }
  );
  const thread = threadData?.conversation ?? null;
  const proposal = threadData?.proposal ?? null;

  useEffect(() => {
    setProposalDraft(threadData?.proposal?.body ?? "");
  }, [threadData?.proposal?.id]);

  const clients = Array.from(new Set(conversations.map((c) => c.workspaceName ?? "—"))).sort();
  const needle = search.trim().toLowerCase();
  const visible = conversations.filter(
    (c) =>
      (statusFilter === "all" || c.status === statusFilter) &&
      (clientFilter === "all" || (c.workspaceName ?? "—") === clientFilter) &&
      (!needle || [c.workspaceName, c.lastMessage].some((v) => v?.toLowerCase().includes(needle)))
  );
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const count = (s: string) => conversations.filter((c) => c.status === s).length;

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setSending(true);
    try {
      await fn();
      if (success) toast.success(success);
      void refreshThread();
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const handleReply = () =>
    run(async () => {
      await invokeFunction("console-support-reply", {
        body: { conversation_id: selectedId, body: replyDraft.trim(), private: asNote }
      });
      setReplyDraft("");
    }, asNote ? "Internal note added" : "Reply sent");

  const handleStatus = (status: "open" | "resolved") =>
    run(
      () => invokeFunction("console-support-reply", { body: { conversation_id: selectedId, status } }),
      status === "resolved" ? "Ticket resolved" : "Ticket reopened"
    );

  const handleApproveProposal = () =>
    run(() => invokeFunction("console-support-send", { body: { proposal_id: proposal!.id, body: proposalDraft.trim() } }), "Reply sent");

  const handleRejectProposal = () =>
    run(async () => {
      const { error: updateError } = await supabase
        .schema("console")
        .from("support_proposals")
        .update({ status: "rejected", decided_at: new Date().toISOString() })
        .eq("id", proposal!.id);
      if (updateError) throw updateError;
    }, "Draft rejected");

  const threadStatus = thread?.status ?? selected?.status;

  return (
    <ConsoleLayout area="admin" onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Loading support conversations" : error ? `Could not load support: ${error}` : `${visible.length} conversations shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">OPERATIONS</span>
          <h1>Support Desk</h1>
          <p>Every client ticket in one inbox, with drafts, internal notes, and resolution.</p>
        </div>
      </div>

      {error && <ErrorAlert message={`Couldn't load conversations: ${error}`} onRetry={retry} retryLabel="Reload conversations" />}

      <div className="admin-toolbar">
        {(["open", "pending", "resolved", "all"] as StatusFilter[]).map((s) => (
          <button key={s} className={`dash-tab-btn ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
            {s === "all" ? `All (${conversations.length})` : `${s[0].toUpperCase()}${s.slice(1)} (${count(s)})`}
          </button>
        ))}
        <span className="admin-toolbar-spacer" />
        <select className="console-select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Client">
          <option value="all">All clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="workspace-search-box">
          <Search size={13} />
          <input type="text" placeholder="Search tickets…" aria-label="Search tickets" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading conversations…" />
      ) : conversations.length === 0 ? (
        <EmptyState title="No support conversations yet" hint="Tickets clients open from Help & Support land here." />
      ) : (
        <div className="console-grid-layout leads-layout">
          <div className="console-col leads-list-col">
            {visible.length === 0 ? (
              <div className="dash-empty-state">No tickets in this view.</div>
            ) : (
              <div className="leads-list">
                {visible.map((c) => (
                  <button key={c.id} className={`lead-row ${selectedId === c.id ? "active" : ""}`} onClick={() => setSelectedId(c.id)}>
                    <div className="lead-row-main">
                      <strong>{c.workspaceName ?? "Conversation"}</strong>
                      <span className="lead-row-company">{c.lastMessage ?? "No messages yet"}</span>
                    </div>
                    <div className="lead-row-meta">
                      <span className={`system-healthy-pill ${STATUS_TONE[c.status] ?? "neutral"}`}>{c.status?.toUpperCase() ?? "—"}</span>
                      {c.lastActivityAt && (
                        <span className="lead-row-time">
                          <Clock size={11} />
                          {formatDate(c.lastActivityAt)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="console-col leads-detail-col">
            {!selectedId ? (
              <div className="dash-empty-state">Select a ticket.</div>
            ) : threadLoading ? (
              <div className="dash-empty-state">Loading conversation…</div>
            ) : (
              <div className="console-card lead-detail-card">
                <div className="card-top-header">
                  <span className="card-kicker">{selected?.workspaceName ?? "CONVERSATION"}</span>
                  {threadStatus === "resolved" ? (
                    <button className="dash-tab-btn" disabled={sending} onClick={() => handleStatus("open")}>
                      <RotateCcw size={13} />
                      <span>Reopen</span>
                    </button>
                  ) : (
                    <button className="dash-tab-btn" disabled={sending} onClick={() => handleStatus("resolved")}>
                      <CheckCircle2 size={13} />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>

                <div className="support-thread">
                  {(thread?.messages ?? [])
                    .filter((m) => m.message_type !== 2 && m.message_type !== 3)
                    .map((m) => (
                      <div key={m.id} className={`support-message ${m.message_type === 1 ? "outgoing" : "incoming"} ${m.private ? "private" : ""}`}>
                        {m.private && (
                          <span className="support-message-badge">
                            <Lock size={10} /> INTERNAL NOTE
                          </span>
                        )}
                        <p>{m.content}</p>
                        <span className="support-message-time">{formatDateTime(m.created_at * 1000)}</span>
                      </div>
                    ))}
                </div>

                {proposal && proposal.status === "proposed" && (
                  <div className="activity-proposal-draft mt-4">
                    <span className="meta-k">Agent-drafted reply, pending approval</span>
                    <textarea rows={4} value={proposalDraft} onChange={(e) => setProposalDraft(e.target.value)} />
                    <div className="lead-stage-buttons mt-2">
                      <button className="dash-action-btn" disabled={sending || !proposalDraft.trim()} onClick={handleApproveProposal}>
                        <Check size={13} />
                        <span>Approve & Send</span>
                      </button>
                      <button className="dash-tab-btn" disabled={sending} onClick={handleRejectProposal}>
                        <X size={13} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="lead-note-form mt-4">
                  <div className="lead-stage-buttons">
                    <button className={`dash-tab-btn ${!asNote ? "active" : ""}`} onClick={() => setAsNote(false)}>
                      <Send size={12} />
                      <span>Reply to client</span>
                    </button>
                    <button className={`dash-tab-btn ${asNote ? "active" : ""}`} onClick={() => setAsNote(true)}>
                      <Lock size={12} />
                      <span>Internal note</span>
                    </button>
                  </div>
                  <textarea
                    placeholder={asNote ? "Only Restart staff can see this…" : "Write a reply…"}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    rows={3}
                  />
                  <button className="dash-action-btn" disabled={sending || !replyDraft.trim()} onClick={handleReply}>
                    {asNote ? <Lock size={13} /> : <Send size={13} />}
                    <span>{asNote ? "Add note" : "Send"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ConsoleLayout>
  );
}
