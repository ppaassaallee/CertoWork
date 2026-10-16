/**
 * Remote Certo Work MCP.
 * Stateless Streamable HTTP (protocol 2025-06-18) plus the token and item rules.
 * Storage is injected so tests never touch Firestore.
 */

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 60_000;
export const ITEM_FETCH_CAP = 2000;
export const SOFT_DELETE_MS = 30 * 24 * 60 * 60 * 1000;
export const ITEM_TYPES = ["epic", "feature", "pbi", "subtask"];
export const ITEM_STATUSES = [
  "backlog",
  "ready",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

const ASSIGNEE_KEYS = ["assignee", "assignee_id", "assigneeId", "assigneeIds", "assignees"];

export class McpError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.status = status;
  }
}

export function createId(prefix) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const body = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${prefix}${body}`;
}

function base64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `cw_mcp_${base64Url(bytes)}`;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function iso(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  if (typeof value._seconds === "number") return new Date(value._seconds * 1000).toISOString();
  return String(value);
}

function text(value) {
  return String(value ?? "").trim();
}

function arg(args, key) {
  return text(args?.[key]);
}

function defined(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function publicToken(record) {
  return {
    id: record.id,
    name: record.name,
    tokenPrefix: record.tokenPrefix,
    workspaceIds: record.workspaceIds || [],
    permission: record.permission,
    assign: Boolean(record.assign),
    expiresAt: record.expiresAt || null,
    revokedAt: record.revokedAt || null,
    createdAt: record.createdAt || null,
    lastUsedAt: record.lastUsedAt || null,
  };
}

function kindOf(item) {
  const value = text(item?.workItemType || item?.type || item?.itemType).toLowerCase();
  if (value.includes("epic")) return "epic";
  if (value.includes("feature")) return "feature";
  if (value.includes("sub")) return "subtask";
  if (value.includes("pbi") || value.includes("story")) return "pbi";
  return value;
}

function isDeleted(item) {
  const status = text(item?.status).toLowerCase();
  return status === "deleted" || status === "archived" || Boolean(item?.deletedAt);
}

function parentOk(childType, parentType) {
  if (!parentType) return false;
  if (childType === "epic") return false;
  if (childType === "feature") return parentType === "epic";
  if (childType === "pbi") return parentType === "feature";
  if (childType === "subtask") return parentType === "pbi";
  return false;
}

function parentMessage(childType) {
  if (childType === "feature") return "A Feature can only sit under an Epic.";
  if (childType === "pbi") return "A PBI can only sit under a Feature.";
  if (childType === "subtask") return "A Sub Task can only sit under a PBI.";
  if (childType === "epic") return "An Epic cannot have a parent.";
  return "That parent is not allowed for this type.";
}

function resolveType(raw) {
  const key = text(raw).toLowerCase().replace(/[\s-]+/g, "_");
  const type = key === "sub_task" ? "subtask" : key;
  if (!ITEM_TYPES.includes(type)) {
    throw new McpError("invalid_type", `Type must be one of: ${ITEM_TYPES.join(", ")}.`, 400);
  }
  return type;
}

function resolveStatus(raw, fallback) {
  if (raw == null || text(raw) === "") return fallback;
  const key = text(raw).toLowerCase();
  if (!ITEM_STATUSES.includes(key)) {
    throw new McpError(
      "unknown_status",
      `Status "${text(raw)}" is not valid. Use one of: ${ITEM_STATUSES.join(", ")}.`,
      400,
    );
  }
  return key;
}

function resolveDue(raw) {
  if (raw == null || text(raw) === "") return null;
  const value = text(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new McpError("invalid_due_date", "due_date must be YYYY-MM-DD.", 400);
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function resolvePriority(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const value = text(raw);
  if (!value || value.length > 16) {
    throw new McpError("invalid_priority", "priority must be a short label or a number.", 400);
  }
  return value;
}

function categoryGroup(row) {
  const group = text(row?.group || "tag").toLowerCase();
  if (group === "client" || group === "client_entity") return "client";
  if (group === "bpo" || group === "delivery_entity") return "delivery";
  if (group === "tag" || group === "tags" || group === "category") return "tag";
  return "";
}

function buildCatalog(categories, members) {
  const clients = [];
  const deliveries = [];
  const tags = [];
  const seen = { client: new Set(), delivery: new Set(), tag: new Set() };
  for (const row of categories || []) {
    const bucket = categoryGroup(row);
    const name = text(row?.name || row?.title);
    if (!bucket || !name) continue;
    const key = name.toLowerCase();
    if (seen[bucket].has(key)) continue;
    seen[bucket].add(key);
    const entry = { id: row.id, name };
    if (bucket === "client") clients.push(entry);
    if (bucket === "delivery") deliveries.push(entry);
    if (bucket === "tag") tags.push(entry);
  }
  const people = [];
  const seenPeople = new Set();
  for (const member of members || []) {
    const status = text(member.status).toLowerCase();
    if (status && status !== "active" && status !== "accepted") continue;
    const id = text(member.userId || member.id);
    if (!id || seenPeople.has(id)) continue;
    seenPeople.add(id);
    people.push({
      id,
      name: text(member.publicAlias || member.displayName || member.name || member.email) || id,
      email: text(member.email || member.emailLower),
    });
  }
  return { clients, deliveries, tags, members: people, statuses: ITEM_STATUSES, types: ITEM_TYPES };
}

function matchNamed(list, raw) {
  const value = text(raw);
  if (!value) return null;
  const key = value.toLowerCase();
  return (
    (list || []).find(
      (entry) => entry.id === value || text(entry.name).toLowerCase() === key,
    ) || null
  );
}

function requireNamed(list, raw, code, label) {
  if (raw == null || text(raw) === "") return null;
  const match = matchNamed(list, raw);
  if (!match) {
    throw new McpError(
      code,
      `${label} "${text(raw)}" is not in this workspace. Add it in settings before using the API.`,
      400,
    );
  }
  return match;
}

function resolveTags(catalog, raw) {
  if (raw == null) return null;
  if (!Array.isArray(raw)) throw new McpError("invalid_tags", "tags must be an array of names.", 400);
  return raw.map((value) => {
    const match = matchNamed(catalog.tags, value);
    if (!match) {
      throw new McpError("unknown_tag", `Tag "${text(value)}" is not in this workspace.`, 400);
    }
    return match;
  });
}

function rejectAssignee(token, args) {
  const present = ASSIGNEE_KEYS.filter((key) => args?.[key] != null && text(args[key]) !== "");
  if (!present.length) return;
  if (!token.assign) {
    throw new McpError(
      "assign_forbidden",
      "This token cannot assign people. Turn on the assign permission to change an assignee.",
      403,
    );
  }
}

function resolveAssignee(token, catalog, args) {
  rejectAssignee(token, args);
  const raw = args?.assignee_id ?? args?.assigneeId ?? args?.assignee;
  if (raw == null || text(raw) === "") return undefined;
  const key = text(raw).toLowerCase();
  const member = catalog.members.find(
    (person) => person.id === text(raw) || person.name.toLowerCase() === key || person.email.toLowerCase() === key,
  );
  if (!member) {
    throw new McpError("unknown_assignee", "That person is not a member of this workspace.", 400);
  }
  return member;
}

function show(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
}

function comparable(item) {
  return {
    title: item?.title || "",
    description: item?.description || "",
    status: item?.status || "",
    type: kindOf(item),
    parent_id: item?.parentId || "",
    client: item?.clientEntity || item?.client || "",
    delivery: item?.deliveryEntity || item?.bpo || "",
    tags: item?.tags || [],
    due_date: item?.dueDate || "",
    priority: item?.priority ?? "",
    assignee_id: item?.assigneeId || "",
    external_id: item?.externalId || "",
    workspace_id: item?.workspaceId || "",
    deleted_at: item?.deletedAt || "",
  };
}

function changeText(before, after) {
  const left = comparable(before);
  const right = comparable(after);
  const parts = [];
  for (const key of Object.keys(right)) {
    if (JSON.stringify(left[key]) === JSON.stringify(right[key])) continue;
    parts.push(`${key}: ${show(left[key])} → ${show(right[key])}`);
  }
  return parts.join("; ");
}

function auditEntry(token, summary, before, after, now) {
  return {
    at: new Date(now).toISOString(),
    by: `vía API (${token.name})`,
    via: "api",
    tokenId: token.id,
    tokenName: token.name,
    userId: token.userId,
    text: summary,
    before,
    after,
  };
}

async function requireWorkspace(repo, token, workspaceId) {
  const id = text(workspaceId);
  if (!id) {
    throw new McpError("workspace_required", "workspace_id is required. It is never inferred.", 400);
  }
  if (!(token.workspaceIds || []).includes(id)) {
    throw new McpError("workspace_forbidden", "This token cannot access that workspace.", 403);
  }
  const allowed = await repo.userCanAccess(token.userId, id);
  if (!allowed) {
    throw new McpError("workspace_access_revoked", "You no longer have access to that workspace.", 403);
  }
  return id;
}

function requireWrite(token) {
  if (token.permission !== "read-write") {
    throw new McpError("read_only", "This token is read-only.", 403);
  }
}

async function workspaceItems(repo, workspaceId) {
  const rows = await repo.listItems(workspaceId);
  return (rows || []).filter((item) => text(item.workspaceId) === workspaceId);
}

async function requireItem(repo, workspaceId, itemId) {
  const id = text(itemId);
  if (!id) throw new McpError("item_required", "item_id is required.", 400);
  const item = await repo.getItem(id);
  if (!item || text(item.workspaceId) !== workspaceId) {
    throw new McpError("not_found", "Item not found in this workspace.", 404);
  }
  return item;
}

async function loadCatalog(repo, workspaceId, userId) {
  const loaded = await repo.loadCatalog(workspaceId, userId);
  return buildCatalog(loaded?.categories || [], loaded?.members || []);
}

function childrenOf(items, parentId) {
  return items.filter((item) => text(item.parentId) === parentId && !isDeleted(item));
}

function descendants(items, rootId) {
  const out = [];
  const walk = (parentId) => {
    for (const child of items.filter((item) => text(item.parentId) === parentId)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(rootId);
  return out;
}

function assertNoCycle(items, itemId, parentId) {
  let cursor = parentId;
  const seen = new Set();
  while (cursor) {
    if (cursor === itemId) {
      throw new McpError("invalid_parent", "That parent is under this item.", 400);
    }
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const next = items.find((item) => item.id === cursor);
    cursor = next ? text(next.parentId) : "";
  }
}

function lineage(parent) {
  if (!parent) return { epicId: null, featureId: null };
  const type = kindOf(parent);
  if (type === "epic") return { epicId: parent.id, featureId: null };
  if (type === "feature") return { epicId: parent.epicId || null, featureId: parent.id };
  return { epicId: parent.epicId || null, featureId: parent.featureId || null };
}

function applyParent(item, parent) {
  item.parentId = parent ? parent.id : null;
  const line = lineage(parent);
  item.epicId = line.epicId;
  item.featureId = line.featureId;
}

function assertParentLink(childType, parent) {
  if (!parent) {
    if (childType === "epic") return;
    return;
  }
  if (isDeleted(parent)) {
    throw new McpError("invalid_parent", "That parent is in the trash.", 400);
  }
  if (!parentOk(childType, kindOf(parent))) {
    throw new McpError("invalid_parent", parentMessage(childType), 400);
  }
}

function memberName(catalog, assigneeId) {
  if (!assigneeId) return null;
  return catalog.members.find((person) => person.id === assigneeId) || { id: assigneeId, name: assigneeId };
}

function publicTags(item, catalog) {
  const names = Array.isArray(item.tags) ? item.tags : [];
  return names.map((name) => matchNamed(catalog.tags, name) || { id: "", name: String(name) });
}

function activityRows(item) {
  const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
  return history.slice(-30).map((entry) => ({
    at: entry.at || "",
    by: entry.by || "",
    text: entry.text || "",
    via: entry.via || "",
    token_id: entry.tokenId || "",
    before: entry.before || null,
    after: entry.after || null,
  }));
}

function publicSummary(item, catalog) {
  const assignee = memberName(catalog, item.assigneeId);
  return {
    id: item.id,
    workspace_id: item.workspaceId,
    type: kindOf(item) || null,
    title: item.title || "",
    status: item.status || "",
    parent_id: item.parentId || null,
    assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
    client: item.clientEntity || item.client || null,
    delivery: item.deliveryEntity || item.bpo || null,
    tags: publicTags(item, catalog),
    due_date: item.dueDate || null,
    priority: item.priority ?? null,
    external_id: item.externalId || null,
    deleted_at: item.deletedAt || null,
    purge_after: item.purgeAfter || null,
    updated_at: iso(item.updatedAt),
  };
}

function publicItem(item, catalog, items) {
  const parent = item.parentId ? items.find((row) => row.id === item.parentId) : null;
  const children = childrenOf(items, item.id);
  return {
    ...publicSummary(item, catalog),
    description: item.description || "",
    created_at: iso(item.createdAt),
    parent: parent ? publicSummary(parent, catalog) : null,
    children: children.map((child) => publicSummary(child, catalog)),
    comments: (Array.isArray(item.comments) ? item.comments : []).map((comment) => ({
      id: comment.id || "",
      text: comment.text || "",
      at: comment.at || "",
      author: comment.author || "",
      via: comment.via || "",
    })),
    activity: activityRows(item),
  };
}

async function persist(repo, token, before, next, summary, action, now) {
  const textSummary = summary || changeText(before || {}, next);
  const entry = auditEntry(token, textSummary, comparable(before || {}), comparable(next), now);
  const history = Array.isArray(before?.statusHistory) ? before.statusHistory : [];
  next.statusHistory = [...history, entry].slice(-80);
  next.updatedAt = new Date(now).toISOString();
  if (!next.createdAt) next.createdAt = next.updatedAt;
  next.updatedBy = token.userId;
  await repo.saveItem(defined(next));
  await repo.writeAudit({
    id: createId("aud"),
    action,
    tokenId: token.id,
    tokenName: token.name,
    userId: token.userId,
    workspaceId: next.workspaceId,
    itemId: next.id,
    at: next.updatedAt,
    before: entry.before,
    after: entry.after,
  });
  return next;
}

function dateKey(value) {
  const raw = iso(value);
  return raw ? raw.slice(0, 10) : "";
}

function matchesFilters(item, args, catalog, typeFilter) {
  if (isDeleted(item) && arg(args, "status") !== "deleted") return false;
  if (typeFilter && kindOf(item) !== typeFilter) return false;
  if (arg(args, "parent_id") && text(item.parentId) !== arg(args, "parent_id")) return false;
  if (args.sin_padre === true && text(item.parentId)) return false;
  if (arg(args, "status") && text(item.status).toLowerCase() !== arg(args, "status").toLowerCase()) return false;
  if (arg(args, "client")) {
    const wanted = arg(args, "client").toLowerCase();
    const client = text(item.clientEntity || item.client).toLowerCase();
    if (client !== wanted) return false;
  }
  if (arg(args, "delivery")) {
    const wanted = arg(args, "delivery").toLowerCase();
    const delivery = text(item.deliveryEntity || item.bpo).toLowerCase();
    if (delivery !== wanted) return false;
  }
  if (arg(args, "tag")) {
    const wanted = arg(args, "tag").toLowerCase();
    const tags = Array.isArray(item.tags) ? item.tags.map((tag) => text(tag).toLowerCase()) : [];
    const ids = Array.isArray(item.categoryIds) ? item.categoryIds : [];
    if (!tags.includes(wanted) && !ids.includes(arg(args, "tag"))) return false;
  }
  if (arg(args, "assignee")) {
    const wanted = arg(args, "assignee").toLowerCase();
    const person = memberName(catalog, item.assigneeId);
    const names = [item.assigneeId, person?.name, person?.email, ...(item.assignees || [])]
      .map((value) => text(value).toLowerCase())
      .filter(Boolean);
    if (!names.includes(wanted)) return false;
  }
  const due = dateKey(item.dueDate);
  if (arg(args, "due_before") && (!due || due > dateKey(args.due_before))) return false;
  if (arg(args, "due_after") && (!due || due < dateKey(args.due_after))) return false;
  if (arg(args, "texto")) {
    const needle = arg(args, "texto").toLowerCase();
    const haystack = `${item.title || ""} ${item.description || ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

function page(rows, args) {
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 100);
  const sorted = [...rows].sort((left, right) => {
    const time = iso(right.updatedAt).localeCompare(iso(left.updatedAt));
    if (time) return time;
    return String(left.id).localeCompare(String(right.id));
  });
  let start = 0;
  if (arg(args, "cursor")) {
    const cursor = arg(args, "cursor");
    const index = sorted.findIndex((item) => `${iso(item.updatedAt)}|${item.id}` === cursor);
    if (index < 0) throw new McpError("invalid_cursor", "That cursor is not valid for this query.", 400);
    start = index + 1;
  }
  const slice = sorted.slice(start, start + limit);
  const last = slice[slice.length - 1];
  const next = start + slice.length < sorted.length && last ? `${iso(last.updatedAt)}|${last.id}` : null;
  return { slice, next_cursor: next };
}

async function listWorkspaces(repo, token) {
  const workspaces = [];
  for (const workspaceId of token.workspaceIds || []) {
    const allowed = await repo.userCanAccess(token.userId, workspaceId);
    if (!allowed) continue;
    const workspace = await repo.getWorkspace(workspaceId);
    if (!workspace) continue;
    workspaces.push({ id: workspace.id, name: workspace.name || workspace.id });
  }
  return { workspaces };
}

async function listItems(repo, token, args) {
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  const items = await workspaceItems(repo, workspaceId);
  const typeFilter = arg(args, "type") ? resolveType(args.type) : "";
  const filtered = items.filter((item) => matchesFilters(item, args, catalog, typeFilter));
  const paged = page(filtered, args);
  return {
    workspace_id: workspaceId,
    items: paged.slice.map((item) => publicSummary(item, catalog)),
    next_cursor: paged.next_cursor,
  };
}

async function getItem(repo, token, args) {
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const items = await workspaceItems(repo, workspaceId);
  const item = await requireItem(repo, workspaceId, args.item_id);
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  return { item: publicItem(item, catalog, items) };
}

async function getHierarchy(repo, token, args) {
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const items = (await workspaceItems(repo, workspaceId)).filter((item) => !isDeleted(item));
  const ids = new Set(items.map((item) => item.id));
  const byParent = new Map();
  for (const item of items) {
    const parentId = text(item.parentId);
    const list = byParent.get(parentId) || [];
    list.push(item);
    byParent.set(parentId, list);
  }
  const node = (item) => ({
    id: item.id,
    type: kindOf(item),
    title: item.title || "",
    status: item.status || "",
    children: (byParent.get(item.id) || []).map(node),
  });
  const roots = items.filter((item) => !text(item.parentId));
  const unparented = items.filter((item) => text(item.parentId) && !ids.has(text(item.parentId)));
  return { workspace_id: workspaceId, tree: roots.map(node), unparented: unparented.map(node) };
}

async function listFields(repo, token, args) {
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  return {
    workspace_id: workspaceId,
    types: catalog.types,
    statuses: catalog.statuses,
    clients: catalog.clients,
    deliveries: catalog.deliveries,
    tags: catalog.tags,
    members: catalog.members.map((person) => ({ id: person.id, name: person.name })),
  };
}

function applyFieldPatch(item, token, catalog, args) {
  if (args.title != null) {
    const title = text(args.title);
    if (!title || title.length > 500) throw new McpError("invalid_title", "Title is required and must be 500 characters or less.", 400);
    item.title = title;
  }
  if (args.description != null) item.description = String(args.description).slice(0, 20000);
  if (args.client != null) {
    const client = requireNamed(catalog.clients, args.client, "unknown_client", "Client");
    item.clientEntity = client ? client.name : null;
    item.client = client ? client.name : null;
  }
  if (args.delivery != null) {
    const delivery = requireNamed(catalog.deliveries, args.delivery, "unknown_delivery", "Delivery");
    item.deliveryEntity = delivery ? delivery.name : null;
    item.bpo = delivery ? delivery.name : null;
  }
  if (args.tags != null) {
    const tags = resolveTags(catalog, args.tags) || [];
    item.tags = tags.map((tag) => tag.name);
    item.categoryIds = tags.map((tag) => tag.id).filter(Boolean);
  }
  if (args.due_date != null) item.dueDate = resolveDue(args.due_date);
  if (args.priority != null) item.priority = resolvePriority(args.priority);
  if (args.status != null) item.status = resolveStatus(args.status, item.status || "backlog");
  if (args.external_id != null) item.externalId = text(args.external_id) || null;
  const assignee = resolveAssignee(token, catalog, args);
  if (assignee) {
    item.assigneeId = assignee.id;
    item.assignees = [assignee.name];
  }
}

async function findExternal(items, externalId) {
  const key = text(externalId);
  if (!key) return null;
  return items.find((item) => text(item.externalId) === key) || null;
}

async function createItem(repo, token, args, now) {
  requireWrite(token);
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const items = await workspaceItems(repo, workspaceId);
  const existing = await findExternal(items, args.external_id);
  if (existing && !isDeleted(existing)) {
    const catalog = await loadCatalog(repo, workspaceId, token.userId);
    return { created: false, item: publicItem(existing, catalog, items) };
  }
  if (existing && isDeleted(existing)) {
    throw new McpError(
      "external_id_deleted",
      `external_id "${text(args.external_id)}" belongs to a trashed item (${existing.id}).`,
      409,
    );
  }
  const type = resolveType(args.type);
  const title = text(args.title);
  if (!title || title.length > 500) {
    throw new McpError("invalid_title", "Title is required and must be 500 characters or less.", 400);
  }
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  let parent = null;
  if (arg(args, "parent_id")) {
    parent = await requireItem(repo, workspaceId, args.parent_id);
    assertNoCycle(items, "", parent.id);
    assertParentLink(type, parent);
  } else if (type === "epic") {
    assertParentLink(type, null);
  }
  const item = {
    id: createId("task"),
    userId: token.userId,
    createdBy: token.userId,
    ownerId: token.userId,
    workspaceId,
    title,
    description: "",
    status: "backlog",
    priority: null,
    dueDate: null,
    workItemType: type,
    itemType: type,
    type,
    parentId: null,
    epicId: null,
    featureId: null,
    tags: [],
    categoryIds: [],
    externalId: null,
    comments: [],
    statusHistory: [],
    source: "api",
    deletedAt: null,
    purgeAfter: null,
    createdAt: new Date(now).toISOString(),
  };
  applyParent(item, parent);
  applyFieldPatch(item, token, catalog, { ...args, title });
  item.workItemType = type;
  item.itemType = type;
  item.type = type;
  const saved = await persist(repo, token, {}, item, `Created ${type}`, "create_item", now);
  return { created: true, item: publicItem(saved, catalog, [...items, saved]) };
}

async function updateItem(repo, token, args, now) {
  requireWrite(token);
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const current = await requireItem(repo, workspaceId, args.item_id);
  if (isDeleted(current)) throw new McpError("deleted", "This item is in the trash.", 409);
  const items = await workspaceItems(repo, workspaceId);
  if (args.external_id != null && text(args.external_id)) {
    const clash = items.find((item) => item.id !== current.id && text(item.externalId) === text(args.external_id));
    if (clash) throw new McpError("external_id_taken", "That external_id is already used in this workspace.", 409);
  }
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  const next = { ...current };
  applyFieldPatch(next, token, catalog, args);
  const saved = await persist(repo, token, current, next, "", "update_item", now);
  return { item: publicItem(saved, catalog, items.map((item) => (item.id === saved.id ? saved : item))) };
}

async function setParent(repo, token, args, now) {
  requireWrite(token);
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const items = await workspaceItems(repo, workspaceId);
  const current = await requireItem(repo, workspaceId, args.item_id);
  if (isDeleted(current)) throw new McpError("deleted", "This item is in the trash.", 409);
  const childType = kindOf(current);
  let parent = null;
  if (arg(args, "parent_id")) {
    parent = await requireItem(repo, workspaceId, args.parent_id);
    if (parent.id === current.id) throw new McpError("invalid_parent", "An item cannot be its own parent.", 400);
    assertNoCycle(items, current.id, parent.id);
  }
  assertParentLink(childType, parent);
  const next = { ...current };
  applyParent(next, parent);
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  const saved = await persist(repo, token, current, next, "", "set_parent", now);
  return { item: publicItem(saved, catalog, items.map((item) => (item.id === saved.id ? saved : item))) };
}

async function changeType(repo, token, args, now) {
  requireWrite(token);
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const items = await workspaceItems(repo, workspaceId);
  const current = await requireItem(repo, workspaceId, args.item_id);
  if (isDeleted(current)) throw new McpError("deleted", "This item is in the trash.", 409);
  const nextType = resolveType(args.type);
  const parent = current.parentId ? items.find((item) => item.id === current.parentId) : null;
  if (parent) assertParentLink(nextType, parent);
  if (!parent && nextType !== "epic" && text(current.parentId)) {
    throw new McpError("invalid_parent", "The current parent is missing, so this type cannot be changed in place.", 400);
  }
  if (nextType === "epic" && text(current.parentId)) {
    throw new McpError("invalid_parent", parentMessage("epic"), 400);
  }
  for (const child of childrenOf(items, current.id)) {
    if (!parentOk(kindOf(child), nextType)) {
      throw new McpError(
        "invalid_parent",
        `Child "${child.title || child.id}" cannot sit under a ${nextType}.`,
        400,
      );
    }
  }
  const next = { ...current, workItemType: nextType, itemType: nextType, type: nextType };
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  const saved = await persist(repo, token, current, next, "", "change_type", now);
  return { item: publicItem(saved, catalog, items.map((item) => (item.id === saved.id ? saved : item))) };
}

function storedLabels(item, catalog, field) {
  if (field === "tags") {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return tags.map((tag) => {
      const match = matchNamed(catalog.tags, tag);
      if (!match) {
        throw new McpError("unknown_tag", `Tag "${tag}" on ${item.id} is not in the target workspace.`, 400);
      }
      return match;
    });
  }
  return [];
}

async function moveItem(repo, token, args, now) {
  requireWrite(token);
  const sourceId = await requireWorkspace(repo, token, args.workspace_id);
  const targetId = await requireWorkspace(repo, token, args.target_workspace_id);
  if (sourceId === targetId) {
    throw new McpError("same_workspace", "target_workspace_id is already this item's workspace.", 400);
  }
  const sourceItems = await workspaceItems(repo, sourceId);
  const current = await requireItem(repo, sourceId, args.item_id);
  const moving = [current, ...descendants(sourceItems, current.id)];
  const targetCatalog = await loadCatalog(repo, targetId, token.userId);
  for (const row of moving) {
    if (text(row.clientEntity || row.client)) {
      requireNamed(targetCatalog.clients, row.clientEntity || row.client, "unknown_client", "Client");
    }
    if (text(row.deliveryEntity || row.bpo)) {
      requireNamed(targetCatalog.deliveries, row.deliveryEntity || row.bpo, "unknown_delivery", "Delivery");
    }
    storedLabels(row, targetCatalog, "tags");
  }
  const target = await repo.getWorkspace(targetId);
  const targetName = target?.name || targetId;
  const saved = [];
  for (const row of moving) {
    const next = { ...row, workspaceId: targetId };
    saved.push(await persist(repo, token, row, next, `Moved to workspace ${targetName}`, "move_item_to_workspace", now));
  }
  return {
    workspace_id: targetId,
    moved: saved.map((item) => item.id),
    item: publicItem(saved[0], targetCatalog, saved),
  };
}

async function addComment(repo, token, args, now) {
  requireWrite(token);
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const current = await requireItem(repo, workspaceId, args.item_id);
  if (isDeleted(current)) throw new McpError("deleted", "This item is in the trash.", 409);
  const body = String(args.text ?? "");
  if (!text(body)) throw new McpError("comment_required", "text is required.", 400);
  if (body.length > 8000) throw new McpError("comment_too_long", "Comments must be 8000 characters or less.", 400);
  const comment = {
    id: createId("c"),
    text: body,
    at: new Date(now).toISOString(),
    author: `vía API (${token.name})`,
    via: "api",
    tokenId: token.id,
    visibility: "internal",
  };
  const next = {
    ...current,
    comments: [...(Array.isArray(current.comments) ? current.comments : []), comment].slice(-200),
  };
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  const items = await workspaceItems(repo, workspaceId);
  const saved = await persist(repo, token, current, next, "Comment added", "add_comment", now);
  return { comment, item: publicItem(saved, catalog, items.map((item) => (item.id === saved.id ? saved : item))) };
}

function planUpdate(current, token, catalog, fields) {
  const next = { ...current };
  applyFieldPatch(next, token, catalog, fields);
  return {
    item_id: current.id,
    ok: true,
    before: comparable(current),
    after: comparable(next),
    next,
  };
}

async function bulkUpdate(repo, token, args, now) {
  requireWrite(token);
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const entries = args.items;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new McpError("bulk_empty", "items must contain at least one update.", 400);
  }
  if (entries.length > 100) {
    throw new McpError("bulk_too_large", "Bulk update accepts at most 100 items.", 400);
  }
  const ids = entries.map((entry) => text(entry?.item_id));
  if (new Set(ids).size !== ids.length) {
    throw new McpError("duplicate_item", "Each item_id can appear only once in a bulk update.", 400);
  }
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  const items = await workspaceItems(repo, workspaceId);
  const plans = [];
  for (const entry of entries) {
    try {
      const current = await requireItem(repo, workspaceId, entry?.item_id);
      if (isDeleted(current)) throw new McpError("deleted", "This item is in the trash.", 409);
      plans.push(planUpdate(current, token, catalog, entry || {}));
    } catch (error) {
      plans.push({
        item_id: text(entry?.item_id),
        ok: false,
        code: error.code || "tool_error",
        message: error.message,
      });
    }
  }
  const dryRun = args.dry_run === true;
  if (dryRun || plans.some((plan) => !plan.ok)) {
    return {
      dry_run: dryRun,
      applied: false,
      results: plans.map((plan) => {
        const copy = { ...plan };
        delete copy.next;
        return copy;
      }),
    };
  }
  const savedIds = [];
  for (const plan of plans) {
    const current = items.find((item) => item.id === plan.item_id);
    await persist(repo, token, current, plan.next, "", "bulk_update", now);
    savedIds.push(plan.item_id);
  }
  return {
    dry_run: false,
    applied: true,
    results: plans.map((plan) => ({
      item_id: plan.item_id,
      ok: true,
      before: plan.before,
      after: plan.after,
    })),
    updated: savedIds,
  };
}

async function deleteItem(repo, token, args, now) {
  requireWrite(token);
  const workspaceId = await requireWorkspace(repo, token, args.workspace_id);
  const items = await workspaceItems(repo, workspaceId);
  const current = await requireItem(repo, workspaceId, args.item_id);
  if (childrenOf(items, current.id).length) {
    throw new McpError("has_children", "Delete or move the child items first. This item still has children.", 409);
  }
  if (isDeleted(current)) {
    throw new McpError("already_deleted", "This item is already in the trash.", 409);
  }
  const deletedAt = new Date(now).toISOString();
  const next = {
    ...current,
    status: "deleted",
    previousStatus: current.status || "backlog",
    deletedAt,
    purgeAfter: new Date(now + SOFT_DELETE_MS).toISOString(),
  };
  const catalog = await loadCatalog(repo, workspaceId, token.userId);
  const saved = await persist(repo, token, current, next, "Moved to trash", "delete_item", now);
  return {
    deleted: true,
    recoverable_until: saved.purgeAfter,
    item: publicItem(saved, catalog, items.map((item) => (item.id === saved.id ? saved : item))),
  };
}

const TOOL_RUNNERS = {
  list_workspaces: listWorkspaces,
  list_items: listItems,
  get_item: getItem,
  get_hierarchy: getHierarchy,
  list_fields: listFields,
  create_item: createItem,
  update_item: updateItem,
  set_parent: setParent,
  change_type: changeType,
  move_item_to_workspace: moveItem,
  add_comment: addComment,
  bulk_update: bulkUpdate,
  delete_item: deleteItem,
};

const workspaceProp = {
  workspace_id: { type: "string", description: "Workspace this call is allowed to touch. Required. Never inferred." },
};

function schema(properties, required) {
  return { type: "object", properties, required, additionalProperties: false };
}

export const MCP_TOOLS = [
  {
    name: "list_workspaces",
    description: "List workspaces this token may access. Does not accept or infer a workspace.",
    inputSchema: schema({}, []),
  },
  {
    name: "list_items",
    description: "List work items in one workspace. Filters combine with AND. Deleted items stay hidden unless status is deleted.",
    inputSchema: schema({
      ...workspaceProp,
      type: { type: "string", enum: ITEM_TYPES },
      parent_id: { type: "string" },
      status: { type: "string" },
      assignee: { type: "string", description: "Member id or name. Does not change assignment." },
      client: { type: "string" },
      delivery: { type: "string" },
      tag: { type: "string" },
      due_before: { type: "string" },
      due_after: { type: "string" },
      sin_padre: { type: "boolean" },
      texto: { type: "string" },
      cursor: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }, ["workspace_id"]),
  },
  {
    name: "get_item",
    description: "Read one item, including parent, children, tags, comments, and API activity.",
    inputSchema: schema({ ...workspaceProp, item_id: { type: "string" } }, ["workspace_id", "item_id"]),
  },
  {
    name: "get_hierarchy",
    description: "Return the Epic, Feature, PBI, and Sub Task tree for one workspace.",
    inputSchema: schema(workspaceProp, ["workspace_id"]),
  },
  {
    name: "list_fields",
    description: "Valid clients, deliveries, tags, statuses, members, and types. The API does not create new options.",
    inputSchema: schema(workspaceProp, ["workspace_id"]),
  },
  {
    name: "create_item",
    description: "Create an item. external_id is idempotent inside the workspace. Assignee changes require the assign permission.",
    inputSchema: schema({
      ...workspaceProp,
      type: { type: "string", enum: ITEM_TYPES },
      title: { type: "string" },
      parent_id: { type: "string" },
      description: { type: "string" },
      client: { type: "string" },
      delivery: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      due_date: { type: "string" },
      priority: {},
      status: { type: "string" },
      external_id: { type: "string" },
      assignee: { type: "string" },
    }, ["workspace_id", "type", "title"]),
  },
  {
    name: "update_item",
    description: "Patch fields on one item. Omitted fields stay as they are. Parent, type, and workspace use their own tools.",
    inputSchema: schema({
      ...workspaceProp,
      item_id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      client: { type: "string" },
      delivery: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      due_date: { type: "string" },
      priority: {},
      status: { type: "string" },
      external_id: { type: "string" },
      assignee: { type: "string" },
    }, ["workspace_id", "item_id"]),
  },
  {
    name: "set_parent",
    description: "Move an item under a parent. Feature only under Epic, PBI only under Feature, Sub Task only under PBI. Empty parent_id detaches it.",
    inputSchema: schema({
      ...workspaceProp,
      item_id: { type: "string" },
      parent_id: { type: "string" },
    }, ["workspace_id", "item_id"]),
  },
  {
    name: "change_type",
    description: "Change Epic, Feature, PBI, or Sub Task. Fails when the parent or children would break the hierarchy.",
    inputSchema: schema({
      ...workspaceProp,
      item_id: { type: "string" },
      type: { type: "string", enum: ITEM_TYPES },
    }, ["workspace_id", "item_id", "type"]),
  },
  {
    name: "move_item_to_workspace",
    description: "Move an item and its descendants to another workspace on this token. History and comments stay. Client, delivery, and tags must already exist there.",
    inputSchema: schema({
      ...workspaceProp,
      item_id: { type: "string" },
      target_workspace_id: { type: "string" },
    }, ["workspace_id", "item_id", "target_workspace_id"]),
  },
  {
    name: "add_comment",
    description: "Append a comment attributed to this API token.",
    inputSchema: schema({
      ...workspaceProp,
      item_id: { type: "string" },
      text: { type: "string" },
    }, ["workspace_id", "item_id", "text"]),
  },
  {
    name: "bulk_update",
    description: "Update up to 100 items. dry_run returns the diff and writes nothing. Any invalid row writes nothing.",
    inputSchema: schema({
      ...workspaceProp,
      dry_run: { type: "boolean" },
      items: { type: "array", items: { type: "object" } },
    }, ["workspace_id", "items"]),
  },
  {
    name: "delete_item",
    description: "Soft-delete an item that has no children. It stays recoverable for 30 days.",
    inputSchema: schema({ ...workspaceProp, item_id: { type: "string" } }, ["workspace_id", "item_id"]),
  },
];

export async function executeTool(repo, token, name, args, now = Date.now()) {
  const run = TOOL_RUNNERS[name];
  if (!run) throw new McpError("unknown_tool", `Unknown tool: ${name}`, 404);
  if (name !== "list_workspaces") {
    await requireWorkspace(repo, token, args?.workspace_id);
  }
  return run(repo, token, args || {}, now);
}

function bearer(authorization) {
  const header = text(authorization);
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

export async function authenticateMcp(repo, authorization, now = Date.now()) {
  const secret = bearer(authorization);
  if (!secret) throw new McpError("unauthorized", "Send the API token in Authorization: Bearer.", 401);
  const hash = await sha256Hex(secret);
  const token = await repo.getTokenByHash(hash);
  if (!token || token.tokenHash !== hash) {
    throw new McpError("invalid_token", "This API token is not valid.", 401);
  }
  if (token.revokedAt) throw new McpError("token_revoked", "This API token was revoked.", 401);
  if (token.expiresAt && Date.parse(token.expiresAt) <= now) {
    throw new McpError("token_expired", "This API token has expired.", 401);
  }
  const start = Number(token.rateWindowStart || 0);
  const count = Number(token.rateCount || 0);
  let patch;
  if (!start || now - start >= RATE_WINDOW_MS) {
    patch = { rateWindowStart: now, rateCount: 1, lastUsedAt: new Date(now).toISOString() };
  } else if (count >= RATE_LIMIT) {
    throw new McpError("rate_limited", `This token is limited to ${RATE_LIMIT} requests per minute.`, 429);
  } else {
    patch = { rateWindowStart: start, rateCount: count + 1, lastUsedAt: new Date(now).toISOString() };
  }
  await repo.patchToken(token.id, patch);
  const remaining = RATE_LIMIT - patch.rateCount;
  return { token: { ...token, ...patch }, remaining };
}

function rpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data } };
}

function wantsSse(accept) {
  return text(accept).includes("text/event-stream");
}

function pack(status, payload, accept, extra = {}) {
  const headers = {
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    "cache-control": "no-store",
    ...extra,
  };
  if (payload == null) return { status, headers, body: "" };
  if (wantsSse(accept) && status === 200) {
    headers["content-type"] = "text/event-stream";
    return {
      status,
      headers,
      body: `event: message\ndata: ${JSON.stringify(payload)}\n\n`,
    };
  }
  headers["content-type"] = "application/json; charset=utf-8";
  return { status, headers, body: JSON.stringify(payload) };
}

async function dispatchMethod(repo, token, message, now) {
  const method = message.method;
  if (method === "initialize") {
    const requested = message.params?.protocolVersion;
    if (requested && !SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
      throw new McpError(
        "unsupported_protocol",
        `Unsupported protocol version. Use one of: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}.`,
        400,
      );
    }
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "Certo Work", version: "1.0.0" },
      instructions: "Pass workspace_id on every tool except list_workspaces. Never infer the workspace. Do not invent clients, deliveries, or tags.",
    };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools: MCP_TOOLS };
  if (method === "tools/call") {
    const name = text(message.params?.name);
    const args = message.params?.arguments || {};
    try {
      const data = await executeTool(repo, token, name, args, now);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
        isError: false,
      };
    } catch (error) {
      const body = {
        code: error.code || "tool_error",
        message: error.message || "The tool failed.",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(body) }],
        structuredContent: body,
        isError: true,
      };
    }
  }
  throw new McpError("method_not_found", `Unknown method: ${method}`, 404);
}

export async function handleMcpHttp({ repo, method, authorization, accept, body, now = Date.now() }) {
  const verb = text(method).toUpperCase();
  if (verb === "OPTIONS") return { status: 204, headers: { allow: "POST, OPTIONS" }, body: "" };
  if (verb === "GET" || verb === "DELETE") {
    return pack(405, {
      code: "method_not_allowed",
      message: "Send JSON-RPC with POST. This server does not keep a server-initiated stream.",
    }, "application/json", { allow: "POST, OPTIONS" });
  }
  if (verb !== "POST") {
    return pack(405, { code: "method_not_allowed", message: "Use POST." }, accept, { allow: "POST, OPTIONS" });
  }
  if (Array.isArray(body)) {
    return pack(400, { code: "invalid_request", message: "JSON-RPC batches are not accepted." }, accept);
  }
  let session;
  try {
    session = await authenticateMcp(repo, authorization, now);
  } catch (error) {
    const status = error.status || 401;
    const payload = body && typeof body === "object" && body.id != null
      ? rpcError(body.id, status === 429 ? -32029 : -32001, error.message, { code: error.code, message: error.message })
      : { code: error.code || "unauthorized", message: error.message };
    return pack(status, payload, accept, status === 429 ? { "retry-after": "60" } : {
      "www-authenticate": `Bearer realm="certo-mcp", error="${error.code || "invalid_token"}"`,
    });
  }
  const rateHeaders = {
    "ratelimit-limit": String(RATE_LIMIT),
    "ratelimit-remaining": String(Math.max(session.remaining, 0)),
  };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return pack(400, { code: "parse_error", message: "Body must be one JSON-RPC object." }, accept, rateHeaders);
  }
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return pack(400, rpcError(body.id, -32600, "Invalid Request"), accept, rateHeaders);
  }
  if (body.id == null && body.method.startsWith("notifications/")) {
    return { status: 202, headers: { ...rateHeaders, "mcp-protocol-version": MCP_PROTOCOL_VERSION }, body: "" };
  }
  try {
    const result = await dispatchMethod(repo, session.token, body, now);
    return pack(200, { jsonrpc: "2.0", id: body.id ?? null, result }, accept, rateHeaders);
  } catch (error) {
    const status = error instanceof McpError ? error.status : 500;
    const code = error instanceof McpError && error.code === "method_not_found" ? -32601 : -32603;
    return pack(status, rpcError(body.id, code, error.message, { code: error.code || "internal", message: error.message }), accept, rateHeaders);
  }
}

export async function issueToken(repo, user, input, now = Date.now()) {
  const name = text(input?.name);
  if (!name || name.length > 80) {
    throw new McpError("invalid_name", "Give the token a name up to 80 characters.", 400);
  }
  const workspaceIds = [...new Set((input?.workspaceIds || []).map((id) => text(id)).filter(Boolean))];
  if (!workspaceIds.length || workspaceIds.length > 20) {
    throw new McpError("workspace_required", "Choose one or more workspaces for this token.", 400);
  }
  for (const workspaceId of workspaceIds) {
    const allowed = await repo.userCanAccess(user.uid, workspaceId);
    if (!allowed) {
      throw new McpError("workspace_forbidden", `You cannot grant access to workspace ${workspaceId}.`, 403);
    }
  }
  const permission = input?.permission === "read-write" || input?.permission === "read" ? input.permission : "";
  if (!permission) throw new McpError("invalid_permission", "Permission must be read or read-write.", 400);
  if (input?.assign && permission !== "read-write") {
    throw new McpError("assign_requires_write", "The assign permission requires read-write.", 400);
  }
  const days = Number(input?.expiresInDays ?? 90);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new McpError("invalid_expiry", "Expiration must be between 1 and 365 days.", 400);
  }
  const secret = randomToken();
  const record = {
    id: createId("pat"),
    name,
    tokenHash: await sha256Hex(secret),
    tokenPrefix: secret.slice(0, 12),
    userId: user.uid,
    workspaceIds,
    permission,
    assign: Boolean(input?.assign),
    expiresAt: new Date(now + days * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
    createdAt: new Date(now).toISOString(),
    lastUsedAt: null,
    rateWindowStart: 0,
    rateCount: 0,
  };
  await repo.saveToken(record);
  await repo.writeAudit({
    id: createId("aud"),
    action: "token.create",
    tokenId: record.id,
    tokenName: name,
    userId: user.uid,
    at: record.createdAt,
    before: null,
    after: { workspaceIds, permission, assign: record.assign, expiresAt: record.expiresAt },
  });
  return { token: secret, access_token: secret, ...publicToken(record) };
}

export async function listTokenRecords(repo, user) {
  const rows = await repo.listTokens(user.uid);
  return rows.map(publicToken);
}

export async function revokeToken(repo, user, tokenId, now = Date.now()) {
  const rows = await repo.listTokens(user.uid);
  const token = rows.find((row) => row.id === tokenId);
  if (!token || token.userId !== user.uid) throw new McpError("not_found", "Token not found.", 404);
  if (token.revokedAt) return publicToken(token);
  const revokedAt = new Date(now).toISOString();
  await repo.patchToken(token.id, { revokedAt });
  await repo.writeAudit({
    id: createId("aud"),
    action: "token.revoke",
    tokenId: token.id,
    tokenName: token.name,
    userId: user.uid,
    at: revokedAt,
    before: { revokedAt: null },
    after: { revokedAt },
  });
  return publicToken({ ...token, revokedAt });
}

export async function handleMcpAdmin({ repo, method, path, body, user, now = Date.now() }) {
  if (!user?.uid) throw new McpError("unauthorized", "Sign in to manage API tokens.", 401);
  const verb = text(method).toUpperCase();
  if (verb === "GET" && path === "/api/mcp/tokens") {
    return { status: 200, body: { tokens: await listTokenRecords(repo, user) } };
  }
  if (verb === "POST" && path === "/api/mcp/tokens") {
    return { status: 201, body: await issueToken(repo, user, body || {}, now) };
  }
  const revoke = String(path || "").match(/^\/api\/mcp\/tokens\/([^/]+)\/revoke$/);
  if (verb === "POST" && revoke) {
    const token = await revokeToken(repo, user, decodeURIComponent(revoke[1]), now);
    return { status: 200, body: { token } };
  }
  return { status: 404, body: { code: "not_found", message: "Unknown token route." } };
}

export function createMemoryMcpRepo() {
  const state = {
    tokens: [],
    items: [],
    audits: [],
    workspaces: [],
    categories: [],
    members: [],
  };
  return {
    state,
    async getTokenByHash(hash) {
      return state.tokens.find((token) => token.tokenHash === hash) || null;
    },
    async listTokens(userId) {
      return state.tokens.filter((token) => token.userId === userId);
    },
    async saveToken(record) {
      const index = state.tokens.findIndex((token) => token.id === record.id);
      if (index >= 0) state.tokens[index] = record;
      else state.tokens.push(record);
    },
    async patchToken(id, patch) {
      const token = state.tokens.find((row) => row.id === id);
      if (!token) throw new McpError("not_found", "Token not found.", 404);
      Object.assign(token, patch);
    },
    async userCanAccess(userId, workspaceId) {
      const workspace = state.workspaces.find((row) => row.id === workspaceId);
      if (!workspace) return false;
      if (workspace.ownerId === userId) return true;
      return state.members.some((member) => {
        const status = text(member.status || "active").toLowerCase();
        return member.workspaceId === workspaceId && member.userId === userId && (status === "active" || status === "accepted");
      });
    },
    async getWorkspace(workspaceId) {
      const workspace = state.workspaces.find((row) => row.id === workspaceId);
      return workspace ? { id: workspace.id, name: workspace.name || workspace.id } : null;
    },
    async listItems(workspaceId) {
      return state.items.filter((item) => item.workspaceId === workspaceId).slice(0, ITEM_FETCH_CAP);
    },
    async getItem(itemId) {
      return state.items.find((item) => item.id === itemId) || null;
    },
    async saveItem(item) {
      const index = state.items.findIndex((row) => row.id === item.id);
      if (index >= 0) state.items[index] = item;
      else state.items.push(item);
    },
    async writeAudit(event) {
      state.audits.push(event);
    },
    async loadCatalog(workspaceId, userId) {
      const categories = state.categories.filter((row) => {
        const rowWorkspace = text(row.workspaceId);
        if (rowWorkspace === workspaceId) return true;
        return !rowWorkspace && row.userId === userId;
      });
      const members = state.members.filter((member) => member.workspaceId === workspaceId);
      return { categories, members };
    },
  };
}
