import { Timestamp } from "firebase-admin/firestore";
import { ITEM_FETCH_CAP } from "../worker/assistantAccessCore.js";

const TOKENS = "assistant_access_tokens";
const PROPOSALS = "assistant_proposals";
const AUDITS = "assistant_audit_events";

function asRecord(id: string, data: Record<string, unknown> | undefined) {
  return { id, ...(data || {}) };
}

function withTaskStamps(data: Record<string, unknown>) {
  const next = { ...data };
  for (const key of ["createdAt", "updatedAt"] as const) {
    const value = next[key];
    if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
      next[key] = Timestamp.fromDate(new Date(value));
    } else if (value instanceof Date) {
      next[key] = Timestamp.fromDate(value);
    }
  }
  return next;
}

export function createFirestoreAssistantRepo(
  db: any,
  isMember: (userId: string, workspaceId: string) => Promise<boolean>,
) {
  return {
    isMember,
    async listTokensForUser(userId: string) {
      const snap = await db.collection(TOKENS).where("userId", "==", userId).limit(50).get();
      return snap.docs.map((doc) => asRecord(doc.id, doc.data()));
    },
    async saveToken(record: { id: string } & Record<string, unknown>) {
      const { id, ...data } = record;
      await db.collection(TOKENS).doc(id).set(data);
    },
    async getToken(id: string) {
      const snap = await db.collection(TOKENS).doc(id).get();
      return snap.exists ? asRecord(snap.id, snap.data()) : null;
    },
    async findTokenByHash(hash: string) {
      const snap = await db.collection(TOKENS).where("tokenHash", "==", hash).limit(2).get();
      if (snap.size !== 1) return null;
      const doc = snap.docs[0];
      return asRecord(doc.id, doc.data());
    },
    async patchToken(id: string, patch: Record<string, unknown>) {
      await db.collection(TOKENS).doc(id).set(patch, { merge: true });
    },
    async listItems(workspaceId: string) {
      const snap = await db.collection("tasks").where("workspaceId", "==", workspaceId).limit(ITEM_FETCH_CAP).get();
      return snap.docs.map((doc) => asRecord(doc.id, doc.data()));
    },
    async getItem(workspaceId: string, itemId: string) {
      const snap = await db.collection("tasks").doc(itemId).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      if (String(data.workspaceId || "") !== workspaceId) return null;
      return asRecord(snap.id, data);
    },
    async listTags(workspaceId: string) {
      const snap = await db.collection("categories").where("workspaceId", "==", workspaceId).limit(500).get();
      return snap.docs.map((doc) => asRecord(doc.id, doc.data()));
    },
    async saveProposal(record: { id: string } & Record<string, unknown>) {
      const { id, ...data } = record;
      await db.collection(PROPOSALS).doc(id).set(data);
    },
    async listProposals(userId: string) {
      const snap = await db.collection(PROPOSALS).where("userId", "==", userId).limit(200).get();
      return snap.docs.map((doc) => asRecord(doc.id, doc.data()));
    },
    async getProposal(id: string) {
      const snap = await db.collection(PROPOSALS).doc(id).get();
      return snap.exists ? asRecord(snap.id, snap.data()) : null;
    },
    async patchProposal(id: string, patch: Record<string, unknown>) {
      await db.collection(PROPOSALS).doc(id).set(patch, { merge: true });
    },
    async createItem(data: Record<string, unknown>) {
      const ref = db.collection("tasks").doc();
      await ref.set(withTaskStamps(data));
      return { id: ref.id };
    },
    async updateItem(workspaceId: string, itemId: string, patch: Record<string, unknown>) {
      const ref = db.collection("tasks").doc(itemId);
      const snap = await ref.get();
      if (!snap.exists || String(snap.data()?.workspaceId || "") !== workspaceId) {
        const error = new Error("Item not found") as Error & { status: number; code: string };
        error.status = 404;
        error.code = "not_found";
        throw error;
      }
      await ref.update(withTaskStamps(patch));
    },
    async writeAudit(event: { id: string } & Record<string, unknown>) {
      const { id, ...data } = event;
      await db.collection(AUDITS).doc(id).set(data);
    },
  };
}
