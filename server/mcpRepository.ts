import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ITEM_FETCH_CAP, McpError } from "../worker/mcp/remoteCore.js";

const TOKENS = "mcp_api_tokens";
const AUDITS = "mcp_audit_events";

function asRecord(id: string, data: Record<string, unknown> | undefined) {
  return { id, ...(data || {}) };
}

function stamp(data: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if ((key === "createdAt" || key === "updatedAt") && typeof value === "string" && Number.isFinite(Date.parse(value))) {
      next[key] = Timestamp.fromDate(new Date(value));
      continue;
    }
    if ((key === "createdAt" || key === "updatedAt") && value instanceof Date) {
      next[key] = Timestamp.fromDate(value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function createMcpRepository(db: {
  collection: (name: string) => any;
  runTransaction?: Firestore["runTransaction"];
}) {
  async function queryEqual(collection: string, field: string, value: string, limit: number) {
    const snap = await db.collection(collection).where(field, "==", value).limit(limit).get();
    return snap.docs.map((doc) => asRecord(doc.id, doc.data()));
  }

  return {
    configured: () => true,
    async getRunControl(id:string) {
      const snap=await db.collection("run_agent_state").doc(id).get();
      return snap.exists?snap.data():null;
    },
    async mutateRun(workspaceId:string,build:(rows:Array<Record<string,unknown>&{id:string}>,control:Record<string,unknown>|null)=>Promise<{value:unknown;writes?:Array<{collection:string;id:string;data:Record<string,unknown>}>}>,options:{controlId?:string;readItems?:boolean}={}) {
      if(!db.runTransaction)throw new McpError("unavailable","Atomic Run storage is unavailable.",503);
      return db.runTransaction(async transaction=>{
        const snap=options.readItems===false?null:await transaction.get(db.collection("tasks").where("workspaceId","==",workspaceId).limit(2001));
        const rows=snap?snap.docs.map(doc=>asRecord(doc.id,doc.data())):[];
        if(rows.length>2000)throw new McpError("incomplete_snapshot","Workspace exceeds the complete-read limit.",409);
        const control=options.controlId?await transaction.get(db.collection("run_agent_state").doc(options.controlId)):null;
        const result=await build(rows,control?.exists?control.data():null);
        for(const write of result.writes||[])transaction.set(db.collection(write.collection).doc(write.id),write.data);
        return result.value;
      });
    },
    async getTokenByHash(hash: string) {
      const rows = await queryEqual(TOKENS, "tokenHash", hash, 2);
      return rows.length === 1 ? rows[0] : null;
    },
    listTokens(userId: string) {
      return queryEqual(TOKENS, "userId", userId, 50);
    },
    async saveToken(record: { id: string } & Record<string, unknown>) {
      const { id, ...data } = record;
      await db.collection(TOKENS).doc(id).set(data, { merge: true });
    },
    async patchToken(id: string, patch: Record<string, unknown>) {
      await db.collection(TOKENS).doc(id).set(patch, { merge: true });
    },
    async userCanAccess(userId: string, workspaceId: string) {
      const [workspace, member] = await Promise.all([
        db.collection("workspaces").doc(workspaceId).get(),
        db.collection("workspace_members").doc(`${workspaceId}_${userId}`).get(),
      ]);
      if (workspace.exists && workspace.data()?.ownerId === userId) return true;
      const status = String(member.data()?.status || "").toLowerCase();
      return Boolean(member.exists && (status === "active" || status === "accepted"));
    },
    async getWorkspace(workspaceId: string) {
      const snap = await db.collection("workspaces").doc(workspaceId).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      return { id: workspaceId, name: String(data.name || data.title || workspaceId) };
    },
    listItems(workspaceId: string) {
      return queryEqual("tasks", "workspaceId", workspaceId, ITEM_FETCH_CAP);
    },
    async getItem(itemId: string) {
      const snap = await db.collection("tasks").doc(itemId).get();
      return snap.exists ? asRecord(snap.id, snap.data()) : null;
    },
    async saveItem(item: { id: string } & Record<string, unknown>) {
      const { id, ...data } = item;
      await db.collection("tasks").doc(id).set(stamp(data), { merge: true });
    },
    async writeAudit(event: { id: string } & Record<string, unknown>) {
      const { id, ...data } = event;
      await db.collection(AUDITS).doc(id).set(data);
    },
    async loadCatalog(workspaceId: string, userId: string) {
      const [byWorkspace, byUser, members] = await Promise.all([
        queryEqual("categories", "workspaceId", workspaceId, 500),
        queryEqual("categories", "userId", userId, 500),
        queryEqual("workspace_members", "workspaceId", workspaceId, 200),
      ]);
      const seen = new Set(byWorkspace.map((row) => String(row.id)));
      const categories = [...byWorkspace];
      for (const row of byUser) {
        if (seen.has(String(row.id))) continue;
        const rowWorkspace = String(row.workspaceId || "").trim();
        if (rowWorkspace && rowWorkspace !== workspaceId) continue;
        categories.push(row);
      }
      return { categories, members };
    },
    listProjects(workspaceId: string) {
      return queryEqual("projects", "workspaceId", workspaceId, 200);
    },
    async getProject(projectId: string) {
      const snap = await db.collection("projects").doc(projectId).get();
      return snap.exists ? asRecord(snap.id, snap.data()) : null;
    },
    async saveCategory(record: { id: string } & Record<string, unknown>) {
      const { id, ...data } = record;
      await db.collection("categories").doc(id).set(stamp(data), { merge: true });
    },
    listViews(workspaceId: string) {
      return queryEqual("saved_views", "workspaceId", workspaceId, 200);
    },
    async saveView(record: { id: string } & Record<string, unknown>) {
      const { id, ...data } = record;
      await db.collection("saved_views").doc(id).set(data, { merge: true });
    },
  };
}

export function mcpUnavailable() {
  return new McpError("unavailable", "API tokens need the Firebase admin credential on this server.", 503);
}
