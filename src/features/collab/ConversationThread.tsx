import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "../../components/ui/Icon";
import {
  conversationService,
  messageService,
  type Conversation,
  type ConversationAnchor,
  type ConversationMessage,
  type ConversationType,
} from "../../lib/collab";
import { CollabComposer } from "./CollabComposer";
import { CardRenderer } from "./cards/CardRenderer";

const GROUP_MS = 5 * 60 * 1000;

function anchorToType(
  anchor: ConversationAnchor,
): Extract<ConversationType, "project_room" | "item_thread" | "record_thread"> {
  if (anchor.type === "project") return "project_room";
  if (anchor.type === "record") return "record_thread";
  return "item_thread";
}

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shouldStartGroup(prev: ConversationMessage | null, msg: ConversationMessage) {
  if (!prev) return true;
  if (prev.senderId !== msg.senderId || prev.senderType !== msg.senderType) return true;
  const a = new Date(prev.createdAt).getTime();
  const b = new Date(msg.createdAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  return b - a > GROUP_MS;
}

export type ConversationThreadProps = {
  workspaceId: string;
  userId: string;
  userName: string;
  /** Open by conversation id */
  conversationId?: string | null;
  /** Or ensure/open by anchor (item modal, project room, etc.) */
  anchor?: ConversationAnchor | null;
  /** Compact layout for embeds (item modal) */
  compact?: boolean;
  /** Hide composer */
  readOnly?: boolean;
  className?: string;
  onConversationReady?: (conversation: Conversation) => void;
};

/** Reusable thread: header + messages + composer. Used in Collab desk and item modal. */
export function ConversationThread({
  workspaceId,
  userId,
  userName,
  conversationId: conversationIdProp,
  anchor,
  compact,
  readOnly,
  className,
  onConversationReady,
}: ConversationThreadProps) {
  const [resolvedId, setResolvedId] = useState<string | null>(conversationIdProp || null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  // Resolve conversation from prop or anchor
  useEffect(() => {
    let cancelled = false;
    if (conversationIdProp) {
      setResolvedId(conversationIdProp);
      return;
    }
    if (!anchor || !workspaceId || !userId) {
      setResolvedId(null);
      return;
    }
    setBooting(true);
    setError(null);
    void conversationService
      .ensureAnchorConversation({
        workspaceId,
        anchor,
        type: anchorToType(anchor),
        createdBy: userId,
        participantIds: [userId],
        title: anchor.label,
      })
      .then((c) => {
        if (cancelled) return;
        setResolvedId(c.id);
        setConversation(c);
        onConversationReady?.(c);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not open conversation");
        setResolvedId(null);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchor, conversationIdProp, onConversationReady, userId, workspaceId]);

  // Subscribe conversation meta
  useEffect(() => {
    if (!resolvedId) {
      setConversation(null);
      return;
    }
    return conversationService.subscribeConversation(resolvedId, (c) => {
      setConversation(c);
      if (c) onConversationReady?.(c);
    });
  }, [onConversationReady, resolvedId]);

  // Subscribe messages
  useEffect(() => {
    if (!resolvedId) {
      setMessages([]);
      return;
    }
    setError(null);
    return messageService.subscribe(resolvedId, {
      onChange: (msgs) => setMessages(msgs),
      onError: (err) => setError(err.message),
    });
  }, [resolvedId]);

  // Mark read when viewing
  useEffect(() => {
    if (!resolvedId || !userId) return;
    if (markedRef.current === resolvedId) return;
    markedRef.current = resolvedId;
    void messageService.markRead(resolvedId, userId).catch(() => undefined);
  }, [resolvedId, userId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, resolvedId]);

  const send = useCallback(
    async (text: string) => {
      if (!resolvedId || !workspaceId || !userId) return;
      const { parseSlashCommand, approvalCard } = await import("../../lib/collab/commands");
      const { askOdysseus } = await import("../../lib/collab/odysseusClient");
      const parsed = parseSlashCommand(text);

      if (parsed.command === "summarize" || parsed.command === "actions" || parsed.command === "status" || parsed.command === "draft") {
        await messageService.send({
          workspaceId,
          conversationId: resolvedId,
          senderId: userId,
          senderName: userName || "You",
          text,
        });
        const result = await askOdysseus({
          workspaceId,
          conversationId: resolvedId,
          userId,
          text: parsed.rest,
          command: parsed.command,
          post: true,
        });
        if (!result.ok) {
          await messageService.send({
            workspaceId,
            conversationId: resolvedId,
            senderId: "odysseus",
            senderName: "Odysseus",
            senderType: "odysseus",
            text: result.error || "Odysseus could not answer.",
            channel: "system",
          });
        } else if (result.ok && result.reply && !result.posted) {
          // Client write when server did not persist.
          await messageService.send({
            workspaceId,
            conversationId: resolvedId,
            senderId: "odysseus",
            senderName: "Odysseus",
            senderType: "odysseus",
            text: result.reply,
            card: result.card || null,
            channel: "system",
            kind: result.card ? "card" : "text",
          });
        }
        void messageService.markRead(resolvedId, userId).catch(() => undefined);
        return;
      }

      if (parsed.command === "approve") {
        const what = parsed.rest || "Please approve this request";
        await messageService.send({
          workspaceId,
          conversationId: resolvedId,
          senderId: userId,
          senderName: userName || "You",
          text: what,
          kind: "card",
          card: approvalCard({
            what,
            askedBy: userId,
            askedByName: userName || "You",
          }),
        });
        void messageService.markRead(resolvedId, userId).catch(() => undefined);
        return;
      }

      if (parsed.command === "task") {
        const title = parsed.rest || "New item from Collab";
        const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
        const { db } = await import("../../lib/firebase");
        const taskRef = await addDoc(collection(db, "tasks"), {
          workspaceId,
          title,
          status: "todo",
          createdBy: userId,
          assigneeId: userId,
          sourceConversationId: resolvedId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await messageService.send({
          workspaceId,
          conversationId: resolvedId,
          senderId: userId,
          senderName: userName || "You",
          text: `Created item: ${title}`,
          kind: "card",
          card: { type: "item", ref: { id: taskRef.id, title, status: "todo" } },
          mentions: {
            userIds: [],
            agentIds: [],
            itemIds: [taskRef.id],
            projectIds: [],
            recordRefs: [],
          },
        });
        void messageService.markRead(resolvedId, userId).catch(() => undefined);
        return;
      }

      if (parsed.command === "invoice") {
        const invoiceId = parsed.rest;
        await messageService.send({
          workspaceId,
          conversationId: resolvedId,
          senderId: userId,
          senderName: userName || "You",
          text: invoiceId ? `Invoice ${invoiceId}` : "Invoice",
          kind: "card",
          card: {
            type: "invoice",
            ref: { id: invoiceId || "", number: invoiceId || "—" },
          },
        });
        void messageService.markRead(resolvedId, userId).catch(() => undefined);
        return;
      }

      // #item:id shorthand → attach item card
      const itemMention = text.match(/#item:([a-zA-Z0-9_-]+)/i);
      await messageService.send({
        workspaceId,
        conversationId: resolvedId,
        senderId: userId,
        senderName: userName || "You",
        text,
        card: itemMention
          ? { type: "item", ref: { id: itemMention[1] } }
          : null,
        kind: itemMention ? "card" : "text",
      });
      void messageService.markRead(resolvedId, userId).catch(() => undefined);
    },
    [resolvedId, userId, userName, workspaceId],
  );

  const groups = useMemo(() => {
    const out: Array<{ msg: ConversationMessage; startGroup: boolean }> = [];
    let prev: ConversationMessage | null = null;
    for (const msg of messages) {
      if (msg.deletedAt || msg.status === "deleted") continue;
      out.push({ msg, startGroup: shouldStartGroup(prev, msg) });
      prev = msg;
    }
    return out;
  }, [messages]);

  const title = conversation?.title || anchor?.label || "Conversation";
  const subtitle = conversation?.anchor
    ? `${conversation.anchor.type} · ${conversation.anchor.label}`
    : conversation?.type?.replace(/_/g, " ");

  if (!workspaceId || !userId) {
    return (
      <div className={`do-collab-thread${compact ? " is-compact" : ""} ${className || ""}`.trim()}>
        <div className="do-collab-thread-empty">
          <MessageSquare size={24} />
          <p>Sign in to view Collab.</p>
        </div>
      </div>
    );
  }

  if (!resolvedId && !booting) {
    return (
      <div
        className={`do-collab-thread${compact ? " is-compact" : ""} ${className || ""}`.trim()}
        data-testid="collab-thread-empty"
      >
        <div className="do-collab-thread-empty">
          <MessageSquare size={28} />
          <h2>Pick a conversation</h2>
          <p>Select a room from the list, or open Collab from a project or item.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`do-collab-thread${compact ? " is-compact" : ""} ${className || ""}`.trim()}
      data-testid="collab-thread"
    >
      <header className="do-collab-thread-header">
        <div className="do-collab-thread-header-text">
          <h2>{booting && !conversation ? "Opening…" : title}</h2>
          {subtitle ? <p className="do-collab-muted">{subtitle}</p> : null}
        </div>
      </header>

      {error ? <p className="do-collab-thread-error">{error}</p> : null}

      <div className="do-collab-thread-messages" data-testid="collab-messages">
        {booting && messages.length === 0 ? (
          <p className="do-collab-list-status">Loading messages…</p>
        ) : null}
        {!booting && groups.length === 0 ? (
          <p className="do-collab-list-status">No messages yet. Say hello.</p>
        ) : null}
        {groups.map(({ msg, startGroup }) => (
          <div
            key={msg.id}
            className={`do-collab-msg${startGroup ? " is-group-start" : ""}${
              msg.senderId === userId ? " is-mine" : ""
            }${msg.senderType === "system" || msg.kind === "system" ? " is-system" : ""}`}
          >
            {startGroup ? (
              <div className="do-collab-msg-meta">
                <span className="do-collab-msg-author">{msg.senderName || msg.senderId}</span>
                <span className="do-collab-msg-time">{formatMessageTime(msg.createdAt)}</span>
              </div>
            ) : null}
            <div className="do-collab-msg-bubble">
              {msg.kind === "system" || msg.senderType === "system" ? (
                <em>{msg.text}</em>
              ) : (
                msg.text
              )}
              {msg.card ? (
                <div className="do-collab-msg-card">
                  <CardRenderer
                    card={msg.card}
                    onApprove={() => {
                      void messageService.send({
                        workspaceId,
                        conversationId: resolvedId!,
                        senderId: userId,
                        senderName: userName || "You",
                        text: `Approved: ${String(msg.card?.ref?.what || msg.card?.ref?.title || "request")}`,
                        senderType: "user",
                        channel: "system",
                        kind: "system",
                      });
                    }}
                    onDecline={() => {
                      void messageService.send({
                        workspaceId,
                        conversationId: resolvedId!,
                        senderId: userId,
                        senderName: userName || "You",
                        text: `Declined: ${String(msg.card?.ref?.what || msg.card?.ref?.title || "request")}`,
                        senderType: "user",
                        channel: "system",
                        kind: "system",
                      });
                    }}
                    onCreateItem={(item) => {
                      void (async () => {
                        const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
                        const { db } = await import("../../lib/firebase");
                        const taskRef = await addDoc(collection(db, "tasks"), {
                          workspaceId,
                          title: item.title,
                          status: "todo",
                          createdBy: userId,
                          assigneeId: userId,
                          sourceConversationId: resolvedId,
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        });
                        await messageService.send({
                          workspaceId,
                          conversationId: resolvedId!,
                          senderId: userId,
                          senderName: userName || "You",
                          text: `Created from action plan: ${item.title}`,
                          kind: "card",
                          card: { type: "item", ref: { id: taskRef.id, title: item.title, status: "todo" } },
                        });
                      })();
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!readOnly && resolvedId ? (
        <CollabComposer conversationId={resolvedId} onSend={send} disabled={booting} />
      ) : null}
    </div>
  );
}
