import { projectHealth, type ProjectHealth } from "./projectPortfolio";

export function timestamp(value: any) {
  if (value?.seconds)
    return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  return typeof value === "number" ? value : 0;
}

export function timeAgo(value: any) {
  const delta = Math.max(0, Date.now() - timestamp(value));
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function initials(name?: string | null) {
  const source = name?.trim() || "D";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function inviteMessage(invite: any) {
  const email = invite.email || invite.emailLower || "your invited email";
  const token = invite.inviteToken ? `/invite/${invite.inviteToken}` : "";
  return `You have been invited to Certo Work. Open https://certo.work${token || ""} and activate your account using this exact email: ${email}. Set your password, then sign out and sign back in with those credentials.`;
}

export function displayName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "there";
}

export function entityTitle(entity: any) {
  return entity?.title || entity?.name || "Untitled";
}

export function isGenericProjectTitle(value: any) {
  return [
    "create a project",
    "crear un proyecto",
    "new project",
    "nuevo proyecto",
    "project",
    "proyecto",
    "help me create a project",
  ].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

export function proposedTitle(proposed: any, fallback: any) {
  const proposedValue = String(proposed?.title || proposed?.name || "").trim();
  if (proposedValue && !isGenericProjectTitle(proposedValue)) return proposedValue;
  const fallbackValue = String(fallback || "").trim();
  if (fallbackValue && !isGenericProjectTitle(fallbackValue)) return fallbackValue;
  return proposedValue || fallbackValue || "Untitled";
}

export function projectWorkKey(project: any) {
  const explicit = String(project?.projectKey || project?.key || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (explicit) return explicit.slice(0, 10);
  const words =
    String(project?.title || project?.name || "WORK")
      .toUpperCase()
      .match(/[A-Z0-9]+/g) || ["WORK"];
  const initialsValue = words.map((word) => word[0]).join("");
  return (initialsValue.length >= 2 ? initialsValue : words[0].slice(0, 5)).slice(0, 6);
}

export function isClosed(status?: string) {
  return ["done", "completed", "closed", "archived", "cancelled"].includes(
    String(status || "").toLowerCase(),
  );
}

export function localDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function dateKey(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value?.toDate) return localDateKey(value.toDate());
  if (value?.seconds) return localDateKey(new Date(value.seconds * 1000));
  return "";
}

export function priorityLabel(value: any) {
  const normalized = String(value || "").toLowerCase();
  if (["urgent", "critical", "p0", "p1", "high", "1"].includes(normalized))
    return "Priority 1";
  if (["p2", "medium", "2"].includes(normalized)) return "Priority 2";
  if (["p3", "low", "3"].includes(normalized)) return "Priority 3";
  return "N/A";
}

export function reviewTypeForAction(type?: string) {
  const types: Record<string, string> = {
    create_project: "project",
    update_project: "project_update",
    create_project_artifact: "knowledge",
    create_milestone: "milestone",
    update_milestone: "milestone_update",
    create_risk: "risk",
    update_risk: "risk_update",
    update_task: "task_update",
    reschedule_task: "task_update",
    post_to_conversation: "conversation_message",
    outbox_communication: "digest_request",
  };
  return types[String(type || "")] || "task";
}

export function normalizedEntityName(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findMatchingProject(
  projects: any[],
  proposed: any,
  fallbackProjectId = "",
) {
  const explicitId = String(proposed?.projectId || proposed?.id || fallbackProjectId || "");
  if (explicitId) {
    const direct = projects.find((project) => project.id === explicitId);
    if (direct) return direct;
  }
  const proposedName = normalizedEntityName(
    proposed?.title || proposed?.name || proposed?.projectTitle || proposed?.projectName,
  );
  if (!proposedName) return null;
  return (
    projects.find((project) => {
      const title = normalizedEntityName(project.title || project.name);
      return (
        title === proposedName ||
        title.includes(proposedName) ||
        proposedName.includes(title)
      );
    }) || null
  );
}

export function isDuplicateProjectProposal(
  action: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  if (String(action?.type || "") !== "create_project") return null;
  return (
    findMatchingProject(projects, action?.proposedChange || {}, fallbackProject?.id || "") ||
    fallbackProject ||
    null
  );
}

export function proposalActionType(
  action: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  return isDuplicateProjectProposal(action, projects, fallbackProject)
    ? "update_project"
    : String(action?.type || "");
}

export function proposalActionTitle(
  action: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  const existingProject = isDuplicateProjectProposal(action, projects, fallbackProject);
  const title =
    action?.proposedChange?.title ||
    action?.proposedChange?.name ||
    action?.reason ||
    "Review details";
  if (!existingProject) return title;
  return `Update existing project: ${existingProject.title || existingProject.name || title}`;
}

export function proposalChipLabel(
  chip: string,
  plan: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  const hasDuplicateProject = plan?.proposedActions?.some((action: any) =>
    isDuplicateProjectProposal(action, projects, fallbackProject),
  );
  if (!hasDuplicateProject) return chip;
  if (/approve.*project.*creation|create.*project|project.*creation/i.test(chip)) {
    return "Update existing project";
  }
  return chip;
}

export function reviewTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    project: "Project",
    project_update: "Project update",
    knowledge: "Project document",
    milestone: "Milestone",
    milestone_update: "Milestone update",
    risk: "Risk",
    risk_update: "Risk update",
    conversation_message: "Conversation handoff",
    task: "Task",
    task_update: "Task update",
  };
  return labels[String(type || "task")] || "Item";
}

export function groupProjectsByHealth(
  projects: any[],
  tasks: any[] = [],
  risks: any[] = [],
) {
  const groups: Record<ProjectHealth, any[]> = {
    blocked: [],
    at_risk: [],
    on_track: [],
  };
  for (const project of projects) {
    const health = projectHealth(
      project,
      tasks.filter((task) => task.projectId === project.id),
      risks.filter((risk) => risk.projectId === project.id),
    );
    groups[health].push(project);
  }
  return groups;
}
