export type SprintStatus = "planning" | "active" | "completed";

export type SprintRecord = {
  id: string;
  projectId?: string;
  name?: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: SprintStatus | string;
  createdBy?: string;
};

export function sprintLabel(sprint?: SprintRecord | null) {
  return String(sprint?.name || "Sprint").trim() || "Sprint";
}

export function isSprintOpen(sprint?: SprintRecord | null) {
  return String(sprint?.status || "planning").toLowerCase() !== "completed";
}

export function itemMatchesSprint(item: { sprintId?: string | null }, sprintId: string) {
  if (sprintId === "all") return true;
  if (sprintId === "none") return !item.sprintId;
  return String(item.sprintId || "") === sprintId;
}
