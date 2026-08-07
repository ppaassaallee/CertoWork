/**
 * Logical D1 schema for the DelivereeOS ↔ Codex delivery bridge.
 *
 * Firestore remains the product source of truth. D1 stores only the authenticated
 * connection map, scoped project snapshots, and delivery events exchanged with
 * Codex. The Worker creates these tables idempotently from the matching SQL in
 * worker/codex-bridge.js so the existing Vite/Worker architecture stays intact.
 */
export const CODEX_BRIDGE_SCHEMA_VERSION = 1;

export type CodexConnectionRecord = {
  id: string;
  platformUserId: string;
  firebaseUserId: string;
  workspaceId: string;
  projectId: string;
  conversationId: string | null;
  handoffCode: string;
  syncMode: "completion_and_notes" | "review_every_change";
  status: "ready" | "connected" | "disabled";
};

export type CodexBridgeEventRecord = {
  id: string;
  connectionId: string;
  workspaceId: string;
  projectId: string;
  workItemId: string | null;
  kind: "work_item_claimed" | "work_item_progress" | "work_item_completed" | "project_gap";
  status: "pending" | "authorized" | "applied" | "rejected";
  payloadJson: string;
};
