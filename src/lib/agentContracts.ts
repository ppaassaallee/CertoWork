export type AgentId =
  | "chief_of_staff"
  | "capture_triage"
  | "project_architect"
  | "planning"
  | "judgment"
  | "retrieval_memory"
  | "meeting_note_processor"
  | "communication_draft"
  | "report";

export type AgentDataScope =
  | "tasks"
  | "projects"
  | "calendar"
  | "knowledge"
  | "conversations"
  | "meetings"
  | "review_queue"
  | "reports";

export interface AgentTaskEnvelope<TInput = Record<string, unknown>> {
  taskId: string;
  agentId: AgentId;
  userId: string;
  workspaceId: string;
  input: TInput;
  requestedAt: string;
  deadlineMs: number;
  allowedTools: string[];
  dataScopes: AgentDataScope[];
  requiresApproval: boolean;
}

export interface AgentEvidence {
  sourceType: AgentDataScope;
  sourceId: string;
  title: string;
  excerpt?: string;
  score?: number;
}

export interface AgentResultEnvelope<TResult = Record<string, unknown>> {
  taskId: string;
  agentId: AgentId;
  status: "completed" | "needs_approval" | "blocked" | "failed";
  result?: TResult;
  evidence: AgentEvidence[];
  confidence: number;
  warnings: string[];
  latencyMs: number;
  requiresApproval: boolean;
}

export interface SpecialistAgentDefinition {
  id: AgentId;
  name: string;
  purpose: string;
  allowedTools: string[];
  dataScopes: AgentDataScope[];
  mayWrite: boolean;
  requiresApprovalForWrites: boolean;
}

export const CHIEF_OF_STAFF_ORCHESTRATOR: SpecialistAgentDefinition = {
  id: "chief_of_staff",
  name: "Odiseus Orchestrator",
  purpose: "Route bounded tasks, synthesize evidence, and present one accountable response.",
  allowedTools: ["delegate_typed_task", "merge_agent_results", "propose_action_plan"],
  dataScopes: ["tasks", "projects", "calendar", "knowledge", "conversations", "review_queue", "reports"],
  mayWrite: true,
  requiresApprovalForWrites: true,
};

export const SPECIALIST_AGENTS: SpecialistAgentDefinition[] = [
  {
    id: "capture_triage",
    name: "Capture & Triage",
    purpose: "Classify raw input and propose a safe destination.",
    allowedTools: ["read_inbox", "propose_review_candidate"],
    dataScopes: ["tasks", "projects", "knowledge", "review_queue"],
    mayWrite: true,
    requiresApprovalForWrites: true,
  },
  {
    id: "project_architect",
    name: "Project Architect",
    purpose: "Define outcomes, phases, risks, and a first action.",
    allowedTools: ["read_projects", "propose_project", "propose_task"],
    dataScopes: ["projects", "tasks", "knowledge"],
    mayWrite: true,
    requiresApprovalForWrites: true,
  },
  {
    id: "planning",
    name: "Planning",
    purpose: "Build capacity-aware daily and weekly plans.",
    allowedTools: ["read_calendar", "read_tasks", "propose_time_block"],
    dataScopes: ["tasks", "projects", "calendar"],
    mayWrite: true,
    requiresApprovalForWrites: true,
  },
  {
    id: "judgment",
    name: "Judgment",
    purpose: "Challenge overload, conflicts, ambiguity, and opportunity cost.",
    allowedTools: ["read_calendar", "read_tasks", "read_projects"],
    dataScopes: ["tasks", "projects", "calendar", "conversations"],
    mayWrite: false,
    requiresApprovalForWrites: true,
  },
  {
    id: "retrieval_memory",
    name: "Retrieval & Memory",
    purpose: "Retrieve workspace-scoped evidence and durable context.",
    allowedTools: ["search_workspace_memory"],
    dataScopes: ["knowledge", "tasks", "projects", "conversations"],
    mayWrite: false,
    requiresApprovalForWrites: true,
  },
  {
    id: "meeting_note_processor",
    name: "Meeting & Note Processor",
    purpose: "Extract decisions, follow-ups, and grounded references.",
    allowedTools: ["read_meeting", "propose_decision", "propose_followup"],
    dataScopes: ["meetings", "knowledge", "review_queue"],
    mayWrite: true,
    requiresApprovalForWrites: true,
  },
  {
    id: "communication_draft",
    name: "Communication Draft",
    purpose: "Draft communications without sending them.",
    allowedTools: ["read_stakeholder_context", "propose_outbox_message"],
    dataScopes: ["conversations", "knowledge", "review_queue"],
    mayWrite: true,
    requiresApprovalForWrites: true,
  },
  {
    id: "report",
    name: "Report",
    purpose: "Create cited snapshots from workspace facts.",
    allowedTools: ["read_workspace_metrics", "render_markdown_report"],
    dataScopes: ["tasks", "projects", "calendar", "knowledge", "reports"],
    mayWrite: false,
    requiresApprovalForWrites: false,
  },
];
