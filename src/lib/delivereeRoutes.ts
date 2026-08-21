export type ProjectTab = "overview" | "notes" | "tasks" | "strategy";
export type MoreSection =
  | "automations"
  | "updates"
  | "habits"
  | "workouts"
  | "warroom"
  | "knowledge"
  | "workspace";

export type DelivereeLens =
  | { kind: "home" }
  | { kind: "work"; section: "portfolio" | "issues" | "intake" }
  | { kind: "project"; projectId: string; tab: ProjectTab }
  | { kind: "approvals" }
  | { kind: "settings" }
  | { kind: "more"; section: MoreSection };

export function resolveDelivereeLens(pathname: string): DelivereeLens {
  const path = pathname.replace(/\/+$/, "") || "/";
  const projectMatch = path.match(
    /^\/work\/projects\/([^/]+)(?:\/(notes|tasks|strategy|overview))?$/,
  );
  if (projectMatch && projectMatch[1] !== "health") {
    const tab = (projectMatch[2] || "overview") as ProjectTab;
    const normalized: ProjectTab =
      tab === "notes" || tab === "tasks" || tab === "strategy" ? tab : "overview";
    return {
      kind: "project",
      projectId: decodeURIComponent(projectMatch[1]),
      tab: normalized,
    };
  }
  if (
    path === "/approvals" ||
    path.startsWith("/capture/review") ||
    path.startsWith("/review")
  ) {
    return { kind: "approvals" };
  }
  if (path.startsWith("/settings") || path.startsWith("/me")) {
    return { kind: "settings" };
  }
  if (path.startsWith("/more/")) {
    const section = path.slice("/more/".length) as MoreSection;
    if (
      ["automations", "updates", "habits", "workouts", "warroom", "knowledge", "workspace"].includes(
        section,
      )
    ) {
      return { kind: "more", section };
    }
  }
  if (path === "/skills" || path === "/more/skills") {
    return { kind: "more", section: "automations" };
  }
  if (path === "/digest") {
    return { kind: "more", section: "updates" };
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

export function lensToPath(lens: DelivereeLens) {
  if (lens.kind === "work") {
    if (lens.section === "issues") return "/work/tasks";
    if (lens.section === "intake") return "/capture";
    return "/work";
  }
  if (lens.kind === "project") {
    const base = `/work/projects/${encodeURIComponent(lens.projectId)}`;
    if (lens.tab === "overview") return base;
    return `${base}/${lens.tab}`;
  }
  if (lens.kind === "approvals") return "/approvals";
  if (lens.kind === "settings") return "/settings";
  if (lens.kind === "more") return `/more/${lens.section}`;
  return "/home";
}

export function normalizeDeliveryStage(value?: string | null) {
  const stage = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (
    [
      "idea",
      "assessment",
      "approved",
      "planning",
      "delivery",
      "uat",
      "production",
      "support",
      "archived",
    ].includes(stage)
  ) {
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
    update_project: "Update project",
    create_project_artifact: "Add project document",
    create_milestone: "Create milestone",
    update_milestone: "Update milestone",
    create_risk: "Record risk",
    update_risk: "Update risk",
    post_to_conversation: "Leave conversation handoff",
    create_decision: "Record decision",
    create_followup: "Create follow-up",
    outbox_communication: "Draft update",
    kill_or_archive: "Archive item",
  };
  return labels[String(type || "")] || String(type || "Review change").replace(/_/g, " ");
}
