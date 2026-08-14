const DAY_MS = 86_400_000;

export type TemplateRole = "project_manager" | "product_owner" | "sponsor";

export type ProjectTemplateItem = {
  templateKey: string;
  parentTemplateKey: string | null;
  title: string;
  description: string;
  workItemType: string;
  priority: string | null;
  dueOffsetDays: number | null;
  startOffsetDays: number | null;
  assigneeRole: TemplateRole | null;
  order: number;
};

function dateOnly(value: any) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  return "";
}

function offsetDays(value: any, anchor: string) {
  const date = dateOnly(value);
  if (!date || !anchor) return null;
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${anchor}T00:00:00`).getTime()) / DAY_MS);
}

export function applyRelativeDate(anchor: string, offset: number | null) {
  if (!anchor || offset == null || !Number.isFinite(offset)) return null;
  const date = new Date(`${anchor}T00:00:00`);
  date.setDate(date.getDate() + Number(offset));
  return date.toISOString().slice(0, 10);
}

function itemType(item: any) {
  return String(item?.workItemType || item?.type || item?.itemType || "pbi").toLowerCase();
}

function itemParentId(item: any) {
  return String(item?.parentId || item?.featureId || item?.epicId || "");
}

function normalizedPeople(value: any) {
  return [
    ...(Array.isArray(value?.assigneeIds) ? value.assigneeIds : []),
    ...(Array.isArray(value?.assignees) ? value.assignees : []),
    value?.owner,
    value?.assignee,
  ]
    .filter(Boolean)
    .map((entry) => String(entry).trim().toLowerCase());
}

function projectRoleValues(project: any, role: TemplateRole) {
  if (role === "project_manager") return [project.projectManagerId, project.projectManager, project.owner];
  if (role === "product_owner") return [project.productOwnerId, project.productOwner];
  return [
    project.sponsorId,
    project.sponsor,
    ...(Array.isArray(project.sponsorIds) ? project.sponsorIds : []),
    ...(Array.isArray(project.sponsors) ? project.sponsors : []),
  ];
}

function inferAssigneeRole(item: any, project: any): TemplateRole | null {
  const people = normalizedPeople(item);
  for (const role of ["project_manager", "product_owner", "sponsor"] as TemplateRole[]) {
    const candidates = projectRoleValues(project, role)
      .filter(Boolean)
      .map((entry) => String(entry).trim().toLowerCase());
    if (candidates.some((candidate) => people.includes(candidate))) return role;
  }
  return null;
}

export function buildProjectTemplate(project: any, tasks: any[], name: string, description = "") {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const dated = projectTasks
    .flatMap((task) => [dateOnly(task.startDate || task.plannedStartDate), dateOnly(task.dueDate || task.targetDate)])
    .filter(Boolean)
    .sort();
  const anchor = dateOnly(project.startDate || project.plannedStartDate) || dated[0] || new Date().toISOString().slice(0, 10);
  const idToTemplateKey = new Map(projectTasks.map((task, index) => [task.id, `item-${index + 1}`]));
  const items: ProjectTemplateItem[] = projectTasks.map((task, index) => ({
    templateKey: idToTemplateKey.get(task.id) || `item-${index + 1}`,
    parentTemplateKey: idToTemplateKey.get(itemParentId(task)) || null,
    title: String(task.title || task.name || "Untitled work item"),
    description: String(task.description || task.definitionOfDone || ""),
    workItemType: itemType(task),
    priority: task.priority == null ? null : String(task.priority).replace(/^P/i, ""),
    dueOffsetDays: offsetDays(task.dueDate || task.targetDate, anchor),
    startOffsetDays: offsetDays(task.startDate || task.plannedStartDate, anchor),
    assigneeRole: inferAssigneeRole(task, project),
    order: Number(task.order ?? task.rank ?? index),
  }));

  return {
    templateType: "project",
    name: name.trim(),
    description: description.trim() || String(project.description || project.outcome || ""),
    sourceProjectId: project.id,
    sourceProjectName: String(project.title || project.name || "Project"),
    projectDefaults: {
      description: String(project.description || ""),
      outcome: String(project.outcome || project.objective || ""),
      methodology: String(project.methodology || "scrum"),
      deliveryStage: String(project.deliveryStage || "define"),
      deliveryPhase: String(project.deliveryPhase || "discovery"),
      serviceLine: String(project.serviceLine || project.technology || ""),
      definitionOfDone: String(project.definitionOfDone || ""),
      tags: Array.isArray(project.tags) ? project.tags : [],
    },
    roles: ["project_manager", "product_owner", "sponsor"],
    scheduleAnchor: "project_start",
    items,
  };
}

export function instantiateTemplateItems(
  template: any,
  startDate: string,
  roleAssignments: Partial<Record<TemplateRole, { id: string; name: string }>> = {},
) {
  return (Array.isArray(template?.items) ? template.items : []).map((item: ProjectTemplateItem) => {
    const role = item.assigneeRole ? roleAssignments[item.assigneeRole] : null;
    return {
      ...item,
      startDate: applyRelativeDate(startDate, item.startOffsetDays),
      dueDate: applyRelativeDate(startDate, item.dueOffsetDays),
      assigneeIds: role?.id ? [role.id] : [],
      assignees: role?.name ? [role.name] : [],
      owner: role?.name || "",
    };
  });
}
