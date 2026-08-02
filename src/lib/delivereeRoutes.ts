export type DelivereeLens =
  | { kind: "home" }
  | { kind: "work"; section: "portfolio" | "issues" | "intake" }
  | { kind: "project"; projectId: string }
  | { kind: "review" }
  | { kind: "settings" };

export function resolveDelivereeLens(pathname: string): DelivereeLens {
  const path = pathname.replace(/\/+$/, "") || "/";
  const projectMatch = path.match(/^\/work\/projects\/([^/]+)$/);
  if (projectMatch && projectMatch[1] !== "health") {
    return { kind: "project", projectId: decodeURIComponent(projectMatch[1]) };
  }
  if (path.startsWith("/capture/review") || path.startsWith("/review")) {
    return { kind: "review" };
  }
  if (path.startsWith("/settings") || path.startsWith("/me")) {
    return { kind: "settings" };
  }
  if (path.startsWith("/capture") || path === "/inbox" || path === "/rich-capture") {
    return { kind: "work", section: "intake" };
  }
  if (
    path.startsWith("/work/action-board") ||
    path === "/action-board" ||
    path.startsWith("/work/tasks")
  ) {
    return { kind: "work", section: "issues" };
  }
  if (
    path === "/work" ||
    path.startsWith("/work/projects") ||
    path.startsWith("/work/delivery-os") ||
    path === "/delivery-os" ||
    path === "/projects-deals" ||
    path === "/operations-hub"
  ) {
    return { kind: "work", section: "portfolio" };
  }
  return { kind: "home" };
}

export function normalizeDeliveryStage(value?: string | null) {
  const stage = String(value || "").toLowerCase().replace(/\s+/g, "_");
  if (["idea", "assessment", "approved", "planning", "delivery", "uat", "production", "support", "archived"].includes(stage)) {
    return stage;
  }
  if (["done", "completed", "closed"].includes(stage)) return "support";
  if (["active", "in_progress", "open"].includes(stage)) return "delivery";
  return "assessment";
}

export function projectHealth(project: Record<string, unknown>, openIssueCount = 0) {
  const explicit = String(project.health || "").toLowerCase();
  if (["blocked", "critical", "red"].includes(explicit)) return "blocked";
  if (["at_risk", "warning", "yellow"].includes(explicit)) return "at_risk";
  if (String(project.supportReadiness || "").toLowerCase() === "blocked") return "at_risk";
  if (openIssueCount > 12) return "at_risk";
  return "on_track";
}

export function actionLabel(type?: string) {
  const labels: Record<string, string> = {
    create_task: "Create task",
    update_task: "Update task",
    reschedule_task: "Reschedule task",
    create_project: "Create project",
    create_decision: "Record decision",
    create_followup: "Create follow-up",
    outbox_communication: "Draft update",
    kill_or_archive: "Archive item",
  };
  return labels[String(type || "")] || String(type || "Review change").replace(/_/g, " ");
}
