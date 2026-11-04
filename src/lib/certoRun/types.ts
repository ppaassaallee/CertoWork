import type { Decision, Health, ItemState, ItemType, Lane, OutcomeKind, Priority } from "./vocab";

export interface Outcome {
  kind: OutcomeKind;
  reason?: string;
  at?: string;
  by?: string;
  ts?: number;
  owner?: string;
  date?: string;
  mode?: "captain" | "propose";
  context?: string;
}

export interface Delegation {
  to: string;
  mode: "captain" | "propose";
  context: string;
  date?: string;
}

export interface DeskItem {
  id: string;
  externalId: string;
  instanceId?: string;
  workspaceId: string;
  world: string;
  type: ItemType;
  parentId?: string;
  epicId?: string;
  featureId?: string;
  lane: Lane;
  decision: Decision;
  priority: Priority;
  title: string;
  context?: string;
  deliverable?: string;
  doneWhen?: string;
  nextStep?: string;
  source?: string;
  epic: string;
  feature: string;
  clientEntity?: string;
  tags: string[];
  assigneeUid?: string;
  assigneeName?: string;
  requesterUid?: string;
  createdBy?: string;
  dueDate?: string;
  queueOrder: number | null;
  created?: string;
  state: ItemState;
  outcome?: Outcome;
  delegation?: Delegation;
  needsWorldReview?: boolean;
  pinnedAt?: number;
  postponedAt?: number;
  /** Open work that has no Certo Run decision yet. Still counts as open. */
  inQueue?: boolean;
}

export interface Viewer {
  uid: string;
  displayName?: string;
  /** Workspace lead sees the whole desk, matching the prototype counts. */
  lead?: boolean;
}

export interface ImportItem {
  external_id: string;
  workspace: string;
  world: string;
  lane: Lane;
  decision: Decision;
  priority: Priority;
  epic: string;
  feature: string;
  title: string;
  context?: string;
  deliverable?: string;
  done_when?: string;
  next_step?: string;
  source?: string;
  owner?: string;
  due_date?: string;
  client_entity?: string;
  tags?: string[];
  queue_order?: number | null;
  created?: string;
  previous_title?: string;
  needs_world_review?: boolean;
}

export interface ImportProject {
  workspace: string;
  world: string;
  epic: string;
  client_entity?: string;
  lane: Lane;
  pipeline_stage?: string | null;
  health?: Health | null;
  features?: string[];
  team?: string[];
  next_due?: string;
}

export interface ImportWorkspace {
  id: string;
  name: string;
  kind: "shared" | "private";
  color: string;
  clients?: string[];
}

export interface ProjectHealth {
  epic: string;
  light: Health | "";
  note: string;
}

export const UNASSIGNED = "Unassigned";

const NO_OWNER = /^(alejandro|unassigned|por asignar|sin|no )/i;

export function isOpen(item: DeskItem): boolean {
  if (item.state !== "open") return false;
  if (!item.outcome) return true;
  return item.outcome.kind === "postponed" || item.outcome.kind === "pinned" || item.outcome.kind === "delegated" || item.outcome.kind === "renegotiated";
}

/** Review items stay in the workspace but out of open counts and queues. */
export function countsOpen(item: DeskItem): boolean {
  return isOpen(item) && !item.needsWorldReview && item.type !== "epic" && item.type !== "feature";
}

export function inWorkspace(item: DeskItem, workspace: string): boolean {
  return item.workspaceId === workspace || item.world === workspace;
}

export function isDelegatedOutcome(item: DeskItem): boolean {
  return item.outcome?.kind === "delegated";
}

export function notDelegated(item: DeskItem): boolean {
  return !isDelegatedOutcome(item);
}

export function ownerName(item: DeskItem): string {
  return (item.outcome?.owner || item.delegation?.to || item.assigneeName || "").trim();
}

export function noOwner(item: DeskItem): boolean {
  const name = ownerName(item);
  return !name || name === UNASSIGNED || name === "Por asignar" || name === "Alejandro";
}

export function dueOf(item: DeskItem): string {
  return item.outcome?.date || item.delegation?.date || item.dueDate || "";
}

export function isLate(item: DeskItem, today: string): boolean {
  const due = dueOf(item);
  return Boolean(due) && due < today;
}

export function mine(item: DeskItem, viewer: Viewer): boolean {
  if (viewer.lead) return true;
  if (item.assigneeUid && item.assigneeUid === viewer.uid) return true;
  if (!item.assigneeUid && item.assigneeName && viewer.displayName && item.assigneeName === viewer.displayName) return true;
  if (!item.assigneeName && item.createdBy === viewer.uid) return true;
  if (item.requesterUid === viewer.uid) return true;
  return false;
}

export function isPersonName(name: string): boolean {
  const trimmed = name.trim();
  return Boolean(trimmed) && !NO_OWNER.test(trimmed) && trimmed.length < 40;
}

export function fromImportItem(raw: ImportItem, instanceId = "pascual"): DeskItem {
  const tags = [...(raw.tags ?? [])];
  if (raw.needs_world_review && !tags.includes("needs-world-review")) tags.push("needs-world-review");
  return {
    id: raw.external_id,
    externalId: raw.external_id,
    instanceId,
    workspaceId: raw.workspace,
    world: raw.world,
    type: "pbi",
    lane: raw.lane,
    decision: raw.decision,
    priority: raw.priority,
    title: raw.title,
    context: raw.context,
    deliverable: raw.deliverable,
    doneWhen: raw.done_when,
    nextStep: raw.next_step,
    source: raw.source,
    epic: raw.epic,
    feature: raw.feature,
    clientEntity: raw.client_entity,
    tags,
    assigneeName: raw.owner || "",
    dueDate: raw.due_date || "",
    queueOrder: raw.queue_order ?? null,
    created: raw.created,
    state: "open",
    needsWorldReview: Boolean(raw.needs_world_review),
  };
}
