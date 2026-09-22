import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  CONVERSATIONS,
  CONVERSATION_PARTICIPANTS,
  type Conversation,
  type ConversationAnchor,
  type ConversationParticipant,
  type ConversationType,
  participantDocId,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function asConversation(id: string, data: Record<string, unknown>): Conversation {
  return { id, ...(data as Omit<Conversation, "id">) };
}

/** Deterministic id for anchored rooms/threads. */
export function anchorConversationId(anchor: ConversationAnchor): string {
  if (anchor.type === "record") {
    return `record_${anchor.tableId || "t"}_${anchor.id}`;
  }
  return `${anchor.type}_${anchor.id}`;
}

export async function ensureAnchorConversation(input: {
  workspaceId: string;
  anchor: ConversationAnchor;
  type: Extract<ConversationType, "project_room" | "item_thread" | "record_thread">;
  createdBy: string;
  participantIds?: string[];
  title?: string;
}): Promise<Conversation> {
  const id = anchorConversationId(input.anchor);
  const ref = doc(db, CONVERSATIONS, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return asConversation(id, existing.data() as Record<string, unknown>);
  }
  const now = nowIso();
  const participants = Array.from(
    new Set([input.createdBy, ...(input.participantIds || [])].filter(Boolean)),
  );
  const title =
    input.title ||
    (input.type === "project_room"
      ? `Room · ${input.anchor.label}`
      : input.anchor.label || "Conversation");
  const docData: Omit<Conversation, "id"> = {
    workspaceId: input.workspaceId,
    type: input.type,
    title: title.slice(0, 120),
    anchor: input.anchor,
    participantIds: participants,
    agentIds: [],
    guestIds: [],
    isPrivate: false,
    status: "active",
    lastMessageAt: null,
    messageCount: 0,
    pinnedMessageIds: [],
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, docData);
  await Promise.all(
    participants.map((uid) =>
      setDoc(
        doc(db, CONVERSATION_PARTICIPANTS, participantDocId(id, uid)),
        {
          id: participantDocId(id, uid),
          workspaceId: input.workspaceId,
          conversationId: id,
          kind: "user",
          userId: uid,
          displayName: uid === input.createdBy ? "You" : uid,
          roleInChat: uid === input.createdBy ? "owner" : "member",
          status: "active",
          unreadCount: 0,
          joinedAt: now,
          addedBy: input.createdBy,
        } satisfies ConversationParticipant,
      ),
    ),
  );
  return { id, ...docData };
}

export async function ensureDm(input: {
  workspaceId: string;
  uidA: string;
  uidB: string;
  nameA?: string;
  nameB?: string;
}): Promise<Conversation> {
  const [a, b] = [input.uidA, input.uidB].sort();
  const id = `dm_${a}_${b}`;
  const ref = doc(db, CONVERSATIONS, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return asConversation(id, existing.data() as Record<string, unknown>);
  }
  const now = nowIso();
  const title = `${input.nameA || a} · ${input.nameB || b}`.slice(0, 120);
  const docData: Omit<Conversation, "id"> = {
    workspaceId: input.workspaceId,
    type: "dm",
    title,
    participantIds: [a, b],
    agentIds: [],
    guestIds: [],
    isPrivate: true,
    status: "active",
    lastMessageAt: null,
    messageCount: 0,
    pinnedMessageIds: [],
    createdBy: input.uidA,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, docData);
  for (const uid of [a, b]) {
    await setDoc(doc(db, CONVERSATION_PARTICIPANTS, participantDocId(id, uid)), {
      id: participantDocId(id, uid),
      workspaceId: input.workspaceId,
      conversationId: id,
      kind: "user",
      userId: uid,
      displayName: uid === a ? input.nameA || a : input.nameB || b,
      roleInChat: "member",
      status: "active",
      unreadCount: 0,
      joinedAt: now,
      addedBy: input.uidA,
    } satisfies ConversationParticipant);
  }
  return { id, ...docData };
}

export async function createGroup(input: {
  workspaceId: string;
  title: string;
  createdBy: string;
  userIds: string[];
  agentIds?: string[];
}): Promise<Conversation> {
  const now = nowIso();
  const participants = Array.from(
    new Set([input.createdBy, ...input.userIds].filter(Boolean)),
  );
  const ref = await addDoc(collection(db, CONVERSATIONS), {
    workspaceId: input.workspaceId,
    type: "group",
    title: input.title.trim() || "Group",
    participantIds: participants,
    agentIds: input.agentIds || [],
    guestIds: [],
    isPrivate: true,
    status: "active",
    lastMessageAt: null,
    messageCount: 0,
    pinnedMessageIds: [],
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  for (const uid of participants) {
    await setDoc(doc(db, CONVERSATION_PARTICIPANTS, participantDocId(ref.id, uid)), {
      id: participantDocId(ref.id, uid),
      workspaceId: input.workspaceId,
      conversationId: ref.id,
      kind: "user",
      userId: uid,
      displayName: uid,
      roleInChat: uid === input.createdBy ? "owner" : "member",
      status: "active",
      unreadCount: 0,
      joinedAt: now,
      addedBy: input.createdBy,
    } satisfies ConversationParticipant);
  }
  const snap = await getDoc(ref);
  return asConversation(ref.id, snap.data() as Record<string, unknown>);
}

export async function archiveConversation(conversationId: string) {
  await updateDoc(doc(db, CONVERSATIONS, conversationId), {
    status: "archived",
    updatedAt: nowIso(),
  });
}

export async function addParticipants(input: {
  conversationId: string;
  workspaceId: string;
  userIds: string[];
  addedBy: string;
}) {
  const now = nowIso();
  await updateDoc(doc(db, CONVERSATIONS, input.conversationId), {
    participantIds: arrayUnion(...input.userIds),
    updatedAt: now,
  });
  for (const uid of input.userIds) {
    await setDoc(
      doc(db, CONVERSATION_PARTICIPANTS, participantDocId(input.conversationId, uid)),
      {
        id: participantDocId(input.conversationId, uid),
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        kind: "user",
        userId: uid,
        displayName: uid,
        roleInChat: "member",
        status: "active",
        unreadCount: 0,
        joinedAt: now,
        addedBy: input.addedBy,
      } satisfies ConversationParticipant,
      { merge: true },
    );
  }
}

export async function removeParticipant(conversationId: string, userId: string) {
  await updateDoc(doc(db, CONVERSATIONS, conversationId), {
    participantIds: arrayRemove(userId),
    updatedAt: nowIso(),
  });
  await updateDoc(doc(db, CONVERSATION_PARTICIPANTS, participantDocId(conversationId, userId)), {
    status: "removed",
  });
}

export async function pinMessage(conversationId: string, messageId: string) {
  await updateDoc(doc(db, CONVERSATIONS, conversationId), {
    pinnedMessageIds: arrayUnion(messageId),
    updatedAt: nowIso(),
  });
}

export async function unpinMessage(conversationId: string, messageId: string) {
  await updateDoc(doc(db, CONVERSATIONS, conversationId), {
    pinnedMessageIds: arrayRemove(messageId),
    updatedAt: nowIso(),
  });
}

export async function listForUser(
  uid: string,
  workspaceId: string,
): Promise<Conversation[]> {
  const q = query(
    collection(db, CONVERSATIONS),
    where("workspaceId", "==", workspaceId),
    where("participantIds", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
    limit(80),
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => asConversation(d.id, d.data() as Record<string, unknown>));
  } catch {
    // Index may still be building — fallback without order.
    const fallback = query(
      collection(db, CONVERSATIONS),
      where("workspaceId", "==", workspaceId),
      where("participantIds", "array-contains", uid),
      limit(80),
    );
    const snap = await getDocs(fallback);
    return snap.docs
      .map((d) => asConversation(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")));
  }
}

export function subscribeConversation(
  conversationId: string,
  onChange: (conversation: Conversation | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, CONVERSATIONS, conversationId), (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange(asConversation(snap.id, snap.data() as Record<string, unknown>));
  });
}
