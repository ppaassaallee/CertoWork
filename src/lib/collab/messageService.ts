import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentSnapshot,
  type Unsubscribe,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { parseMentions, previewFromText } from "./mentions";
import {
  CONVERSATIONS,
  CONVERSATION_MESSAGES,
  CONVERSATION_PARTICIPANTS,
  emptyMentions,
  participantDocId,
  type ConversationMessage,
  type MessageAttachment,
  type MessageCard,
  type MessageKind,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function asMessage(id: string, data: Record<string, unknown>): ConversationMessage {
  return { id, ...(data as Omit<ConversationMessage, "id">) };
}

export type SendMessageInput = {
  workspaceId: string;
  conversationId: string;
  threadId?: string | null;
  senderId: string;
  senderName: string;
  text: string;
  attachments?: MessageAttachment[];
  card?: MessageCard | null;
  visibility?: "internal" | "external";
  channel?: ConversationMessage["channel"];
  kind?: MessageKind;
  senderType?: ConversationMessage["senderType"];
};

export async function send(input: SendMessageInput): Promise<string> {
  const now = nowIso();
  const parsed = parseMentions(input.text);
  const mentions = {
    userIds: parsed.userIds,
    agentIds: parsed.agentIds,
    itemIds: parsed.itemIds,
    projectIds: parsed.projectIds,
    recordRefs: parsed.recordRefs,
  };
  const preview = previewFromText(input.text);
  const kind: MessageKind =
    input.kind ||
    (input.card ? "card" : input.attachments?.length ? "file" : "text");

  const ref = await addDoc(collection(db, CONVERSATION_MESSAGES), {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    threadId: input.threadId || null,
    senderType: input.senderType || "user",
    senderId: input.senderId,
    senderName: input.senderName,
    kind,
    text: input.text,
    mentions,
    attachments: input.attachments || [],
    card: input.card || null,
    reactions: {},
    visibility: input.visibility || "internal",
    channel: input.channel || "app",
    status: "sent",
    replyCount: 0,
    model: null,
    searchText: input.text.toLowerCase(),
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<ConversationMessage, "id">);

  // Client writes preview only; counters / unread are owned by onMessageCreated.
  await updateDoc(doc(db, CONVERSATIONS, input.conversationId), {
    lastMessageAt: now,
    lastMessagePreview: preview,
    lastMessageBy: input.senderId,
    updatedAt: now,
  }).catch(() => undefined);

  return ref.id;
}

export async function edit(messageId: string, text: string, _senderId: string) {
  const now = nowIso();
  const parsed = parseMentions(text);
  await updateDoc(doc(db, CONVERSATION_MESSAGES, messageId), {
    text,
    mentions: {
      userIds: parsed.userIds,
      agentIds: parsed.agentIds,
      itemIds: parsed.itemIds,
      projectIds: parsed.projectIds,
      recordRefs: parsed.recordRefs,
    },
    searchText: text.toLowerCase(),
    editedAt: now,
    updatedAt: now,
  });
}

export async function softDelete(messageId: string) {
  const now = nowIso();
  await updateDoc(doc(db, CONVERSATION_MESSAGES, messageId), {
    deletedAt: now,
    status: "deleted",
    text: "",
    searchText: "",
    updatedAt: now,
  });
}

export async function react(messageId: string, emoji: string, uid: string, add: boolean) {
  const msgSnap = await getDoc(doc(db, CONVERSATION_MESSAGES, messageId));
  if (!msgSnap.exists()) return;
  const data = msgSnap.data() as ConversationMessage;
  const reactions = { ...(data.reactions || {}) };
  const list = new Set(reactions[emoji] || []);
  if (add) list.add(uid);
  else list.delete(uid);
  if (list.size === 0) delete reactions[emoji];
  else reactions[emoji] = Array.from(list);
  await updateDoc(doc(db, CONVERSATION_MESSAGES, messageId), {
    reactions,
    updatedAt: nowIso(),
  });
}

export async function markRead(conversationId: string, uid: string) {
  await updateDoc(doc(db, CONVERSATION_PARTICIPANTS, participantDocId(conversationId, uid)), {
    lastReadAt: nowIso(),
    unreadCount: 0,
  });
}

export type SubscribeMessagesOpts = {
  threadId?: string | null;
  pageLimit?: number;
  before?: DocumentSnapshot | QueryDocumentSnapshot;
  onChange: (messages: ConversationMessage[], cursor: QueryDocumentSnapshot | null) => void;
  onError?: (err: Error) => void;
};

export function subscribe(
  conversationId: string,
  opts: SubscribeMessagesOpts,
): Unsubscribe {
  const pageLimit = opts.pageLimit ?? 60;
  const constraints = [
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "desc"),
    limit(pageLimit),
  ];
  if (opts.threadId) {
    constraints.splice(1, 0, where("threadId", "==", opts.threadId));
  } else {
    // Root messages only when not in a thread view — include null threadId.
  }
  let q = query(collection(db, CONVERSATION_MESSAGES), ...constraints);
  if (opts.before) {
    q = query(
      collection(db, CONVERSATION_MESSAGES),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "desc"),
      startAfter(opts.before),
      limit(pageLimit),
    );
  }
  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs
        .map((d) => asMessage(d.id, d.data() as Record<string, unknown>))
        .reverse();
      const cursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      opts.onChange(messages, cursor);
    },
    (err) => opts.onError?.(err as Error),
  );
}

export async function search(
  workspaceId: string,
  searchQuery: string,
  max = 50,
): Promise<ConversationMessage[]> {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return [];
  // Prefix via range on searchText; client filters further.
  const end = `${q}\uf8ff`;
  try {
    const snap = await getDocs(
      query(
        collection(db, CONVERSATION_MESSAGES),
        where("workspaceId", "==", workspaceId),
        where("searchText", ">=", q),
        where("searchText", "<=", end),
        limit(max),
      ),
    );
    return snap.docs.map((d) => asMessage(d.id, d.data() as Record<string, unknown>));
  } catch {
    // Index missing — empty until indexes land.
    return [];
  }
}

export { emptyMentions, previewFromText, parseMentions };
