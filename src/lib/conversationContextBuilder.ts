import { evaluateJudgment } from "./judgment";
import {
  conversationProjectIds,
  conversationScopeLabel,
  conversationScopeType,
  conversationTaskIds,
} from "./conversationScope";
import { buildProjectDocumentContext } from "./projectContext";
import { buildNotebookContext, type NotebookEntry } from "./notebookContext";
import { scopePersonalHomeRecords, type PersonalHomeActor } from "./personalHomeContext";

const MAX_CONTEXT_TASKS = 24;
const MAX_CONTEXT_PROJECTS = 12;
const MAX_CONTEXT_MILESTONES = 12;
const MAX_CONTEXT_RISKS = 10;
const MAX_CONTEXT_GOALS = 8;
const MAX_CONTEXT_MEASURES = 12;
const MAX_CONTEXT_MEMBERS = 20;
const MAX_CONTEXT_TEAMS = 12;
const MAX_CONTEXT_CONVERSATIONS = 15;
const MAX_CONTEXT_TEXT = 700;

type ConversationContextBuildParams = {
  text: string;
  currentUserMessageId: string;
  contextualMessages: Array<{ id?: string; role: string; content: string }>;
  isFocusedConversation: boolean;
  primaryProject?: any | null;
  activeProject?: any | null;
  directContextProjectIds: string[];
  contextTaskIds: string[];
  contextProjectIds: string[];
  contextProjects: any[];
  contextTasks: any[];
  projectTasks: any[];
  openTasks: any[];
  activeProjects: any[];
  milestones: any[];
  risks: any[];
  todayTasks: any[];
  projects: any[];
  tasks: any[];
  conversations: any[];
  reviewItems: any[];
  strategicGoals: any[];
  strategicMeasures: any[];
  strategicRecords: any[];
  workspaceMembers: any[];
  workspaceTeams: any[];
  projectDocuments: any[];
  notebookEntries: NotebookEntry[];
  userId: string;
  workspaceId: string;
  conversationId?: string | null;
  currentMemberId?: string | null;
  currentUserEmail?: string | null;
  odiseusMemory?: any[];
  skills?: any[];
  schedules?: any[];
};

export type ConversationRequestContext = {
  judgment: ReturnType<typeof evaluateJudgment>;
  workspaceSnapshot: any;
  workspaceContext: any;
  messages: Array<{ role: string; content: string }>;
};

function scopedByProject<T extends { projectId?: string }>(
  records: T[],
  projectIds: string[],
) {
  return records.filter((record) => projectIds.includes(String(record.projectId || "")));
}

function conversationDirectory(conversations: any[], projects: any[], tasks: any[]) {
  return conversations.slice(0, MAX_CONTEXT_CONVERSATIONS).map((conversation) => ({
    id: conversation.id,
    title: conversation.title || "New conversation",
    scope: conversationScopeLabel(conversation, projects, tasks),
    conversationType:
      conversation.conversationType ||
      conversationScopeType(
        conversationProjectIds(conversation),
        conversationTaskIds(conversation),
      ),
  }));
}

function compactText(value: any, limit = MAX_CONTEXT_TEXT) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function recordSearchText(record: any) {
  return [
    record?.title,
    record?.name,
    record?.description,
    record?.outcome,
    record?.objective,
    record?.status,
    record?.priority,
    record?.dueDate,
    record?.workItemType,
    record?.deliveryEntity,
    record?.clientEntity,
    Array.isArray(record?.tags) ? record.tags.join(" ") : "",
  ].join(" ").toLowerCase();
}

function relevanceScore(record: any, text: string, forcedIds: Set<string>) {
  if (forcedIds.has(String(record?.id || ""))) return 1_000;
  const haystack = recordSearchText(record);
  const tokens = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
  let score = 0;
  for (const token of tokens) if (haystack.includes(token)) score += 1;
  if (String(record?.status || "").toLowerCase() !== "done") score += 0.5;
  if (record?.dueDate) score += 0.25;
  return score;
}

function selectRelevantRecords<T extends { id?: string }>(
  records: T[],
  text: string,
  limit: number,
  forcedIds: string[] = [],
) {
  const forced = new Set(forcedIds.filter(Boolean).map(String));
  return [...records]
    .map((record, index) => ({ record, index, score: relevanceScore(record, text, forced) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ record }) => record);
}

function compactTask(task: any) {
  return {
    id: task.id,
    title: compactText(task.title || task.name, 220),
    status: task.status || null,
    priority: task.priority || null,
    dueDate: task.dueDate || null,
    projectId: task.projectId || null,
    parentId: task.parentId || null,
    workItemType: task.workItemType || task.type || null,
    assigneeIds: task.assigneeIds || [],
    ownerId: task.ownerId || task.userId || null,
    tags: Array.isArray(task.tags) ? task.tags.slice(0, 8) : [],
    description: compactText(task.description || task.summary, 360),
  };
}

function compactProject(project: any) {
  if (!project) return null;
  return {
    id: project.id,
    title: compactText(project.title || project.name, 220),
    status: project.status || null,
    stage: project.stage || null,
    projectCategory: project.projectCategory || null,
    productStage: project.productStage || null,
    priority: project.priority || null,
    dueDate: project.dueDate || project.targetDate || null,
    outcome: compactText(project.outcome || project.objective, 420),
  };
}

function compactMilestone(record: any) {
  return {
    id: record.id,
    projectId: record.projectId || null,
    title: compactText(record.title || record.name, 180),
    status: record.status || null,
    dueDate: record.dueDate || null,
  };
}

function compactRisk(record: any) {
  return {
    id: record.id,
    projectId: record.projectId || null,
    title: compactText(record.title || record.name, 180),
    status: record.status || null,
    severity: record.severity || record.priority || null,
    summary: compactText(record.summary || record.description, 320),
  };
}

function compactGoal(record: any) {
  return {
    id: record.id,
    title: compactText(record.title || record.name, 200),
    status: record.status || null,
    timeframe: record.timeframe || null,
    objective: compactText(record.objective || record.description, 320),
  };
}

export function buildConversationRequestContext({
  text,
  currentUserMessageId,
  contextualMessages,
  isFocusedConversation,
  primaryProject,
  activeProject,
  directContextProjectIds,
  contextTaskIds,
  contextProjectIds,
  contextProjects,
  contextTasks,
  projectTasks,
  openTasks,
  activeProjects,
  milestones,
  risks,
  todayTasks,
  projects,
  tasks,
  conversations,
  reviewItems,
  strategicGoals,
  strategicMeasures,
  strategicRecords,
  workspaceMembers,
  workspaceTeams,
  projectDocuments,
  notebookEntries,
  userId,
  workspaceId,
  conversationId,
  currentMemberId,
  currentUserEmail,
  odiseusMemory,
  skills,
  schedules,
}: ConversationContextBuildParams): ConversationRequestContext {
  const actor: PersonalHomeActor = {
    userId,
    memberId: currentMemberId,
    email: currentUserEmail,
  };
  const personalHome = isFocusedConversation
    ? null
    : scopePersonalHomeRecords({
        openTasks,
        activeProjects,
        milestones,
        risks,
        todayTasks,
        actor,
      });
  const scopedTasks = isFocusedConversation
    ? projectTasks
    : personalHome?.scopedTasks || [];
  const scopedProjects = isFocusedConversation
    ? contextProjects
    : personalHome?.scopedProjects || [];
  const scopedMilestones = isFocusedConversation
    ? scopedByProject(milestones, contextProjectIds)
    : personalHome?.scopedMilestones || [];
  const scopedRisks = isFocusedConversation
    ? scopedByProject(risks, contextProjectIds)
    : personalHome?.scopedRisks || [];
  const scopedTodayTasks = isFocusedConversation
    ? todayTasks.filter((task) =>
        scopedTasks.some((scopedTask) => scopedTask.id === task.id),
      )
    : personalHome?.scopedTodayTasks || [];
  const previousLongProjectMessage = [...contextualMessages]
    .reverse()
    .find(
      (message) =>
        message.role === "user" && message.content.trim().length >= 2_500,
    );
  const projectArtifactSourceMessageId =
    text.length >= 2_500
      ? currentUserMessageId
      : previousLongProjectMessage?.id || currentUserMessageId;
  const notebookDocuments = buildNotebookContext(notebookEntries, text, {
    activeProjectId: primaryProject?.id || activeProject?.id || null,
    limit: isFocusedConversation ? 4 : 6,
  });
  const workspaceSnapshot = {
    tasks: scopedTasks,
    projects: scopedProjects,
    milestones: scopedMilestones,
    risks: scopedRisks,
    goals: strategicGoals,
    events: [],
    dailyCapacityMinutes: 360,
    loaded: true,
    scope: (isFocusedConversation
      ? "project_delivery"
      : "personal_home") as "chief_of_staff" | "project_delivery" | "personal_home",
    activeProjectId: primaryProject?.id || null,
  };
  const judgment = evaluateJudgment(text, workspaceSnapshot);
  const conversationType = conversationScopeType(
    directContextProjectIds,
    contextTaskIds,
  );
  const forcedTaskIds = [...contextTaskIds, currentUserMessageId].filter(Boolean);
  const forcedProjectIds = [
    ...directContextProjectIds,
    ...contextProjectIds,
    primaryProject?.id,
    activeProject?.id,
  ].filter(Boolean);
  const aiTasks = selectRelevantRecords(scopedTasks, text, MAX_CONTEXT_TASKS, forcedTaskIds).map(compactTask);
  const aiProjects = selectRelevantRecords(scopedProjects, text, MAX_CONTEXT_PROJECTS, forcedProjectIds).map(compactProject);
  const aiMilestones = selectRelevantRecords(scopedMilestones, text, MAX_CONTEXT_MILESTONES, forcedProjectIds).map(compactMilestone);
  const aiRisks = selectRelevantRecords(scopedRisks, text, MAX_CONTEXT_RISKS, forcedProjectIds).map(compactRisk);
  const aiGoals = selectRelevantRecords(strategicGoals, text, MAX_CONTEXT_GOALS).map(compactGoal);

  return {
    judgment,
    workspaceSnapshot,
    messages: [
      ...contextualMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user", content: text },
    ],
    workspaceContext: {
      tasks: aiTasks,
      projects: aiProjects,
      milestones: aiMilestones,
      risks: aiRisks,
      goals: aiGoals,
      events: [],
      dailyCapacityMinutes: workspaceSnapshot.dailyCapacityMinutes,
      loaded: true,
      scope: workspaceSnapshot.scope,
      activeProjectId: workspaceSnapshot.activeProjectId,
      contextStats: {
        totalTasksInScope: scopedTasks.length,
        sentTasks: aiTasks.length,
        totalProjectsInScope: scopedProjects.length,
        sentProjects: aiProjects.length,
        totalMilestonesInScope: scopedMilestones.length,
        sentMilestones: aiMilestones.length,
        totalRisksInScope: scopedRisks.length,
        sentRisks: aiRisks.length,
      },
      judgment,
      mode: isFocusedConversation ? "focused_delivery" : "personal_home",
      privacyScope: isFocusedConversation ? "focused_delivery" : "personal_home",
      workspaceRadar: isFocusedConversation ? [] : personalHome?.workspaceRadar || [],
      currentMemberId: currentMemberId || null,
      activeProject: compactProject(primaryProject),
      contextProjects: selectRelevantRecords(contextProjects, text, MAX_CONTEXT_PROJECTS, forcedProjectIds).map(compactProject),
      contextTasks: selectRelevantRecords(contextTasks, text, MAX_CONTEXT_TASKS, forcedTaskIds).map(compactTask),
      conversationType,
      conversationDirectory: conversationDirectory(conversations, projects, tasks),
      todayTaskCount: scopedTodayTasks.length,
      workspaceMembers: workspaceMembers.slice(0, MAX_CONTEXT_MEMBERS).map((member) => ({
        id: member.id,
        displayName: member.displayName || member.alias || "Team member",
        alias: member.alias || member.displayName || "Team member",
        avatarEmoji: member.avatarEmoji || "",
        role: member.role || "member",
        status: member.status || "active",
      })),
      workspaceTeams: workspaceTeams.slice(0, MAX_CONTEXT_TEAMS).map((team) => ({
        id: team.id,
        name: team.name || "Team",
        memberCount: Array.isArray(team.memberEmails) ? team.memberEmails.length : 0,
      })),
      strategicMeasures: selectRelevantRecords(strategicMeasures, text, MAX_CONTEXT_MEASURES).map((measure) => ({
        id: measure.id,
        strategicGoalId: measure.strategicGoalId,
        title: compactText(measure.title, 180),
        measureKind: measure.measureKind || "outcome",
        currentValue: measure.currentValue,
        targetValue: measure.targetValue,
        unit: measure.unit || "",
        sourceType: measure.sourceType || "manual",
        sourceId: measure.sourceId || null,
      })),
      strategyPulse: strategicRecords
        .filter((record) => record.recordType === "strategy_checkin")
        .slice(0, 12),
      pendingReviewCount: isFocusedConversation
        ? reviewItems.filter((item) =>
            contextProjectIds.includes(item.projectId || item.proposed?.projectId),
          ).length
        : reviewItems.length,
      currentUserMessageId,
      projectArtifactSourceMessageId,
      documents: [
        ...(isFocusedConversation
          ? buildProjectDocumentContext(projectDocuments, text)
          : []),
        ...notebookDocuments,
      ],
      notebookNotes: notebookDocuments,
      userId,
      workspaceId,
      conversationId: conversationId || null,
      odiseusMemory: (odiseusMemory || []).slice(0, 40).map((item) => ({
        id: item.id,
        text: item.text,
        kind: item.kind,
        tags: item.tags,
      })),
      skills: (skills || []).slice(0, 40).map((item) => ({
        id: item.id,
        name: item.name || item.title,
        description: item.description,
        instructions: item.instructions || item.prompt,
      })),
      schedules: (schedules || []).slice(0, 20).map((item) => ({
        id: item.id,
        title: item.title,
        cron: item.cron,
        prompt: item.prompt,
        enabled: item.enabled,
        lastRunAt: item.lastRunAt,
      })),
    },
  };
}
