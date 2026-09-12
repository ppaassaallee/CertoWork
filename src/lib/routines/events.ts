/**
 * Domain event outbox for Certo Rutinas (Phase 4).
 * Client write-paths emit; Cloudflare cron drains and matches event triggers.
 */

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const EVENT_OUTBOX_COLLECTION = "event_outbox";

export type DomainEventType =
  | "item.blocked"
  | "item.status_changed"
  | "item.assigned"
  | "item.due_soon"
  | "note.created"
  | "request.stale"
  | "invoice.overdue";

export type DomainEventPayload = {
  workspaceId: string;
  userId: string;
  eventType: DomainEventType;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  meta?: Record<string, unknown>;
};

export async function emitDomainEvent(input: DomainEventPayload) {
  if (!input.workspaceId || !input.eventType || !input.entityId) return null;
  try {
    const ref = await addDoc(collection(db, EVENT_OUTBOX_COLLECTION), {
      ...input,
      status: "pending",
      chainDepth: 0,
      createdAt: serverTimestamp(),
      availableAt: new Date().toISOString(),
    });
    return ref.id;
  } catch (error) {
    console.error("[emitDomainEvent]", error);
    return null;
  }
}
