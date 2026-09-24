// Support desk: a thin, branded surface over Chatwoot (support.restart.ng).
// Chatwoot owns every conversation and message -- this page only ever
// reads/writes through the console-support-* edge functions, which are
// the only things holding CHATWOOT_API_ACCESS_TOKEN. No message content
// is stored in our own Postgres.

import { useEffect, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/lib/supabase";
import { Clock, Plus, Send, Check, X, Lock } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";

interface ConversationSummary {
  id: string;
  workspaceName: string | null;
  status: string;
  lastMessage: string | null;
  lastActivityAt: number | null;
}

// Chatwoot serializes message_type as a number, not the string its own
// API docs' examples suggest: 0 = incoming (client), 1 = outgoing
// (Restart), 2 = activity, 3 = template.
type ChatwootMessageType = 0 | 1 | 2 | 3;

interface ChatwootMessage {
  id: number;
  content: string;
  message_type: ChatwootMessageType;
  private: boolean;
  created_at: number;
}

interface Proposal {
  id: string;
  body: string;
  status: "proposed" | "approved" | "rejected";
}

async function invoke<T = any>(name: string, options: { body?: unknown; query?: string } = {}): Promise<T> {
  const path = options.query ? `${name}?${options.query}` : name;
  const { data, error } = await supabase.functions.invoke(path, options.body ? { body: options.body } : undefined);
  if (error) {
    // supabase-js's own error.message is just "Edge Function returned a
    // non-2xx status code" -- the function's actual {error} body (which is
    // what we want to show) is only reachable via error.context, the raw
    // Response object, and has to be read out explicitly.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.json();
        if (body?.error) throw new Error(body.error);
      } catch {
        // fall through to the generic error below
      }
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function Support() {
  const { activeWorkspace, isAdmin } = useWorkspace();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<{ messages: ChatwootMessage[]; status: string } | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [proposalDraft, setProposalDraft] = useState("");

  const loadConversations = () => {
    setLoading(true);
    setError(null);
    invoke<{ conversations: ConversationSummary[] }>("console-support-data")
      .then((data) => setConversations(data.conversations ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load conversations"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const loadThread = (id: string) => {
    setThreadLoading(true);
    invoke<{ conversation: { messages: ChatwootMessage[]; status: string }; proposal: Proposal | null }>(
      "console-support-data",
      { query: `conversation_id=${id}` }
    )
      .then((data) => {
        setThread(data.conversation);
        setProposal(data.proposal);
        setProposalDraft(data.proposal?.body ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load conversation"))
      .finally(() => setThreadLoading(false));
  };

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId]);

  const handleCreateTicket = async () => {
    if (!activeWorkspace || !newMessage.trim()) return;
    setCreating(true);
    try {
      const result = await invoke<{ id: string }>("console-support-create", {
        body: { workspace_id: activeWorkspace.id, subject: newSubject.trim(), message: newMessage.trim() }
      });
      setNewSubject("");
      setNewMessage("");
      setShowNewTicket(false);
      loadConversations();
      setSelectedId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open ticket");
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async () => {
    if (!selectedId || !replyDraft.trim()) return;
    setSending(true);
    try {
      await invoke("console-support-reply", { body: { conversation_id: selectedId, body: replyDraft.trim() } });
      setReplyDraft("");
      loadThread(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!selectedId || !proposal || !proposalDraft.trim()) return;
    setSending(true);
    try {
      await invoke("console-support-send", { body: { proposal_id: proposal.id, body: proposalDraft.trim() } });
      loadThread(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const handleRejectProposal = async () => {
    if (!proposal) return;
    setSending(true);
    try {
      const { error: updateError } = await supabase
        .schema("console")
        .from("support_proposals")
        .update({ status: "rejected", decided_at: new Date().toISOString() })
        .eq("id", proposal.id);
      if (updateError) throw updateError;
      if (selectedId) loadThread(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject draft");
    } finally {
      setSending(false);
    }
  };

  return (
    <ConsoleLayout onRefresh={loadConversations} isRefreshing={loading}>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">SUPPORT</span>
          <h1>Help & Support</h1>
          <p>Talk to us directly -- every message here goes straight to our support desk.</p>
        </div>
        <button className="dash-action-btn" onClick={() => setShowNewTicket((v) => !v)}>
          <Plus size={14} />
          <span>New Ticket</span>
        </button>
      </div>

      {error && <div className="dash-empty-state">{error}</div>}

      {showNewTicket && (
        <div className="console-card mb-4">
          <div className="card-top-header">
            <span className="card-kicker">NEW TICKET</span>
          </div>
          <div className="lead-note-form">
            <input
              className="console-input mb-2"
              placeholder="Subject (optional)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
            <textarea
              placeholder="What's going on?"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={4}
            />
            <button className="dash-action-btn" disabled={creating || !newMessage.trim()} onClick={handleCreateTicket}>
              <Send size={13} />
              <span>Send</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="dash-empty-state">Loading conversations…</div>
      ) : (
        <div className="console-grid-layout leads-layout">
          <div className="console-col leads-list-col">
            {conversations.length === 0 ? (
              <div className="dash-empty-state">No support conversations yet.</div>
            ) : (
              <div className="leads-list">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    className={`lead-row ${selectedId === c.id ? "active" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="lead-row-main">
                      <strong>{c.workspaceName ?? "Conversation"}</strong>
                      <span className="lead-row-company">{c.lastMessage ?? "No messages yet"}</span>
                    </div>
                    <div className="lead-row-meta">
                      <span className="system-healthy-pill neutral">{c.status?.toUpperCase() ?? "—"}</span>
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
              <div className="dash-empty-state">Select a conversation, or start a new ticket.</div>
            ) : threadLoading ? (
              <div className="dash-empty-state">Loading conversation…</div>
            ) : (
              <div className="console-card lead-detail-card">
                <div className="support-thread">
                  {(thread?.messages ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`support-message ${m.message_type === 1 ? "outgoing" : "incoming"} ${m.private ? "private" : ""}`}
                    >
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

                {isAdmin && proposal && proposal.status === "proposed" && (
                  <div className="activity-proposal-draft mt-4">
                    <span className="meta-k">Agent-drafted reply, pending approval</span>
                    <textarea rows={4} value={proposalDraft} onChange={(e) => setProposalDraft(e.target.value)} />
                    <div className="lead-stage-buttons mt-2">
                      <button className="dash-action-btn" disabled={sending} onClick={handleApproveProposal}>
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
                  <textarea
                    placeholder="Write a reply…"
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    rows={3}
                  />
                  <button className="dash-action-btn" disabled={sending || !replyDraft.trim()} onClick={handleReply}>
                    <Send size={13} />
                    <span>Send</span>
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
