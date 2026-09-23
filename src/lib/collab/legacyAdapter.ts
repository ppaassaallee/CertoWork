/**
 * Adapter so legacy item-comment callers keep working while Collab rolls out.
 * When flags.collab is off, still writes through conversation_messages (new model)
 * so we never create new work_item_messages docs. Flag-off UI may still render
 * the old list shape returned by listItemMessages.
 */
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { hasConfirmedSnapshotData } from "../firestoreSnapshotSafety";
import { ensureAnchorConversation } from "./conversationService";
import { send as sendMessage, subscribe as subscribeMessages } from "./messageService";
import { CONVERSATION_MESSAGES, type ConversationMessage } from "./types";

export type LegacyItemMessage = {
  id: string;
  workspaceId: string;
  workItemId: string;
  visibility: "public" | "internal";
  channel: string;
  body: string;
  authorId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  authorRole?: "team" | "requester";
  createdAt?: unknown;
};

function messageToLegacy(
  m: ConversationMessage,
  workItemId: string,
): LegacyItemMessage {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    workItemId,
    visibility: m.visibility === "external" ? "public" : "internal",
    channel: m.channel,
    body: m.text,
    authorId: m.senderId,
    authorName: m.senderName,
    authorRole: m.senderType === "guest" ? "requester" : "team",
    createdAt: m.createdAt,
  };
}

export async function ensureItemThread(input: {
  workspaceId: string;
  workItemId: string;
  title: string;
  createdBy: string;
  participantIds?: string[];
}) {
  return ensureAnchorConversation({
    workspaceId: input.workspaceId,
    type: "item_thread",
    createdBy: input.createdBy,
    participantIds: input.participantIds,
    title: input.title,
    anchor: { type: "task", id: input.workItemId, label: input.title },
  });
}

export async function sendItemMessage(input: {
  workspaceId: string;
  workItemId: string;
  title: string;
  text: string;
  visibility: "public" | "internal";
  senderId: string;
  senderName: string;
  participantIds?: string[];
  channel?: ConversationMessage["channel"];
  senderType?: ConversationMessage["senderType"];
}): Promise<string> {
  const conv = await ensureItemThread({
    workspaceId: input.workspaceId,
    workItemId: input.workItemId,
    title: input.title,
    createdBy: input.senderId,
    participantIds: input.participantIds,
  });
  return sendMessage({
    workspaceId: input.workspaceId,
    conversationId: conv.id,
    senderId: input.senderId,
    senderName: input.senderName,
    text: input.text,
    visibility: input.visibility === "public" ? "external" : "internal",
    channel: input.channel || "app",
    senderType: input.senderType || "user",
  });
}

/** Subscribe to item thread messages in legacy shape. */
export function subscribeItemMessages(
  workItemId: string,
  onChange: (messages: LegacyItemMessage[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const conversationId = `task_${workItemId}`;
  return subscribeMessages(conversationId, {
    pageLimit: 200,
    onChange: (messages) => {
      onChange(messages.map((m) => messageToLegacy(m, workItemId)));
    },
    onError,
  });
}

/** One-shot list (legacy callers). */
export async function listItemMessages(
  workItemId: string,
): Promise<LegacyItemMessage[]> {
  return new Promise((resolve, reject) => {
    const unsub = subscribeItemMessages(workItemId, (msgs) => {
      unsub();
      resolve(msgs);
    }, reject);
  });
}

/** Workspace-scoped legacy list used by RequestsCenter (maps all item threads). */
export function subscribeWorkspaceItemMessages(
  workspaceId: string,
  onChange: (messages: LegacyItemMessage[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const q = query(
    collection(db, CONVERSATION_MESSAGES),
    where("workspaceId", "==", workspaceId),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (!hasConfirmedSnapshotData(snap)) return;
      const rows: LegacyItemMessage[] = [];
      for (const d of snap.docs) {
        const data = d.data() as ConversationMessage;
        if (!String(data.conversationId || "").startsWith("task_")) continue;
        const workItemId = String(data.conversationId).replace(/^task_/, "");
        rows.push(messageToLegacy({ ...data, id: d.id }, workItemId));
      }
      onChange(rows);
    },
    (error) => onError?.(error),
  );
}
