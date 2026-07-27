export type ChatType = 'group' | 'dm' | 'project_room' | 'agent_room';
export type ParticipantType = 'user' | 'agent';
export type SenderType = 'user' | 'agent' | 'system';

export interface WarRoomChat {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  type: ChatType;
  linkedProjectId?: string;
  status: 'active' | 'archived';
  createdBy: string;
  isPrivate?: boolean;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface WarRoomParticipant {
  id: string;
  workspaceId: string;
  chatId: string;
  participantType: ParticipantType;
  userId?: string;
  agentId?: string;
  displayName: string;
  avatarUrl?: string;
  roleInChat?: string;
  status: 'active' | 'removed';
  joinedAt: any;
  addedBy: string;
  createdAt: any;
  updatedAt: any;
}

export type WarRoomMessageType =
  | 'text'
  | 'system'
  | 'agent_status'
  | 'widget'
  | 'file'
  | 'action_plan'
  | 'status_report'
  | 'task_reference'
  | 'project_reference';

export interface WarRoomMessage {
  id: string;
  workspaceId: string;
  chatId: string;
  threadId?: string;
  senderType: SenderType;
  senderUserId?: string;
  senderAgentId?: string;
  messageType: WarRoomMessageType;
  content: string;
  mentionsUserIds?: string[];
  mentionsAgentIds?: string[];
  linkedWidgetId?: string;
  linkedFileIds?: string[];
  linkedEntityType?: string;
  linkedEntityId?: string;
  modelProvider?: string;
  modelName?: string;
  tokenUsage?: number;
  costEstimate?: number;
  status: 'sending' | 'sent' | 'failed' | 'deleted';
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface WarRoomThread {
  id: string;
  workspaceId: string;
  chatId: string;
  parentMessageId: string;
  title?: string;
  status: 'active' | 'resolved' | 'archived';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export type AgentType =
  | 'general'
  | 'product_manager'
  | 'designer'
  | 'engineer'
  | 'researcher'
  | 'reviewer'
  | 'project_manager'
  | 'data_analyst'
  | 'sales'
  | 'operations'
  | 'custom';

export interface BoldiAgent {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  avatarEmoji?: string;
  avatarUrl?: string;
  agentType: AgentType;
  systemPrompt: string;
  modelProvider: string;
  modelName: string;
  toolsAllowed: string[];
  permissionsProfile: 'tell_me_only' | 'can_create_drafts' | 'can_create_review_candidates' | 'can_execute_with_approval' | 'admin_only';
  memoryPolicy: 'none' | 'chat_only' | 'workspace_summary' | 'project_context' | 'explicit_files_only';
  status: 'active' | 'disabled' | 'archived';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface AgentTemplate {
  id: string;
  workspaceId?: string;
  title: string;
  description: string;
  category: 'product' | 'engineering' | 'research' | 'operations' | 'project_management' | 'recruiting' | 'sales' | 'executive' | 'custom';
  agentConfig: Partial<BoldiAgent>;
  isSystemTemplate: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AgentRun {
  id: string;
  workspaceId: string;
  chatId: string;
  threadId?: string;
  agentId: string;
  triggeredByUserId?: string;
  triggerMessageId: string;
  runType: 'reply' | 'autonomous_debate' | 'research' | 'widget_generation' | 'widget_mutation' | 'action_plan' | 'project_status_report' | 'tool_execution';
  status: 'queued' | 'running' | 'waiting_for_tool' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled';
  inputSummary: string;
  outputSummary?: string;
  toolCalls?: any[];
  modelProvider: string;
  modelName: string;
  tokenUsage?: number;
  costEstimate?: number;
  error?: string;
  startedAt: any;
  completedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export type WidgetType =
  | 'document'
  | 'dashboard'
  | 'research_brief'
  | 'project_status'
  | 'project_plan'
  | 'comparison_table'
  | 'decision_matrix'
  | 'roadmap'
  | 'gantt_summary'
  | 'custom';

export interface WarRoomWidget {
  id: string;
  workspaceId: string;
  chatId: string;
  threadId?: string;
  title: string;
  widgetType: WidgetType;
  currentVersionId: string;
  status: 'active' | 'archived';
  createdByAgentId?: string;
  createdByUserId?: string;
  linkedProjectId?: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface HeroMetric {
  label: string;
  value: string;
  subtext?: string;
}

export interface NavigationTab {
  tab_id: string;
  tab_title: string;
  markdown_body: string;
}

export interface WidgetPayload {
  document_title: string;
  version_tag: string;
  hero_metrics?: HeroMetric[];
  navigation_tabs?: NavigationTab[];
  source_summary?: string;
  confidence?: 'high' | 'medium' | 'low';
  open_questions?: string[];
}

export interface WarRoomWidgetVersion {
  id: string;
  workspaceId: string;
  widgetId: string;
  versionNumber: number;
  versionTag: string;
  title: string;
  heroMetrics?: HeroMetric[];
  navigationTabs?: NavigationTab[];
  markdownBody?: string;
  jsonPayload: WidgetPayload;
  sourceMessageId?: string;
  sourceAgentRunId?: string;
  changedByAgentId?: string;
  changedByUserId?: string;
  changeSummary?: string;
  createdAt: any;
}

export type FileType = 'google_drive_file' | 'google_drive_folder' | 'uploaded_file' | 'external_link' | 'generated_report';

export interface WarRoomFile {
  id: string;
  workspaceId: string;
  chatId?: string;
  threadId?: string;
  projectId?: string;
  title: string;
  fileType: FileType;
  url?: string;
  storagePath?: string;
  googleDriveFileId?: string;
  googleDriveFolderId?: string;
  mimeType?: string;
  sizeBytes?: number;
  contentAvailable: boolean;
  extractedTextAvailable: boolean;
  summary?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface ProposedAction {
  type: 'create_task' | 'create_milestone' | 'update_project_stage' | 'update_project_health' | 'create_status_report' | 'add_document_link';
  payload: any;
}

export interface WarRoomActionPlan {
  id: string;
  workspaceId: string;
  chatId: string;
  threadId?: string;
  title: string;
  summary: string;
  proposedByAgentId: string;
  status: 'draft' | 'needs_approval' | 'approved' | 'applied' | 'partially_applied' | 'rejected' | 'failed';
  proposedActions: ProposedAction[];
  affectedEntityTypes: string[];
  affectedRecordCount: number;
  riskLevel: 'low' | 'medium' | 'high';
  createdBy: string;
  approvedBy?: string;
  approvedAt?: any;
  appliedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  action: string;
  actorId: string;
  actorType: 'user' | 'agent' | 'system';
  targetId?: string;
  targetType?: string;
  details?: any;
  createdAt: any;
}

export interface AgentGroup {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  groupType: 'private' | 'workspace' | 'project' | 'public_template';
  visibility: 'private' | 'workspace' | 'public';
  linkedProjectId?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  status: 'active' | 'archived' | 'full';
  maxMembers?: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface AgentGroupMember {
  id: string;
  workspaceId: string;
  groupId: string;
  participantType: 'user' | 'agent';
  userId?: string;
  agentId?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'removed';
  joinedAt: any;
  addedBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface AgentWorkbenchTemplate {
  id: string;
  workspaceId?: string;
  title: string;
  description: string;
  templateType: 'agent' | 'group' | 'workflow';
  category: 'product' | 'research' | 'project_management' | 'executive' | 'sales' | 'engineering' | 'personal' | 'custom';
  avatarUrl?: string;
  avatarEmoji?: string;
  tags: string[];
  userCount: number;
  configPayload: any;
  isSystemTemplate: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AgentMoment {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  sourceChatId?: string;
  sourceWidgetId?: string;
  sourceMessageId?: string;
  visibility: 'private' | 'workspace' | 'public';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface AgentResource {
  id: string;
  workspaceId: string;
  title: string;
  resourceType: 'doc' | 'canvas' | 'file' | 'google_drive_file' | 'google_drive_folder' | 'link' | 'generated_report';
  content?: string;
  markdownContent?: string;
  jsonCanvas?: any;
  url?: string;
  storagePath?: string;
  googleDriveFileId?: string;
  googleDriveFolderId?: string;
  mimeType?: string;
  sizeBytes?: number;
  linkedProjectId?: string;
  linkedChatId?: string;
  contentAvailable: boolean;
  extractedTextAvailable: boolean;
  summary?: string;
  tags: string[];
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface AgentInvite {
  id: string;
  workspaceId: string;
  inviteType: 'workspace' | 'group' | 'chat' | 'agent' | 'workbench';
  targetId?: string;
  email?: string;
  inviteToken: string;
  inviteUrl: string;
  qrCodeUrl?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdBy: string;
  createdAt: any;
  expiresAt: any;
  acceptedAt?: any;
}

export interface Contact {
  id: string;
  workspaceId: string;
  userId?: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  contactType: 'human' | 'external' | 'agent_reference';
  status: 'active' | 'invited' | 'blocked' | 'archived';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface ContactRequest {
  id: string;
  workspaceId: string;
  fromUserId?: string;
  fromEmail?: string;
  fromName?: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  message?: string;
  contactType?: 'human' | 'agent_reference';
  displayName?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}
