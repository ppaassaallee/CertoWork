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

export function projectCheckpointDate(project: any) {
  return (
    String(
      project?.revisedDueDate ||
        project?.dueDate ||
        project?.targetDate ||
        project?.originalDueDate ||
        "",
    ).slice(0, 10) || ""
  );
}

/** Local calendar YYYY-MM-DD for date-only comparisons. */
export function todayIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Human checkpoint label: "Apr 30 · in 21 days" / "Apr 30 · today" / "Apr 30 · 3 days ago".
 * Past dates are flagged via `overdue` for red styling.
 */
export function formatCheckpointLabel(isoDate: string, now = new Date()) {
  const raw = String(isoDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { text: "No date", overdue: false, relative: "" };
  }
  const [year, month, day] = raw.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deltaDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const short = target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (deltaDays === 0) return { text: `${short} · today`, overdue: false, relative: "today" };
  if (deltaDays > 0) {
    return {
      text: `${short} · in ${deltaDays} day${deltaDays === 1 ? "" : "s"}`,
      overdue: false,
      relative: `in ${deltaDays} day${deltaDays === 1 ? "" : "s"}`,
    };
  }
  const ago = Math.abs(deltaDays);
  return {
    text: `${short} · ${ago} day${ago === 1 ? "" : "s"} ago`,
    overdue: true,
    relative: `${ago} day${ago === 1 ? "" : "s"} ago`,
  };
}

/**
 * Upcoming checkpoints for the Projects home.
 * Only open projects with a checkpoint date on or after today.
 * Past dates never appear here — they surface via health / attention.
 */
export function upcomingProjectCheckpoints(
  projects: any[],
  limit = 8,
  now = new Date(),
) {
  const today = todayIsoDate(now);
  return [...projects]
    .filter((project) => {
      if (isProjectClosed(project)) return false;
      const date = projectCheckpointDate(project);
      return Boolean(date) && date >= today;
    })
    .sort((left, right) =>
      projectCheckpointDate(left).localeCompare(projectCheckpointDate(right)),
    )
    .slice(0, Math.max(0, limit));
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

/** Same definition as portfolio health: open projects that are not on track. */
export function projectNeedsAttention(
  project: any,
  projectTasks: any[] = [],
  projectRisks: any[] = [],
) {
  if (isProjectClosed(project)) return false;
  return projectHealth(project, projectTasks, projectRisks) !== "on_track";
}

export function projectAttentionReason(
  project: any,
  projectTasks: any[] = [],
  projectRisks: any[] = [],
) {
  const blockedCount = projectTasks.filter(
    (task) => String(task.status || "").toLowerCase() === "blocked",
  ).length;
  if (blockedCount) {
    return `${blockedCount} blocked item${blockedCount === 1 ? "" : "s"}`;
  }
  const openRisks = projectRisks.filter(
    (risk) =>
      !["closed", "resolved", "accepted"].includes(
        String(risk.status || "open").toLowerCase(),
      ),
  );
  if (openRisks.some((risk) => String(risk.severity || "").toLowerCase() === "critical")) {
    return "Critical open risk";
  }
  if (openRisks.length) {
    return `${openRisks.length} open risk${openRisks.length === 1 ? "" : "s"}`;
  }
  const date = projectCheckpointDate(project);
  if (date && date < todayIsoDate()) {
    return "Overdue checkpoint";
  }
  const explicit = String(
    project?.healthOverride ||
      (!project?.importedFrom ? project?.health || project?.healthStatus : "") ||
      "",
  ).toLowerCase();
  if (explicit === "blocked") return "Marked blocked";
  if (["at_risk", "at risk", "risk"].includes(explicit)) return "Marked at risk";
  return projectHealthLabel(projectHealth(project, projectTasks, projectRisks));
}

export function projectOwnerLabel(project: any) {
  return (
    String(
      project?.projectManager ||
        project?.owner ||
        project?.scrumMaster ||
        "",
    ).trim() || "Unassigned"
  );
}

export type WorkLane = "backlog" | "in_progress" | "blocked" | "done";

export function taskWorkLane(task: any): WorkLane {
  const status = String(task?.status || "open").toLowerCase();
  if (["done", "completed", "closed", "cancelled"].includes(status)) return "done";
  if (["blocked", "waiting"].includes(status)) return "blocked";
  if (["in_progress", "in_review", "active", "doing"].includes(status)) return "in_progress";
  return "backlog";
}
