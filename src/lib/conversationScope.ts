export type ConversationScopeType =
  | "chief_of_staff"
  | "general"
  | "project"
  | "multi_project"
  | "task"
  | "multi_task"
  | "mixed";

export type ConversationScopeRecord = {
  contextEntityId?: string | null;
  sourceContext?: string | null;
  conversationType?: ConversationScopeType | string | null;
  linkedProjectIds?: string[] | null;
  linkedTaskIds?: string[] | null;
};

function uniqueIds(values: unknown) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

export function conversationProjectIds(conversation?: ConversationScopeRecord | null) {
  const linked = uniqueIds(conversation?.linkedProjectIds);
  if (linked.length > 0) return linked;
  if (conversation?.contextEntityId && conversation?.sourceContext !== "task") {
    return [String(conversation.contextEntityId)];
  }
  return [];
}

export function conversationTaskIds(conversation?: ConversationScopeRecord | null) {
  const linked = uniqueIds(conversation?.linkedTaskIds);
  if (linked.length > 0) return linked;
  if (conversation?.contextEntityId && conversation?.sourceContext === "task") {
    return [String(conversation.contextEntityId)];
  }
  return [];
}

export function conversationScopeType(projectIds: string[], taskIds: string[]): ConversationScopeType {
  const projects = uniqueIds(projectIds);
  const tasks = uniqueIds(taskIds);
  if (projects.length > 0 && tasks.length > 0) return "mixed";
  if (projects.length > 1) return "multi_project";
  if (projects.length === 1) return "project";
  if (tasks.length > 1) return "multi_task";
  if (tasks.length === 1) return "task";
  return "general";
}

export function conversationScopeLabel(
  conversation: ConversationScopeRecord | null | undefined,
  projects: Array<{ id: string; title?: string; name?: string }>,
  tasks: Array<{ id: string; title?: string; name?: string }>,
) {
  const projectIds = conversationProjectIds(conversation);
  const taskIds = conversationTaskIds(conversation);
  const projectTitles = projectIds.map((id) => {
    const project = projects.find((item) => item.id === id);
    return project?.title || project?.name || "Project";
  });
  const taskTitles = taskIds.map((id) => {
    const task = tasks.find((item) => item.id === id);
    return task?.title || task?.name || "Task";
  });

  if (projectTitles.length === 1 && taskTitles.length === 0) return projectTitles[0];
  if (projectTitles.length > 1 && taskTitles.length === 0) return `${projectTitles.length} projects`;
  if (taskTitles.length === 1 && projectTitles.length === 0) return taskTitles[0];
  if (taskTitles.length > 1 && projectTitles.length === 0) return `${taskTitles.length} tasks`;
  if (projectTitles.length > 0 || taskTitles.length > 0) {
    return `${projectTitles.length} project${projectTitles.length === 1 ? "" : "s"} · ${taskTitles.length} task${taskTitles.length === 1 ? "" : "s"}`;
  }
  return conversation?.conversationType === "chief_of_staff" ||
    (conversation as { isChiefOfStaff?: boolean } | null | undefined)?.isChiefOfStaff
    ? "Odysseus"
    : "General";
}

export function conversationIncludesProject(conversation: ConversationScopeRecord | null | undefined, projectId: string) {
  return conversationProjectIds(conversation).includes(projectId);
}

export function isStandaloneConversation(conversation?: ConversationScopeRecord | null) {
  if (!conversation) return true;
  if (conversation.conversationType === "chief_of_staff" || (conversation as { isChiefOfStaff?: boolean }).isChiefOfStaff) {
    return true;
  }
  return conversationProjectIds(conversation).length === 0 && conversationTaskIds(conversation).length === 0;
}

export function isProjectConversation(conversation?: ConversationScopeRecord | null) {
  return conversationProjectIds(conversation).length > 0;
}
