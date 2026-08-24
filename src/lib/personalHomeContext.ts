import { projectHealth } from "./projectPortfolio";

export type PersonalHomeActor = {
  userId: string;
  memberId?: string | null;
  email?: string | null;
};

export type WorkspaceRadarItem = {
  id: string;
  title: string;
  health: "on_track" | "at_risk" | "blocked";
  dueDate?: string | null;
};

function asIdList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function actorTokens(actor: PersonalHomeActor) {
  const email = String(actor.email || "")
    .trim()
    .toLowerCase();
  return new Set(
    [actor.userId, actor.memberId, email].map((value) => String(value || "").trim()).filter(Boolean),
  );
}

function recordTokens(record: Record<string, unknown> | null | undefined) {
  if (!record) return [] as string[];
  return [
    ...asIdList(record.userId),
    ...asIdList(record.createdBy),
    ...asIdList(record.ownerId),
    ...asIdList(record.owner),
    ...asIdList(record.assigneeId),
    ...asIdList(record.assignedTo),
    ...asIdList(record.assigneeIds),
    ...asIdList(record.accessMemberIds),
    ...asIdList(record.visibleToUserIds),
    ...asIdList(record.sharedWithUserIds),
    ...asIdList(record.teamMemberIds),
    ...asIdList(record.sponsorIds),
    ...asIdList(record.projectManagerId),
    ...asIdList(record.productOwnerId),
    ...asIdList(record.visibleToEmails).map((value) => value.toLowerCase()),
    ...asIdList(record.assigneeEmails).map((value) => value.toLowerCase()),
  ];
}

export function isPersonalWorkItem(
  record: Record<string, unknown> | null | undefined,
  actor: PersonalHomeActor,
) {
  if (!record || !actor.userId) return false;
  const tokens = actorTokens(actor);
  return recordTokens(record).some((value) => tokens.has(value));
}

export function isPersonalProject(
  project: Record<string, unknown> | null | undefined,
  actor: PersonalHomeActor,
) {
  return isPersonalWorkItem(project, actor);
}

export function buildWorkspaceRadar(
  projects: any[] = [],
  tasks: any[] = [],
  risks: any[] = [],
  limit = 8,
): WorkspaceRadarItem[] {
  return projects
    .filter((project) => project?.id)
    .map((project) => {
      const projectTasks = tasks.filter((task) => String(task.projectId || "") === String(project.id));
      const projectRisks = risks.filter((risk) => String(risk.projectId || "") === String(project.id));
      return {
        id: String(project.id),
        title: String(project.title || project.name || "Project"),
        health: projectHealth(project, projectTasks, projectRisks),
        dueDate: project.revisedDueDate || project.dueDate || project.targetDate || null,
      };
    })
    .filter((item) => item.health === "blocked" || item.health === "at_risk")
    .slice(0, limit);
}

export function scopePersonalHomeRecords({
  openTasks,
  activeProjects,
  milestones,
  risks,
  todayTasks,
  actor,
}: {
  openTasks: any[];
  activeProjects: any[];
  milestones: any[];
  risks: any[];
  todayTasks: any[];
  actor: PersonalHomeActor;
}) {
  const scopedTasks = openTasks.filter((task) => isPersonalWorkItem(task, actor));
  const personalProjectIds = new Set(
    scopedTasks.map((task) => String(task.projectId || "")).filter(Boolean),
  );
  const scopedProjects = activeProjects.filter(
    (project) => isPersonalProject(project, actor) || personalProjectIds.has(String(project.id)),
  );
  const scopedProjectIds = new Set(scopedProjects.map((project) => String(project.id)));
  const scopedMilestones = milestones.filter((item) =>
    scopedProjectIds.has(String(item.projectId || "")),
  );
  const scopedRisks = risks.filter((item) => scopedProjectIds.has(String(item.projectId || "")));
  const scopedTodayTasks = todayTasks.filter((task) =>
    scopedTasks.some((scopedTask) => scopedTask.id === task.id),
  );

  return {
    scopedTasks,
    scopedProjects,
    scopedMilestones,
    scopedRisks,
    scopedTodayTasks,
    workspaceRadar: buildWorkspaceRadar(activeProjects, openTasks, risks),
    privacyScope: "personal_home" as const,
  };
}
