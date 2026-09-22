/**
 * Index conversation messages into the existing retrieval layer (stub).
 * Full embedding path lands with retrieval.ts wiring in deploy.
 */
import type { ConversationMessage } from "./types";

export type CollabRetrievalDoc = {
  id: string;
  workspaceId: string;
  conversationId: string;
  text: string;
  anchor?: { type: string; id: string; label?: string } | null;
  createdAt: string;
  senderName: string;
};

export function messageToRetrievalDoc(
  message: ConversationMessage,
  anchor?: { type: string; id: string; label?: string } | null,
): CollabRetrievalDoc {
  return {
    id: message.id,
    workspaceId: message.workspaceId,
    conversationId: message.conversationId,
    text: message.text,
    anchor: anchor || null,
    createdAt: message.createdAt,
    senderName: message.senderName,
  };
}

/** Prefix search already lives in messageService.search; this is the semantic hook. */
export async function indexMessageForRetrieval(
  _doc: CollabRetrievalDoc,
): Promise<void> {
  // Hook for server/retrieval.ts — no-op client-side.
}
