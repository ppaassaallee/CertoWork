export type ProjectTab = "overview" | "notes" | "tasks" | "strategy";
export type MoreSection =
  | "automations"
  | "updates"
  | "habits"
  | "workouts"
  | "warroom"
  | "knowledge"
  | "workspace";
export type MyWorkSection = "assigned" | "inbox" | "waiting";
export type AgentsSection = "home" | "automations" | "activity";

export type FeedbackSection = "submit" | "queue";

export type DelivereeLens =
  | { kind: "home" }
  | { kind: "my-work"; section: MyWorkSection }
  | { kind: "work"; section: "portfolio" | "issues" | "intake" }
  | { kind: "agents"; section: AgentsSection }
  | { kind: "project"; projectId: string; tab: ProjectTab }
  | { kind: "approvals" }
  | { kind: "invoices" }
  | { kind: "settings" }
  | { kind: "feedback"; section: FeedbackSection; intent?: "bug" | "feature" }
  | { kind: "more"; section: MoreSection };

const MORE_SECTIONS: MoreSection[] = [
  "automations",
  "updates",
  "habits",
  "workouts",
  "warroom",
  "knowledge",
  "workspace",
];

export function resolveDelivereeLens(pathname: string): DelivereeLens {
  const path = pathname.replace(/\/+$/, "") || "/";

  const projectMatch = path.match(
    /^\/(?:work\/)?projects\/([^/]+)(?:\/(notes|tasks|strategy|overview))?$/,
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

  if (path === "/invoices" || path === "/finance" || path === "/workspace/invoices") {
    return { kind: "invoices" };
  }

  if (
    path === "/workspace/feedback" ||
    path === "/feedback/queue" ||
    path === "/workspace/bugs"
  ) {
    return { kind: "feedback", section: "queue" };
  }

  if (path === "/report-bug") {
    return { kind: "feedback", section: "submit", intent: "bug" };
  }

  if (path === "/feature-request") {
    return { kind: "feedback", section: "submit", intent: "feature" };
  }

  if (path === "/feedback") {
    return { kind: "feedback", section: "submit" };
  }

  if (path === "/workspace" || path === "/more/workspace") {
    return { kind: "more", section: "workspace" };
  }

  if (
    path === "/agents" ||
    path === "/agents/odysseus" ||
    path === "/work/agent-workspace"
  ) {
    return { kind: "agents", section: "home" };
  }
  if (
    path === "/agents/automations" ||
    path === "/skills" ||
    path === "/more/skills" ||
    path === "/more/automations"
  ) {
    return { kind: "agents", section: "automations" };
  }
  if (path === "/agents/activity" || path === "/digest" || path === "/more/updates") {
    return { kind: "agents", section: "activity" };
  }

  if (path === "/my-work" || path === "/my-work/assigned") {
    return { kind: "my-work", section: "assigned" };
  }
  if (path === "/my-work/inbox") {
    return { kind: "my-work", section: "inbox" };
  }
  if (path === "/my-work/waiting") {
    return { kind: "my-work", section: "waiting" };
  }

  if (path.startsWith("/more/")) {
    const section = path.slice("/more/".length) as MoreSection;
    if (MORE_SECTIONS.includes(section)) {
      if (section === "automations") return { kind: "agents", section: "automations" };
      if (section === "updates") return { kind: "agents", section: "activity" };
      return { kind: "more", section };
    }
  }

  if (
    path.startsWith("/capture") ||
    path === "/inbox" ||
    path === "/rich-capture"
  ) {
    return { kind: "my-work", section: "inbox" };
  }

  if (
    path.startsWith("/work/action-board") ||
    path === "/action-board" ||
    path.startsWith("/work/tasks")
  ) {
    return { kind: "my-work", section: "assigned" };
  }

  if (
    path === "/projects" ||
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
  if (lens.kind === "my-work") {
    if (lens.section === "inbox") return "/my-work/inbox";
    if (lens.section === "waiting") return "/my-work/waiting";
    return "/my-work";
  }
  if (lens.kind === "agents") {
    if (lens.section === "automations") return "/agents/automations";
    if (lens.section === "activity") return "/agents/activity";
    return "/agents";
  }
  if (lens.kind === "work") {
    if (lens.section === "issues") return "/my-work";
    if (lens.section === "intake") return "/my-work/inbox";
    return "/projects";
  }
  if (lens.kind === "project") {
    const base = `/work/projects/${encodeURIComponent(lens.projectId)}`;
    if (lens.tab === "overview") return base;
    return `${base}/${lens.tab}`;
  }
  if (lens.kind === "approvals") return "/approvals";
  if (lens.kind === "invoices") return "/invoices";
  if (lens.kind === "settings") return "/settings";
  if (lens.kind === "feedback") {
    return lens.section === "queue" ? "/workspace/feedback" : "/feedback";
  }
  if (lens.kind === "more") {
    if (lens.section === "workspace") return "/workspace";
    return `/more/${lens.section}`;
  }
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
    create_odiseus_memory: "Remember fact",
  };
  return labels[String(type || "")] || String(type || "Review change").replace(/_/g, " ");
}
