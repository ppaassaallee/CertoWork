import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const CONVERSATIONS = "conversations";
const CONVERSATION_PARTICIPANTS = "conversation_participants";
const CONVERSATION_MESSAGES = "conversation_messages";
const USER_NOTIFICATIONS = "user_notifications";
const TABLE_EVENTS = "tableEvents";

type MessageData = {
  workspaceId?: string;
  conversationId?: string;
  threadId?: string | null;
  senderId?: string;
  senderName?: string;
  senderType?: string;
  text?: string;
  visibility?: string;
  channel?: string;
  mentions?: {
    userIds?: string[];
    agentIds?: string[];
  };
};

function preview(text: string, max = 140): string {
  const cleaned = String(text || "")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}

/**
 * Authoritative side-effects when a conversation message is created:
 * - messageCount / lastMessage* on the conversation
 * - unreadCount for other active participants
 * - replyCount on thread root
 * - user_notifications for mentions / DMs / replies
 * - tableEvents message.created for routines
 * - stubs for agent / Odysseus / guest email (wired in later steps)
 */
export const onMessageCreated = onDocumentCreated(
  { document: `${CONVERSATION_MESSAGES}/{messageId}`, region: "us-central1" },
  async (event) => {
    const data = event.data?.data() as MessageData | undefined;
    if (!data?.conversationId || !data.workspaceId) return;
    const db = getFirestore();
    const messageId = event.params.messageId;
    const conversationId = data.conversationId;
    const senderId = data.senderId || "";
    const now = FieldValue.serverTimestamp();
    const textPreview = preview(data.text || "");

    const convRef = db.collection(CONVERSATIONS).doc(conversationId);
    const convSnap = await convRef.get();
    const conv = convSnap.data() || {};

    await convRef.set(
      {
        messageCount: FieldValue.increment(1),
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: textPreview,
        lastMessageBy: senderId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    if (data.threadId) {
      const rootRef = db.collection(CONVERSATION_MESSAGES).doc(data.threadId);
      const root = await rootRef.get();
      if (root.exists) {
        await rootRef.set({ replyCount: FieldValue.increment(1) }, { merge: true });
      }
    }

    const participantIds: string[] = Array.isArray(conv.participantIds)
      ? conv.participantIds
      : [];
    const batch = db.batch();
    let batchCount = 0;
    for (const uid of participantIds) {
      if (!uid || uid === senderId) continue;
      const partId = `${conversationId}_${uid}`;
      const partRef = db.collection(CONVERSATION_PARTICIPANTS).doc(partId);
      batch.set(
        partRef,
        { unreadCount: FieldValue.increment(1), status: "active" },
        { merge: true },
      );
      batchCount += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();

    const mentionUserIds = Array.from(
      new Set((data.mentions?.userIds || []).filter((id) => id && id !== senderId)),
    );
    const notifWrites = mentionUserIds.map((userId) =>
      db.collection(USER_NOTIFICATIONS).add({
        userId,
        workspaceId: data.workspaceId,
        type: "mention",
        kind: "mention",
        conversationId,
        messageId,
        preview: textPreview,
        fromName: data.senderName || senderId,
        read: false,
        createdAt: now,
      }),
    );

    if (conv.type === "dm" && senderId) {
      for (const uid of participantIds) {
        if (uid === senderId) continue;
        notifWrites.push(
          db.collection(USER_NOTIFICATIONS).add({
            userId: uid,
            workspaceId: data.workspaceId,
            type: "dm",
            kind: "dm",
            conversationId,
            messageId,
            preview: textPreview,
            fromName: data.senderName || senderId,
            read: false,
            createdAt: now,
          }),
        );
      }
    }

    if (data.threadId && senderId) {
      const root = await db.collection(CONVERSATION_MESSAGES).doc(data.threadId).get();
      const rootSender = root.data()?.senderId as string | undefined;
      if (rootSender && rootSender !== senderId && !mentionUserIds.includes(rootSender)) {
        notifWrites.push(
          db.collection(USER_NOTIFICATIONS).add({
            userId: rootSender,
            workspaceId: data.workspaceId,
            type: "reply",
            kind: "reply",
            conversationId,
            messageId,
            preview: textPreview,
            fromName: data.senderName || senderId,
            read: false,
            createdAt: now,
          }),
        );
      }
    }

    await Promise.allSettled(notifWrites);

    await db.collection(TABLE_EVENTS).add({
      type: "message.created",
      workspaceId: data.workspaceId,
      conversationId,
      messageId,
      conversationType: conv.type || null,
      anchor: conv.anchor || null,
      senderId,
      senderType: data.senderType || "user",
      visibility: data.visibility || "internal",
      channel: data.channel || "app",
      mentionsAgentIds: data.mentions?.agentIds || [],
      textPreview,
      createdAt: now,
      // Guest email / Odysseus / agent runs: wired in Steps 12 & 16.
      collabHooks: {
        needsOdysseus: /\{\{odysseus\}\}/i.test(data.text || ""),
        agentIds: data.mentions?.agentIds || [],
        needsGuestEmail:
          data.visibility === "external" &&
          data.senderType !== "guest" &&
          conv.type === "external",
      },
    });
  },
);
