import { evaluateJudgment } from "./judgment";
import {
  conversationProjectIds,
  conversationScopeLabel,
  conversationScopeType,
  conversationTaskIds,
} from "./conversationScope";
import { buildProjectDocumentContext } from "./projectContext";
import { buildNotebookContext, type NotebookEntry } from "./notebookContext";

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
  return conversations.slice(0, 30).map((conversation) => ({
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
  odiseusMemory,
  skills,
  schedules,
}: ConversationContextBuildParams): ConversationRequestContext {
  const scopedTasks = isFocusedConversation ? projectTasks : openTasks;
  const scopedProjects = isFocusedConversation ? contextProjects : activeProjects;
  const scopedMilestones = isFocusedConversation
    ? scopedByProject(milestones, contextProjectIds)
    : milestones;
  const scopedRisks = isFocusedConversation
    ? scopedByProject(risks, contextProjectIds)
    : risks;
  const scopedTodayTasks = isFocusedConversation
    ? todayTasks.filter((task) =>
        scopedTasks.some((scopedTask) => scopedTask.id === task.id),
      )
    : todayTasks;
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
      : "chief_of_staff") as "chief_of_staff" | "project_delivery",
    activeProjectId: primaryProject?.id || null,
  };
  const judgment = evaluateJudgment(text, workspaceSnapshot);
  const conversationType = conversationScopeType(
    directContextProjectIds,
    contextTaskIds,
  );

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
      ...workspaceSnapshot,
      judgment,
      mode: isFocusedConversation ? "focused_delivery" : "chief_of_staff",
      activeProject: primaryProject,
      contextProjects,
      contextTasks,
      conversationType,
      conversationDirectory: conversationDirectory(conversations, projects, tasks),
      todayTaskCount: scopedTodayTasks.length,
      workspaceMembers: workspaceMembers.map((member) => ({
        id: member.id,
        email: member.email || member.emailLower || "",
        displayName: member.displayName || "",
        role: member.role || "member",
        status: member.status || "active",
      })),
      workspaceTeams: workspaceTeams.map((team) => ({
        id: team.id,
        name: team.name || "Team",
        memberEmails: team.memberEmails || [],
      })),
      strategicMeasures: strategicMeasures.map((measure) => ({
        id: measure.id,
        strategicGoalId: measure.strategicGoalId,
        title: measure.title,
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
