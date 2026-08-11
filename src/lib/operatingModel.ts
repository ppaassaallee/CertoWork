export type ActionBoardPhase = "capture" | "clarify" | "organize" | "execute" | "review";

export type TimeSectorId =
  | "today"
  | "this_week"
  | "next_week"
  | "this_month"
  | "next_month"
  | "later"
  | "someday";

export const ACTION_BOARD_LIFECYCLE: Array<{
  id: ActionBoardPhase;
  label: string;
  purpose: string;
  systemQuestion: string;
}> = [
  {
    id: "capture",
    label: "Capture",
    purpose: "Capture without interrupting flow.",
    systemQuestion: "What is this, in the user's words?",
  },
  {
    id: "clarify",
    label: "Clarify",
    purpose: "Decide whether the item is actionable and what the next visible action is.",
    systemQuestion: "Is this actionable, and what is the next action?",
  },
  {
    id: "organize",
    label: "Organize",
    purpose: "Place the item in the right time sector, owner, context, project, or reference area.",
    systemQuestion: "When should this receive attention?",
  },
  {
    id: "execute",
    label: "Execute",
    purpose: "Execute only the work selected for today or the active planning session.",
    systemQuestion: "What should move now, without overloading the day?",
  },
  {
    id: "review",
    label: "Review",
    purpose: "Review stuck, completed, postponed, or unclear work and update the system.",
    systemQuestion: "What changed, what is stale, and what should be moved?",
  },
];

export const TIME_SECTOR_MODEL: Array<{
  id: TimeSectorId;
  label: string;
  description: string;
}> = [
  { id: "today", label: "Today", description: "Visible in daily execution and eligible for 2+8 planning." },
  { id: "this_week", label: "This week", description: "Needs attention in the next seven days but not necessarily today." },
  { id: "next_week", label: "Next week", description: "Parked for the next weekly plan." },
  { id: "this_month", label: "This month", description: "Important soon, but outside the current weekly execution window." },
  { id: "next_month", label: "Next month", description: "Future planned work that should not create daily noise yet." },
  { id: "later", label: "Later", description: "Valid but intentionally deferred." },
  { id: "someday", label: "Someday", description: "Maybe/idea work; not a commitment." },
];

function normalized(value: unknown) {
  return String(value || "").toLowerCase().trim().replace(/\s+/g, "_");
}

function hasActionableShape(item: any) {
  const title = String(item?.title || item?.name || "").trim();
  const type = normalized(item?.itemType || item?.workItemType || item?.type);
  if (!title) return false;
  if (["reference", "note", "document", "idea"].includes(type)) return false;
  return true;
}

export function normalizeTimeSector(value: unknown): TimeSectorId | null {
  const sector = normalized(value);
  if (["today", "do_today"].includes(sector)) return "today";
  if (["this_week", "week", "current_week"].includes(sector)) return "this_week";
  if (["next_week"].includes(sector)) return "next_week";
  if (["this_month", "month", "current_month"].includes(sector)) return "this_month";
  if (["next_month"].includes(sector)) return "next_month";
  if (["later", "deferred"].includes(sector)) return "later";
  if (["someday", "maybe"].includes(sector)) return "someday";
  return null;
}

export function operatingStateForItem(item: any): {
  phase: ActionBoardPhase;
  timeSector: TimeSectorId | null;
  needsClarification: boolean;
  nextSystemPrompt: string;
} {
  const status = normalized(item?.status);
  const stage = normalized(item?.stageId);
  const folder = normalized(item?.globalStageId);
  const itemType = normalized(item?.itemType || item?.type || item?.workItemType);
  const timeSector = normalizeTimeSector(item?.timeSector || item?.proposed?.timeSector || item?.occurrenceDate && "today");

  if (status === "done" || stage === "done") {
    return {
      phase: "review",
      timeSector,
      needsClarification: false,
      nextSystemPrompt: "Record completion evidence, learnings, or whether follow-up is required.",
    };
  }

  if (itemType === "reference") {
    return {
      phase: "organize",
      timeSector: null,
      needsClarification: false,
      nextSystemPrompt: "File as knowledge/reference and keep it out of execution lists.",
    };
  }

  if (!hasActionableShape(item) || folder === "inbox" || stage === "capture") {
    return {
      phase: "clarify",
      timeSector,
      needsClarification: true,
      nextSystemPrompt: "Clarify the desired outcome, next physical action, owner, and time sector.",
    };
  }

  if (folder === "waiting" || itemType === "waiting_for") {
    return {
      phase: "organize",
      timeSector,
      needsClarification: false,
      nextSystemPrompt: "Track the owner and review date; do not show as personal execution work.",
    };
  }

  if (folder === "someday" || itemType === "someday" || timeSector === "someday") {
    return {
      phase: "organize",
      timeSector: "someday",
      needsClarification: false,
      nextSystemPrompt: "Keep as maybe/later; revisit during weekly or monthly review.",
    };
  }

  if (timeSector === "today" || Boolean(item?.isOneThing)) {
    return {
      phase: "execute",
      timeSector: "today",
      needsClarification: false,
      nextSystemPrompt: "Decide whether it is one of today's 2 must-dos, a should-do, or a could-do.",
    };
  }

  return {
    phase: timeSector ? "organize" : "clarify",
    timeSector,
    needsClarification: !timeSector,
    nextSystemPrompt: timeSector
      ? "Keep it out of Today until its time sector becomes active."
      : "Assign a time sector before it competes for attention.",
  };
}

export function summarizeOperatingModel(items: any[]) {
  const states = items.map(operatingStateForItem);
  return {
    captureOrClarify: states.filter((state) => state.phase === "capture" || state.needsClarification).length,
    today: states.filter((state) => state.phase === "execute").length,
    waiting: items.filter((item) => normalized(item?.globalStageId) === "waiting" || normalized(item?.itemType) === "waiting_for").length,
    someday: states.filter((state) => state.timeSector === "someday").length,
    review: states.filter((state) => state.phase === "review").length,
  };
}
