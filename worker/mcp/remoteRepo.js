import { McpError, ITEM_FETCH_CAP } from "./remoteCore.js";
import {
  firestoreAdminConfigured,
  firestoreGetDocument,
  firestorePatchDocument,
  firestoreRunQuery,
  firestoreUpsertDocument,
} from "../firestoreAdmin.js";

const TOKENS = "mcp_api_tokens";
const AUDITS = "mcp_audit_events";

function equalFilter(field, value) {
  return {
    fieldFilter: {
      field: { fieldPath: field },
      op: "EQUAL",
      value: { stringValue: value },
    },
  };
}

function stamp(data) {
  const next = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined) continue;
    if ((key === "createdAt" || key === "updatedAt") && typeof value === "string" && Number.isFinite(Date.parse(value))) {
      next[key] = new Date(value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

async function queryEqual(env, collectionId, field, value, limit) {
  const result = await firestoreRunQuery(env, {
    from: [{ collectionId }],
    where: equalFilter(field, value),
    limit,
  });
  if (!result.ok) {
    throw new McpError("unavailable", result.reason || "Work item storage is unavailable.", 503);
  }
  return result.documents || [];
}

export function createWorkerMcpRepo(env) {
  return {
    configured() {
      return firestoreAdminConfigured(env);
    },
    async getTokenByHash(hash) {
      const rows = await queryEqual(env, TOKENS, "tokenHash", hash, 2);
      return rows.length === 1 ? rows[0] : null;
    },
    listTokens(userId) {
      return queryEqual(env, TOKENS, "userId", userId, 50);
    },
    async saveToken(record) {
      const { id, ...data } = record;
      const saved = await firestoreUpsertDocument(env, TOKENS, id, data);
      if (!saved.ok) throw new McpError("unavailable", saved.reason || "Could not save the token.", 503);
    },
    async patchToken(id, patch) {
      const saved = await firestorePatchDocument(env, TOKENS, id, patch);
      if (!saved.ok) throw new McpError("unavailable", saved.reason || "Could not update the token.", 503);
    },
    async userCanAccess(userId, workspaceId) {
      const [workspace, member] = await Promise.all([
        firestoreGetDocument(env, "workspaces", workspaceId),
        firestoreGetDocument(env, "workspace_members", `${workspaceId}_${userId}`),
      ]);
      if (workspace && workspace.ownerId === userId) return true;
      const status = String(member?.status || "").toLowerCase();
      return Boolean(member && (status === "active" || status === "accepted"));
    },
    async getWorkspace(workspaceId) {
      const workspace = await firestoreGetDocument(env, "workspaces", workspaceId);
      if (!workspace) return null;
      return { id: workspaceId, name: workspace.name || workspace.title || workspaceId };
    },
    listItems(workspaceId) {
      return queryEqual(env, "tasks", "workspaceId", workspaceId, ITEM_FETCH_CAP);
    },
    getItem(itemId) {
      return firestoreGetDocument(env, "tasks", itemId);
    },
    async saveItem(item) {
      const { id, ...data } = item;
      const saved = await firestoreUpsertDocument(env, "tasks", id, stamp(data));
      if (!saved.ok) throw new McpError("unavailable", saved.reason || "Could not save the item.", 503);
    },
    async writeAudit(event) {
      const { id, ...data } = event;
      const saved = await firestoreUpsertDocument(env, AUDITS, id, data);
      if (!saved.ok) throw new McpError("unavailable", saved.reason || "Could not write the audit.", 503);
    },
    async loadCatalog(workspaceId, userId) {
      const [byWorkspace, byUser, members] = await Promise.all([
        queryEqual(env, "categories", "workspaceId", workspaceId, 500),
        queryEqual(env, "categories", "userId", userId, 500),
        queryEqual(env, "workspace_members", "workspaceId", workspaceId, 200),
      ]);
      const seen = new Set(byWorkspace.map((row) => row.id));
      const categories = [...byWorkspace];
      for (const row of byUser) {
        if (seen.has(row.id)) continue;
        const rowWorkspace = String(row.workspaceId || "").trim();
        if (rowWorkspace && rowWorkspace !== workspaceId) continue;
        categories.push(row);
      }
      return { categories, members };
    },
    listProjects(workspaceId) {
      return queryEqual(env, "projects", "workspaceId", workspaceId, 200);
    },
    getProject(projectId) {
      return firestoreGetDocument(env, "projects", projectId);
    },
    async saveCategory(record) {
      const { id, ...data } = record;
      const saved = await firestoreUpsertDocument(env, "categories", id, stamp(data));
      if (!saved.ok) throw new McpError("unavailable", saved.reason || "Could not save the catalog option.", 503);
    },
    listViews(workspaceId) {
      return queryEqual(env, "saved_views", "workspaceId", workspaceId, 200);
    },
    async saveView(record) {
      const { id, ...data } = record;
      const saved = await firestoreUpsertDocument(env, "saved_views", id, data);
      if (!saved.ok) throw new McpError("unavailable", saved.reason || "Could not save the view.", 503);
    },
  };
}
