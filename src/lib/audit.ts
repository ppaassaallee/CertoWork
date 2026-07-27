/**
 * Centralized Audit & Platform Event Logging helpers for Gazelle.
 */

export interface AuditLogPayload {
  workspaceId: string;
  actorId: string;
  actorType?: "user" | "boldi" | "system";
  action: string;
  entityType?: string;
  entityId?: string;
  before?: any;
  after?: any;
  metadata?: any;
}

export interface PlatformEventPayload {
  workspaceId: string;
  actorId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  payload?: any;
}

/**
 * Log an action to the central audit_logs collection.
 */
export async function logAuditAction(payload: AuditLogPayload): Promise<void> {
  try {
    const res = await fetch("/api/data-management/log-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn("Failed to submit audit log:", await res.text());
    }
  } catch (err) {
    console.error("Error logging audit action:", err);
  }
}

/**
 * Emit a platform event to the platform_events collection.
 */
export async function emitPlatformEvent(payload: PlatformEventPayload): Promise<void> {
  try {
    const res = await fetch("/api/data-management/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn("Failed to submit platform event:", await res.text());
    }
  } catch (err) {
    console.error("Error emitting platform event:", err);
  }
}
