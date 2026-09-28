import type { DelivereeLens } from "./delivereeRoutes";

/**
 * Route-scoped Firestore subscription packs.
 * Core shell (projects/tasks/conversations/members) stays hot; everything else
 * mounts only when the active lens needs it — cuts always-on listener fan-out.
 */
export type FirestoreListenPacks = {
  /** Stable key for effect deps (avoids restarting on unrelated lens field churn). */
  key: string;
  tables: boolean;
  tableRecords: boolean;
  itemMessages: boolean;
  odysseus: boolean;
  financeOps: boolean;
  strategyKnowledge: boolean;
  notes: boolean;
  review: boolean;
  templatesCategories: boolean;
  milestones: boolean;
  invites: boolean;
  /** Pending beta access_requests — owner settings only; prefer one-shot fetch. */
  accessRequests: boolean;
};

const OFF: Omit<FirestoreListenPacks, "key"> = {
  tables: false,
  tableRecords: false,
  itemMessages: false,
  odysseus: false,
  financeOps: false,
  strategyKnowledge: false,
  notes: false,
  review: false,
  templatesCategories: false,
  milestones: false,
  invites: false,
  accessRequests: false,
};

function packsKey(packs: Omit<FirestoreListenPacks, "key">): string {
  return Object.entries(packs)
    .filter(([, on]) => on)
    .map(([name]) => name)
    .sort()
    .join("|") || "core";
}

/** Which deferred Firestore packs the current route should subscribe to. */
export function resolveFirestoreListenPacks(lens: DelivereeLens): FirestoreListenPacks {
  const packs = { ...OFF };

  switch (lens.kind) {
    case "home":
    case "my-work":
    case "inbox":
      packs.tables = true;
      packs.tableRecords = true;
      packs.milestones = true;
      packs.review = lens.kind === "my-work" && lens.section === "reviews";
      break;
    case "work":
      // Portfolio / projects list: keep milestones + light metadata only.
      // table_records, finance ops, and strategy fan-out wait for project / tables routes.
      packs.tables = true;
      packs.milestones = true;
      packs.templatesCategories = true;
      break;
    case "project":
      packs.tables = true;
      packs.milestones = true;
      packs.templatesCategories = true;
      // Records only when the project needs table-backed surfaces; finance/strategy by tab.
      packs.tableRecords = lens.tab === "tasks" || lens.tab === "overview";
      packs.financeOps = lens.tab === "overview";
      packs.strategyKnowledge = lens.tab === "strategy" || lens.tab === "overview";
      if (lens.tab === "notes") packs.notes = true;
      break;
    case "workload":
    case "dashboard":
      packs.tables = true;
      packs.milestones = true;
      packs.financeOps = true;
      packs.templatesCategories = true;
      break;
    case "tables":
    case "tables-dashboard":
      packs.tables = true;
      packs.tableRecords = true;
      break;
    case "notes":
      packs.notes = true;
      packs.tables = true;
      break;
    case "requests":
      packs.itemMessages = true;
      packs.milestones = true;
      break;
    case "collab":
      break;
    case "agents":
    case "routines":
      packs.odysseus = true;
      packs.templatesCategories = true;
      break;
    case "invoices":
      packs.financeOps = true;
      break;
    case "approvals":
      packs.review = true;
      break;
    case "feedback":
      break;
    case "settings":
      packs.invites = true;
      packs.accessRequests = true;
      packs.templatesCategories = true;
      break;
    case "more":
      if (lens.section === "knowledge") packs.strategyKnowledge = true;
      if (lens.section === "workspace") {
        packs.invites = true;
        packs.accessRequests = true;
      }
      if (lens.section === "automations") packs.odysseus = true;
      break;
    default:
      break;
  }

  return { ...packs, key: packsKey(packs) };
}

/** Collab presence heartbeat — was 45s; stretch to cut steady writes. */
export const COLLAB_PRESENCE_HEARTBEAT_MS = 90_000;

/** Kanban board presence — was 20s; align with TTL-friendly cadence. */
export const KANBAN_PRESENCE_HEARTBEAT_MS = 45_000;

/** Notes autosave debounce — was 800ms. */
export const NOTES_AUTOSAVE_DEBOUNCE_MS = 2_500;
