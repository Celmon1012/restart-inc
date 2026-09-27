// Support desk: a thin, branded surface over Chatwoot (support.restart.ng).
// Chatwoot owns every conversation and message -- this page only ever
// reads/writes through the console-support-* edge functions, which are
// the only things holding CHATWOOT_API_ACCESS_TOKEN. No message content
// is stored in our own Postgres.
//
// Client-facing only. Staff tooling (agent-drafted replies, internal notes,
// resolve/reopen, the cross-client inbox) lives in the admin Support Desk.

import { useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { invokeFunction as invoke } from "@/lib/functions";
import { Clock, Plus, Send } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { EmptyState, ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { toast } from "sonner";

interface ConversationSummary {
  id: string;
  workspaceId?: string;
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

export default function Support() {
  const { activeWorkspace } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Conversations and the open thread are two resources, each with its own
  // loading/error state and its own retry. Both previously shared one error
  // variable, which meant a failed thread load could blank the conversation
  // list's error state and vice versa.
  const {
    data: conversationData,
    loading,
    error,
    retry: retryConversations,
    refresh: refreshConversations,
    refreshing,
  } = useAsyncResource<ConversationSummary[]>(
    async (signal) => {
      const data = await invoke<{ conversations: ConversationSummary[] }>("console-support-data");
      if (signal.aborted) return [];
      return data.conversations ?? [];
    },
    [],
    { errorMessage: "Failed to load conversations" }
  );
  // console-support-data returns everything RLS lets the caller see -- for an
  // admin that is every client, so scope to the active workspace here.
  const conversations = (conversationData ?? []).filter(
    (c) => !c.workspaceId || !activeWorkspace || c.workspaceId === activeWorkspace.id
  );
  const loadConversations = refreshConversations;

  // The open thread is keyed by selection, so switching conversations aborts the
  // previous request rather than racing it.
  const { data: threadData, loading: threadLoading, refresh: refreshThread } = useAsyncResource<{
    conversation: { messages: ChatwootMessage[]; status: string };
  }>(
    async (signal) => {
      const data = await invoke<{
        conversation: { messages: ChatwootMessage[]; status: string };
      }>("console-support-data", { query: `conversation_id=${selectedId}` });
      if (signal.aborted) throw new Error("cancelled");
      return data;
    },
    [selectedId],
    { enabled: Boolean(selectedId), errorMessage: "Failed to load conversation" }
  );
  const thread = threadData?.conversation ?? null;
  const loadThread = refreshThread;

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
      toast.error(err instanceof Error ? err.message : "Failed to open ticket");
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
      void loadThread();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <ConsoleLayout onRefresh={() => void refreshConversations()} isRefreshing={refreshing}>
      <StatusRegion
        message={
          loading
            ? "Loading support conversations"
            : error
              ? `Could not load support: ${error}`
              : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"} loaded`
        }
      />
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

      {error && (
        <ErrorAlert
          message={`Couldn't load conversations: ${error}`}
          onRetry={retryConversations}
          retryLabel="Reload conversations"
        />
      )}

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
        <LoadingState label="Loading conversations…" />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No support conversations yet"
          hint="Open a ticket and it appears here, alongside anything the support desk replies with."
        />
      ) : (
        <div className="console-grid-layout leads-layout">
          <div className="console-col leads-list-col">
            {conversations.length === 0 ? (
              <div className="dash-empty-state">No conversations in this view.</div>
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
                  {/* The function already strips private notes for members; an
                      admin previewing the console gets them too, so drop them
                      here -- this page shows what the client sees. */}
                  {(thread?.messages ?? []).filter((m) => !m.private).map((m) => (
                    <div
                      key={m.id}
                      className={`support-message ${m.message_type === 1 ? "outgoing" : "incoming"}`}
                    >
                      <p>{m.content}</p>
                      <span className="support-message-time">{formatDateTime(m.created_at * 1000)}</span>
                    </div>
                  ))}
                </div>

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
