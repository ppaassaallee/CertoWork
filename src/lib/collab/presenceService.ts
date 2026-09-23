import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  CONVERSATION_TYPING,
  PRESENCE,
  presenceDocId,
  typingDocId,
} from "./types";

import { COLLAB_PRESENCE_HEARTBEAT_MS } from "../firestoreListenDiet";

const HEARTBEAT_MS = COLLAB_PRESENCE_HEARTBEAT_MS;
const TYPING_THROTTLE_MS = 3_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastTypingAt = 0;
let activeUid: string | null = null;
let activeWorkspaceId: string | null = null;
let activeConversationId: string | null = null;

async function writePresence() {
  if (!activeUid || !activeWorkspaceId) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  await setDoc(
    doc(db, PRESENCE, presenceDocId(activeWorkspaceId, activeUid)),
    {
      uid: activeUid,
      workspaceId: activeWorkspaceId,
      lastSeenAt: new Date().toISOString(),
      activeConversationId: activeConversationId || null,
    },
    { merge: true },
  ).catch(() => undefined);
}

/** Start presence heartbeat while the tab is visible. */
export function startPresence(workspaceId: string, uid: string) {
  activeUid = uid;
  activeWorkspaceId = workspaceId;
  void writePresence();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => void writePresence(), HEARTBEAT_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
}

export function stopPresence() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibility);
  }
  activeUid = null;
  activeWorkspaceId = null;
  activeConversationId = null;
}

function onVisibility() {
  void writePresence();
}

export function setActiveConversation(conversationId: string | null) {
  activeConversationId = conversationId;
  void writePresence();
}

/** Throttled typing indicator (3s). TTL is enforced client-side by readers (~10s). */
export async function typing(conversationId: string, uid: string) {
  const now = Date.now();
  if (now - lastTypingAt < TYPING_THROTTLE_MS) return;
  lastTypingAt = now;
  await setDoc(
    doc(db, CONVERSATION_TYPING, typingDocId(conversationId, uid)),
    {
      conversationId,
      uid,
      at: new Date().toISOString(),
    },
    { merge: true },
  ).catch(() => undefined);
}
