export const PROJECT_STATUSES = [
  "idea",
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export const PROJECT_HEALTH = ["on_track", "at_risk", "blocked"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectHealth = (typeof PROJECT_HEALTH)[number];

function timestamp(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  return typeof value === "number" ? value : 0;
}

export function projectSortTime(project: any) {
  return timestamp(project?.updatedAt || project?.createdAt);
}

export function sortProjectsByRecency(projects: any[]) {
  return [...projects].sort((left, right) => projectSortTime(right) - projectSortTime(left));
}

export function isProjectFavorite(project: any) {
  return Boolean(project?.favorite || project?.isFavorite || project?.starred);
}

export function isProjectClosed(project: any) {
  return ["completed", "done", "closed", "archived", "cancelled", "deleted"].includes(
    String(project?.status || "").toLowerCase(),
  );
}

export function sidebarProjectGroups(projects: any[]) {
  const sorted = sortProjectsByRecency(projects).filter((project) => !isProjectClosed(project));
  const favorites = sorted.filter(isProjectFavorite).slice(0, 4);
  const favoriteIds = new Set(favorites.map((project) => project.id));
  const recent = sorted.filter((project) => !favoriteIds.has(project.id)).slice(0, 6);
  return { favorites, recent };
}

export function projectStatusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    idea: "Idea",
    planning: "Planning",
    active: "Active",
    in_progress: "Active",
    paused: "Paused",
    completed: "Completed",
    done: "Completed",
    archived: "Archived",
    deleted: "Deleted",
  };
  return labels[String(status || "planning").toLowerCase()] || "Planning";
}

export function projectHealth(project: any, projectTasks: any[] = [], projectRisks: any[] = []): ProjectHealth {
  const explicit = String(project?.healthOverride || (!project?.importedFrom ? project?.health || project?.healthStatus : "") || "").toLowerCase();
  if (explicit === "blocked") return "blocked";
  if (["at_risk", "at risk", "risk"].includes(explicit)) return "at_risk";
  if (["on_track", "on track", "healthy"].includes(explicit)) return "on_track";
  if (projectTasks.some((task) => String(task.status || "").toLowerCase() === "blocked")) return "blocked";
  const openRisks = projectRisks.filter((risk) => !["closed", "resolved", "accepted"].includes(String(risk.status || "open").toLowerCase()));
  if (openRisks.some((risk) => String(risk.severity || "medium").toLowerCase() === "critical")) return "blocked";
  if (openRisks.length) {
    return "at_risk";
  }
  const dueValue = project?.revisedDueDate || project?.dueDate || project?.targetDate || project?.originalDueDate;
  const dueTime = typeof dueValue === "string" ? Date.parse(dueValue) : dueValue?.toMillis?.() || (dueValue?.seconds ? dueValue.seconds * 1000 : 0);
  if (dueTime && dueTime < Date.now() && !["completed", "done", "closed", "archived", "cancelled", "deleted"].includes(String(project?.status || "").toLowerCase())) return "at_risk";
  return "on_track";
}

export function projectHealthLabel(health: ProjectHealth) {
  return health === "blocked" ? "Blocked" : health === "at_risk" ? "At risk" : "On track";
}

export type WorkLane = "backlog" | "in_progress" | "blocked" | "done";

export function taskWorkLane(task: any): WorkLane {
  const status = String(task?.status || "open").toLowerCase();
  if (["done", "completed", "closed", "cancelled"].includes(status)) return "done";
  if (["blocked", "waiting"].includes(status)) return "blocked";
  if (["in_progress", "in_review", "active", "doing"].includes(status)) return "in_progress";
  return "backlog";
}
