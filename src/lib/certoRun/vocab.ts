export const LANES = ["commercial", "projects", "admin", "personal"] as const;
export type Lane = (typeof LANES)[number];

export const DECISIONS = ["make", "decide", "delegate", "follow_up", "admin_batch"] as const;
export type Decision = (typeof DECISIONS)[number];

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ITEM_TYPES = ["epic", "feature", "pbi", "task", "subtask"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATES = ["open", "done", "archived"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export const OUTCOME_KINDS = [
  "done",
  "yes",
  "no",
  "dropped",
  "delegated",
  "renegotiated",
  "postponed",
  "pinned",
] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export const OPEN_OUTCOMES: readonly OutcomeKind[] = [
  "postponed",
  "pinned",
  "delegated",
  "renegotiated",
];

export const STAGES = [
  "Discovery",
  "Proposal and pricing",
  "Negotiation and contract",
  "Closing and kickoff",
] as const;
export type Stage = (typeof STAGES)[number];

export const HEALTH = ["green", "amber", "red"] as const;
export type Health = (typeof HEALTH)[number];

export const PRICING_MODELS = [
  "Fixed monthly",
  "Hourly",
  "Per FTE",
  "Per transaction",
  "Per outcome",
  "Gain-share",
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const BILLING_STATUSES = ["To invoice", "Invoiced", "Collected"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const RELATIONS = ["wife", "kid", "family", "friend"] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_CADENCE: Record<Relation, number> = {
  wife: 7,
  kid: 7,
  family: 21,
  friend: 30,
};

export const MOOD_KEYS = ["short_night", "stuck", "scattered", "low_energy", "ready"] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];

export const DROP_REASONS = [
  "Already passed",
  "Already resolved",
  "Adds nothing",
  "Duplicate",
] as const;
export type DropReason = (typeof DROP_REASONS)[number];

export const INSTANCE_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type InstanceRole = (typeof INSTANCE_ROLES)[number];

export const WORKSPACE_ROLES = ["lead", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const SCOPES = ["read", "propose", "write", "assign", "delete", "admin"] as const;
export type Scope = (typeof SCOPES)[number];

export const CURRENCIES = ["USD", "GTQ"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const SPECIAL_ALLOCATIONS = ["Internal or presales", "Time off"] as const;

export const SPLIT_CLIENTS = [
  "Cementos Progreso",
  "Credichapin",
  "Klap",
  "Menzis",
  "PYP",
  "Tecalis",
] as const;

export const LANE_LABEL: Record<Lane, string> = {
  commercial: "Commercial",
  projects: "Projects",
  admin: "Admin",
  personal: "Personal",
};

export const DECISION_LABEL: Record<Decision, string> = {
  make: "Make",
  decide: "Decide",
  delegate: "Delegate",
  follow_up: "Follow-up",
  admin_batch: "Admin batch",
};

export const WORLD_ORDER = ["Pure AI", "Boldr AI"] as const;

/** Certo Run worlds. These are not Certo Work workspaces. */
export const RUN_WORLDS = ["Pure AI", "Boldr AI", "Personal"] as const;
export type RunWorld = (typeof RUN_WORLDS)[number];

export function isRunWorld(value: string): value is RunWorld {
  return (RUN_WORLDS as readonly string[]).includes(value);
}

export const AGENTS = {
  "Pure AI": { ops: "Lucy", crm: "Sales Enablement", cal: "OneSource and Allied Global" },
  "Boldr AI": { ops: "Lucy", crm: "Sales Enablement", cal: "Boldr AI" },
  Personal: { ops: "Lucy", coach: "Micah", cal: "personal" },
} as const;

export type WorldName = keyof typeof AGENTS;

export function isLane(value: string): value is Lane {
  return (LANES as readonly string[]).includes(value);
}

export function isDecision(value: string): value is Decision {
  return (DECISIONS as readonly string[]).includes(value);
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}
