import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Folder,
  Inbox,
  LayoutGrid,
  ListTodo,
  Loader2,
  Menu,
  MessageSquare,
  Mail,
  Mic,
  MicOff,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { TextSizeControl } from "./TextSizeControl";
import { evaluateJudgment, type JudgmentAssessment } from "../lib/judgment";
import { actionLabel, resolveDelivereeLens } from "../lib/delivereeRoutes";
import {
  sidebarProjectGroups,
  sortProjectsByRecency,
  type WorkLane,
} from "../lib/projectPortfolio";
import { buildProjectDocumentContext } from "../lib/projectContext";
import {
  conversationIncludesProject,
  conversationProjectIds,
  conversationScopeLabel,
  conversationScopeType,
  conversationTaskIds,
  type ConversationScopeType,
} from "../lib/conversationScope";
import { ProjectCommandCenter, ProjectConsolePanel } from "./ProjectSurfaces";
import { WorkItemsCenter } from "./WorkItemsCenter";
import { ProjectWizardSkill } from "./ProjectWizardSkill";
import { NotesWorkspace } from "./NotesWorkspace";
import { StrategyCenter } from "./StrategyCenter";
import { ControlledListsSettings } from "./ControlledListsSettings";
import {
  buildProjectTemplate,
  instantiateTemplateItems,
  type TemplateRole,
} from "../lib/projectTemplates";
import { categoryGroup, type ControlledListOption } from "../lib/controlledLists";
import type { TemplateApplication } from "./ProjectTemplatesPanel";
import {
  DELIVEREE_SKILLS,
  isProjectWizardInvocation,
  splitProjectWizardLines,
  type ProjectWizardDraft,
} from "../lib/delivereeSkills";
import {
  buildNotebookContext,
  type NotebookEntry,
} from "../lib/notebookContext";
import {
  WORKSPACE_LIMIT,
  WORKSPACE_ROLES,
  canCreateWorkspace,
  createInviteCode,
  memberAssignmentValue,
  memberLabel,
  normalizeInviteEmail,
  roleLabel,
  type WorkspaceMember,
  type WorkspaceTeam,
} from "../lib/workspaceCollaboration";

type Conversation = {
  id: string;
  title?: string;
  contextEntityId?: string | null;
  sourceContext?: string | null;
  conversationType?: ConversationScopeType;
  linkedProjectIds?: string[];
  linkedTaskIds?: string[];
  isChiefOfStaff?: boolean;
  updatedAt?: any;
  createdAt?: any;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: any;
  citations?: Array<{ id: string; title: string; type?: string }>;
  suggestedChips?: string[];
  actionPlan?: any;
  offline?: boolean;
};

type Panel =
  | "today"
  | "projects"
  | "project"
  | "approvals"
  | "skills"
  | "digest"
  | "workspace"
  | null;
type CenterView =
  | "conversation"
  | "items"
  | "notes"
  | "strategy"
  | "portfolio"
  | "project"
  | "settings";

function timestamp(value: any) {
  if (value?.seconds)
    return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  return typeof value === "number" ? value : 0;
}

function timeAgo(value: any) {
  const delta = Math.max(0, Date.now() - timestamp(value));
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "D";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function displayName(name?: string | null, email?: string | null) {
  return name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "there";
}

function entityTitle(entity: any) {
  return entity?.title || entity?.name || "Untitled";
}

function isGenericProjectTitle(value: any) {
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

function proposedTitle(proposed: any, fallback: any) {
  const proposedValue = String(proposed?.title || proposed?.name || "").trim();
  if (proposedValue && !isGenericProjectTitle(proposedValue))
    return proposedValue;
  const fallbackValue = String(fallback || "").trim();
  if (fallbackValue && !isGenericProjectTitle(fallbackValue))
    return fallbackValue;
  return proposedValue || fallbackValue || "Untitled";
}

function projectWorkKey(project: any) {
  const explicit = String(project?.projectKey || project?.key || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (explicit) return explicit.slice(0, 10);
  const words = String(project?.title || project?.name || "WORK")
    .toUpperCase()
    .match(/[A-Z0-9]+/g) || ["WORK"];
  const initials = words.map((word) => word[0]).join("");
  return (initials.length >= 2 ? initials : words[0].slice(0, 5)).slice(0, 6);
}

function isClosed(status?: string) {
  return ["done", "completed", "closed", "archived", "cancelled"].includes(
    String(status || "").toLowerCase(),
  );
}

function localDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateKey(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value?.toDate) return localDateKey(value.toDate());
  if (value?.seconds) return localDateKey(new Date(value.seconds * 1000));
  return "";
}

function priorityLabel(value: any) {
  const normalized = String(value || "").toLowerCase();
  if (["urgent", "critical", "p0", "p1", "high", "1"].includes(normalized))
    return "Priority 1";
  if (["p2", "medium", "2"].includes(normalized)) return "Priority 2";
  if (["p3", "low", "3"].includes(normalized)) return "Priority 3";
  return "N/A";
}

function reviewTypeForAction(type?: string) {
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

function normalizedEntityName(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findMatchingProject(
  projects: any[],
  proposed: any,
  fallbackProjectId = "",
) {
  const explicitId = String(
    proposed?.projectId || proposed?.id || fallbackProjectId || "",
  );
  if (explicitId) {
    const direct = projects.find((project) => project.id === explicitId);
    if (direct) return direct;
  }
  const proposedTitle = normalizedEntityName(
    proposed?.title ||
      proposed?.name ||
      proposed?.projectTitle ||
      proposed?.projectName,
  );
  if (!proposedTitle) return null;
  return (
    projects.find((project) => {
      const title = normalizedEntityName(project.title || project.name);
      return (
        title === proposedTitle ||
        title.includes(proposedTitle) ||
        proposedTitle.includes(title)
      );
    }) || null
  );
}

function isDuplicateProjectProposal(
  action: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  if (String(action?.type || "") !== "create_project") return null;
  return (
    findMatchingProject(
      projects,
      action?.proposedChange || {},
      fallbackProject?.id || "",
    ) ||
    fallbackProject ||
    null
  );
}

function proposalActionType(
  action: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  return isDuplicateProjectProposal(action, projects, fallbackProject)
    ? "update_project"
    : String(action?.type || "");
}

function proposalActionTitle(
  action: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  const existingProject = isDuplicateProjectProposal(
    action,
    projects,
    fallbackProject,
  );
  const proposedTitle =
    action?.proposedChange?.title ||
    action?.proposedChange?.name ||
    action?.reason ||
    "Review details";
  if (!existingProject) return proposedTitle;
  return `Update existing project: ${existingProject.title || existingProject.name || proposedTitle}`;
}

function proposalChipLabel(
  chip: string,
  plan: any,
  projects: any[],
  fallbackProject: any | null = null,
) {
  const hasDuplicateProject = plan?.proposedActions?.some((action: any) =>
    isDuplicateProjectProposal(action, projects, fallbackProject),
  );
  if (!hasDuplicateProject) return chip;
  if (
    /approve.*project.*creation|create.*project|project.*creation/i.test(chip)
  )
    return "Update existing project";
  return chip;
}

function reviewTypeLabel(type?: string) {
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

function RichText({ text }: { text: string }) {
  return (
    <div className="do-rich-text">
      {text.split("\n").map((line, index) => {
        const plain = line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "");
        if (!plain.trim()) return <div className="do-rich-space" key={index} />;
        if (/^#{1,4}\s/.test(line)) return <h3 key={index}>{plain}</h3>;
        if (/^\s*[-*]\s/.test(line)) {
          return (
            <div className="do-rich-bullet" key={index}>
              <span />
              <p>{plain.replace(/^\s*[-*]\s*/, "")}</p>
            </div>
          );
        }
        return <p key={index}>{plain}</p>;
      })}
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isDocument = text.length > 2_500;
  const visible =
    isDocument && !expanded ? `${text.slice(0, 1_400).trimEnd()}…` : text;
  return (
    <div className={`do-user-message ${isDocument ? "is-document" : ""}`}>
      {isDocument && (
        <div className="do-user-document-head">
          <span>
            Long project input · {text.length.toLocaleString()} characters
          </span>
          <button onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? "Collapse" : "Show full"}
          </button>
        </div>
      )}
      <div>{visible}</div>
    </div>
  );
}

function ActionProposal({
  message,
  projects,
  activeProject,
  onStage,
}: {
  message: Message;
  projects: any[];
  activeProject: any | null;
  onStage: (message: Message) => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const plan = message.actionPlan;
  if (!plan?.proposedActions?.length) return null;
  return (
    <section className="do-proposal" data-testid="action-proposal">
      <div className="do-proposal-head">
        <div>
          <span className="do-kicker">Pending</span>
          <h3>{plan.title || "Pending changes"}</h3>
          <p>{plan.summary}</p>
        </div>
        <ShieldCheck size={17} />
      </div>
      <div className="do-proposal-items">
        {plan.proposedActions.map((action: any, index: number) => (
          <div className="do-proposal-item" key={`${action.type}-${index}`}>
            <span className="do-proposal-number">{index + 1}</span>
            <div>
              <strong>
                {actionLabel(
                  proposalActionType(action, projects, activeProject),
                )}
              </strong>
              <p>{proposalActionTitle(action, projects, activeProject)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="do-proposal-foot">
        <span>Nothing changes until you apply it.</span>
        <button
          className="do-button do-button-dark"
          disabled={status !== "idle"}
          onClick={async () => {
            setStatus("saving");
            await onStage(message);
            setStatus("done");
          }}
          type="button"
        >
          {status === "saving" ? (
            <Loader2 className="spin" size={14} />
          ) : status === "done" ? (
            <Check size={14} />
          ) : (
            <ShieldCheck size={14} />
          )}
          {status === "done" ? "Ready to apply" : "Review pending"}
        </button>
      </div>
    </section>
  );
}

export function DelivereeWorkspace() {
  const {
    user,
    workspace,
    workspaces,
    setWorkspace,
    reloadWorkspaces,
    logOut,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const lens = resolveDelivereeLens(location.pathname);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>([]);
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    [],
  );
  const [workspaceTeams, setWorkspaceTeams] = useState<WorkspaceTeam[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<any[]>([]);
  const [costTemplates, setCostTemplates] = useState<any[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<any[]>([]);
  const [strategicGoals, setStrategicGoals] = useState<any[]>([]);
  const [strategicMeasures, setStrategicMeasures] = useState<any[]>([]);
  const [strategicRecords, setStrategicRecords] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [judgment, setJudgment] = useState<JudgmentAssessment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("certo-sidebar-collapsed") === "true"
      : false,
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contextTaskSearch, setContextTaskSearch] = useState("");
  const [chatsExpanded, setChatsExpanded] = useState(false);
  const [projectConsoleId, setProjectConsoleId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [centerHistory, setCenterHistory] = useState<{
    items: CenterView[];
    index: number;
  }>({ items: ["conversation"], index: 0 });
  const centerView = centerHistory.items[centerHistory.index];
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [cleanSlateOpen, setCleanSlateOpen] = useState(false);
  const [cleanConfirmText, setCleanConfirmText] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [newTeamName, setNewTeamName] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const goCenterView = (next: CenterView) => {
    setCenterHistory((current) => {
      if (current.items[current.index] === next) return current;
      const items = [...current.items.slice(0, current.index + 1), next];
      return { items, index: items.length - 1 };
    });
  };
  const goCenterBack = () =>
    setCenterHistory((current) => ({
      ...current,
      index: Math.max(0, current.index - 1),
    }));
  const goCenterForward = () =>
    setCenterHistory((current) => ({
      ...current,
      index: Math.min(current.items.length - 1, current.index + 1),
    }));

  useEffect(() => {
    if (!user || !workspace) return;
    setWorkspaceNameDraft(workspace.name || "Workspace");
    const makeQuery = (
      name: string,
      callback: (items: any[]) => void,
      activeOnly = false,
      personal = false,
    ) => {
      const clauses: any[] = personal
        ? [
            where("userId", "==", user.uid),
            where("workspaceId", "==", workspace.id),
          ]
        : [where("workspaceId", "==", workspace.id)];
      if (activeOnly) clauses.push(where("status", "==", "active"));
      return onSnapshot(
        query(collection(db, name), ...clauses),
        (snapshot) =>
          callback(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
          ),
        () => callback([]),
      );
    };
    const unsubscribers = [
      makeQuery(
        "boldi_conversations",
        (items) => {
          const sorted = items.sort(
            (left, right) =>
              timestamp(right.updatedAt || right.createdAt) -
              timestamp(left.updatedAt || left.createdAt),
          );
          setConversations(sorted);
          setConversationId((current) => current || sorted[0]?.id || null);
        },
        true,
        true,
      ),
      makeQuery("projects", setProjects),
      makeQuery("tasks", setTasks),
      makeQuery("milestones", setMilestones),
      makeQuery("boldr_risks", setRisks),
      makeQuery("categories", setCategories),
      makeQuery("cost_templates", setCostTemplates),
      makeQuery("agent_templates", (items) =>
        setProjectTemplates(
          items.filter((item) => item.templateType === "project"),
        ),
      ),
      makeQuery("strategic_goals", setStrategicGoals),
      makeQuery("key_results", setStrategicMeasures),
      makeQuery("strategic_initiatives", setStrategicRecords),
      makeQuery("knowledge_items", setKnowledgeItems, false, true),
      makeQuery(
        "notebook_entries",
        (items) => setNotebookEntries(items as NotebookEntry[]),
        false,
        true,
      ),
      makeQuery(
        "review_candidates",
        (items) =>
          setReviewItems(
            items.filter((item) =>
              ["pending", "approved_for_review"].includes(item.status),
            ),
          ),
        false,
        true,
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, workspace]);

  useEffect(() => {
    window.localStorage.setItem(
      "certo-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!user || !workspace) return;
    const unsubscribers = [
      onSnapshot(
        query(
          collection(db, "workspace_members"),
          where("workspaceId", "==", workspace.id),
        ),
        (snapshot) =>
          setWorkspaceMembers(
            snapshot.docs.map(
              (item) => ({ id: item.id, ...item.data() }) as WorkspaceMember,
            ),
          ),
        () => setWorkspaceMembers([]),
      ),
      onSnapshot(
        query(
          collection(db, "agent_groups"),
          where("workspaceId", "==", workspace.id),
        ),
        (snapshot) =>
          setWorkspaceTeams(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }) as WorkspaceTeam)
              .filter(
                (team: any) =>
                  team.groupType === "workspace_team" &&
                  team.status !== "archived",
              ),
          ),
        () => setWorkspaceTeams([]),
      ),
      onSnapshot(
        query(
          collection(db, "agent_invites"),
          where("workspaceId", "==", workspace.id),
        ),
        (snapshot) =>
          setWorkspaceInvites(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }))
              .filter(
                (invite: any) =>
                  invite.inviteType === "workspace_member" &&
                  !["accepted", "revoked"].includes(
                    String(invite.status || "").toLowerCase(),
                  ),
              ),
          ),
        () => setWorkspaceInvites([]),
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, workspace]);

  useEffect(() => {
    if (!conversationId || !user || !workspace) {
      setMessages([]);
      return;
    }
    return onSnapshot(
      query(
        collection(db, "boldi_messages"),
        where("conversationId", "==", conversationId),
        where("userId", "==", user.uid),
        where("workspaceId", "==", workspace.id),
      ),
      (snapshot) =>
        setMessages(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }) as Message)
            .sort(
              (left, right) =>
                timestamp(left.createdAt) - timestamp(right.createdAt),
            ),
        ),
      () => setMessages([]),
    );
  }, [conversationId, user, workspace]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamed, submitting]);

  useEffect(() => {
    if (lens.kind === "review") setPanel("approvals");
    if (lens.kind === "work")
      setPanel(lens.section === "portfolio" ? "projects" : "today");
    if (lens.kind === "settings") {
      setPanel(null);
      goCenterView("settings");
    }
  }, [lens.kind, lens.kind === "work" ? lens.section : null]);

  useEffect(() => {
    const Recognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Recognition) return;
    setVoiceSupported(true);
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      setInput(
        Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join(" "),
      );
    };
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const activeProjects = useMemo(
    () =>
      sortProjectsByRecency(
        projects.filter((project) => !isClosed(project.status)),
      ),
    [projects],
  );
  const sidebarProjects = useMemo(
    () => sidebarProjectGroups(projects),
    [projects],
  );
  const openTasks = useMemo(
    () => tasks.filter((task) => !isClosed(task.status)),
    [tasks],
  );
  const activeProject = useMemo(
    () =>
      lens.kind === "project"
        ? projects.find((project) => project.id === lens.projectId)
        : null,
    [lens, projects],
  );
  const currentConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const impliedConversationScope =
    currentConversation ||
    (activeProject
      ? {
          linkedProjectIds: [activeProject.id],
          linkedTaskIds: [],
          conversationType: "project" as const,
        }
      : null);
  const directContextProjectIds = conversationProjectIds(
    impliedConversationScope,
  );
  const conversationContextTaskIds = conversationTaskIds(
    impliedConversationScope,
  );
  const selectedWorkItem = selectedWorkItemId
    ? tasks.find((task) => task.id === selectedWorkItemId) || null
    : null;
  const contextTaskIds = [
    ...new Set([
      ...conversationContextTaskIds,
      ...(selectedWorkItem ? [selectedWorkItem.id] : []),
    ]),
  ];
  const contextTasks = openTasks.filter((task) =>
    contextTaskIds.includes(task.id),
  );
  const contextProjectIds = [
    ...new Set([
      ...directContextProjectIds,
      ...(selectedWorkItem?.projectId
        ? [String(selectedWorkItem.projectId)]
        : []),
      ...contextTasks
        .map((task) => String(task.projectId || ""))
        .filter(Boolean),
    ]),
  ];
  const contextProjects = projects.filter((project) =>
    contextProjectIds.includes(project.id),
  );
  const primaryProject =
    contextProjects.length === 1 ? contextProjects[0] : null;
  const routeOrPrimaryProject = primaryProject || activeProject;
  const isFocusedConversation =
    directContextProjectIds.length > 0 || contextTaskIds.length > 0;
  const projectTasks = useMemo(
    () =>
      openTasks.filter(
        (task) =>
          directContextProjectIds.includes(String(task.projectId || "")) ||
          contextTaskIds.includes(task.id),
      ),
    [contextTaskIds, directContextProjectIds, openTasks],
  );
  const consoleProject = useMemo(
    () =>
      projects.find((project) => project.id === projectConsoleId) ||
      routeOrPrimaryProject ||
      null,
    [projectConsoleId, projects, routeOrPrimaryProject],
  );
  const projectDocuments = useMemo(
    () =>
      knowledgeItems.filter(
        (item) =>
          contextProjectIds.includes(item.projectId) &&
          item.status !== "archived",
      ),
    [contextProjectIds, knowledgeItems],
  );
  const todayKey = localDateKey(new Date());
  const todayTasks = useMemo(
    () =>
      openTasks
        .filter(
          (task) =>
            dateKey(task.dueDate) === todayKey ||
            String(task.timeSector || "").toLowerCase() === "today",
        )
        .sort((left, right) =>
          String(left.priority || "z").localeCompare(
            String(right.priority || "z"),
          ),
        ),
    [openTasks, todayKey],
  );
  const visibleMessages = messages.filter(
    (message) => message.role !== "system",
  );
  const contextualMessages = visibleMessages;
  const currentContextLabel = selectedWorkItem
    ? entityTitle(selectedWorkItem)
    : conversationScopeLabel(impliedConversationScope, projects, tasks);
  const filteredConversations = conversations.filter((conversation) =>
    String(conversation.title || "")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (!activeProject) return;
    setConversationId((currentId) => {
      const current = conversations.find(
        (conversation) => conversation.id === currentId,
      );
      if (conversationIncludesProject(current, activeProject.id))
        return currentId;
      return (
        conversations.find(
          (conversation) =>
            conversationProjectIds(conversation).length === 1 &&
            conversationTaskIds(conversation).length === 0 &&
            conversationIncludesProject(conversation, activeProject.id),
        )?.id || null
      );
    });
  }, [activeProject, conversations]);

  const createConversation = useCallback(async () => {
    if (!user || !workspace || creatingConversation) return;
    setCreatingConversation(true);
    setNotice("");
    try {
      const ref = await addDoc(collection(db, "boldi_conversations"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: "New conversation",
        status: "active",
        sourceContext: activeProject ? "project" : "home",
        contextEntityId: activeProject?.id || null,
        conversationType: activeProject ? "project" : "general",
        linkedProjectIds: activeProject ? [activeProject.id] : [],
        linkedTaskIds: [],
        isChiefOfStaff: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setConversations((current) => [
        {
          id: ref.id,
          title: "New conversation",
          contextEntityId: activeProject?.id || null,
          sourceContext: activeProject ? "project" : "home",
          conversationType: activeProject ? "project" : "general",
          linkedProjectIds: activeProject ? [activeProject.id] : [],
          linkedTaskIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        ...current.filter((conversation) => conversation.id !== ref.id),
      ]);
      setConversationId(ref.id);
      setMessages([]);
      setInput("");
      setJudgment(null);
      setSidebarOpen(false);
      setPanel(null);
      navigate(activeProject ? `/work/projects/${activeProject.id}` : "/");
      requestAnimationFrame(() => composerRef.current?.focus());
    } catch {
      setNotice(
        "A new conversation could not be created. Check workspace access and try again.",
      );
    } finally {
      setCreatingConversation(false);
    }
  }, [activeProject, creatingConversation, navigate, user, workspace]);

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createConversation();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [createConversation]);

  const ensureConversation = async (title: string) => {
    if (conversationId) return conversationId;
    if (!user || !workspace) throw new Error("Workspace is still loading");
    const projectIds = activeProject ? [activeProject.id] : [];
    const ref = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: title.slice(0, 64) || "New conversation",
      status: "active",
      sourceContext: activeProject ? "project" : "home",
      contextEntityId: activeProject?.id || null,
      conversationType: conversationScopeType(projectIds, []),
      linkedProjectIds: projectIds,
      linkedTaskIds: [],
      isChiefOfStaff: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    return ref.id;
  };

  const openChiefOfStaff = async () => {
    if (!user || !workspace) return;
    const existing =
      conversations.find((conversation) => conversation.isChiefOfStaff) ||
      conversations.find(
        (conversation) =>
          conversationProjectIds(conversation).length === 0 &&
          conversationTaskIds(conversation).length === 0,
      );
    if (existing) {
      if (
        !existing.isChiefOfStaff ||
        existing.conversationType !== "chief_of_staff"
      ) {
        await updateDoc(doc(db, "boldi_conversations", existing.id), {
          conversationType: "chief_of_staff",
          isChiefOfStaff: true,
          updatedAt: serverTimestamp(),
        });
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === existing.id
              ? {
                  ...conversation,
                  conversationType: "chief_of_staff",
                  isChiefOfStaff: true,
                  updatedAt: Date.now(),
                }
              : conversation,
          ),
        );
      }
      setConversationId(existing.id);
      navigate("/");
      setSidebarOpen(false);
      return;
    }
    const ref = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: "Chief of Staff",
      status: "active",
      sourceContext: "home",
      contextEntityId: null,
      conversationType: "chief_of_staff",
      linkedProjectIds: [],
      linkedTaskIds: [],
      isChiefOfStaff: true,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    setMessages([]);
    navigate("/");
    setSidebarOpen(false);
  };

  const updateConversationContext = async (
    projectIds: string[],
    taskIds: string[],
    asChiefOfStaff = false,
  ) => {
    if (!user || !workspace) return;
    const targetId = await ensureConversation("New conversation");
    const normalizedProjects = [...new Set(projectIds)].filter(Boolean);
    const normalizedTasks = [...new Set(taskIds)].filter(Boolean);
    const derivedScopeType = conversationScopeType(
      normalizedProjects,
      normalizedTasks,
    );
    const scopeType: ConversationScopeType =
      asChiefOfStaff &&
      normalizedProjects.length === 0 &&
      normalizedTasks.length === 0
        ? "chief_of_staff"
        : derivedScopeType;
    await updateDoc(doc(db, "boldi_conversations", targetId), {
      sourceContext:
        scopeType.includes("project") || scopeType === "mixed"
          ? "project"
          : scopeType.includes("task")
            ? "task"
            : "home",
      contextEntityId:
        normalizedProjects.length === 1 && normalizedTasks.length === 0
          ? normalizedProjects[0]
          : null,
      conversationType: scopeType,
      linkedProjectIds: normalizedProjects,
      linkedTaskIds: normalizedTasks,
      isChiefOfStaff: scopeType === "chief_of_staff",
      updatedAt: serverTimestamp(),
    });
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === targetId
          ? {
              ...conversation,
              sourceContext:
                scopeType.includes("project") || scopeType === "mixed"
                  ? "project"
                  : scopeType.includes("task")
                    ? "task"
                    : "home",
              contextEntityId:
                normalizedProjects.length === 1 && normalizedTasks.length === 0
                  ? normalizedProjects[0]
                  : null,
              conversationType: scopeType,
              linkedProjectIds: normalizedProjects,
              linkedTaskIds: normalizedTasks,
              isChiefOfStaff: scopeType === "chief_of_staff",
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    );
    if (normalizedProjects.length === 1 && normalizedTasks.length === 0)
      navigate(`/work/projects/${normalizedProjects[0]}`);
    else navigate("/");
  };

  const streamReply = async (text: string) => {
    const size = Math.max(8, Math.ceil(text.length / 70));
    for (let index = 0; index < text.length; index += size) {
      setStreamed(text.slice(0, index + size));
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
  };

  const sendMessage = async (explicit?: string) => {
    const text = String(explicit || input).trim();
    if (!text || !user || !workspace || submitting) return;
    if (isProjectWizardInvocation(text)) {
      setInput("");
      setActionMenuOpen(false);
      setProjectWizardOpen(true);
      return;
    }
    setInput("");
    setActionMenuOpen(false);
    setSubmitting(true);
    setStreamed("");
    setNotice("");
    const localId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: localId, role: "user", content: text, createdAt: Date.now() },
    ]);
    let activeConversationId: string | null = conversationId;
    try {
      activeConversationId = await ensureConversation(text);
      const userMessageRef = await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        role: "user",
        content: text,
        inputType: "text",
        contextType: conversationScopeType(
          directContextProjectIds,
          contextTaskIds,
        ),
        contextEntityId: primaryProject?.id || null,
        createdAt: serverTimestamp(),
      });

      const operatingScope = isFocusedConversation
        ? "focused_delivery"
        : "chief_of_staff";
      const scopedTasks = isFocusedConversation ? projectTasks : openTasks;
      const scopedProjects = isFocusedConversation
        ? contextProjects
        : activeProjects;
      const scopedMilestones = isFocusedConversation
        ? milestones.filter((item) =>
            contextProjectIds.includes(item.projectId),
          )
        : milestones;
      const scopedRisks = isFocusedConversation
        ? risks.filter((item) => contextProjectIds.includes(item.projectId))
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
          ? userMessageRef.id
          : previousLongProjectMessage?.id || userMessageRef.id;
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
      const nextJudgment = evaluateJudgment(text, workspaceSnapshot);
      setJudgment(nextJudgment);
      const token = await user.getIdToken();
      const response = await fetch("/api/boldi/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          conversationId: activeConversationId,
          messages: [
            ...contextualMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            { role: "user", content: text },
          ],
          workspaceContext: {
            ...workspaceSnapshot,
            judgment: nextJudgment,
            mode: operatingScope,
            activeProject: primaryProject,
            contextProjects,
            contextTasks,
            conversationType: conversationScopeType(
              directContextProjectIds,
              contextTaskIds,
            ),
            conversationDirectory: conversations
              .slice(0, 30)
              .map((conversation) => ({
                id: conversation.id,
                title: conversation.title || "New conversation",
                scope: conversationScopeLabel(conversation, projects, tasks),
                conversationType:
                  conversation.conversationType ||
                  conversationScopeType(
                    conversationProjectIds(conversation),
                    conversationTaskIds(conversation),
                  ),
              })),
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
                  contextProjectIds.includes(
                    item.projectId || item.proposed?.projectId,
                  ),
                ).length
              : reviewItems.length,
            currentUserMessageId: userMessageRef.id,
            projectArtifactSourceMessageId,
            documents: [
              ...(isFocusedConversation
                ? buildProjectDocumentContext(projectDocuments, text)
                : []),
              ...notebookDocuments,
            ],
            notebookNotes: notebookDocuments,
            userId: user.uid,
            workspaceId: workspace.id,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.error || "The AI service is temporarily unavailable.",
        );
      const reply =
        result.reply ||
        "I reviewed the workspace, but there is no response to display.";
      await streamReply(reply);
      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        role: "assistant",
        content: reply,
        inputType: "text",
        citations: result.citations || [],
        suggestedChips: result.suggestedChips || [],
        actionPlan: result.actionPlan || null,
        provider: result.provider || null,
        judgment: nextJudgment,
        createdAt: serverTimestamp(),
      });
      if (activeConversationId) {
        await updateDoc(doc(db, "boldi_conversations", activeConversationId), {
          title:
            contextualMessages.length === 0
              ? text.slice(0, 64)
              : currentConversation?.title || text.slice(0, 64),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      const reply = `I couldn't complete that request: ${error instanceof Error ? error.message : "the service is unavailable"}\n\nNothing was changed.`;
      await streamReply(reply);
      setMessages((current) => [
        ...current.filter((message) => message.id !== localId),
        { id: localId, role: "user", content: text, createdAt: Date.now() },
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: reply,
          createdAt: Date.now(),
          offline: true,
        },
      ]);
    } finally {
      setStreamed("");
      setSubmitting(false);
    }
  };

  const stagePlan = async (message: Message) => {
    if (!user || !workspace || !message.actionPlan) return;
    const plan = message.actionPlan;
    const planRef = await addDoc(collection(db, "boldi_action_plans"), {
      userId: user.uid,
      workspaceId: workspace.id,
      conversationId,
      title: plan.title,
      summary: plan.summary,
      riskLevel: plan.riskLevel || "medium",
      status: "approved_for_review",
      contextEntityId: primaryProject?.id || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    for (const action of plan.proposedActions || []) {
      const proposedChange = action.proposedChange || {};
      const duplicateProject =
        String(action.type || "") === "create_project"
          ? findMatchingProject(
              projects,
              proposedChange,
              primaryProject?.id || "",
            )
          : null;
      const actionType = duplicateProject ? "update_project" : action.type;
      const reviewType = reviewTypeForAction(actionType);
      const projectId =
        duplicateProject?.id ||
        proposedChange.projectId ||
        primaryProject?.id ||
        "";
      await addDoc(collection(db, "review_candidates"), {
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        title:
          reviewType === "project"
            ? proposedTitle(proposedChange, actionLabel(actionType))
            : proposedChange?.title || actionLabel(actionType),
        type: reviewType,
        why: action.reason || "Proposed in conversation",
        action: actionLabel(actionType),
        confidence: Number(action.confidence || 0.8) >= 0.8 ? "high" : "medium",
        proposed: {
          ...proposedChange,
          projectId,
          ...(duplicateProject ? { id: duplicateProject.id } : {}),
        },
        projectId,
        source: duplicateProject
          ? `${plan.summary || "Certo Work conversation"} · Existing project recognized; converted create_project to update_project.`
          : plan.summary || "Certo Work conversation",
        sourceType: "delivereeos",
        sourceId: planRef.id,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setNotice("Pending change ready. Review it before anything changes.");
    setPanel("approvals");
  };

  const processReview = async (
    candidate: any,
    decision: "approve" | "dismiss",
  ) => {
    if (!user || !workspace) return;
    try {
      if (decision === "dismiss") {
        await updateDoc(doc(db, "review_candidates", candidate.id), {
          status: "dismissed",
          updatedAt: serverTimestamp(),
        });
        setNotice("Pending change dismissed. Nothing changed.");
        return;
      }
      const proposed = candidate.proposed || {};
      const reviewType = String(candidate.type || "task");
      const projectId =
        proposed.projectId || candidate.projectId || primaryProject?.id || "";
      let convertedToType = reviewType;
      let convertedToId = "";

      if (
        ["task_update", "milestone_update", "risk_update"].includes(reviewType)
      ) {
        const targetId = String(
          proposed.taskId ||
            proposed.milestoneId ||
            proposed.riskId ||
            proposed.id ||
            "",
        );
        const collectionName =
          reviewType === "task_update"
            ? "tasks"
            : reviewType === "milestone_update"
              ? "milestones"
              : "boldr_risks";
        const allowedFields =
          reviewType === "task_update"
            ? [
                "title",
                "description",
                "status",
                "priority",
                "dueDate",
                "owner",
                "assignee",
                "assigneeId",
                "projectId",
                "timeSector",
                "actionType",
                "gtdActionType",
                "globalStageId",
                "definitionOfDone",
                "type",
                "workItemType",
                "itemType",
                "parentId",
                "epicId",
                "featureId",
                "sprintId",
                "acceptanceCriteria",
                "storyPoints",
                "estimateHours",
                "labels",
                "dependencyIds",
                "blocked",
                "blockedReason",
              ]
            : reviewType === "milestone_update"
              ? [
                  "title",
                  "description",
                  "status",
                  "dueDate",
                  "targetDate",
                  "owner",
                  "projectId",
                ]
              : [
                  "title",
                  "description",
                  "status",
                  "severity",
                  "owner",
                  "mitigation",
                  "projectId",
                  "type",
                ];
        if (!targetId) throw new Error("The item to update is required");
        const patch = Object.fromEntries(
          allowedFields
            .filter((field) => proposed[field] !== undefined)
            .map((field) => [field, proposed[field]]),
        );
        await updateDoc(doc(db, collectionName, targetId), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
        convertedToType = collectionName;
        convertedToId = targetId;
      } else if (reviewType === "conversation_message") {
        const targetConversationId = String(
          proposed.targetConversationId || "",
        );
        const targetConversation = conversations.find(
          (conversation) => conversation.id === targetConversationId,
        );
        const content = String(
          proposed.content || proposed.message || proposed.summary || "",
        ).trim();
        if (!targetConversation || !content)
          throw new Error(
            "A valid target conversation and message are required",
          );
        await addDoc(collection(db, "boldi_messages"), {
          userId: user.uid,
          workspaceId: workspace.id,
          conversationId: targetConversationId,
          role: "assistant",
          content: `**Handoff from Chief of Staff**\n\n${content}`,
          inputType: "conversation_handoff",
          sourceConversationId: conversationId,
          contextType: targetConversation.conversationType || "general",
          contextEntityId: targetConversation.contextEntityId || null,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "boldi_conversations", targetConversationId), {
          updatedAt: serverTimestamp(),
        });
        convertedToType = "conversation";
        convertedToId = targetConversationId;
      } else if (reviewType === "digest_request") {
        const content = String(
          proposed.content || proposed.message || proposed.summary || "",
        ).trim();
        const created = await addDoc(collection(db, "daily_briefs"), {
          userId: user.uid,
          workspaceId: workspace.id,
          type: proposed.digestType || proposed.cadence || "email_reminder",
          title: candidate.title || proposed.subject || "Email reminder",
          requestedChannel: "email",
          email: proposed.email || user.email || "",
          status: "draft",
          deliveryStatus: "needs_email_service",
          subject: proposed.subject || "",
          content,
          scope: proposed.scope || "workspace",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        convertedToType = "daily_briefs";
        convertedToId = created.id;
      } else if (reviewType === "project_update") {
        if (!projectId) throw new Error("Project context is required");
        const allowedFields = [
          "title",
          "outcome",
          "objective",
          "description",
          "status",
          "methodology",
          "targetDate",
          "dueDate",
          "priority",
          "projectType",
          "category",
          "health",
          "sprintGoal",
          "projectManager",
          "sponsor",
          "teamMembers",
          "definitionOfDone",
          "deliveryStage",
          "nextAction",
          "initialCost",
          "recurringMonthlyCost",
          "costTemplateId",
          "costBreakdown",
        ];
        const patch = Object.fromEntries(
          allowedFields
            .filter((field) => proposed[field] !== undefined)
            .map((field) => [field, proposed[field]]),
        );
        await updateDoc(doc(db, "projects", projectId), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
        convertedToType = "project";
        convertedToId = projectId;
      } else if (reviewType === "project") {
        const existingProject = findMatchingProject(
          projects,
          proposed,
          projectId,
        );
        if (existingProject?.id) {
          const allowedFields = [
            "title",
            "outcome",
            "objective",
            "description",
            "status",
            "methodology",
            "targetDate",
            "dueDate",
            "priority",
            "projectType",
            "category",
            "health",
            "sprintGoal",
            "projectManager",
            "sponsor",
            "teamMembers",
            "definitionOfDone",
            "deliveryStage",
            "nextAction",
            "initialCost",
            "recurringMonthlyCost",
            "costTemplateId",
            "costBreakdown",
          ];
          const patch = Object.fromEntries(
            allowedFields
              .filter((field) => proposed[field] !== undefined)
              .map((field) => [field, proposed[field]]),
          );
          await updateDoc(doc(db, "projects", existingProject.id), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
          convertedToType = "project";
          convertedToId = existingProject.id;
        } else {
          let payload: Record<string, unknown> = {
            ...proposed,
            userId: user.uid,
            workspaceId: workspace.id,
            title: proposedTitle(proposed, candidate.title),
            status: proposed.status || "planning",
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          delete payload.projectId;
          const created = await addDoc(collection(db, "projects"), payload);
          convertedToType = "projects";
          convertedToId = created.id;
        }
      } else {
        let collectionName = "tasks";
        let payload: Record<string, unknown> = {
          ...proposed,
          userId: user.uid,
          workspaceId: workspace.id,
          projectId,
          title:
            reviewType === "project"
              ? proposedTitle(proposed, candidate.title)
              : candidate.title || proposed.title || "Untitled",
          status: proposed.status || "open",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (reviewType === "milestone") {
          collectionName = "milestones";
          payload = { ...payload, status: proposed.status || "not_started" };
        } else if (reviewType === "risk") {
          collectionName = "boldr_risks";
          payload = {
            ...payload,
            status: proposed.status || "open",
            severity: proposed.severity || "medium",
            type: proposed.riskType || "project_risk",
          };
        } else if (reviewType === "knowledge") {
          collectionName = "knowledge_items";
          let sourceContent = String(proposed.content || proposed.body || "");
          if (proposed.sourceMessageId) {
            const sourceMessage = await getDoc(
              doc(db, "boldi_messages", String(proposed.sourceMessageId)),
            );
            if (sourceMessage.exists())
              sourceContent = String(
                sourceMessage.data().content || sourceContent,
              );
          }
          payload = {
            ...payload,
            type: "Project Document",
            docType: proposed.docType || "PRD",
            status: "active",
            content: sourceContent,
            body: sourceContent,
            summary: proposed.summary || proposed.description || "",
            sensitivity: proposed.sensitivity || "internal",
            aiReadable: true,
            isAIReadable: true,
            aiUsageScope: "project_builder",
            sourceMessageId: proposed.sourceMessageId || "",
          };
        }

        const created = await addDoc(collection(db, collectionName), payload);
        convertedToType = collectionName;
        convertedToId = created.id;
      }
      await updateDoc(doc(db, "review_candidates", candidate.id), {
        status: "approved",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        convertedToType,
        convertedToId,
        updatedAt: serverTimestamp(),
      });
      setNotice(
        `${reviewTypeLabel(reviewType)} ${reviewType === "project_update" ? "updated" : "created"}.`,
      );
    } catch {
      setNotice(
        "That pending change could not be processed. It is still waiting for you.",
      );
    }
  };

  const setComposer = (value: string) => {
    setInput(value);
    setPanel(null);
    setActionMenuOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const selectProjectContext = (project: any) => {
    const projectConversation = conversations.find(
      (conversation) =>
        conversationProjectIds(conversation).length === 1 &&
        conversationTaskIds(conversation).length === 0 &&
        conversationIncludesProject(conversation, project.id),
    );
    setConversationId(projectConversation?.id || null);
    navigate(`/work/projects/${project.id}`);
    setPanel(null);
    setSidebarOpen(false);
  };

  const openProjectRecord = (project: any) => {
    selectProjectContext(project);
    setProjectConsoleId(project.id);
    setPanel(null);
    goCenterView("project");
  };

  const updateProject = async (
    projectId: string,
    patch: Record<string, unknown>,
  ) => {
    await updateDoc(doc(db, "projects", projectId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const createControlledOption = async (
    group: "delivery_entity" | "client_entity" | "tag",
    name: string,
  ) => {
    if (!user || !workspace) return name;
    const cleaned = name.trim();
    if (!cleaned) return "";
    const exists = categories.some(
      (category) =>
        categoryGroup(category) === group &&
        String(category.name || "").trim().toLowerCase() ===
          cleaned.toLowerCase(),
    );
    const existing = categories.find(
      (category) =>
        categoryGroup(category) === group &&
        String(category.name || "").trim().toLowerCase() ===
          cleaned.toLowerCase(),
    );
    if (exists) return group === "tag" ? existing?.id || cleaned : cleaned;
    const created = await addDoc(collection(db, "categories"), {
      userId: user.uid,
      workspaceId: workspace.id,
      name: cleaned,
      group,
      color:
        group === "delivery_entity"
          ? "#315f46"
          : group === "client_entity"
            ? "#4b6988"
            : "#7b5ea7",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice(`${cleaned} added to ${group.replace(/_/g, " ")}.`);
    return group === "tag" ? created.id : cleaned;
  };

  const renameControlledOption = async (
    group: "delivery_entity" | "client_entity" | "tag",
    option: ControlledListOption,
    name: string,
  ) => {
    if (!user || !workspace || !option.id) return;
    const previous = String(option.name || "").trim();
    const next = name.trim();
    if (!previous || !next || previous === next) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "categories", option.id), {
      name: next,
      updatedAt: serverTimestamp(),
    });
    if (group === "delivery_entity") {
      projects
        .filter(
          (project) =>
            String(project.deliveryEntity || project.bpo || "").trim() ===
            previous,
        )
        .forEach((project) =>
          batch.update(doc(db, "projects", project.id), {
            deliveryEntity: next,
            bpo: next,
            updatedAt: serverTimestamp(),
          }),
        );
      tasks
        .filter(
          (task) =>
            String(task.deliveryEntity || task.bpo || "").trim() === previous,
        )
        .forEach((task) =>
          batch.update(doc(db, "tasks", task.id), {
            deliveryEntity: next,
            bpo: next,
            updatedAt: serverTimestamp(),
          }),
        );
    }
    if (group === "client_entity") {
      projects
        .filter(
          (project) =>
            String(project.clientEntity || project.client || "").trim() ===
            previous,
        )
        .forEach((project) =>
          batch.update(doc(db, "projects", project.id), {
            clientEntity: next,
            client: next,
            updatedAt: serverTimestamp(),
          }),
        );
      tasks
        .filter(
          (task) =>
            String(task.clientEntity || task.client || "").trim() === previous,
        )
        .forEach((task) =>
          batch.update(doc(db, "tasks", task.id), {
            clientEntity: next,
            client: next,
            updatedAt: serverTimestamp(),
          }),
        );
    }
    await batch.commit();
    setNotice(`${previous} renamed to ${next}.`);
  };

  const createCostTemplate = async (template: any) => {
    if (!user || !workspace || !template?.name?.trim()) return;
    await addDoc(collection(db, "cost_templates"), {
      name: template.name.trim(),
      description: String(template.description || "").trim(),
      rows: Array.isArray(template.rows) ? template.rows : [],
      userId: user.uid,
      workspaceId: workspace.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice("Cost template saved for this workspace.");
  };

  const updateCostTemplate = async (
    templateId: string,
    patch: Record<string, unknown>,
  ) => {
    await updateDoc(doc(db, "cost_templates", templateId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    setNotice("Cost template updated.");
  };

  const createProjectTemplate = async (
    sourceProjectId: string,
    name: string,
    description: string,
  ) => {
    if (!user || !workspace) return;
    const source = projects.find((project) => project.id === sourceProjectId);
    if (!source || !name.trim()) return;
    const template = buildProjectTemplate(source, tasks, name, description);
    await addDoc(collection(db, "agent_templates"), {
      ...template,
      userId: user.uid,
      workspaceId: workspace.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice(`${name.trim()} saved to the workspace template library.`);
  };

  const deleteProjectTemplate = async (templateId: string) => {
    if (!templateId) return;
    await deleteDoc(doc(db, "agent_templates", templateId));
    setNotice("Project template deleted.");
  };

  const applyProjectTemplate = async (
    template: any,
    application: TemplateApplication,
  ) => {
    if (!user || !workspace || !application.title.trim()) return;
    const member = (id: string) =>
      workspaceMembers.find((candidate) => candidate.id === id);
    const roleAssignment = (id: string) => {
      const selected = member(id);
      return selected
        ? { id: selected.id, name: memberLabel(selected) }
        : undefined;
    };
    const roleAssignments: Partial<
      Record<TemplateRole, { id: string; name: string }>
    > = {
      project_manager: roleAssignment(application.projectManagerId),
      product_owner: roleAssignment(application.productOwnerId),
      sponsor: roleAssignment(application.sponsorId),
    };
    const instantiatedItems = instantiateTemplateItems(
      template,
      application.startDate,
      roleAssignments,
    );
    const projectRef = doc(collection(db, "projects"));
    const conversationRef = doc(collection(db, "boldi_conversations"));
    const taskRefs = new Map<string, ReturnType<typeof doc>>();
    const taskByKey = new Map<string, any>();
    instantiatedItems.forEach((item: any) => {
      taskRefs.set(item.templateKey, doc(collection(db, "tasks")));
      taskByKey.set(item.templateKey, item);
    });
    const projectManager = roleAssignments.project_manager;
    const productOwner = roleAssignments.product_owner;
    const sponsor = roleAssignments.sponsor;
    const dueDates = instantiatedItems
      .map((item: any) => item.dueDate)
      .filter(Boolean)
      .sort();
    const batch = writeBatch(db);
    batch.set(projectRef, {
      ...(template.projectDefaults || {}),
      userId: user.uid,
      workspaceId: workspace.id,
      title: application.title.trim(),
      name: application.title.trim(),
      normalizedTitle: application.title.trim().toLowerCase().replace(/\s+/g, " "),
      projectKey: `${projectWorkKey({ title: application.title })}-${projectRef.id.slice(0, 4).toUpperCase()}`,
      client: application.client || "Internal",
      bpo: application.bpo || "Internal",
      status: "planning",
      startDate: application.startDate,
      plannedStartDate: application.startDate,
      targetDate: dueDates[dueDates.length - 1] || null,
      dueDate: dueDates[dueDates.length - 1] || null,
      projectManagerId: projectManager?.id || null,
      projectManager: projectManager?.name || "",
      productOwnerId: productOwner?.id || null,
      productOwner: productOwner?.name || "",
      sponsorId: sponsor?.id || null,
      sponsor: sponsor?.name || "",
      sponsorIds: sponsor?.id ? [sponsor.id] : [],
      sponsors: sponsor?.name ? [sponsor.name] : [],
      sourceTemplateId: template.id,
      sourceTemplateName: template.name,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    instantiatedItems.forEach((item: any, index: number) => {
      const taskRef = taskRefs.get(item.templateKey)!;
      const parentRef = item.parentTemplateKey
        ? taskRefs.get(item.parentTemplateKey)
        : null;
      const parentTemplate = item.parentTemplateKey
        ? taskByKey.get(item.parentTemplateKey)
        : null;
      const parentKind = String(parentTemplate?.workItemType || "");
      const canonicalType = String(item.workItemType || "pbi").toLowerCase();
      batch.set(taskRef, {
        userId: user.uid,
        workspaceId: workspace.id,
        projectId: projectRef.id,
        title: item.title,
        normalizedTitle: String(item.title).trim().toLowerCase().replace(/\s+/g, " "),
        description: item.description || "",
        key: `${projectWorkKey({ title: application.title })}-${index + 1}`,
        type: canonicalType,
        workItemType: canonicalType,
        itemType: canonicalType,
        parentId: parentRef?.id || null,
        epicId: parentKind === "epic" ? parentRef?.id || null : null,
        featureId: parentKind === "feature" ? parentRef?.id || null : null,
        priority: item.priority || null,
        status: "backlog",
        startDate: item.startDate || null,
        dueDate: item.dueDate || null,
        assigneeIds: item.assigneeIds || [],
        assignees: item.assignees || [],
        owner: item.owner || "",
        order: Number(item.order ?? index),
        rank: Number(item.order ?? index),
        source: "project_template",
        sourceTemplateId: template.id,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    batch.set(conversationRef, {
      userId: user.uid,
      workspaceId: workspace.id,
      title: application.title.trim(),
      status: "active",
      sourceContext: "project",
      contextEntityId: projectRef.id,
      conversationType: "project",
      linkedProjectIds: [projectRef.id],
      linkedTaskIds: [],
      isChiefOfStaff: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    setConversationId(conversationRef.id);
    setMessages([]);
    setProjectConsoleId(projectRef.id);
    setPanel(null);
    goCenterView("project");
    navigate(`/work/projects/${projectRef.id}`);
    setNotice(
      `${application.title.trim()} created from ${template.name} with ${instantiatedItems.length} work items.`,
    );
  };

  const updateWorkspaceProfile = async () => {
    if (!workspace || !workspaceNameDraft.trim()) return;
    await updateDoc(doc(db, "workspaces", workspace.id), {
      name: workspaceNameDraft.trim(),
      updatedAt: serverTimestamp(),
    });
    await reloadWorkspaces();
    setNotice("Workspace updated.");
  };

  const createWorkspace = async () => {
    if (!user || !newWorkspaceName.trim()) return;
    if (!canCreateWorkspace(workspaces.length)) {
      setNotice(
        `You can have up to ${WORKSPACE_LIMIT} workspaces in this version.`,
      );
      return;
    }
    const workspaceRef = doc(collection(db, "workspaces"));
    const email = user.email || "";
    const emailLower = email.toLowerCase();
    const workspacePayload = {
      name: newWorkspaceName.trim(),
      ownerId: user.uid,
      members: email ? [emailLower] : [],
      roles: email ? { [emailLower]: "owner" } : {},
      color: "#214b39",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(workspaceRef, workspacePayload);
    await setDoc(
      doc(db, "workspace_members", `${workspaceRef.id}_${user.uid}`),
      {
        id: `${workspaceRef.id}_${user.uid}`,
        workspaceId: workspaceRef.id,
        userId: user.uid,
        email,
        emailLower,
        displayName: user.displayName || "",
        role: "owner",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    );
    setNewWorkspaceName("");
    await reloadWorkspaces();
    setWorkspace({ id: workspaceRef.id, ...workspacePayload });
  };

  const inviteWorkspaceMember = async () => {
    if (!user || !workspace) return;
    const email = normalizeInviteEmail(inviteEmail);
    if (!email || !email.includes("@")) {
      setNotice("Add a valid email to invite someone.");
      return;
    }
    const currentMembers = [
      ...new Set([
        ...(workspace.members || []).map((item) => String(item).toLowerCase()),
        email,
      ]),
    ];
    await updateDoc(doc(db, "workspaces", workspace.id), {
      members: currentMembers,
      roles: { ...(workspace.roles || {}), [email]: inviteRole },
      updatedAt: serverTimestamp(),
    });
    const pendingMemberId = `${workspace.id}_invite_${email.replace(/[^a-z0-9]/g, "_")}`;
    await setDoc(
      doc(db, "workspace_members", pendingMemberId),
      {
        id: pendingMemberId,
        workspaceId: workspace.id,
        userId: `pending:${email}`,
        email,
        emailLower: email,
        displayName: email,
        role: inviteRole,
        status: "invited",
        invitedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await addDoc(collection(db, "agent_invites"), {
      userId: user.uid,
      workspaceId: workspace.id,
      email,
      emailLower: email,
      role: inviteRole,
      inviteType: "workspace_member",
      inviteToken: createInviteCode(),
      status: "pending",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setInviteEmail("");
    await reloadWorkspaces();
    setNotice(
      `Invite prepared for ${email}. They will join this workspace after signing in with that email.`,
    );
  };

  const createWorkspaceTeam = async () => {
    if (!user || !workspace || !newTeamName.trim()) return;
    await addDoc(collection(db, "agent_groups"), {
      userId: user.uid,
      workspaceId: workspace.id,
      name: newTeamName.trim(),
      title: newTeamName.trim(),
      groupType: "workspace_team",
      status: "active",
      memberEmails: [],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewTeamName("");
    setNotice("Team created.");
  };

  const toggleTeamMember = async (
    team: WorkspaceTeam,
    member: WorkspaceMember,
  ) => {
    const email = normalizeInviteEmail(member.email || member.emailLower || "");
    if (!email) return;
    const current = (team.memberEmails || []).map((item) =>
      normalizeInviteEmail(item),
    );
    const next = current.includes(email)
      ? current.filter((item) => item !== email)
      : [...current, email];
    await updateDoc(doc(db, "agent_groups", team.id), {
      memberEmails: next,
      updatedAt: serverTimestamp(),
    });
  };

  const updateMemberRole = async (
    member: WorkspaceMember,
    role: "admin" | "member" | "viewer",
  ) => {
    if (!workspace || !member.id) return;
    const email = normalizeInviteEmail(member.email || member.emailLower || "");
    await updateDoc(doc(db, "workspace_members", member.id), {
      role,
      updatedAt: serverTimestamp(),
    });
    if (email) {
      await updateDoc(doc(db, "workspaces", workspace.id), {
        roles: { ...(workspace.roles || {}), [email]: role },
        updatedAt: serverTimestamp(),
      });
      await reloadWorkspaces();
    }
  };

  const archiveConversation = async (conversation: Conversation) => {
    await updateDoc(doc(db, "boldi_conversations", conversation.id), {
      status: "archived",
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (conversationId === conversation.id) {
      setConversationId(null);
      setMessages([]);
      navigate("/");
    }
    setNotice("Conversation archived. Its history is preserved.");
  };

  const deleteConversation = async (conversation: Conversation) => {
    const confirmed = window.confirm(
      `Delete "${conversation.title || "this conversation"}" and its messages? This cannot be undone.`,
    );
    if (!confirmed || !user || !workspace) return;
    const snapshot = await getDocs(
      query(
        collection(db, "boldi_messages"),
        where("userId", "==", user.uid),
        where("workspaceId", "==", workspace.id),
        where("conversationId", "==", conversation.id),
      ),
    );
    for (let index = 0; index < snapshot.docs.length; index += 400) {
      const batch = writeBatch(db);
      snapshot.docs
        .slice(index, index + 400)
        .forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, "boldi_conversations", conversation.id));
    if (conversationId === conversation.id) {
      setConversationId(null);
      setMessages([]);
      navigate("/");
    }
    setNotice("Conversation deleted.");
  };

  const archiveProject = async (project: any) => {
    await updateProject(project.id, {
      status: "archived",
      previousStatus: project.status || "active",
      archivedAt: serverTimestamp(),
    });
    if (projectConsoleId === project.id) {
      setProjectConsoleId(null);
      setPanel(null);
    }
    if (activeProject?.id === project.id) navigate("/");
    setNotice(`${entityTitle(project)} archived. Its history is preserved.`);
  };

  const deleteProject = async (project: any) => {
    const confirmed = window.confirm(
      `Move "${entityTitle(project)}" to Deleted? It can be restored for 30 days.`,
    );
    if (!confirmed || !user || !workspace) return;
    const deletedAt = new Date();
    const purgeAfter = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    await updateProject(project.id, {
      status: "deleted",
      previousStatus: project.status || "active",
      deletedAt,
      purgeAfter,
      archivedAt: null,
    });
    if (projectConsoleId === project.id) {
      setProjectConsoleId(null);
      setPanel(null);
      goCenterView("portfolio");
    }
    if (activeProject?.id === project.id) navigate("/");
    setNotice(
      `${entityTitle(project)} moved to Deleted. It can be restored until ${purgeAfter.toLocaleDateString()}.`,
    );
  };

  const restoreProject = async (project: any) => {
    const purgeDate = project.purgeAfter?.toDate
      ? project.purgeAfter.toDate()
      : project.purgeAfter
        ? new Date(project.purgeAfter)
        : null;
    if (purgeDate && purgeDate.getTime() < Date.now()) {
      setNotice("The 30-day restoration period has expired.");
      return;
    }
    await updateProject(project.id, {
      status: project.previousStatus || "active",
      deletedAt: null,
      purgeAfter: null,
      archivedAt: null,
      restoredAt: serverTimestamp(),
    });
    setNotice(`${entityTitle(project)} restored.`);
  };

  const saveDigestRequest = async (
    kind: "email_reminder" | "daily_digest" | "weekly_summary",
  ) => {
    if (!user || !workspace) return;
    const labels = {
      email_reminder: "email reminder",
      daily_digest: "daily digest",
      weekly_summary: "weekly summary",
    };
    await addDoc(collection(db, "daily_briefs"), {
      userId: user.uid,
      workspaceId: workspace.id,
      type: kind,
      title: labels[kind],
      requestedChannel: "email",
      email: user.email || "",
      status: "draft",
      deliveryStatus: "needs_email_service",
      scope: kind === "weekly_summary" ? "week" : "day",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice(
      `${labels[kind]} request saved. Email delivery still needs an email service; Certo Work can draft it now.`,
    );
    setComposer(
      `Draft my ${labels[kind]} from the current workspace. Do not claim it was sent.`,
    );
  };

  const addProjectTask = async (
    projectId: string,
    title: string,
    status: WorkLane,
    patch: Record<string, unknown> = {},
  ) => {
    if (!user || !workspace) return;
    const project = projects.find((item) => item.id === projectId);
    const prefix = projectId ? projectWorkKey(project) : "TASK";
    const nextSequence =
      tasks
        .filter((item) =>
          projectId ? item.projectId === projectId : !item.projectId,
        )
        .reduce((maximum, item) => {
          const match = String(item.key || item.workItemKey || "").match(
            /-(\d+)$/,
          );
          return Math.max(maximum, match ? Number(match[1]) : 0);
        }, 0) + 1;
    const canonicalType = String(
      patch.workItemType || patch.type || patch.itemType || "task",
    ).toLowerCase();
    await addDoc(collection(db, "tasks"), {
      ...patch,
      userId: user.uid,
      workspaceId: workspace.id,
      projectId,
      title,
      normalizedTitle: title.trim().toLowerCase().replace(/\s+/g, " "),
      key: String(patch.key || `${prefix}-${nextSequence}`),
      type: canonicalType,
      workItemType: canonicalType,
      itemType: canonicalType,
      source: String(patch.source || "manual"),
      priority: patch.priority ?? null,
      status,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const updateProjectTask = async (
    taskId: string,
    patch: Record<string, unknown>,
  ) => {
    await updateDoc(doc(db, "tasks", taskId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const createProjectFromWizard = async (draft: ProjectWizardDraft) => {
    if (!user || !workspace) return;
    const successCriteria = splitProjectWizardLines(draft.successCriteriaText);
    const targetDate = draft.noTargetDate ? "" : draft.targetDate;
    const projectRef = await addDoc(collection(db, "projects"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: draft.title.trim(),
      normalizedTitle: draft.title.trim().toLowerCase().replace(/\s+/g, " "),
      description: draft.why.trim(),
      outcome: draft.outcome.trim(),
      objective: draft.outcome.trim(),
      status: "planning",
      health: "on_track",
      methodology: draft.methodology,
      projectManager: draft.owner.trim(),
      targetDate,
      dueDate: targetDate,
      successCriteria,
      definitionOfDone: draft.definitionOfDone.trim(),
      createdFromSkill: "project_wizard",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (draft.firstMilestone.trim()) {
      await addProjectMilestone(projectRef.id, draft.firstMilestone.trim());
    }
    await addProjectTask(
      projectRef.id,
      draft.firstAction.trim().slice(0, 500),
      "backlog",
      {
        key: `${projectWorkKey({ title: draft.title })}-1`,
        source: "project_wizard",
        priority: "1",
        dueDate: targetDate || null,
        workItemType: "task",
        itemType: "task",
        type: "task",
        acceptanceCriteria: successCriteria.join("\n"),
        definitionOfDone: draft.definitionOfDone.trim(),
      },
    );

    const conversationRef = await addDoc(
      collection(db, "boldi_conversations"),
      {
        userId: user.uid,
        workspaceId: workspace.id,
        title: draft.title.trim(),
        status: "active",
        sourceContext: "project",
        contextEntityId: projectRef.id,
        conversationType: "project",
        linkedProjectIds: [projectRef.id],
        linkedTaskIds: [],
        isChiefOfStaff: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    );
    setConversationId(conversationRef.id);
    setMessages([]);
    setProjectConsoleId(projectRef.id);
    setPanel("project");
    goCenterView("conversation");
    navigate(`/work/projects/${projectRef.id}`);
    setNotice(
      `${draft.title.trim()} created with Project Wizard. Its console is open.`,
    );
  };

  const updateProjectFromWizard = async (
    projectId: string,
    draft: ProjectWizardDraft,
  ) => {
    if (!user || !workspace) return;
    const successCriteria = splitProjectWizardLines(draft.successCriteriaText);
    const targetDate = draft.noTargetDate ? "" : draft.targetDate;
    await updateProject(projectId, {
      title: draft.title.trim(),
      normalizedTitle: draft.title.trim().toLowerCase().replace(/\s+/g, " "),
      description: draft.why.trim(),
      outcome: draft.outcome.trim(),
      objective: draft.outcome.trim(),
      methodology: draft.methodology,
      projectManager: draft.owner.trim(),
      targetDate,
      dueDate: targetDate,
      successCriteria,
      definitionOfDone: draft.definitionOfDone.trim(),
      updatedFromSkill: "project_wizard",
    });
    if (draft.firstMilestone.trim())
      await addProjectMilestone(projectId, draft.firstMilestone.trim());
    await addProjectTask(
      projectId,
      draft.firstAction.trim().slice(0, 500),
      "backlog",
      {
        source: "project_wizard",
        priority: "1",
        dueDate: targetDate || null,
        workItemType: "task",
        itemType: "task",
        type: "task",
        acceptanceCriteria: successCriteria.join("\n"),
        definitionOfDone: draft.definitionOfDone.trim(),
      },
    );
    setProjectConsoleId(projectId);
    setPanel("project");
    goCenterView("conversation");
    navigate(`/work/projects/${projectId}`);
    setNotice(`${draft.title.trim()} updated with Project Wizard.`);
  };

  const resetWorkspaceData = async () => {
    if (
      !user ||
      !workspace ||
      cleanConfirmText.trim().toUpperCase() !== "CLEAR" ||
      cleaning
    )
      return;
    setCleaning(true);
    setNotice("");
    const collectionsToClear = [
      "projects",
      "tasks",
      "milestones",
      "boldr_risks",
      "knowledge_items",
      "review_candidates",
      "boldi_conversations",
      "boldi_messages",
      "boldi_action_plans",
      "categories",
      "stakeholders",
      "inbox_items",
      "ai_initiatives",
      "prompt_assets",
      "ai_artifacts",
      "support_cases",
      "delivery_reviews",
      "delivery_gates",
      "integration_configs",
      "cost_templates",
      "agent_templates",
      "strategic_goals",
      "key_results",
      "strategic_initiatives",
      "daily_metrics",
      "habits",
      "habit_logs",
      "workout_plans",
      "workout_sessions",
      "workout_exercises",
      "workout_logs",
      "resources",
      "notebook_pages",
      "notebook_entries",
      "notebook_handwriting_assets",
      "skills",
      "skill_folders",
      "mental_clarity_items",
      "mental_clarity_sessions",
      "let_go_items",
      "daily_clarity_preferences",
      "daily_briefs",
      "start_day_sessions",
      "performance_analyses",
    ];
    try {
      for (const collectionName of collectionsToClear) {
        const snapshot = await getDocs(
          query(
            collection(db, collectionName),
            where("userId", "==", user.uid),
            where("workspaceId", "==", workspace.id),
          ),
        );
        for (let index = 0; index < snapshot.docs.length; index += 400) {
          const batch = writeBatch(db);
          snapshot.docs
            .slice(index, index + 400)
            .forEach((item) => batch.delete(item.ref));
          await batch.commit();
        }
      }
      setConversationId(null);
      setMessages([]);
      setProjects([]);
      setTasks([]);
      setMilestones([]);
      setRisks([]);
      setKnowledgeItems([]);
      setNotebookEntries([]);
      setReviewItems([]);
      setSelectedWorkItemId(null);
      setPanel(null);
      goCenterView("conversation");
      setCleanSlateOpen(false);
      setCleanConfirmText("");
      navigate("/");
      setNotice(
        "Clean Certo Work is ready. No projects, items, tags, or pending changes remain in this workspace.",
      );
    } catch {
      setNotice(
        "I could not finish the clean reset. Please try again after the workspace finishes syncing.",
      );
    } finally {
      setCleaning(false);
    }
  };

  const addProjectMilestone = async (projectId: string, title: string) => {
    if (!user || !workspace) return;
    await addDoc(collection(db, "milestones"), {
      userId: user.uid,
      workspaceId: workspace.id,
      projectId,
      title,
      status: "not_started",
      order: milestones.filter((item) => item.projectId === projectId).length,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const addProjectRisk = async (
    projectId: string,
    title: string,
    patch: Record<string, unknown> = {},
  ) => {
    if (!user || !workspace) return;
    await addDoc(collection(db, "boldr_risks"), {
      userId: user.uid,
      workspaceId: workspace.id,
      projectId,
      title,
      type: "project_risk",
      severity: patch.severity || "medium",
      status: "open",
      ...patch,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const openingPrompts = isFocusedConversation
    ? [
        `What needs attention in ${currentContextLabel}?`,
        `Turn the next step for ${currentContextLabel} into clear work.`,
        `Give me a short, honest update for this conversation.`,
      ]
    : [
        "Plan my day realistically.",
        "What is the most important thing to move next?",
        "Help me capture and clarify something new.",
      ];

  return (
    <div className={`do-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <button
        aria-label="Close navigation"
        className={`do-scrim ${sidebarOpen || panel ? "is-open" : ""}`}
        onClick={() => {
          setSidebarOpen(false);
          setPanel(null);
        }}
        type="button"
      />

      <aside
        className={`do-sidebar ${sidebarOpen ? "is-open" : ""}`}
        data-testid="primary-sidebar"
      >
        <div className="do-brand-row">
          <button
            className="do-brand"
            onClick={() => {
              navigate("/");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <span className="do-logo">C</span>
            <span>
              <strong>Certo Work</strong>
              <small>Think. Choose. Move.</small>
            </span>
          </button>
          <button
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="do-sidebar-collapse"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            type="button"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
          <button
            aria-label="Close navigation"
            className="do-mobile-close"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <button
          className="do-new-conversation"
          data-testid="new-conversation"
          disabled={creatingConversation}
          onClick={createConversation}
          type="button"
        >
          {creatingConversation ? (
            <Loader2 className="spin" size={15} />
          ) : (
            <Plus size={15} />
          )}
          <span>{creatingConversation ? "Starting…" : "New conversation"}</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          className="do-chief-conversation"
          onClick={openChiefOfStaff}
          type="button"
        >
          <span>
            <Sparkles size={14} />
          </span>
          <div>
            <strong>Chief of Staff</strong>
            <small>Coordinate across all work</small>
          </div>
          <ChevronRight size={13} />
        </button>

        <div className="do-sidebar-scroll">
          <div className="do-sidebar-section">
            <div className="do-section-head">
              <span>Projects</span>
              <button
                aria-label="Open project command center"
                onClick={() => {
                  goCenterView("portfolio");
                  setPanel(null);
                  setSidebarOpen(false);
                }}
                type="button"
              >
                Command center
              </button>
            </div>
            <div className="do-project-list">
              {sidebarProjects.favorites.length > 0 && (
                <span className="do-project-group-label">
                  <Star size={10} /> Favorites
                </span>
              )}
              {sidebarProjects.favorites.map((project) => (
                <div
                  className={`do-project-row ${activeProject?.id === project.id ? "is-active" : ""}`}
                  key={project.id}
                >
                  <button
                    className="do-project-context"
                    onClick={() => selectProjectContext(project)}
                    type="button"
                  >
                    <Star fill="currentColor" size={12} />
                    <span>{entityTitle(project)}</span>
                    <small>
                      {openTasks.filter((task) => task.projectId === project.id)
                        .length || ""}
                    </small>
                  </button>
                  <button
                    className="do-project-open"
                    data-testid={`open-project-${project.id}`}
                    onClick={() => openProjectRecord(project)}
                    type="button"
                  >
                    Open
                  </button>
                  <button
                    aria-label={`Archive ${entityTitle(project)}`}
                    className="do-project-icon"
                    onClick={() => archiveProject(project)}
                    type="button"
                  >
                    <Archive size={11} />
                  </button>
                  <button
                    aria-label={`Delete ${entityTitle(project)}`}
                    className="do-project-icon is-danger"
                    onClick={() => deleteProject(project)}
                    type="button"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {sidebarProjects.recent.length > 0 && (
                <span className="do-project-group-label">Recent</span>
              )}
              {sidebarProjects.recent.map((project) => (
                <div
                  className={`do-project-row ${activeProject?.id === project.id ? "is-active" : ""}`}
                  key={project.id}
                >
                  <button
                    className="do-project-context"
                    onClick={() => selectProjectContext(project)}
                    type="button"
                  >
                    <Folder size={12} />
                    <span>{entityTitle(project)}</span>
                    <small>
                      {openTasks.filter((task) => task.projectId === project.id)
                        .length || ""}
                    </small>
                  </button>
                  <button
                    className="do-project-open"
                    data-testid={`open-project-${project.id}`}
                    onClick={() => openProjectRecord(project)}
                    type="button"
                  >
                    Open
                  </button>
                  <button
                    aria-label={`Archive ${entityTitle(project)}`}
                    className="do-project-icon"
                    onClick={() => archiveProject(project)}
                    type="button"
                  >
                    <Archive size={11} />
                  </button>
                  <button
                    aria-label={`Delete ${entityTitle(project)}`}
                    className="do-project-icon is-danger"
                    onClick={() => deleteProject(project)}
                    type="button"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {activeProjects.length === 0 && (
                <button
                  className="do-empty-link"
                  onClick={() => setProjectWizardOpen(true)}
                  type="button"
                >
                  Create your first project
                </button>
              )}
            </div>
          </div>

          <div className="do-sidebar-section do-conversations">
            <div className="do-section-head">
              <span>Conversations</span>
              <button
                aria-label="Search conversations"
                onClick={() => setSearchOpen((open) => !open)}
                type="button"
              >
                <Search size={13} />
              </button>
            </div>
            {searchOpen && (
              <input
                aria-label="Search conversations"
                autoFocus
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                value={search}
              />
            )}
            {filteredConversations
              .slice(0, chatsExpanded || search.trim() ? 50 : 5)
              .map((conversation) => (
                <div
                  className={`do-conversation-row ${conversation.id === conversationId ? "is-active" : ""}`}
                  key={conversation.id}
                >
                  <button
                    className="do-conversation-main"
                    onClick={() => {
                      setConversationId(conversation.id);
                      const projectIds = conversationProjectIds(conversation);
                      const taskIds = conversationTaskIds(conversation);
                      navigate(
                        projectIds.length === 1 && taskIds.length === 0
                          ? `/work/projects/${projectIds[0]}`
                          : "/",
                      );
                      setSidebarOpen(false);
                    }}
                    type="button"
                  >
                    {conversationProjectIds(conversation).length > 0 ? (
                      <Folder size={13} />
                    ) : conversationTaskIds(conversation).length > 0 ? (
                      <ListTodo size={13} />
                    ) : conversation.isChiefOfStaff ? (
                      <Sparkles size={13} />
                    ) : (
                      <MessageSquare size={13} />
                    )}
                    <span>{conversation.title || "New conversation"}</span>
                    <small>
                      {conversationScopeLabel(conversation, projects, tasks)} ·{" "}
                      {timeAgo(
                        conversation.updatedAt || conversation.createdAt,
                      )}
                    </small>
                  </button>
                  <button
                    aria-label={`Archive ${conversation.title || "conversation"}`}
                    className="do-conversation-action"
                    onClick={() => archiveConversation(conversation)}
                    type="button"
                  >
                    <Archive size={11} />
                  </button>
                  {!conversation.isChiefOfStaff && (
                    <button
                      aria-label={`Delete ${conversation.title || "conversation"}`}
                      className="do-conversation-action is-danger"
                      onClick={() => deleteConversation(conversation)}
                      type="button"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            {!search.trim() && filteredConversations.length > 5 && (
              <button
                className="do-expand-chats"
                onClick={() => setChatsExpanded((expanded) => !expanded)}
                type="button"
              >
                <ChevronDown
                  className={chatsExpanded ? "is-up" : ""}
                  size={13}
                />
                <span>
                  {chatsExpanded
                    ? "Show less"
                    : `Show ${filteredConversations.length - 5} more`}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="do-account">
          <button
            onClick={() => setWorkspaceOpen((open) => !open)}
            type="button"
          >
            <span className="do-avatar">
              {initials(user?.displayName, user?.email)}
            </span>
            <span>
              <strong>{workspace?.name || "Certo Work"}</strong>
              <small>{user?.email}</small>
            </span>
            <MoreHorizontal size={15} />
          </button>
          {workspaceOpen && (
            <div className="do-account-menu">
              <div className="do-account-menu-preference">
                <span>Text size</span>
                <TextSizeControl compact />
              </div>
              <button
                onClick={() => {
                  setPanel("workspace");
                  setWorkspaceOpen(false);
                }}
                type="button"
              >
                <Users size={14} /> Workspace & team
              </button>
              <button
                onClick={() => {
                  navigate("/settings");
                  setWorkspaceOpen(false);
                }}
                type="button"
              >
                <Settings size={14} /> Settings
              </button>
              <button
                onClick={() => {
                  setCleanSlateOpen(true);
                  setWorkspaceOpen(false);
                }}
                type="button"
              >
                Start clean
              </button>
              <button onClick={logOut} type="button">
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="do-main">
        <header className="do-header">
          <button
            aria-label="Open navigation"
            className="do-icon-button do-menu-button"
            onClick={() => setSidebarOpen(true)}
            type="button"
          >
            <Menu size={18} />
          </button>
          <button
            className="do-context-title"
            onClick={() => setPanel("projects")}
            type="button"
          >
            <span>{currentContextLabel}</span>
            <ChevronRight size={13} />
          </button>
          <div className="do-header-actions">
            {routeOrPrimaryProject && (
              <button
                className={`do-header-button ${centerView === "project" ? "is-active" : ""}`}
                onClick={() => {
                  setProjectConsoleId(routeOrPrimaryProject.id);
                  setPanel(null);
                  goCenterView(
                    centerView === "project" ? "conversation" : "project",
                  );
                }}
                type="button"
              >
                <Folder size={15} />
                <span>Project console</span>
              </button>
            )}
            <button
              className={`do-header-button ${panel === "skills" ? "is-active" : ""}`}
              onClick={() => setPanel(panel === "skills" ? null : "skills")}
              type="button"
            >
              <WandSparkles size={15} />
              <span>Skills</span>
            </button>
            <button
              className={`do-header-button ${panel === "digest" ? "is-active" : ""}`}
              onClick={() => setPanel(panel === "digest" ? null : "digest")}
              type="button"
            >
              <Mail size={15} />
              <span>Digest</span>
            </button>
            <button
              className="do-header-button"
              onClick={() => setPanel("today")}
              type="button"
            >
              <ListTodo size={15} />
              <span>Today</span>
              {todayTasks.length > 0 && <small>{todayTasks.length}</small>}
            </button>
            <button
              className="do-header-button"
              onClick={() => setPanel("approvals")}
              type="button"
            >
              <ShieldCheck size={15} />
              <span>Pendientes</span>
              {reviewItems.length > 0 && (
                <small className="is-attention">{reviewItems.length}</small>
              )}
            </button>
          </div>
        </header>

        {notice && (
          <div className="do-notice" role="status">
            <CheckCircle2 size={15} />
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <section
          className={`do-center-bar ${centerView === "portfolio" ? "is-portfolio" : ""}`}
          aria-label="Current work view"
        >
          <div className="do-center-navigation" aria-label="View history">
            <button
              aria-label="Go back"
              disabled={centerHistory.index === 0}
              onClick={goCenterBack}
              type="button"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              aria-label="Go forward"
              disabled={centerHistory.index === centerHistory.items.length - 1}
              onClick={goCenterForward}
              type="button"
            >
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="do-breadcrumb">
            <span>
              {routeOrPrimaryProject
                ? entityTitle(routeOrPrimaryProject)
                : "Chief of Staff"}
            </span>
            {selectedWorkItem && (
              <>
                <ChevronRight size={12} />
                <strong>{entityTitle(selectedWorkItem)}</strong>
              </>
            )}
          </div>
          <div
            className="do-view-switch"
            role="tablist"
            aria-label="Central view"
          >
            <button
              aria-selected={centerView === "conversation"}
              className={centerView === "conversation" ? "is-active" : ""}
              onClick={() => goCenterView("conversation")}
              role="tab"
              type="button"
            >
              <MessageSquare size={13} /> Conversación
            </button>
            <button
              aria-selected={centerView === "items"}
              className={centerView === "items" ? "is-active" : ""}
              onClick={() => goCenterView("items")}
              role="tab"
              type="button"
            >
              <ListTodo size={13} /> Ítems
            </button>
            <button
              aria-selected={centerView === "notes"}
              className={centerView === "notes" ? "is-active" : ""}
              onClick={() => goCenterView("notes")}
              role="tab"
              type="button"
            >
              <BookOpen size={13} /> Notas
            </button>
            <button
              aria-selected={centerView === "strategy"}
              className={centerView === "strategy" ? "is-active" : ""}
              onClick={() => {
                goCenterView("strategy");
                setPanel(null);
              }}
              role="tab"
              type="button"
            >
              <Target size={13} /> Strategy
            </button>
            <button
              aria-selected={centerView === "portfolio"}
              className={centerView === "portfolio" ? "is-active" : ""}
              onClick={() => {
                goCenterView("portfolio");
                setPanel(null);
              }}
              role="tab"
              type="button"
            >
              <LayoutGrid size={13} /> Portfolio
            </button>
            <button
              aria-selected={centerView === "settings"}
              className={centerView === "settings" ? "is-active" : ""}
              onClick={() => {
                goCenterView("settings");
                setPanel(null);
              }}
              role="tab"
              type="button"
            >
              <Settings size={13} /> Settings
            </button>
          </div>
        </section>

        {centerView === "conversation" ? (
          <>
            <div className="do-thread-viewport">
              <div className="do-thread">
                {contextualMessages.length === 0 && !submitting ? (
                  <section className="do-opening">
                    <div className="do-welcome">
                      <span className="do-orb">
                        <Sparkles size={21} />
                      </span>
                      {isFocusedConversation && (
                        <span className="do-context-eyebrow">
                          FOCUSED · {currentContextLabel}
                        </span>
                      )}
                      <h1>
                        {isFocusedConversation
                          ? "What should move next?"
                          : `What matters now, ${displayName(user?.displayName, user?.email)}?`}
                      </h1>
                      <p>
                        {routeOrPrimaryProject
                          ? routeOrPrimaryProject.outcome ||
                            routeOrPrimaryProject.description ||
                            `${projectTasks.length} open tasks in this context.`
                          : isFocusedConversation
                            ? `${projectTasks.length} open items are connected to this conversation.`
                            : "Capture anything. Make a plan. Finish the right work."}
                      </p>
                    </div>

                    {!isFocusedConversation && (
                      <button
                        className="do-daily-pulse"
                        onClick={() =>
                          sendMessage(
                            "Give me a realistic plan for today using my current work.",
                          )
                        }
                        type="button"
                      >
                        <span>
                          <CalendarDays size={15} /> Today
                        </span>
                        <strong>
                          {todayTasks.length
                            ? `${todayTasks.length} tasks need attention`
                            : "Your day is open"}
                        </strong>
                        <ChevronRight size={15} />
                      </button>
                    )}

                    {isFocusedConversation && (
                      <div className="do-project-pulse">
                        <span>{projectTasks.length} open in context</span>
                        <span>{currentContextLabel}</span>
                        {routeOrPrimaryProject && (
                          <button
                            onClick={() =>
                              openProjectRecord(routeOrPrimaryProject)
                            }
                            type="button"
                          >
                            Project console
                          </button>
                        )}
                      </div>
                    )}

                    <div className="do-prompt-list">
                      {openingPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => sendMessage(prompt)}
                          type="button"
                        >
                          <span>{prompt}</span>
                          <ArrowUp size={14} />
                        </button>
                      ))}
                    </div>
                  </section>
                ) : (
                  <>
                    {isFocusedConversation && (
                      <div className="do-inline-context">
                        {directContextProjectIds.length > 0 ? (
                          <Folder size={12} />
                        ) : (
                          <ListTodo size={12} />
                        )}
                        <strong>{currentContextLabel}</strong>
                        <span>{projectTasks.length} open</span>
                        <button
                          aria-label="Edit conversation context"
                          onClick={() => setPanel("projects")}
                          type="button"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    )}
                    {contextualMessages.map((message) => (
                      <article
                        className={`do-message is-${message.role}`}
                        key={message.id}
                      >
                        {message.role === "user" ? (
                          <UserMessage text={message.content} />
                        ) : (
                          <div className="do-assistant-message">
                            <div className="do-assistant-mark">
                              <Bot size={16} />
                            </div>
                            <div className="do-assistant-content">
                              <div className="do-assistant-name">
                                Certo Work{" "}
                                {message.offline && <span>safe mode</span>}
                              </div>
                              <RichText text={message.content} />
                              {message.citations &&
                                message.citations.length > 0 && (
                                  <div className="do-citations">
                                    {message.citations.map((citation) => (
                                      <span
                                        key={`${citation.type}-${citation.id}`}
                                      >
                                        {citation.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              <ActionProposal
                                activeProject={
                                  primaryProject || activeProject || null
                                }
                                message={message}
                                onStage={stagePlan}
                                projects={projects}
                              />
                              {message.suggestedChips && (
                                <div className="do-chips">
                                  {message.suggestedChips.map((chip) => {
                                    const label = proposalChipLabel(
                                      chip,
                                      message.actionPlan,
                                      projects,
                                      primaryProject || activeProject || null,
                                    );
                                    return (
                                      <button
                                        key={chip}
                                        onClick={() => sendMessage(label)}
                                        type="button"
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                    {(submitting || streamed) && (
                      <article className="do-message is-assistant">
                        <div className="do-assistant-message">
                          <div className="do-assistant-mark">
                            <Bot size={16} />
                          </div>
                          <div className="do-assistant-content">
                            {streamed ? (
                              <RichText text={streamed} />
                            ) : (
                              <div className="do-thinking">
                                <span />
                                <span />
                                <span />
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    )}
                  </>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="do-composer-wrap">
              {actionMenuOpen && (
                <div className="do-quick-actions">
                  <button
                    onClick={() => setComposer("Capture this as a task: ")}
                    type="button"
                  >
                    <Inbox size={15} />
                    <span>
                      <strong>Capture</strong>
                      <small>Turn a thought into a clear task</small>
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      sendMessage(
                        "Plan my day realistically using the 2 must-dos and up to 8 should-dos method.",
                      )
                    }
                    type="button"
                  >
                    <CalendarDays size={15} />
                    <span>
                      <strong>Plan today</strong>
                      <small>Choose work that fits the day</small>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActionMenuOpen(false);
                      goCenterView("notes");
                    }}
                    type="button"
                  >
                    <BookOpen size={15} />
                    <span>
                      <strong>Open notes</strong>
                      <small>Notebook, section, notes and handwriting</small>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActionMenuOpen(false);
                      setProjectWizardOpen(true);
                    }}
                    type="button"
                  >
                    <WandSparkles size={15} />
                    <span>
                      <strong>Project Wizard</strong>
                      <small>Create or update a project safely</small>
                    </span>
                  </button>
                  <button
                    onClick={() => setComposer("Help me create a project for ")}
                    type="button"
                  >
                    <Folder size={15} />
                    <span>
                      <strong>Freeform project note</strong>
                      <small>Talk it through before creating</small>
                    </span>
                  </button>
                </div>
              )}
              {isFocusedConversation && (
                <div className="do-composer-context">
                  {directContextProjectIds.length > 0 ? (
                    <Folder size={12} />
                  ) : (
                    <ListTodo size={12} />
                  )}
                  <span>{currentContextLabel}</span>
                  <button
                    aria-label="Edit conversation context"
                    onClick={() => setPanel("projects")}
                    type="button"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}
              <div className="do-composer">
                <textarea
                  aria-label="Message Certo Work"
                  data-testid="message-composer"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    isFocusedConversation
                      ? `Ask about ${currentContextLabel}…`
                      : "Ask, capture, or plan…"
                  }
                  ref={composerRef}
                  rows={1}
                  value={input}
                />
                <div className="do-composer-foot">
                  <div>
                    <button
                      aria-label="Open quick actions"
                      className={actionMenuOpen ? "is-active" : ""}
                      onClick={() => setActionMenuOpen((open) => !open)}
                      type="button"
                    >
                      <Plus size={16} />
                    </button>
                    {voiceSupported && (
                      <button
                        aria-label={
                          isListening ? "Stop listening" : "Start voice input"
                        }
                        className={isListening ? "is-listening" : ""}
                        onClick={() =>
                          isListening
                            ? recognitionRef.current?.stop()
                            : recognitionRef.current?.start()
                        }
                        type="button"
                      >
                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                      </button>
                    )}
                  </div>
                  <button
                    aria-label="Send message"
                    className="do-send"
                    disabled={!input.trim() || submitting}
                    onClick={() => sendMessage()}
                    type="button"
                  >
                    {submitting ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <ArrowUp size={17} />
                    )}
                  </button>
                </div>
              </div>
              <p className="do-composer-note">
                You stay in control. Suggested changes remain pending until
                approved.
              </p>
            </div>
          </>
        ) : centerView === "items" ? (
          <WorkItemsCenter
            activeProject={routeOrPrimaryProject}
            onAddTask={addProjectTask}
            onAsk={(prompt) => {
              setComposer(prompt);
              goCenterView("conversation");
            }}
            onOpenProjectConsole={openProjectRecord}
            onSelectItem={setSelectedWorkItemId}
            onCreateControlledOption={createControlledOption}
            onUpdateTask={updateProjectTask}
            projects={projects}
            selectedItemId={selectedWorkItemId}
            tags={categories}
            tasks={tasks}
            workspaceMembers={workspaceMembers}
          />
        ) : centerView === "strategy" ? (
          <StrategyCenter
            goals={strategicGoals}
            keyResults={strategicMeasures}
            onAsk={(prompt) => {
              setComposer(prompt);
              goCenterView("conversation");
            }}
            projects={projects}
            records={strategicRecords}
            tasks={tasks}
            workspaceMembers={workspaceMembers}
          />
        ) : centerView === "settings" ? (
          <ControlledListsSettings
            categories={categories}
            onBack={() => goCenterView("conversation")}
            onCreateOption={createControlledOption}
            onRenameOption={renameControlledOption}
            projects={projects}
            tasks={tasks}
          />
        ) : centerView === "portfolio" ? (
          <ProjectCommandCenter
            onArchiveProject={archiveProject}
            onDeleteProject={deleteProject}
            onRestoreProject={restoreProject}
            onClose={() => goCenterView("conversation")}
            onAsk={(prompt) => {
              setComposer(prompt);
              goCenterView("conversation");
            }}
            onCreateControlledOption={createControlledOption}
            onOpenProject={openProjectRecord}
            onUpdateProject={updateProject}
            onApplyProjectTemplate={applyProjectTemplate}
            onCreateProjectTemplate={createProjectTemplate}
            onDeleteProjectTemplate={deleteProjectTemplate}
            costTemplates={costTemplates}
            onCreateCostTemplate={createCostTemplate}
            onUpdateCostTemplate={updateCostTemplate}
            projects={projects}
            projectTemplates={projectTemplates}
            risks={risks}
            tags={categories}
            tasks={tasks}
            workspaceMembers={workspaceMembers}
          />
        ) : centerView === "project" ? (
          consoleProject ? (
            <ProjectConsolePanel
              conversationId={conversationId}
              costTemplates={costTemplates}
              documents={knowledgeItems.filter(
                (item) =>
                  item.projectId === consoleProject.id &&
                  item.status !== "archived",
              )}
              milestones={milestones.filter(
                (item) => item.projectId === consoleProject.id,
              )}
              onAddRisk={(title, patch) =>
                addProjectRisk(consoleProject.id, title, patch)
              }
              onAddTask={(title, status, patch) =>
                addProjectTask(consoleProject.id, title, status, patch)
              }
              onArchiveProject={archiveProject}
              onCreateCostTemplate={createCostTemplate}
              onDeleteProject={deleteProject}
              onRestoreProject={restoreProject}
              onAsk={(prompt) => {
                setComposer(prompt);
                goCenterView("conversation");
              }}
              onUpdateProject={updateProject}
              onUpdateCostTemplate={updateCostTemplate}
              onUpdateTask={updateProjectTask}
              project={consoleProject}
              risks={risks.filter(
                (item) => item.projectId === consoleProject.id,
              )}
              tasks={tasks.filter(
                (item) => item.projectId === consoleProject.id,
              )}
              workspaceMembers={workspaceMembers}
            />
          ) : (
            <div className="do-panel-empty">
              <Folder size={20} />
              <strong>No project selected.</strong>
              <span>Choose a project from the portfolio.</span>
            </div>
          )
        ) : (
          <NotesWorkspace
            activeProject={routeOrPrimaryProject}
            entries={notebookEntries}
            knowledgeItems={knowledgeItems}
            onAsk={(prompt) => {
              setComposer(prompt);
              goCenterView("conversation");
            }}
            projects={projects}
            tasks={tasks}
          />
        )}
      </main>

      <aside
        className={`do-panel ${panel ? "is-open" : ""} ${panel === "project" ? "is-project-console" : ""}`}
        aria-hidden={!panel}
      >
        <div className="do-panel-head">
          <div>
            <span>
              {panel === "today"
                ? "FOCUS"
                : panel === "projects"
                  ? "CONTEXT"
                  : panel === "project"
                    ? "PROJECT"
                    : panel === "skills"
                      ? "SKILLS"
                      : panel === "digest"
                        ? "EMAIL"
                        : panel === "workspace"
                          ? "ADMIN"
                          : "CONTROL"}
            </span>
            <h2>
              {panel === "today"
                ? "Today"
                : panel === "projects"
                  ? "Conversation context"
                  : panel === "project"
                    ? "Project console"
                    : panel === "skills"
                      ? "Skills"
                      : panel === "digest"
                        ? "Digest & reminders"
                        : panel === "workspace"
                          ? "Workspace & team"
                          : "Pendientes"}
            </h2>
          </div>
          <button
            aria-label="Close panel"
            onClick={() => setPanel(null)}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="do-panel-body">
          {panel === "project" &&
            (consoleProject ? (
              <ProjectConsolePanel
                conversationId={conversationId}
                costTemplates={costTemplates}
                documents={knowledgeItems.filter(
                  (item) =>
                    item.projectId === consoleProject.id &&
                    item.status !== "archived",
                )}
                milestones={milestones.filter(
                  (item) => item.projectId === consoleProject.id,
                )}
                onAddRisk={(title, patch) =>
                  addProjectRisk(consoleProject.id, title, patch)
                }
                onAddTask={(title, status, patch) =>
                  addProjectTask(consoleProject.id, title, status, patch)
                }
                onArchiveProject={archiveProject}
                onCreateCostTemplate={createCostTemplate}
                onDeleteProject={deleteProject}
                onRestoreProject={restoreProject}
                onAsk={setComposer}
                onUpdateProject={updateProject}
                onUpdateCostTemplate={updateCostTemplate}
                onUpdateTask={updateProjectTask}
                project={consoleProject}
                risks={risks.filter(
                  (item) => item.projectId === consoleProject.id,
                )}
                tasks={tasks.filter(
                  (item) => item.projectId === consoleProject.id,
                )}
                workspaceMembers={workspaceMembers}
              />
            ) : (
              <div className="do-panel-empty">
                <Folder size={20} />
                <strong>No project selected.</strong>
                <span>
                  Choose a project from the sidebar, then open its console.
                </span>
              </div>
            ))}

          {panel === "today" && (
            <>
              <p className="do-panel-intro">
                Only the work that may need your attention now.
              </p>
              <div className="do-panel-list">
                {(isFocusedConversation ? projectTasks : todayTasks)
                  .slice(0, 10)
                  .map((task) => (
                    <button
                      key={task.id}
                      onClick={() =>
                        setComposer(
                          `Help me move this task forward: ${entityTitle(task)}`,
                        )
                      }
                      type="button"
                    >
                      <Circle size={13} />
                      <span>
                        <strong>{entityTitle(task)}</strong>
                        <small>
                          {priorityLabel(task.priority)}
                          {task.projectId
                            ? ` · ${entityTitle(projects.find((project) => project.id === task.projectId))}`
                            : ""}
                        </small>
                      </span>
                      <ChevronRight size={13} />
                    </button>
                  ))}
                {(isFocusedConversation ? projectTasks : todayTasks).length ===
                  0 && (
                  <div className="do-panel-empty">
                    <CheckCircle2 size={20} />
                    <strong>Nothing urgent here.</strong>
                    <span>
                      Use the conversation to decide what deserves focus.
                    </span>
                  </div>
                )}
              </div>
              <button
                className="do-panel-primary"
                onClick={() =>
                  sendMessage(
                    "Plan my day realistically using my current work and available capacity.",
                  )
                }
                type="button"
              >
                <Sparkles size={15} /> Plan with Certo Work
              </button>
            </>
          )}

          {panel === "projects" && (
            <>
              <p className="do-panel-intro">
                A conversation can stay general or focus on one or several
                projects and tasks.
              </p>
              <div className="do-panel-list do-context-options">
                <button
                  className={!isFocusedConversation ? "is-selected" : ""}
                  onClick={() => updateConversationContext([], [], true)}
                  type="button"
                >
                  <Sparkles size={14} />
                  <span>
                    <strong>Chief of Staff · general</strong>
                    <small>
                      Coordinate and manage anything in the workspace
                    </small>
                  </span>
                  {!isFocusedConversation ? (
                    <Check size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )}
                </button>
                <span className="do-context-section-label">Projects</span>
                {activeProjects.map((project) => {
                  const count = openTasks.filter(
                    (task) => task.projectId === project.id,
                  ).length;
                  const selected = directContextProjectIds.includes(project.id);
                  return (
                    <button
                      className={selected ? "is-selected" : ""}
                      key={project.id}
                      onClick={() =>
                        updateConversationContext(
                          selected
                            ? directContextProjectIds.filter(
                                (id) => id !== project.id,
                              )
                            : [...directContextProjectIds, project.id],
                          contextTaskIds,
                        )
                      }
                      type="button"
                    >
                      <Folder size={14} />
                      <span>
                        <strong>{entityTitle(project)}</strong>
                        <small>
                          {count} open task{count === 1 ? "" : "s"}
                        </small>
                      </span>
                      {selected ? <Check size={13} /> : <Plus size={13} />}
                    </button>
                  );
                })}
                <span className="do-context-section-label">Tasks</span>
                <input
                  aria-label="Find tasks for this conversation"
                  onChange={(event) => setContextTaskSearch(event.target.value)}
                  placeholder="Find a task"
                  value={contextTaskSearch}
                />
                {openTasks
                  .filter(
                    (task) =>
                      !contextTaskSearch.trim() ||
                      `${entityTitle(task)} ${entityTitle(projects.find((project) => project.id === task.projectId))}`
                        .toLowerCase()
                        .includes(contextTaskSearch.toLowerCase()),
                  )
                  .sort(
                    (left, right) =>
                      Number(contextTaskIds.includes(right.id)) -
                      Number(contextTaskIds.includes(left.id)),
                  )
                  .slice(0, 15)
                  .map((task) => {
                    const selected = contextTaskIds.includes(task.id);
                    return (
                      <button
                        className={selected ? "is-selected" : ""}
                        key={task.id}
                        onClick={() =>
                          updateConversationContext(
                            directContextProjectIds,
                            selected
                              ? contextTaskIds.filter((id) => id !== task.id)
                              : [...contextTaskIds, task.id],
                          )
                        }
                        type="button"
                      >
                        <ListTodo size={14} />
                        <span>
                          <strong>{entityTitle(task)}</strong>
                          <small>
                            {task.projectId
                              ? entityTitle(
                                  projects.find(
                                    (project) => project.id === task.projectId,
                                  ),
                                )
                              : "No project"}
                          </small>
                        </span>
                        {selected ? <Check size={13} /> : <Plus size={13} />}
                      </button>
                    );
                  })}
              </div>
              {routeOrPrimaryProject && (
                <button
                  className="do-panel-primary"
                  onClick={() => openProjectRecord(routeOrPrimaryProject)}
                  type="button"
                >
                  <Folder size={15} /> Open project console
                </button>
              )}
              <button
                className="do-panel-primary"
                onClick={() => setPanel(null)}
                type="button"
              >
                <Check size={15} /> Done
              </button>
              <button
                className="do-panel-secondary"
                onClick={() => {
                  setPanel(null);
                  goCenterView("portfolio");
                }}
                type="button"
              >
                Project command center
              </button>
            </>
          )}

          {panel === "skills" && (
            <>
              <p className="do-panel-intro">
                Skills are reusable operating moves. You can invoke them from
                here, from the + menu, or by typing /project wizard.
              </p>
              <div className="do-panel-list do-skill-list">
                {DELIVEREE_SKILLS.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      setPanel(null);
                      setProjectWizardOpen(true);
                    }}
                    type="button"
                  >
                    <WandSparkles size={14} />
                    <span>
                      <strong>{skill.title}</strong>
                      <small>{skill.summary}</small>
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
              <div className="do-panel-empty do-skill-next">
                <Sparkles size={20} />
                <strong>One skill first. Good.</strong>
                <span>
                  Project Wizard is the foundation. Later we can add PRD
                  Builder, Sprint Planner, Risk Review, and Codex Handoff as
                  real skills.
                </span>
              </div>
            </>
          )}

          {panel === "digest" && (
            <>
              <p className="do-panel-intro">
                Ask Certo Work for reminders and summaries from the same flow.
                Email delivery is saved as a request until an email service is
                connected.
              </p>
              <div className="do-panel-list">
                <button
                  onClick={() => saveDigestRequest("email_reminder")}
                  type="button"
                >
                  <Mail size={14} />
                  <span>
                    <strong>Email reminder</strong>
                    <small>
                      Draft a reminder from current work and mark delivery as
                      pending integration
                    </small>
                  </span>
                  <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => saveDigestRequest("daily_digest")}
                  type="button"
                >
                  <CalendarDays size={14} />
                  <span>
                    <strong>Daily digest</strong>
                    <small>
                      Prepare today’s tasks, priorities, risks, and follow-ups
                    </small>
                  </span>
                  <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => saveDigestRequest("weekly_summary")}
                  type="button"
                >
                  <ListTodo size={14} />
                  <span>
                    <strong>Weekly summary</strong>
                    <small>
                      Prepare a week-level digest by project, priority, and date
                    </small>
                  </span>
                  <ChevronRight size={13} />
                </button>
              </div>
              <div className="do-panel-empty do-skill-next">
                <ShieldCheck size={20} />
                <strong>No fake sending.</strong>
                <span>
                  Requests are saved now. Actual automatic emails need a
                  configured provider such as Gmail, SendGrid, Resend, or
                  Postmark.
                </span>
              </div>
            </>
          )}

          {panel === "workspace" && (
            <>
              <p className="do-panel-intro">
                Workspaces separate companies, teams, or operating contexts.
                This version supports up to {WORKSPACE_LIMIT}; conversations
                stay personal, while projects and tasks live inside the selected
                workspace.
              </p>

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Current workspace</span>
                  <strong>{workspace?.name || "Workspace"}</strong>
                </div>
                <label>
                  Workspace name
                  <input
                    onChange={(event) =>
                      setWorkspaceNameDraft(event.target.value)
                    }
                    onKeyDown={(event) =>
                      event.key === "Enter" && updateWorkspaceProfile()
                    }
                    value={workspaceNameDraft}
                  />
                </label>
                <button onClick={updateWorkspaceProfile} type="button">
                  Save workspace
                </button>
              </section>

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Switch</span>
                  <strong>
                    {workspaces.length}/{WORKSPACE_LIMIT} workspaces
                  </strong>
                </div>
                <div className="do-workspace-switcher-list">
                  {workspaces.map((item) => (
                    <button
                      className={item.id === workspace?.id ? "is-active" : ""}
                      key={item.id}
                      onClick={() =>
                        item.id !== workspace?.id && setWorkspace(item)
                      }
                      type="button"
                    >
                      <span className="do-avatar">{initials(item.name)}</span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.ownerId === user?.uid ? "Owner" : "Member"}
                        </small>
                      </span>
                      {item.id === workspace?.id ? (
                        <Check size={13} />
                      ) : (
                        <ChevronRight size={13} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="do-workspace-create-row">
                  <input
                    disabled={!canCreateWorkspace(workspaces.length)}
                    onChange={(event) =>
                      setNewWorkspaceName(event.target.value)
                    }
                    onKeyDown={(event) =>
                      event.key === "Enter" && createWorkspace()
                    }
                    placeholder={
                      canCreateWorkspace(workspaces.length)
                        ? "New workspace name"
                        : "Workspace limit reached"
                    }
                    value={newWorkspaceName}
                  />
                  <button
                    disabled={
                      !newWorkspaceName.trim() ||
                      !canCreateWorkspace(workspaces.length)
                    }
                    onClick={createWorkspace}
                    type="button"
                  >
                    <Plus size={13} /> Create
                  </button>
                </div>
              </section>

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Invite</span>
                  <strong>Access control</strong>
                </div>
                <div className="do-workspace-create-row">
                  <input
                    onChange={(event) => setInviteEmail(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && inviteWorkspaceMember()
                    }
                    placeholder="person@company.com"
                    value={inviteEmail}
                  />
                  <select
                    aria-label="Invite role"
                    onChange={(event) =>
                      setInviteRole(
                        event.target.value as "admin" | "member" | "viewer",
                      )
                    }
                    value={inviteRole}
                  >
                    {WORKSPACE_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!inviteEmail.trim()}
                    onClick={inviteWorkspaceMember}
                    type="button"
                  >
                    Invite
                  </button>
                </div>
                <div className="do-role-help">
                  {WORKSPACE_ROLES.map((role) => (
                    <span key={role.value}>
                      <strong>{role.label}</strong>
                      {role.help}
                    </span>
                  ))}
                </div>
              </section>

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Members</span>
                  <strong>{workspaceMembers.length} people</strong>
                </div>
                <div className="do-member-list">
                  {workspaceMembers.map((member) => {
                    const isOwner =
                      String(member.role || "").toLowerCase() === "owner" ||
                      member.userId === workspace?.ownerId;
                    return (
                      <article key={member.id}>
                        <span className="do-avatar">
                          {initials(
                            member.displayName,
                            member.email || member.emailLower,
                          )}
                        </span>
                        <div>
                          <strong>{memberLabel(member)}</strong>
                          <small>
                            {member.email || member.emailLower || "No email"} ·{" "}
                            {String(member.status || "active")}
                          </small>
                        </div>
                        {isOwner ? (
                          <em>Owner</em>
                        ) : (
                          <select
                            aria-label={`Role for ${memberLabel(member)}`}
                            onChange={(event) =>
                              updateMemberRole(
                                member,
                                event.target.value as
                                  | "admin"
                                  | "member"
                                  | "viewer",
                              )
                            }
                            value={String(member.role || "member")}
                          >
                            {WORKSPACE_ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </article>
                    );
                  })}
                  {workspaceMembers.length === 0 && (
                    <div className="do-panel-empty">
                      <Users size={20} />
                      <strong>No members yet.</strong>
                      <span>
                        Invite your team to assign work and collaborate by
                        workspace.
                      </span>
                    </div>
                  )}
                </div>
                {workspaceInvites.length > 0 && (
                  <div className="do-pending-invites">
                    <span className="do-kicker">Pending invites</span>
                    {workspaceInvites.map((invite) => (
                      <small key={invite.id}>
                        {invite.email} · {roleLabel(invite.role)}
                      </small>
                    ))}
                  </div>
                )}
              </section>

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Teams</span>
                  <strong>{workspaceTeams.length} teams</strong>
                </div>
                <div className="do-workspace-create-row">
                  <input
                    onChange={(event) => setNewTeamName(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && createWorkspaceTeam()
                    }
                    placeholder="Engineering, Ops, Leadership…"
                    value={newTeamName}
                  />
                  <button
                    disabled={!newTeamName.trim()}
                    onClick={createWorkspaceTeam}
                    type="button"
                  >
                    <Plus size={13} /> Team
                  </button>
                </div>
                <div className="do-team-list">
                  {workspaceTeams.map((team) => (
                    <article key={team.id}>
                      <strong>{team.name || "Team"}</strong>
                      <small>
                        {(team.memberEmails || []).length} member
                        {(team.memberEmails || []).length === 1 ? "" : "s"}
                      </small>
                      <div>
                        {workspaceMembers
                          .filter(
                            (member) =>
                              String(member.status || "active") !== "removed",
                          )
                          .map((member) => {
                            const email = normalizeInviteEmail(
                              member.email || member.emailLower || "",
                            );
                            const selected = (team.memberEmails || [])
                              .map((item) => normalizeInviteEmail(item))
                              .includes(email);
                            return (
                              <button
                                className={selected ? "is-selected" : ""}
                                key={`${team.id}-${member.id}`}
                                onClick={() => toggleTeamMember(team, member)}
                                type="button"
                              >
                                {memberAssignmentValue(member) || "Member"}
                              </button>
                            );
                          })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {panel === "approvals" && (
            <>
              <p className="do-panel-intro">
                Nothing enters your workspace until you say so.
              </p>
              <div className="do-approval-list">
                {reviewItems.map((item) => {
                  const duplicateProject =
                    String(item.type || "") === "project"
                      ? findMatchingProject(
                          projects,
                          item.proposed || {},
                          item.projectId || primaryProject?.id || "",
                        )
                      : null;
                  const displayType = duplicateProject
                    ? "project_update"
                    : item.type || "change";
                  const displayTitle = duplicateProject
                    ? `Update existing project: ${duplicateProject.title || duplicateProject.name || item.title}`
                    : item.title;
                  const displayReason = duplicateProject
                    ? "Certo Work recognized that this project already exists. Applying this will update the current project record, not create a duplicate."
                    : item.why || item.action || "Proposed in conversation";
                  return (
                    <div className="do-approval-item" key={item.id}>
                      <span className="do-kicker">{displayType}</span>
                      <strong>{displayTitle}</strong>
                      <p>{displayReason}</p>
                      <div>
                        <button
                          onClick={() => processReview(item, "dismiss")}
                          type="button"
                        >
                          Discard
                        </button>
                        <button
                          onClick={() => {
                            setPanel(null);
                            setComposer(
                              `Edit this pending change before applying it: ${displayTitle}\n\n${displayReason}`,
                            );
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => processReview(item, "approve")}
                          type="button"
                        >
                          <Check size={13} /> Apply
                        </button>
                      </div>
                    </div>
                  );
                })}
                {reviewItems.length === 0 && (
                  <div className="do-panel-empty">
                    <CheckCircle2 size={20} />
                    <strong>No pending changes.</strong>
                    <span>
                      New suggestions will appear here before they change your
                      workspace.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {judgment && panel === "today" && judgment.signals.length > 0 && (
          <div className="do-panel-judgment">
            <ShieldCheck size={15} />
            <span>
              <strong>
                {judgment.verdict === "stop"
                  ? "A conflict needs attention"
                  : "A planning signal"}
              </strong>
              <small>{judgment.signals[0].detail}</small>
            </span>
          </div>
        )}
      </aside>

      {cleanSlateOpen && (
        <div
          aria-label="Start clean Certo Work"
          aria-modal="true"
          className="do-clean-layer"
          role="dialog"
        >
          <section className="do-clean-modal">
            <header>
              <span className="do-kicker">Clean start</span>
              <h2>Reset Certo Work content</h2>
              <button
                aria-label="Close clean start"
                onClick={() => setCleanSlateOpen(false)}
                type="button"
              >
                <X size={17} />
              </button>
            </header>
            <p>
              This clears your current Certo Work records: projects, work items,
              tags, conversations, knowledge, pending changes, habits, workouts,
              reports, and delivery records. Your sign-in stays active.
            </p>
            <div className="do-clean-counts">
              <span>
                <strong>{projects.length}</strong> projects
              </span>
              <span>
                <strong>{tasks.length}</strong> items
              </span>
              <span>
                <strong>{conversations.length}</strong> conversations
              </span>
              <span>
                <strong>{reviewItems.length}</strong> pending
              </span>
            </div>
            <label>
              Type CLEAR to confirm
              <input
                autoFocus
                onChange={(event) => setCleanConfirmText(event.target.value)}
                value={cleanConfirmText}
              />
            </label>
            <footer>
              <button onClick={() => setCleanSlateOpen(false)} type="button">
                Cancel
              </button>
              <button
                disabled={
                  cleanConfirmText.trim().toUpperCase() !== "CLEAR" || cleaning
                }
                onClick={resetWorkspaceData}
                type="button"
              >
                {cleaning ? "Clearing..." : "Start clean"}
              </button>
            </footer>
          </section>
        </div>
      )}

      <ProjectWizardSkill
        activeProject={routeOrPrimaryProject}
        isOpen={projectWizardOpen}
        onClose={() => setProjectWizardOpen(false)}
        onCreateProject={createProjectFromWizard}
        onUpdateProject={updateProjectFromWizard}
        projects={activeProjects}
      />
    </div>
  );
}
