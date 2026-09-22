import { addDoc, arrayUnion, collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { CONVERSATIONS, GUESTS, participantDocId } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function randomToken() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Create an external conversation + guest invite (token in clear for share URL; server stores same). */
export async function createExternalThread(input: {
  workspaceId: string;
  createdBy: string;
  title: string;
  guestEmail: string;
  guestName?: string;
  projectId?: string;
  projectLabel?: string;
}): Promise<{ conversationId: string; guestId: string; token: string; portalPath: string }> {
  const token = randomToken();
  const email = input.guestEmail.trim().toLowerCase();
  const guestId = `guest_${email.replace(/[^a-z0-9]+/g, "_")}`;
  const now = nowIso();

  const convRef = await addDoc(collection(db, CONVERSATIONS), {
    workspaceId: input.workspaceId,
    type: "external",
    title: input.title.trim() || `Thread · ${email}`,
    anchor: input.projectId
      ? {
          type: "project",
          id: input.projectId,
          label: input.projectLabel || input.title,
        }
      : null,
    participantIds: [input.createdBy],
    agentIds: [],
    guestIds: [guestId],
    isPrivate: true,
    status: "active",
    lastMessageAt: null,
    messageCount: 0,
    pinnedMessageIds: [],
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, "conversation_participants", participantDocId(convRef.id, input.createdBy)), {
    id: participantDocId(convRef.id, input.createdBy),
    workspaceId: input.workspaceId,
    conversationId: convRef.id,
    kind: "user",
    userId: input.createdBy,
    displayName: "You",
    roleInChat: "owner",
    status: "active",
    unreadCount: 0,
    joinedAt: now,
    addedBy: input.createdBy,
  });

  await setDoc(
    doc(db, GUESTS, guestId),
    {
      workspaceId: input.workspaceId,
      email,
      name: input.guestName || email,
      token,
      status: "invited",
      conversationIds: [convRef.id],
      createdBy: input.createdBy,
      createdAt: now,
    },
    { merge: true },
  );

  await updateDoc(doc(db, CONVERSATIONS, convRef.id), {
    guestIds: arrayUnion(guestId),
    updatedAt: now,
  });

  return {
    conversationId: convRef.id,
    guestId,
    token,
    portalPath: `/c/${token}`,
  };
}
