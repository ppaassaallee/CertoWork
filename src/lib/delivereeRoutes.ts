export type ProjectTab = "overview" | "notes" | "tasks" | "strategy";
export type MoreSection =
  | "automations"
  | "updates"
  | "habits"
  | "workouts"
  | "warroom"
  | "knowledge"
  | "workspace";
export type MyWorkSection = "assigned" | "inbox" | "waiting" | "today" | "this_week" | "week" | "captured" | "reviews";
export type AgentsSection =
  | "home"
  | "automations"
  | "activity"
  | "builder"
  | "templates"
  | "usage";

export type FeedbackSection = "submit" | "queue";
export type RequestsSection = "inbox" | "mine" | "waiting" | "resolved" | "new";

export type DelivereeLens =
  | { kind: "home" }
  | { kind: "my-work"; section: MyWorkSection }
  | { kind: "work"; section: "portfolio" | "issues" | "intake" }
  | { kind: "agents"; section: AgentsSection; agentId?: string }
  | { kind: "routines"; routineId?: string; build?: boolean }
  | { kind: "project"; projectId: string; tab: ProjectTab }
  | { kind: "approvals" }
  | { kind: "invoices" }
  | { kind: "settings" }
  | { kind: "collab" }
  | { kind: "feedback"; section: FeedbackSection; intent?: "bug" | "feature" }
  | { kind: "requests"; section: RequestsSection }
  | { kind: "notes" }
  | { kind: "tables"; tableId?: string }
  | { kind: "tables-dashboard"; dashboardId: string }
  | { kind: "dashboard" }
  | { kind: "workload" }
  | { kind: "more"; section: MoreSection }
  | { kind: "inbox" };

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

  if (path === "/admin/members" || path === "/workspace/members") {
    return { kind: "settings" };
  }

  if (path.startsWith("/settings") || path.startsWith("/me")) {
    return { kind: "settings" };
  }

  if (path === "/collab" || path.startsWith("/collab/")) {
    return { kind: "collab" };
  }

  if (path === "/invoices" || path === "/workspace/invoices" || path === "/billing") {
    return { kind: "invoices" };
  }

  // /finance opens the portfolio Costs sheet (query handled in the shell).
  if (path === "/finance" || path === "/costs" || path === "/financials") {
    return { kind: "work", section: "portfolio" };
  }

  if (
    path === "/workspace/feedback" ||
    path === "/workspace/supportops" ||
    path === "/supportops/queue" ||
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

  if (path === "/feedback" || path === "/supportops") {
    return { kind: "feedback", section: "submit" };
  }

  if (path === "/workspace" || path === "/more/workspace") {
    return { kind: "more", section: "workspace" };
  }

  const routinesMatch = path.match(/^\/(?:rutinas|routines)\/([^/]+)(?:\/(build))?$/);
  if (routinesMatch) {
    return {
      kind: "routines",
      routineId: decodeURIComponent(routinesMatch[1]),
      build: routinesMatch[2] === "build",
    };
  }

  if (
    path === "/rutinas" ||
    path === "/routines" ||
    path === "/agents/automations" ||
    path === "/skills" ||
    path === "/more/skills" ||
    path === "/more/automations"
  ) {
    return { kind: "routines" };
  }
  if (path === "/agents/new") {
    return { kind: "agents", section: "builder", agentId: "new" };
  }
  if (path === "/agents/templates") {
    return { kind: "agents", section: "templates" };
  }
  if (path === "/agents/usage") {
    return { kind: "agents", section: "usage" };
  }
  const agentSetupMatch = path.match(/^\/agents\/([^/]+)\/setup$/);
  if (agentSetupMatch) {
    return {
      kind: "agents",
      section: "builder",
      agentId: decodeURIComponent(agentSetupMatch[1]),
    };
  }
  if (path === "/agents" || path === "/agents/odysseus" || path === "/work/agent-workspace") {
    return { kind: "agents", section: "home" };
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
  if (path === "/my-work/today") {
    return { kind: "my-work", section: "today" };
  }
  if (path === "/my-work/this-week") {
    return { kind: "my-work", section: "this_week" };
  }
  if (path === "/my-work/week" || path === "/my-work/semana") {
    return { kind: "my-work", section: "week" };
  }
  if (path === "/my-work/captured" || path === "/capture/inbox") {
    return { kind: "my-work", section: "captured" };
  }
  if (path === "/my-work/reviews" || path === "/my-work/revisiones") {
    return { kind: "my-work", section: "reviews" };
  }

  if (path === "/notes" || path.startsWith("/notes/")) {
    return { kind: "notes" };
  }

  if (path === "/dashboard") {
    return { kind: "dashboard" };
  }

  if (path === "/workload") {
    return { kind: "workload" };
  }

  if (path === "/dashboards" || path.startsWith("/dashboards/")) {
    const dashId = path.startsWith("/dashboards/")
      ? decodeURIComponent(path.slice("/dashboards/".length).split("/")[0] || "")
      : "property-operations";
    return { kind: "tables-dashboard", dashboardId: dashId || "property-operations" };
  }

  if (path === "/tables" || path.startsWith("/tables/")) {
    const tableId = path.startsWith("/tables/")
      ? decodeURIComponent(path.slice("/tables/".length).split("/")[0] || "")
      : undefined;
    return { kind: "tables", tableId: tableId || undefined };
  }

  if (
    path === "/requests" ||
    path === "/requests/inbox" ||
    path.startsWith("/requests/")
  ) {
    if (path.endsWith("/mine")) return { kind: "requests", section: "mine" };
    if (path.endsWith("/waiting")) return { kind: "requests", section: "waiting" };
    if (path.endsWith("/resolved")) return { kind: "requests", section: "resolved" };
    if (path.endsWith("/new")) return { kind: "requests", section: "new" };
    return { kind: "requests", section: "inbox" };
  }

  if (path.startsWith("/more/")) {
    const section = path.slice("/more/".length) as MoreSection;
    if (MORE_SECTIONS.includes(section)) {
      if (section === "automations") return { kind: "routines" };
      if (section === "updates") return { kind: "agents", section: "activity" };
      return { kind: "more", section };
    }
  }

  if (path === "/inbox" || path.startsWith("/inbox/")) {
    return { kind: "inbox" };
  }

  if (
    path.startsWith("/capture") ||
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
  if (lens.kind === "inbox") return "/inbox";
  if (lens.kind === "my-work") {
    if (lens.section === "inbox") return "/my-work/inbox";
    if (lens.section === "waiting") return "/my-work/waiting";
    if (lens.section === "today") return "/my-work/today";
    if (lens.section === "this_week") return "/my-work/this-week";
    if (lens.section === "captured") return "/my-work/captured";
    if (lens.section === "reviews") return "/my-work/reviews";
    return "/my-work";
  }
  if (lens.kind === "agents") {
    if (lens.section === "automations") return "/rutinas";
    if (lens.section === "activity") return "/agents/activity";
    if (lens.section === "templates") return "/agents/templates";
    if (lens.section === "usage") return "/agents/usage";
    if (lens.section === "builder") {
      if (!lens.agentId || lens.agentId === "new") return "/agents/new";
      return `/agents/${encodeURIComponent(lens.agentId)}/setup`;
    }
    return "/agents";
  }
  if (lens.kind === "routines") {
    return lens.routineId
      ? `/rutinas/${encodeURIComponent(lens.routineId)}`
      : "/rutinas";
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
  if (lens.kind === "collab") return "/collab";
  if (lens.kind === "feedback") {
    return lens.section === "queue" ? "/workspace/supportops" : "/supportops";
  }
  if (lens.kind === "requests") {
    if (lens.section === "mine") return "/requests/mine";
    if (lens.section === "waiting") return "/requests/waiting";
    if (lens.section === "resolved") return "/requests/resolved";
    if (lens.section === "new") return "/requests/new";
    return "/requests";
  }
  if (lens.kind === "notes") return "/notes";
  if (lens.kind === "dashboard") return "/dashboard";
  if (lens.kind === "workload") return "/workload";
  if (lens.kind === "tables-dashboard") {
    return `/dashboards/${encodeURIComponent(lens.dashboardId)}`;
  }
  if (lens.kind === "tables") {
    return lens.tableId ? `/tables/${encodeURIComponent(lens.tableId)}` : "/tables";
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
