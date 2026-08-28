import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowUp,
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Flag,
  Folder,
  HelpCircle,
  Inbox,
  Home,
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
  Phone,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserMinus,
  Users,
  WandSparkles,
  X,
} from "./ui/Icon";
import { updateProfile } from "firebase/auth";
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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { AliasProfileEditor } from "./ProjectControls";
import { ChatCollabModule } from "./ChatCollabModule";
import { CertoMark } from "./CertoMark";
import { ProductSwitcher } from "./ProductSwitcher";
import { collabProjectPath } from "../lib/collabModule";
import { warmCollabSession } from "../lib/collabClient";
import { useAuth } from "../lib/AuthContext";
import { TextSizeControl } from "./TextSizeControl";
import type { JudgmentAssessment } from "../lib/judgment";
import { actionLabel, resolveDelivereeLens } from "../lib/delivereeRoutes";
import {
  projectHealth,
  sidebarProjectGroups,
  sortProjectsByRecency,
  type WorkLane,
} from "../lib/projectPortfolio";
import { StatusLight, healthToStatus } from "./ui/StatusLight";
import { Toast } from "./ui/Toast";
import { t } from "../lib/i18n";
import {
  dateKey,
  entityTitle,
  findMatchingProject,
  inviteMessage,
  initials,
  isClosed,
  localDateKey,
  priorityLabel,
  proposalChipLabel,
  proposedTitle,
  reviewTypeForAction,
  reviewTypeLabel,
  timeAgo,
  timestamp,
} from "../lib/workspaceDisplay";
import { inviteDirectoryUrl, inviteIsExpired } from "../lib/inviteLifecycle";
import { ActionProposal, RichText, UserMessage } from "./conversation/MessageParts";
import { AppleWidgetSettings } from "./AppleWidgetSettings";
import { AgentsLibrary, AgentBuilderDraft } from "./agents/AgentsLibrary";
import { HomeAttention } from "../pages/HomeAttention";
import { OdysseusBadge, OdysseusMark } from "./odiseus/OdysseusMark";
import {
  OdysseusArtifactCard,
  OdysseusAgentHome,
  OdysseusWorkLog,
  type OdysseusRunStep,
} from "./odiseus/OdysseusWork";
import { OdysseusVoiceCall } from "./odiseus/OdysseusVoiceCall";
import { OdysseusSchedules } from "./odiseus/OdysseusSchedules";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { CommandPalette, type CommandPaletteItem } from "./CommandPalette";
import {
  ODISEUS_CONVERSATION_TITLE,
  ODISEUS_HANDOFF_PREFIX,
  ODISEUS_NAME,
} from "../lib/odiseus";
import { actionIdempotencyKey, normalizeOdysseusRun } from "../lib/odiseusJobs";
import { persistOdysseusRun, recordOdysseusActivitySafe } from "../lib/odiseusActivity";
import {
  conversationIncludesProject,
  conversationProjectIds,
  conversationScopeLabel,
  conversationScopeType,
  conversationTaskIds,
  isStandaloneConversation,
  selectHomeConversation,
  type ConversationScopeType,
} from "../lib/conversationScope";
import { isPersonalWorkItem } from "../lib/personalHomeContext";
import { filterMyWorkTasks, needsCreatorAssigneeRestore, creatorAssigneePatch, withCreatorAssignee } from "../lib/myWorkItems";
import {
  applyInvoiceToFinancePeriods,
  canTransitionInvoice,
  isInvoiceOverdue,
  nextInvoiceNumber,
  paymentStatusForInvoice,
  pendingInvoiceLines,
  type InvoiceDocument,
  type InvoiceStatus,
  type PendingInvoiceLine,
} from "../lib/invoiceDocuments";
import { stripUndefinedValues } from "../lib/projectFinance";
import { InvoiceCenter } from "./InvoiceCenter";
import {
  feedbackToTaskPatch,
  isOpenFeedback,
  type FeedbackKind,
  type FeedbackReport,
  type FeedbackSeverity,
  type FeedbackStatus,
} from "../lib/feedbackReports";
import { ProjectCommandCenter, ProjectConsolePanel } from "./ProjectSurfaces";
import { WorkItemsCenter } from "./WorkItemsCenter";
import { FeedbackCenter } from "./FeedbackCenter";
import { ProjectWizardSkill } from "./ProjectWizardSkill";
import { MagicProjectModal } from "./MagicProjectModal";
import { NotesWorkspace } from "./NotesWorkspace";
import { StrategyCenter } from "./StrategyCenter";
import { ControlledListsSettings } from "./ControlledListsSettings";
import { useControlledListsActions } from "../hooks/useControlledListsActions";
import { useControlledListDeletion } from "../hooks/useControlledListDeletion";
import { useProjectTemplates } from "../hooks/useProjectTemplates";
import {
  activeWorkspaceMemberId as accessMemberId,
  buildOwnedAccessPatch,
  buildTaskAccessPatch,
  isPortfolioViewerMember,
  normalizeAccessEmail,
} from "../lib/accessControl";
import { buildProjectCollaboratorAccessPatch } from "../lib/collaborationAccess";
import {
  DELIVEREE_SKILLS,
  defaultProjectWizardFirstAction,
  isProjectWizardInvocation,
  splitProjectWizardLines,
  type ProjectWizardDraft,
} from "../lib/delivereeSkills";
import { useMobileCore } from "../hooks/useMobileCore";
import { mobileCoreFallbackPath, mobileCoreTab } from "../lib/mobileCore";
import {
  APPLE_WIDGET_COLLECTION,
  buildAppleWidgetSnapshot,
  createAppleWidgetToken,
} from "../lib/appleWidget";
import {
  buildVoiceWrapUpMessage,
  transcribeVoiceAudio,
} from "../lib/voiceConversation";
import type { NotebookEntry } from "../lib/notebookContext";
import { type MagicProjectBlueprint, type MagicProjectItem } from "../lib/magicProject";
import { buildConversationRequestContext } from "../lib/conversationContextBuilder";
import { sendBoldiChat } from "../lib/conversationClient";
import {
  assistantFallbackReply,
  conversationTitleForMessage,
  streamConversationReply,
} from "../lib/conversationSession";
import { sendWorkspaceInviteEmail } from "../lib/emailClient";
import {
  isAllowedProjectResourceSize,
} from "../lib/projectResources";
import { canDeleteProject } from "../lib/projectPermissions";
import { isModernWorkItemKey, nextWorkItemKey } from "../lib/workItemKey";
import type { SprintRecord } from "../lib/sprints";
import { createShareToken, buildProjectStatusReport, sanitizeStatusReportSnapshot } from "../lib/projectStatusReport";
import {
  connectGoogleDrive,
  createDriveFolder,
  listDriveFolders,
  storedDriveAccessToken,
  type DriveFolder,
} from "../lib/googleDrive";
import {
  WORKSPACE_LIMIT,
  WORKSPACE_ROLES,
  activeDirectoryMembers,
  activeMemberId,
  canChangePasswordForProvider,
  canCreateWorkspace,
  canManageWorkspaceMembers,
  canOperateInvoices,
  createInviteCode,
  isAssignableMember,
  isWorkspaceOwnerRole,
  memberAvatar,
  memberHasAlias,
  memberLabel,
  memberManageLabel,
  memberPublicLabel,
  memberStatusLabel,
  membershipPublicPatch,
  normalizeAlias,
  normalizeInviteEmail,
  normalizeMemberEmoji,
  passwordProviderMessage,
  pendingInviteDirectory,
  pendingMemberId,
  roleLabel,
  suggestedAlias,
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

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: any;
  citations?: Array<{ id: string; title: string; type?: string }>;
  suggestedChips?: string[];
  actionPlan?: any;
  odiseusRun?: any;
  offline?: boolean;
};

type AccessRequest = {
  id: string;
  userId?: string;
  email?: string;
  emailLower?: string;
  displayName?: string;
  status?: string;
  provider?: string;
  requestedAt?: any;
  updatedAt?: any;
};

export type Panel =
  | "today"
  | "projects"
  | "project"
  | "approvals"
  | "skills"
  | "digest"
  | "workspace"
  | "settings"
  | null;
export type CenterView =
  | "conversation"
  | "items"
  | "notes"
  | "strategy"
  | "portfolio"
  | "project"
  | "agents"
  | "invoices"
  | "feedback";

export function DelivereeWorkspace() {
  const {
    user,
    workspace,
    workspaces,
    setWorkspace,
    reloadWorkspaces,
    sendPasswordReset,
    logOut,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const lens = resolveDelivereeLens(location.pathname);
  const onCollab = lens.kind === "collab";
  const [workOpened, setWorkOpened] = useState(() => !onCollab);
  const [collabOpened, setCollabOpened] = useState(() => onCollab);
  const mobileCore = useMobileCore();
  useEffect(() => {
    if (onCollab) setCollabOpened(true);
    else setWorkOpened(true);
  }, [onCollab]);
  useEffect(() => {
    if (!user?.email || !workspace) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        await warmCollabSession({
          token,
          userId: user.uid,
          workspaceId: workspace.id,
          email: user.email || "",
          displayName: user.displayName || workspace.name || "Certo Work",
          company: workspace.name || "",
        });
      } catch {
        // The desk still opens from the Collab tab if warming fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, workspace]);
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
  const [invoiceDocuments, setInvoiceDocuments] = useState<InvoiceDocument[]>([]);
  const [invoiceBusyId, setInvoiceBusyId] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    [],
  );
  const [workspaceTeams, setWorkspaceTeams] = useState<WorkspaceTeam[]>([]);
  const [sprints, setSprints] = useState<SprintRecord[]>([]);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [driveRoot, setDriveRoot] = useState<DriveFolder | null>(null);
  const [driveMessage, setDriveMessage] = useState("");
  const [workspaceInvites, setWorkspaceInvites] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReport[]>([]);
  const [costTemplates, setCostTemplates] = useState<any[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<any[]>([]);
  const [strategicGoals, setStrategicGoals] = useState<any[]>([]);
  const [strategicMeasures, setStrategicMeasures] = useState<any[]>([]);
  const [strategicRecords, setStrategicRecords] = useState<any[]>([]);
  const [odiseusMemory, setOdysseusMemory] = useState<any[]>([]);
  const [odiseusActivity, setOdysseusActivity] = useState<any[]>([]);
  const [workspaceSkills, setWorkspaceSkills] = useState<any[]>([]);
  const [odiseusSchedules, setOdysseusSchedules] = useState<any[]>([]);
  const [liveOdysseusSteps, setLiveOdysseusSteps] = useState<OdysseusRunStep[]>(
    [],
  );
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
  const [sidebarSections, setSidebarSections] = useState<{
    projects: boolean;
    favorites: boolean;
    recent: boolean;
    conversations: boolean;
  }>(() => {
    const defaults = {
      projects: true,
      favorites: true,
      recent: true,
      conversations: true,
    };
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem("certo-sidebar-sections");
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  });
  const toggleSidebarSection = (
    key: "projects" | "favorites" | "recent" | "conversations",
  ) => {
    setSidebarSections((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem("certo-sidebar-sections", JSON.stringify(next));
      return next;
    });
  };
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contextTaskSearch, setContextTaskSearch] = useState("");
  const [chatsExpanded, setChatsExpanded] = useState(false);
  const [projectConsoleId, setProjectConsoleId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const panel = (
    lens.kind === "approvals"
      ? "approvals"
      : lens.kind === "settings"
        ? "settings"
        : lens.kind === "agents"
          ? lens.section === "automations"
            ? "skills"
            : lens.section === "activity"
              ? "digest"
              : null
          : lens.kind === "more"
            ? lens.section === "automations"
              ? "skills"
              : lens.section === "updates"
                ? "digest"
                : lens.section === "workspace"
                  ? "workspace"
                  : null
            : null
  ) as Panel;
  const setPanel = (next: Panel) => {
    setSidebarOpen(false);
    if (!next) {
      navigate("/home");
      return;
    }
    if (next === "today") navigate("/home");
    else if (next === "projects") navigate("/projects");
    else if (next === "project") {
      const id = projectConsoleId || (lens.kind === "project" ? lens.projectId : null);
      navigate(id ? `/work/projects/${id}` : "/projects");
    } else if (next === "approvals") navigate("/approvals");
    else if (next === "skills") navigate("/agents/automations");
    else if (next === "digest") navigate("/agents/activity");
    else if (next === "workspace") navigate("/workspace");
    else if (next === "settings") navigate("/settings");
  };
  const centerView: CenterView =
    lens.kind === "notes" || (lens.kind === "project" && lens.tab === "notes")
      ? "notes"
      : lens.kind === "project"
      ? lens.tab === "strategy"
          ? "strategy"
          : "project"
      : lens.kind === "my-work"
        ? "items"
        : lens.kind === "feedback"
        ? "feedback"
        : lens.kind === "work"
          ? lens.section === "issues"
            ? "items"
            : "portfolio"
          : lens.kind === "agents"
            ? "agents"
            : lens.kind === "invoices"
              ? "invoices"
            : "conversation";
  const goCenterView = (next: CenterView) => {
    const projectId =
      (lens.kind === "project" ? lens.projectId : null) || projectConsoleId;
    if (next === "portfolio") navigate("/projects");
    else if (next === "project" && projectId) navigate(`/work/projects/${projectId}`);
    else if (next === "notes") {
      if (projectId && lens.kind === "project") navigate(`/work/projects/${projectId}/notes`);
      else navigate("/notes");
    }
    // Legacy /tasks URL opens the project console on Items (tasks = backlog = items).
    else if (next === "items" && projectId)
      navigate(`/work/projects/${projectId}/tasks`);
    else if (next === "items") navigate("/my-work");
    else if (next === "strategy" && projectId) navigate(`/work/projects/${projectId}/strategy`);
    else if (next === "agents") navigate("/agents");
    else if (next === "invoices") navigate("/invoices");
    else if (next === "feedback") navigate("/feedback");
    else navigate("/home");
  };
  const projectConsoleInitialTab =
    lens.kind === "project" && lens.tab === "tasks" ? "items" : "brief";
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [cleanSlateOpen, setCleanSlateOpen] = useState(false);
  const [cleanConfirmText, setCleanConfirmText] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [magicProjectOpen, setMagicProjectOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const [createMenuPos, setCreateMenuPos] = useState({ top: 0, right: 0 });
  const [agentBuilderOpen, setAgentBuilderOpen] = useState(false);
  const [agentOutcomeDraft, setAgentOutcomeDraft] = useState("");
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [aliasDraft, setAliasDraft] = useState("");
  const [emojiDraft, setEmojiDraft] = useState("🙂");
  const [newTeamName, setNewTeamName] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [widgetToken, setWidgetToken] = useState("");
  const [widgetBusy, setWidgetBusy] = useState(false);
  const [widgetError, setWidgetError] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSessionRef = useRef(false);
  const restoredCreatorAssignees = useRef(new Set<string>());

  useEffect(() => {
    if (!user || !workspace) return;
    setWorkspaceNameDraft(workspace.name || "Workspace");
    const emailLower = normalizeAccessEmail(user.email);
    const memberId = accessMemberId(workspace.id, user.uid);
    const currentMember = workspaceMembers.find((member) => member.userId === user.uid);
    const canSeeWorkspacePortfolio =
      workspace.ownerId === user.uid || isPortfolioViewerMember(currentMember);
    const canTriageFeedback = canManageWorkspaceMembers(
      currentMember?.role,
      workspace.ownerId === user.uid,
    );
    const mergeQueries = (
      name: string,
      queryClauses: any[][],
      callback: (items: any[]) => void,
    ) => {
      const buckets = new Map<number, any[]>();
      const publish = () => {
        const merged = new Map<string, any>();
        [...buckets.values()].flat().forEach((item) => {
          if (item?.workspaceId === workspace.id) merged.set(item.id, item);
        });
        callback([...merged.values()]);
      };
      return queryClauses.map((clauses, index) =>
        onSnapshot(
          query(collection(db, name), ...clauses),
          (snapshot) => {
            buckets.set(
              index,
              snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
            );
            publish();
          },
          () => {
            buckets.set(index, []);
            publish();
          },
        ),
      );
    };
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
    const projectUnsubscribers = canSeeWorkspacePortfolio
      ? [makeQuery("projects", setProjects)]
      : mergeQueries(
          "projects",
          [
            [where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)],
            [where("visibleToUserIds", "array-contains", user.uid)],
            [where("visibleToEmails", "array-contains", emailLower)],
            [where("teamMemberIds", "array-contains", memberId)],
            [where("sponsorIds", "array-contains", memberId)],
            [where("projectManagerId", "==", memberId), where("workspaceId", "==", workspace.id)],
            [where("productOwnerId", "==", memberId), where("workspaceId", "==", workspace.id)],
          ],
          setProjects,
        );
    const taskUnsubscribers =
      workspace.ownerId === user.uid
        ? [makeQuery("tasks", setTasks)]
        : mergeQueries(
            "tasks",
            [
              [where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)],
              [where("createdBy", "==", user.uid), where("workspaceId", "==", workspace.id)],
              [where("visibleToUserIds", "array-contains", user.uid)],
              [where("visibleToEmails", "array-contains", emailLower)],
              [where("assigneeIds", "array-contains", memberId)],
              [where("accessMemberIds", "array-contains", memberId)],
              [where("sharedWithUserIds", "array-contains", user.uid)],
            ],
            setTasks,
          );
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
          setConversationId((current) => {
            if (current) return current;
            return selectHomeConversation(sorted)?.id || null;
          });
        },
        true,
        true,
      ),
      ...projectUnsubscribers,
      ...taskUnsubscribers,
      ...mergeQueries(
        "feedback_reports",
        [
          [where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)],
          ...(canTriageFeedback
            ? [[where("workspaceId", "==", workspace.id)]]
            : []),
        ],
        (items) =>
          setFeedbackReports(
            (items as FeedbackReport[]).sort(
              (left, right) =>
                timestamp(right.createdAt) - timestamp(left.createdAt),
            ),
          ),
      ),
      makeQuery("milestones", setMilestones),
      makeQuery("invoice_documents", (items) =>
        setInvoiceDocuments(items as InvoiceDocument[]),
      ),
      makeQuery("sprints", (items) => setSprints(items as SprintRecord[])),
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
      makeQuery("odiseus_memory", setOdysseusMemory, false, true),
      makeQuery(
        "odiseus_activity",
        (items) =>
          setOdysseusActivity(
            items.sort(
              (left, right) =>
                timestamp(right.createdAt) - timestamp(left.createdAt),
            ),
          ),
        false,
        true,
      ),
      makeQuery("skills", setWorkspaceSkills, false, true),
      makeQuery("scheduled_tasks", setOdysseusSchedules, false, true),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, workspace, workspaceMembers]);

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
      onSnapshot(
        query(collection(db, "access_requests"), where("status", "==", "pending")),
        (snapshot) =>
          setAccessRequests(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }) as AccessRequest)
              .sort(
                (left, right) =>
                  timestamp(right.requestedAt || right.updatedAt) -
                  timestamp(left.requestedAt || left.updatedAt),
              ),
          ),
        () => setAccessRequests([]),
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
  const personalActor = useMemo(
    () => ({
      userId: user?.uid || "",
      memberId:
        user && workspace ? accessMemberId(workspace.id, user.uid) : "",
      email: user?.email || "",
    }),
    [user?.email, user?.uid, workspace],
  );
  const personalTodayTasks = useMemo(
    () => todayTasks.filter((task) => isPersonalWorkItem(task, personalActor)),
    [personalActor, todayTasks],
  );
  const myWorkTasks = useMemo(
    () =>
      filterMyWorkTasks(
        tasks,
        lens.kind === "my-work" ? lens.section : "assigned",
        personalActor,
        workspaceMembers,
      ),
    [lens, personalActor, tasks, workspaceMembers],
  );

  useEffect(() => {
    if (!user || !workspace) return;
    const pending = tasks
      .filter(
        (item) =>
          needsCreatorAssigneeRestore(item, personalActor) &&
          !restoredCreatorAssignees.current.has(item.id),
      )
      .slice(0, 40);
    if (!pending.length) return;
    const patch = creatorAssigneePatch(personalActor, workspaceMembers);
    if (!patch.assigneeIds.length && !patch.assignees.length) return;
    for (const item of pending) restoredCreatorAssignees.current.add(item.id);
    // Additive restore only. My Work is a view: never delete records to change a filter.
    void Promise.all(
      pending.map((item) =>
        updateDoc(doc(db, "tasks", item.id), {
          ...patch,
          ...buildTaskAccessPatch({
            task: { ...item, ...patch },
            workspaceId: workspace.id,
            userId: user.uid,
            email: user.email,
            members: workspaceMembers,
          }),
          updatedAt: serverTimestamp(),
        }),
      ),
    ).catch(() => {
      for (const item of pending) restoredCreatorAssignees.current.delete(item.id);
    });
  }, [personalActor, tasks, user, workspace, workspaceMembers]);

  useEffect(() => {
    if (!user || !workspace) {
      setWidgetToken("");
      return;
    }
    let active = true;
    void getDocs(
      query(collection(db, APPLE_WIDGET_COLLECTION), where("userId", "==", user.uid)),
    )
      .then((snapshot) => {
        const match = snapshot.docs
          .map((item) => ({ id: item.id, ...(item.data() as any) }))
          .find((item) => item.workspaceId === workspace.id && item.revoked !== true);
        if (active) setWidgetToken(String(match?.token || ""));
      })
      .catch(() => {
        if (active) setWidgetToken("");
      });
    return () => {
      active = false;
    };
  }, [user, workspace]);

  useEffect(() => {
    if (!user || !workspace || !widgetToken) return;
    const snapshot = buildAppleWidgetSnapshot({
      tasks: personalTodayTasks,
      projects,
      pendingApprovals: reviewItems.length,
      workspaceName: workspace.name || "Certo Work",
    });
    const handle = window.setTimeout(() => {
      void updateDoc(doc(db, APPLE_WIDGET_COLLECTION, widgetToken), {
        snapshot,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(handle);
  }, [personalTodayTasks, projects, reviewItems.length, user, widgetToken, workspace]);
  const currentWorkspaceMember = useMemo(
    () =>
      workspaceMembers.find(
        (member) =>
          member.userId === user?.uid && isAssignableMember(member),
      ) || null,
    [workspaceMembers, user?.uid],
  );
  const needsAlias = Boolean(
    user && workspace && currentWorkspaceMember && !memberHasAlias(currentWorkspaceMember),
  );
  const canManageMembers = canManageWorkspaceMembers(
    currentWorkspaceMember?.role,
    workspace?.ownerId === user?.uid,
  );
  const canOperateInvoiceQueue = canOperateInvoices(
    currentWorkspaceMember?.role,
    workspace?.ownerId === user?.uid,
    currentWorkspaceMember?.financeAccess,
  );
  const pendingInvoiceQueue = useMemo(
    () => pendingInvoiceLines(projects, invoiceDocuments),
    [projects, invoiceDocuments],
  );
  const directoryMembers = useMemo(
    () => activeDirectoryMembers(workspaceMembers),
    [workspaceMembers],
  );
  const pendingInvites = useMemo(
    () => pendingInviteDirectory(workspaceMembers, workspaceInvites),
    [workspaceMembers, workspaceInvites],
  );

  useEffect(() => {
    if (!currentWorkspaceMember && !user) return;
    setAliasDraft(
      suggestedAlias(currentWorkspaceMember || {}, user?.displayName),
    );
    setEmojiDraft(
      currentWorkspaceMember ? memberAvatar(currentWorkspaceMember) : "🙂",
    );
  }, [
    currentWorkspaceMember?.id,
    currentWorkspaceMember?.alias,
    currentWorkspaceMember?.emoji,
    currentWorkspaceMember?.displayName,
    user?.displayName,
  ]);
  const visibleMessages = messages.filter(
    (message) => message.role !== "system",
  );
  const contextualMessages = visibleMessages;
  const currentContextLabel = selectedWorkItem
    ? entityTitle(selectedWorkItem)
    : conversationScopeLabel(impliedConversationScope, projects, tasks);
  const filteredConversations = conversations.filter((conversation) => {
    if (!isStandaloneConversation(conversation)) return false;
    return String(conversation.title || "")
      .toLowerCase()
      .includes(search.toLowerCase());
  });

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

  useEffect(() => {
    if (lens.kind !== "home") return;
    setConversationId((currentId) => {
      if (!currentId) return selectHomeConversation(conversations)?.id || null;
      const current = conversations.find(
        (conversation) => conversation.id === currentId,
      );
      if (!current || isStandaloneConversation(current)) return currentId;
      return selectHomeConversation(conversations)?.id || currentId;
    });
  }, [conversations, lens.kind]);

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
        sourceContext: "home",
        contextEntityId: null,
        conversationType: "general",
        linkedProjectIds: [],
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
          contextEntityId: null,
          sourceContext: "home",
          conversationType: "general",
          linkedProjectIds: [],
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
      navigate("/");
      requestAnimationFrame(() => composerRef.current?.focus());
    } catch {
      setNotice(
        "A new conversation could not be created. Check workspace access and try again.",
      );
    } finally {
      setCreatingConversation(false);
    }
  }, [creatingConversation, navigate, user, workspace]);

  useLayoutEffect(() => {
    if (!createMenuOpen) return;
    const frame = () => {
      const rect = createMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCreateMenuPos({
        top: Math.round(rect.bottom + 6),
        right: Math.round(window.innerWidth - rect.right),
      });
    };
    frame();
    window.addEventListener("resize", frame);
    window.addEventListener("scroll", frame, true);
    return () => {
      window.removeEventListener("resize", frame);
      window.removeEventListener("scroll", frame, true);
    };
  }, [createMenuOpen]);

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (event.key === "Escape") {
        if (commandPaletteOpen) {
          event.preventDefault();
          setCommandPaletteOpen(false);
          return;
        }
        if (createMenuOpen) {
          setCreateMenuOpen(false);
          return;
        }
        if (magicProjectOpen) {
          setMagicProjectOpen(false);
          return;
        }
        if (panel) {
          setPanel(null);
          return;
        }
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [commandPaletteOpen, createMenuOpen, magicProjectOpen, panel, sidebarOpen]);

  useEffect(() => {
    if (!mobileCore) return;
    const fallback = mobileCoreFallbackPath(location.pathname);
    if (fallback && fallback !== location.pathname) {
      navigate(fallback, { replace: true });
    }
  }, [location.pathname, mobileCore, navigate]);

  const ensureConversation = async (title: string) => {
    if (conversationId) return conversationId;
    if (!user || !workspace) throw new Error("Workspace is still loading");
    const projectIds = activeProject ? [activeProject.id] : [];
    const homeThread = !activeProject && lens.kind === "home";
    const ref = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: homeThread
        ? ODISEUS_CONVERSATION_TITLE
        : title.slice(0, 64) || "New conversation",
      status: "active",
      sourceContext: activeProject ? "project" : "home",
      contextEntityId: activeProject?.id || null,
      conversationType: homeThread
        ? "chief_of_staff"
        : conversationScopeType(projectIds, []),
      linkedProjectIds: projectIds,
      linkedTaskIds: [],
      isChiefOfStaff: homeThread,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    return ref.id;
  };

  const openChiefOfStaff = async (href = "/home") => {
    if (!user || !workspace) return;
    const existing = selectHomeConversation(conversations);
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
      navigate(href);
      setSidebarOpen(false);
      return;
    }
    const ref = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: ODISEUS_CONVERSATION_TITLE,
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
    navigate(href);
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

  const sendMessage = async (
    explicit?: string,
    options?: { voiceSession?: boolean; voiceWrapUp?: boolean },
  ) => {
    const text = String(explicit || input).trim();
    const voiceSession = Boolean(options?.voiceSession || voiceSessionRef.current);
    const voiceWrapUp = Boolean(options?.voiceWrapUp);
    if (!text || !user || !workspace) return null;
    if (submitting && !voiceWrapUp) return null;
    if (!voiceWrapUp && isProjectWizardInvocation(text)) {
      setInput("");
      setActionMenuOpen(false);
      setProjectWizardOpen(true);
      return null;
    }
    setInput("");
    setActionMenuOpen(false);
    setSubmitting(true);
    setStreamed("");
    setNotice("");
    setLiveOdysseusSteps([]);
    const localId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: localId, role: "user", content: text, createdAt: Date.now() },
    ]);
    let activeConversationId: string | null = conversationId;
    let outcome: { reply: string; actionPlan: any } | null = null;
    try {
      activeConversationId = await ensureConversation(text);
      const userMessageRef = await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        role: "user",
        content: text,
        inputType: voiceSession ? "voice" : "text",
        contextType: conversationScopeType(
          directContextProjectIds,
          contextTaskIds,
        ),
        contextEntityId: primaryProject?.id || null,
        createdAt: serverTimestamp(),
      });

      const requestContext = buildConversationRequestContext({
        text,
        currentUserMessageId: userMessageRef.id,
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
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        currentMemberId: personalActor.memberId,
        currentUserEmail: personalActor.email,
        odiseusMemory,
        skills: workspaceSkills,
        schedules: odiseusSchedules,
      });
      const nextJudgment = requestContext.judgment;
      setJudgment(nextJudgment);
      const token = await user.getIdToken();
      const result = await sendBoldiChat({
        token,
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        messages: requestContext.messages,
        workspaceContext: {
          ...requestContext.workspaceContext,
          voiceSession,
          voiceWrapUp,
        },
        onStep: (step) => {
          setLiveOdysseusSteps((current) => {
            const without = current.filter((item) => item.id !== step.id);
            return [...without, step];
          });
        },
      });
      const reply =
        result.reply ||
        "I reviewed the workspace, but there is no response to display.";
      const odiseusRun = normalizeOdysseusRun(result.run);
      if (!voiceSession) {
        await streamConversationReply(reply, setStreamed);
      }
      // Run/activity logs must never block the assistant reply. Missing
      // Firestore rules for odiseus_* previously surfaced as a false
      // "insufficient permissions" failure after a successful chat.
      const runId = await persistOdysseusRun({
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        projectId: primaryProject?.id || null,
        request: text,
        status: odiseusRun?.status || "completed",
        steps: odiseusRun?.steps || [],
        toolCount: odiseusRun?.toolCount || 0,
        artifact: odiseusRun?.artifact || null,
        actionPlan: result.actionPlan || null,
        outcome: reply.slice(0, 2_000),
      });
      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        role: "assistant",
        content: reply,
        inputType: voiceSession ? "voice" : "text",
        citations: result.citations || [],
        suggestedChips: result.suggestedChips || [],
        actionPlan: result.actionPlan || null,
        odiseusRun: odiseusRun
          ? { ...odiseusRun, runId: runId || null }
          : null,
        provider: result.provider || null,
        judgment: nextJudgment,
        createdAt: serverTimestamp(),
      });
      await recordOdysseusActivitySafe({
        workspaceId: workspace.id,
        userId: user.uid,
        conversationId: activeConversationId,
        projectId: primaryProject?.id || null,
        runId,
        action: "job_completed",
        agentId: "odysseus",
        agentName: ODISEUS_NAME,
        result: "completed",
        summary:
          odiseusRun?.toolCount
            ? `Completed job using ${odiseusRun.toolCount} Certo tool step(s)`
            : `${ODISEUS_NAME} completed a run`,
        actionCount: Array.isArray(result.actionPlan?.actions)
          ? result.actionPlan.actions.length
          : 0,
        metadata: { stepCount: odiseusRun?.steps?.length || 0 },
      });
      if (activeConversationId) {
        await updateDoc(doc(db, "boldi_conversations", activeConversationId), {
          title: conversationTitleForMessage(
            text,
            contextualMessages.length,
            currentConversation?.title,
          ),
          updatedAt: serverTimestamp(),
        });
      }
      outcome = { reply, actionPlan: result.actionPlan || null };
    } catch (error) {
      const reply = assistantFallbackReply(error);
      if (!voiceSession) {
        await streamConversationReply(reply, setStreamed);
      }
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
      outcome = { reply, actionPlan: null };
    } finally {
      setStreamed("");
      setSubmitting(false);
      setLiveOdysseusSteps([]);
    }
    return outcome;
  };

  const stagePlan = async (message: Message, options?: { silent?: boolean }) => {
    const empty = { staged: 0, remembered: 0, candidates: [] as any[] };
    if (!user || !workspace || !message.actionPlan) return empty;
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
      odiseusRunId: message.odiseusRun?.runId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    let staged = 0;
    let remembered = 0;
    const candidates: any[] = [];
    for (const [index, action] of (plan.proposedActions || []).entries()) {
      const proposedChange = action.proposedChange || {};
      if (String(action.type || "") === "create_odiseus_memory") {
        const safetyLevel = Number(action.safetyLevel ?? plan.safetyLevel ?? 1);
        const text = String(proposedChange.text || "").trim();
        if (safetyLevel <= 1 && text) {
          await addDoc(collection(db, "odiseus_memory"), {
            userId: user.uid,
            workspaceId: workspace.id,
            text: text.slice(0, 2_000),
            kind: proposedChange.kind || "fact",
            tags: Array.isArray(proposedChange.tags)
              ? proposedChange.tags.slice(0, 12)
              : [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          remembered += 1;
          continue;
        }
      }
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
      const idempotencyKey = actionIdempotencyKey(planRef.id, index, {
        type: actionType,
        proposedChange,
      });
      let alreadyStaged = false;
      try {
        const existing = await getDocs(
          query(
            collection(db, "review_candidates"),
            where("userId", "==", user.uid),
            where("idempotencyKey", "==", idempotencyKey),
          ),
        );
        alreadyStaged = !existing.empty;
      } catch {
        alreadyStaged = false;
      }
      if (alreadyStaged) continue;
      const title =
        reviewType === "project"
          ? proposedTitle(proposedChange, actionLabel(actionType))
          : proposedChange?.title || actionLabel(actionType);
      const proposed = {
        ...proposedChange,
        projectId,
        ...(duplicateProject ? { id: duplicateProject.id } : {}),
      };
      const candidateRef = await addDoc(collection(db, "review_candidates"), {
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        title,
        type: reviewType,
        why: action.reason || "Proposed by Odysseus",
        action: actionLabel(actionType),
        confidence: Number(action.confidence || 0.8) >= 0.8 ? "high" : "medium",
        proposed,
        projectId,
        source: duplicateProject
          ? `${plan.summary || "Odysseus"} · Existing project recognized; converted create_project to update_project.`
          : plan.summary || "Odysseus",
        sourceType: "odiseus",
        sourceId: planRef.id,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      candidates.push({
        id: candidateRef.id,
        type: reviewType,
        title,
        proposed,
        projectId,
      });
      staged += 1;
    }
    if (remembered > 0) {
      await recordOdysseusActivitySafe({
        workspaceId: workspace.id,
        userId: user.uid,
        conversationId,
        projectId: primaryProject?.id || null,
        runId: message.odiseusRun?.runId || null,
        action: "memory_saved",
        summary: `Saved ${remembered} memory note(s)`,
      });
    }
    if (staged > 0) {
      await recordOdysseusActivitySafe({
        workspaceId: workspace.id,
        userId: user.uid,
        conversationId,
        projectId: primaryProject?.id || null,
        runId: message.odiseusRun?.runId || null,
        action: "actions_staged",
        agentId: "odysseus",
        agentName: ODISEUS_NAME,
        result: "proposed",
        actionCount: staged,
        summary: `${ODISEUS_NAME} proposed ${staged} action${staged === 1 ? "" : "s"}`,
        approvalRequired: true,
        approvedBy: user.uid,
      });
      if (!options?.silent) {
        setNotice("Pending change ready. Review it before anything changes.");
        setPanel("approvals");
      }
    } else if (remembered > 0 && !options?.silent) {
      setNotice(
        remembered > 1
          ? `${ODISEUS_NAME} remembered ${remembered} things.`
          : `${ODISEUS_NAME} remembered that.`,
      );
    }
    return { staged, remembered, candidates };
  };

  const rejectPlan = async (message: Message) => {
    if (!user || !workspace) return;
    if (message.id && !message.id.startsWith("error-")) {
      await updateDoc(doc(db, "boldi_messages", message.id), {
        actionPlan: message.actionPlan
          ? { ...message.actionPlan, status: "rejected" }
          : null,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
    const rejectedCount = Array.isArray(message.actionPlan?.actions)
      ? message.actionPlan.actions.length
      : 0;
    await recordOdysseusActivitySafe({
      workspaceId: workspace.id,
      userId: user.uid,
      conversationId,
      projectId: primaryProject?.id || null,
      runId: message.odiseusRun?.runId || null,
      action: "actions_rejected",
      agentId: "odysseus",
      agentName: ODISEUS_NAME,
      result: "rejected",
      actionCount: rejectedCount,
      summary:
        rejectedCount > 0
          ? `You rejected ${rejectedCount} action${rejectedCount === 1 ? "" : "s"} proposed by ${ODISEUS_NAME}`
          : `You rejected actions proposed by ${ODISEUS_NAME}`,
      approvalRequired: true,
      approvedBy: user.uid,
    });
    setNotice(`${ODISEUS_NAME} will not apply those actions.`);
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
          content: `**${ODISEUS_HANDOFF_PREFIX}**\n\n${content}`,
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
      } else if (reviewType === "odiseus_memory") {
        const text = String(proposed.text || "").trim();
        if (!text) throw new Error("Memory text is required");
        const created = await addDoc(collection(db, "odiseus_memory"), {
          userId: user.uid,
          workspaceId: workspace.id,
          text: text.slice(0, 2_000),
          kind: proposed.kind || "fact",
          tags: Array.isArray(proposed.tags) ? proposed.tags.slice(0, 12) : [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        convertedToType = "odiseus_memory";
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
            ...buildOwnedAccessPatch({ userId: user.uid, email: user.email }),
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
        const assigned = withCreatorAssignee(proposed, {
          userId: user.uid,
          memberId: accessMemberId(workspace.id, user.uid),
          email: user.email,
        }, workspaceMembers);
        let payload: Record<string, unknown> = {
          ...assigned,
          userId: user.uid,
          workspaceId: workspace.id,
          projectId,
          ...buildTaskAccessPatch({
            task: assigned,
            workspaceId: workspace.id,
            userId: user.uid,
            email: user.email,
            members: workspaceMembers,
          }),
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

  const applyVoicePlans = async (plans: any[]) => {
    if (!user || !workspace) return 0;
    let applied = 0;
    for (const plan of plans) {
      for (const action of plan?.proposedActions || []) {
        const type = String(action.type || "");
        const proposed = action.proposedChange || {};
        const projectId =
          String(proposed.projectId || primaryProject?.id || "").trim() || null;
        if (type === "create_task") {
          const assigned = withCreatorAssignee(proposed, {
            userId: user.uid,
            memberId: accessMemberId(workspace.id, user.uid),
            email: user.email,
          }, workspaceMembers);
          await addDoc(collection(db, "tasks"), {
            userId: user.uid,
            workspaceId: workspace.id,
            ...(projectId ? { projectId } : {}),
            ...buildTaskAccessPatch({
              task: assigned,
              workspaceId: workspace.id,
              userId: user.uid,
              email: user.email,
              members: workspaceMembers,
            }),
            title: String(assigned.title || assigned.name || "Untitled").trim() || "Untitled",
            description: String(assigned.description || "").slice(0, 4000),
            status: String(assigned.status || "open"),
            priority: assigned.priority ?? null,
            dueDate: assigned.dueDate || null,
            timeSector: assigned.timeSector || "today",
            assigneeIds: assigned.assigneeIds,
            assignees: assigned.assignees,
            owner: assigned.owner,
            assignee: assigned.assignee,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          applied += 1;
          continue;
        }
        if (type === "update_task" || type === "reschedule_task") {
          const targetId = String(proposed.taskId || proposed.id || "").trim();
          if (!targetId) continue;
          const patch = Object.fromEntries(
            ["title", "description", "status", "priority", "dueDate", "timeSector", "projectId"]
              .filter((field) => proposed[field] !== undefined)
              .map((field) => [field, proposed[field]]),
          );
          await updateDoc(doc(db, "tasks", targetId), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
          applied += 1;
          continue;
        }
        const staged = await stagePlan(
          {
            id: "",
            role: "assistant",
            content: "",
            actionPlan: { ...plan, proposedActions: [action] },
          },
          { silent: true },
        );
        for (const candidate of staged.candidates) {
          await processReview(candidate, "approve");
          if (candidate.id) applied += 1;
        }
      }
    }
    setNotice(
      applied > 0
        ? `${ODISEUS_NAME} added ${applied} task${applied === 1 ? "" : "s"} from the call.`
        : "Nothing was applied.",
    );
    return applied;
  };

  const startVoiceCall = () => {
    voiceSessionRef.current = true;
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* dictation mic may already be idle */
    }
    setIsListening(false);
    void openChiefOfStaff("/home");
    setVoiceCallOpen(true);
  };

  const closeVoiceCall = () => {
    voiceSessionRef.current = false;
    setVoiceCallOpen(false);
  };

  const enableAppleWidget = async () => {
    if (!user || !workspace) return;
    setWidgetBusy(true);
    setWidgetError("");
    try {
      const token = createAppleWidgetToken();
      const snapshot = buildAppleWidgetSnapshot({
        tasks: personalTodayTasks,
        projects,
        pendingApprovals: reviewItems.length,
        workspaceName: workspace.name || "Certo Work",
      });
      await setDoc(doc(db, APPLE_WIDGET_COLLECTION, token), {
        token,
        userId: user.uid,
        workspaceId: workspace.id,
        workspaceName: workspace.name || "Certo Work",
        snapshot,
        revoked: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setWidgetToken(token);
    } catch (reason) {
      setWidgetError(
        reason instanceof Error ? reason.message : "The Apple widget could not be created.",
      );
    } finally {
      setWidgetBusy(false);
    }
  };

  const revokeAppleWidget = async () => {
    if (!widgetToken) return;
    setWidgetBusy(true);
    setWidgetError("");
    try {
      await updateDoc(doc(db, APPLE_WIDGET_COLLECTION, widgetToken), {
        revoked: true,
        updatedAt: serverTimestamp(),
      });
      setWidgetToken("");
    } catch (reason) {
      setWidgetError(
        reason instanceof Error ? reason.message : "The Apple widget could not be revoked.",
      );
    } finally {
      setWidgetBusy(false);
    }
  };

  const setComposer = (value: string) => {
    setInput(value);
    setPanel(null);
    setActionMenuOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const selectProjectContext = (project: any) => {
    if (!project?.id) return;
    const projectConversation = conversations.find(
      (conversation) =>
        conversationProjectIds(conversation).length === 1 &&
        conversationTaskIds(conversation).length === 0 &&
        conversationIncludesProject(conversation, project.id),
    );
    setConversationId(projectConversation?.id || null);
    setProjectConsoleId(project.id);
    setSidebarOpen(false);
    navigate(`/work/projects/${project.id}`);
  };

  const openProjectRecord = (project: any) => {
    selectProjectContext(project);
  };

  const updateProject = async (
    projectId: string,
    patch: Record<string, unknown>,
  ) => {
    try {
      const current = projects.find((item) => item.id === projectId) || {};
      const next = { ...current, ...patch };
      await updateDoc(doc(db, "projects", projectId), {
        ...patch,
        ...buildProjectCollaboratorAccessPatch({
          project: next,
          members: workspaceMembers,
          actorUserId: user?.uid || String(next.userId || ""),
          actorEmail: user?.email || "",
        }),
        updatedAt: serverTimestamp(),
      });
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? `Project update was not saved: ${reason.message}`
          : "Project update was not saved. Check access and try again.",
      );
      throw reason;
    }
  };

  const syncInvoiceToProject = async (invoice: InvoiceDocument) => {
    if (!invoice.projectId || !invoice.entryId) return;
    const project = projects.find((item) => item.id === invoice.projectId);
    if (!project) return;
    await updateProject(invoice.projectId, {
      financePeriods: stripUndefinedValues(
        applyInvoiceToFinancePeriods(project, invoice),
      ),
    });
  };

  const pushPendingInvoice = async (line: PendingInvoiceLine) => {
    if (!user || !workspace) return;
    setInvoiceBusyId(`${line.projectId}:${line.entryId}`);
    try {
      const token = createShareToken();
      const invoiceNumber =
        line.invoiceNumber ||
        nextInvoiceNumber(invoiceDocuments.map((item) => String(item.invoiceNumber || "")));
      const payload = {
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        shareToken: token,
        projectId: line.projectId,
        periodId: line.periodId,
        entryId: line.entryId,
        title: line.title,
        description: `${line.projectTitle} · ${line.periodLabel}`,
        clientName: line.clientName,
        invoiceNumber,
        amount: line.amount,
        currency: line.currency || "USD",
        issueDate: line.issueDate || new Date().toISOString().slice(0, 10),
        dueDate: line.dueDate,
        status: "billed" as InvoiceStatus,
        paymentStatus: "unpaid" as const,
        revoked: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "invoice_documents", token), payload);
      await syncInvoiceToProject({
        id: token,
        ...payload,
        status: "billed",
      });
      setNotice(`Pushed ${invoiceNumber} to the AP queue. Send it to the client when ready.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not push this invoice.");
    } finally {
      setInvoiceBusyId("");
    }
  };

  const updateInvoiceStatus = async (
    invoice: InvoiceDocument,
    patch: {
      status: InvoiceStatus;
      settledAmount?: number;
      settledDate?: string;
      remittanceRef?: string;
      exceptionCode?: string;
      exceptionNote?: string;
      rejectionReason?: string;
      adminNote?: string;
    },
  ) => {
    if (!canTransitionInvoice(invoice.status, patch.status, "finance")) {
      setNotice("That status change is not allowed from this step.");
      return;
    }
    setInvoiceBusyId(invoice.id);
    try {
      const overdue = isInvoiceOverdue({ ...invoice, status: patch.status });
      const next: InvoiceDocument = {
        ...invoice,
        status: patch.status,
        paymentStatus: paymentStatusForInvoice(
          patch.status,
          Number(patch.settledAmount || invoice.settledAmount || 0),
          Number(invoice.amount || 0),
          overdue,
        ),
        settledAmount: patch.settledAmount,
        settledDate: patch.settledDate,
        remittanceRef: patch.remittanceRef,
        exceptionCode: patch.exceptionCode,
        exceptionNote: patch.exceptionNote,
        rejectionReason: patch.rejectionReason,
        adminNote: patch.adminNote,
      };
      await updateDoc(doc(db, "invoice_documents", invoice.id), {
        shareToken: invoice.shareToken || invoice.id,
        status: next.status,
        paymentStatus: next.paymentStatus,
        settledAmount: Number(next.settledAmount || 0),
        settledDate: next.settledDate || "",
        remittanceRef: next.remittanceRef || "",
        exceptionCode: next.exceptionCode || "",
        exceptionNote: next.exceptionNote || "",
        rejectionReason: next.rejectionReason || "",
        adminNote: next.adminNote || "",
        updatedAt: serverTimestamp(),
      });
      await syncInvoiceToProject(next);
      setNotice(`${next.invoiceNumber || "Invoice"} is now ${String(patch.status).replace(/_/g, " ")}.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update this invoice.");
    } finally {
      setInvoiceBusyId("");
    }
  };

  const toggleMemberFinanceAccess = async (member: {
    id?: string;
    financeAccess?: boolean;
  }) => {
    if (!member.id || !canManageMembers) return;
    await updateDoc(doc(db, "workspace_members", member.id), {
      financeAccess: !member.financeAccess,
      updatedAt: serverTimestamp(),
    });
  };

  const { createControlledOption, renameControlledOption } =
    useControlledListsActions({
      user,
      workspace,
      categories,
      projects,
      tasks,
      setCategories,
      setProjects,
      setTasks,
      setNotice,
    });

  const { deleteControlledOption } = useControlledListDeletion({
    user,
    workspace,
    categories,
    projects,
    tasks,
    setCategories,
    setProjects,
    setTasks,
    setNotice,
  });

  const {
    createCostTemplate,
    updateCostTemplate,
    createProjectTemplate,
    deleteProjectTemplate,
    applyProjectTemplate,
  } = useProjectTemplates({
    user,
    workspace,
    projects,
    tasks,
    workspaceMembers,
    setNotice,
    memberLabel,
    setConversationId,
    setMessages,
    setProjectConsoleId,
    setPanel,
    goCenterView,
    navigate,
  });

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
      color: "var(--accent)",
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
        ...membershipPublicPatch({ displayName: user.displayName }),
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
    if (!canManageMembers) {
      setNotice("Only the workspace owner or an admin can invite people.");
      return;
    }
    const email = normalizeInviteEmail(inviteEmail);
    if (!email || !email.includes("@")) {
      setNotice("Add a valid email to invite someone.");
      return;
    }
    try {
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
    const pendingId = pendingMemberId(workspace.id, email);
    await setDoc(
      doc(db, "workspace_members", pendingId),
      {
        id: pendingId,
        workspaceId: workspace.id,
        userId: `pending:${email}`,
        email,
        emailLower: email,
        ...membershipPublicPatch({}),
        role: inviteRole,
        status: "invited",
        invitedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    const inviteToken = createInviteCode();
    const inviteRef = await addDoc(collection(db, "agent_invites"), {
      userId: user.uid,
      workspaceId: workspace.id,
      email,
      emailLower: email,
      role: inviteRole,
      inviteType: "workspace_member",
      inviteToken,
      status: "pending",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const result = await deliverWorkspaceInvite({
      email,
      role: inviteRole,
      inviteToken,
      inviteId: inviteRef.id,
    });
    setInviteEmail("");
    await reloadWorkspaces();
    setNotice(
      result.sent
        ? `Invite sent to ${email}. They should sign in with that exact email.`
        : `Invite saved for ${email}, but no email was sent yet: ${result.warning} Copy the link from Pending invites if you need to send it manually.`,
    );
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? `Invite could not be saved: ${reason.message}`
          : "Invite could not be saved. Check workspace access and try again.",
      );
    }
  };

  const copyInviteMessage = async (invite: any) => {
    const message = inviteMessage(invite);
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Invite message copied.");
    } catch {
      setNotice(message);
    }
  };

  const copyInviteLink = async (invite: any) => {
    const url = inviteDirectoryUrl(invite?.inviteToken);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Invite link copied.");
    } catch {
      setNotice(url);
    }
  };

  const deliverWorkspaceInvite = async ({
    email,
    role,
    inviteToken,
    inviteId,
  }: {
    email: string;
    role: string;
    inviteToken: string;
    inviteId: string;
  }) => {
    if (!user || !workspace) {
      return { sent: false, warning: "Sign in to send the invite email." };
    }
    try {
      const token = await user.getIdToken();
      const result = await sendWorkspaceInviteEmail({
        token,
        userId: user.uid,
        workspaceId: workspace.id,
        workspaceName: workspace.name || "Certo Work",
        toEmail: email,
        role,
        inviterName: user.displayName,
        inviterEmail: user.email,
        inviteToken,
      });
      const sent = Boolean(result.sent);
      const warning = sent ? "" : result.error || "Brevo is not configured yet.";
      await updateDoc(doc(db, "agent_invites", inviteId), {
        emailDeliveryStatus: sent ? "sent" : "not_sent",
        emailDeliveryError: sent ? "" : warning,
        emailSentAt: sent ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
      return { sent, warning };
    } catch (error) {
      const warning =
        error instanceof Error ? error.message : "Invite email could not be sent.";
      await updateDoc(doc(db, "agent_invites", inviteId), {
        emailDeliveryStatus: "failed",
        emailDeliveryError: warning,
        updatedAt: serverTimestamp(),
      });
      return { sent: false, warning };
    }
  };

  const resendWorkspaceInvite = async (row: {
    email: string;
    role?: string;
    invite?: Record<string, any> | null;
    member?: WorkspaceMember | null;
  }) => {
    if (!user || !workspace) return;
    if (!canManageMembers) {
      setNotice("Only the workspace owner or an admin can resend invites.");
      return;
    }
    const email = normalizeInviteEmail(row.email);
    const role = String(row.role || row.invite?.role || row.member?.role || "member");
    try {
      let inviteId = String(row.invite?.id || "");
      let inviteToken = String(row.invite?.inviteToken || "");
      if (!inviteId || inviteIsExpired(row.invite) || !inviteToken) {
        inviteToken = createInviteCode();
        if (inviteId) {
          await updateDoc(doc(db, "agent_invites", inviteId), {
            inviteToken,
            status: "pending",
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            updatedAt: serverTimestamp(),
          });
        } else {
          const inviteRef = await addDoc(collection(db, "agent_invites"), {
            userId: user.uid,
            workspaceId: workspace.id,
            email,
            emailLower: email,
            role,
            inviteType: "workspace_member",
            inviteToken,
            status: "pending",
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          inviteId = inviteRef.id;
        }
      }
      const result = await deliverWorkspaceInvite({
        email,
        role,
        inviteToken,
        inviteId,
      });
      setNotice(
        result.sent
          ? `Invite resent to ${email}.`
          : `Invite saved for ${email}, but no email was sent yet: ${result.warning}`,
      );
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? `Invite could not be resent: ${reason.message}`
          : "Invite could not be resent.",
      );
    }
  };

  const requestPasswordReset = async () => {
    if (!user?.email) {
      setNotice("No email is available for this signed-in account.");
      return;
    }
    try {
      await sendPasswordReset();
      setNotice(`Password reset email sent to ${user.email}.`);
    } catch {
      setNotice(
        "Password reset could not be sent. If you sign in with Google, change the password in your Google Account settings.",
      );
    }
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

  const saveAliasProfile = async () => {
    if (!user || !workspace) return;
    const alias = normalizeAlias(aliasDraft);
    if (!alias) {
      setNotice("Choose a public alias. Emails stay private and are never shown.");
      return;
    }
    const emoji = normalizeMemberEmoji(emojiDraft);
    const memberId =
      currentWorkspaceMember?.id || activeMemberId(workspace.id, user.uid);
    await setDoc(
      doc(db, "workspace_members", memberId),
      {
        id: memberId,
        workspaceId: workspace.id,
        userId: user.uid,
        email: user.email || "",
        emailLower: (user.email || "").toLowerCase(),
        alias,
        emoji,
        displayName: alias,
        status: currentWorkspaceMember?.status || "active",
        role:
          currentWorkspaceMember?.role ||
          (workspace.ownerId === user.uid ? "owner" : "member"),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    try {
      await updateProfile(user, { displayName: alias });
    } catch {
      // Alias is stored on the workspace member even if Auth profile update fails.
    }
    setNotice("Alias saved. Teammates will only see this name and icon.");
  };

  const removeWorkspaceMember = async (member: WorkspaceMember) => {
    if (!workspace || !user) return;
    if (!canManageMembers) {
      setNotice("Only the workspace owner or an admin can remove people.");
      return;
    }
    if (member.userId === user.uid || isWorkspaceOwnerRole(member.role) || member.userId === workspace.ownerId) {
      setNotice("The workspace owner cannot be removed.");
      return;
    }
    const label = memberLabel(member);
    const confirmed = window.confirm(`Remove ${label} from this workspace?`);
    if (!confirmed) return;
    const email = normalizeInviteEmail(member.email || member.emailLower || "");
    await updateDoc(doc(db, "workspace_members", member.id), {
      status: "removed",
      removedBy: user.uid,
      removedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (email) {
      const roles = { ...(workspace.roles || {}) };
      delete roles[email];
      await updateDoc(doc(db, "workspaces", workspace.id), {
        members: (workspace.members || []).filter(
          (item) => String(item).toLowerCase() !== email,
        ),
        roles,
        updatedAt: serverTimestamp(),
      });
      const matchingInvites = workspaceInvites.filter(
        (invite) =>
          normalizeInviteEmail(invite.email || invite.emailLower || "") === email,
      );
      for (const invite of matchingInvites) {
        await updateDoc(doc(db, "agent_invites", invite.id), {
          status: "revoked",
          revokedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
      await reloadWorkspaces();
    }
    setNotice(`${label} removed from the workspace.`);
  };

  const revokeWorkspaceInvite = async (invite: any) => {
    if (!workspace || !user || !canManageMembers) return;
    await updateDoc(doc(db, "agent_invites", invite.id), {
      status: "revoked",
      revokedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    const email = normalizeInviteEmail(invite.email || invite.emailLower || "");
    const pending = workspaceMembers.find(
      (member) =>
        pendingMemberId(workspace.id, member.email || member.emailLower || "") ===
          pendingMemberId(workspace.id, email) ||
        (normalizeInviteEmail(member.email || member.emailLower || "") === email &&
          String(member.status || "") === "invited"),
    );
    if (pending) {
      await updateDoc(doc(db, "workspace_members", pending.id), {
        status: "removed",
        removedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    }
    if (email) {
      const roles = { ...(workspace.roles || {}) };
      delete roles[email];
      await updateDoc(doc(db, "workspaces", workspace.id), {
        members: (workspace.members || []).filter(
          (item) => String(item).toLowerCase() !== email,
        ),
        roles,
        updatedAt: serverTimestamp(),
      });
      await reloadWorkspaces();
    }
    setNotice("Invite revoked.");
  };

  const approveAccessRequest = async (
    request: AccessRequest,
    role: "admin" | "member" | "viewer" = "member",
  ) => {
    if (!user || !workspace) return;
    const email = normalizeInviteEmail(request.email || request.emailLower || "");
    const requestUserId = request.userId || request.id;
    if (!email || !requestUserId) {
      setNotice("This access request is missing an email or user id.");
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
      roles: { ...(workspace.roles || {}), [email]: role },
      updatedAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, "workspace_members", activeMemberId(workspace.id, requestUserId)),
      {
        id: activeMemberId(workspace.id, requestUserId),
        workspaceId: workspace.id,
        userId: requestUserId,
        email,
        emailLower: email,
        ...membershipPublicPatch({ displayName: request.displayName }),
        role,
        status: "active",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await updateDoc(doc(db, "access_requests", request.id), {
      status: "approved",
      approvedBy: user.uid,
      approvedWorkspaceId: workspace.id,
      approvedRole: role,
      updatedAt: serverTimestamp(),
    });
    await reloadWorkspaces();
    setNotice(`${normalizeAlias(request.displayName) || "Teammate"} approved for ${workspace.name || "this workspace"}.`);
  };

  const rejectAccessRequest = async (request: AccessRequest) => {
    if (!user) return;
    await updateDoc(doc(db, "access_requests", request.id), {
      status: "rejected",
      rejectedBy: user.uid,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice(`${request.email || request.emailLower || "Request"} rejected.`);
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
    const memberId = accessMemberId(workspace?.id || "", user?.uid || "");
    if (!canDeleteProject(project, user, workspace, memberId)) {
      setNotice("Only the Project Manager or workspace owner can delete this project.");
      return;
    }
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
    const requestedKey = String(patch.key || "").trim().toUpperCase();
    const key = isModernWorkItemKey(requestedKey)
      ? requestedKey
      : nextWorkItemKey(tasks.map((item) => item.key || item.workItemKey));
    const canonicalType = String(
      patch.workItemType || patch.type || patch.itemType || "task",
    ).toLowerCase();
    const actor = {
      userId: user.uid,
      memberId: accessMemberId(workspace.id, user.uid),
      email: user.email,
    };
    const assigned = withCreatorAssignee(patch, actor, workspaceMembers);
    const created = await addDoc(collection(db, "tasks"), {
      ...assigned,
      userId: user.uid,
      workspaceId: workspace.id,
      projectId,
      ...buildTaskAccessPatch({
        task: assigned,
        workspaceId: workspace.id,
        userId: user.uid,
        email: user.email,
        members: workspaceMembers,
      }),
      title,
      normalizedTitle: title.trim().toLowerCase().replace(/\s+/g, " "),
      key,
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
    return created.id;
  };

  const submitFeedbackReport = async (input: {
    kind: FeedbackKind;
    title: string;
    description: string;
    projectId: string;
    severity: FeedbackSeverity | "";
  }) => {
    if (!user || !workspace) return;
    try {
      await addDoc(collection(db, "feedback_reports"), {
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        kind: input.kind,
        title: input.title,
        description: input.description,
        status: "submitted",
        projectId: input.projectId || "",
        severity: input.kind === "bug" ? input.severity || "medium" : "",
        reporterAlias: memberPublicLabel(currentWorkspaceMember || {}),
        reporterEmoji: memberAvatar(currentWorkspaceMember || {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNotice(
        input.kind === "bug"
          ? "Bug submitted. Admins can convert it to a PBI from the feedback queue."
          : "Feature request submitted. Admins can convert it to a PBI from the feedback queue.",
      );
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "Could not submit feedback.",
      );
    }
  };

  const updateFeedbackStatus = async (
    report: FeedbackReport,
    status: FeedbackStatus,
    adminNote?: string,
  ) => {
    if (!workspace) return;
    try {
      await updateDoc(doc(db, "feedback_reports", report.id), {
        status,
        updatedAt: serverTimestamp(),
        ...(status === "triaged" ? { triagedAt: serverTimestamp() } : {}),
        ...(adminNote ? { adminNote } : {}),
      });
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "Could not update this report.",
      );
    }
  };

  const convertFeedbackToPbi = async (report: FeedbackReport, projectId: string) => {
    try {
      const taskId = await addProjectTask(
        projectId,
        report.title || "Untitled feedback",
        "backlog",
        {
          ...feedbackToTaskPatch(report),
          projectId: projectId || null,
        },
      );
      if (!taskId) {
        setNotice("Could not convert this report into a work item.");
        return;
      }
      await updateDoc(doc(db, "feedback_reports", report.id), {
        status: "converted",
        projectId: projectId || "",
        convertedToType: "tasks",
        convertedToId: taskId,
        convertedBy: user?.uid || "",
        convertedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNotice("Converted to a backlog PBI.");
      if (projectId) navigate(`/work/projects/${projectId}/tasks`);
      else navigate("/my-work");
      setSelectedWorkItemId(taskId);
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "Could not convert this report.",
      );
    }
  };

  const updateProjectTask = async (
    taskId: string,
    patch: Record<string, unknown>,
  ) => {
    const current = tasks.find((item) => item.id === taskId) || {};
    const next = { ...current, ...patch };
    await updateDoc(doc(db, "tasks", taskId), {
      ...patch,
      ...buildTaskAccessPatch({
        task: next,
        workspaceId: workspace?.id || String(next.workspaceId || ""),
        userId: user?.uid || String(next.userId || ""),
        email: user?.email || "",
        members: workspaceMembers,
      }),
      updatedAt: serverTimestamp(),
    });
  };

  const createSprint = async (patch: Record<string, unknown>) => {
    if (!user || !workspace) return;
    await addDoc(collection(db, "sprints"), {
      ...patch,
      userId: user.uid,
      workspaceId: workspace.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice("Sprint saved.");
  };

  const updateSprint = async (sprintId: string, patch: Record<string, unknown>) => {
    await updateDoc(doc(db, "sprints", sprintId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const addProjectDocument = async (projectId: string, payload: Record<string, unknown>) => {
    if (!user || !workspace) return;
    let url = String(payload.url || "");
    const file = payload.file as File | undefined;
    if (file) {
      if (!isAllowedProjectResourceSize(file.size)) {
        setNotice("Files must be 20 MB or smaller.");
        return;
      }
      const path = `project-docs/${workspace.id}/${projectId}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      url = await getDownloadURL(fileRef);
    }
    await addDoc(collection(db, "knowledge_items"), {
      userId: user.uid,
      workspaceId: workspace.id,
      projectId,
      title: payload.title || file?.name || "Untitled",
      resourceType: payload.resourceType || "note",
      url,
      content: payload.body || "",
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice("Document saved.");
  };

  const connectProjectDrive = async () => {
    try {
      await connectGoogleDrive();
      const folders = await listDriveFolders();
      setDriveFolders(folders);
      setDriveMessage("Google Drive connected. Choose a root folder, or create a project folder under Drive root.");
      setNotice("Google Drive connected.");
    } catch (reason) {
      setDriveMessage(reason instanceof Error ? reason.message : "Google Drive could not be connected.");
      setNotice(reason instanceof Error ? reason.message : "Google Drive could not be connected.");
    }
  };

  const selectDriveRoot = async (folderId: string, folderName: string) => {
    if (!user || !workspace) return;
    setDriveRoot({ id: folderId, name: folderName });
    await addDoc(collection(db, "integration_configs"), {
      userId: user.uid,
      workspaceId: workspace.id,
      provider: "google_drive",
      rootFolderId: folderId,
      rootFolderName: folderName,
      autoCreateExternalFolder: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setDriveMessage(`Root folder saved: ${folderName}`);
  };

  const createProjectDriveFolder = async (project: any) => {
    try {
      if (!storedDriveAccessToken()) await connectGoogleDrive();
      const folder = await createDriveFolder(String(project.title || project.name || "Project"), driveRoot?.id || null);
      await updateProject(project.id, {
        externalFolderId: folder.id,
        externalFolderName: folder.name,
        externalFolderProvider: "google_drive",
        autoCreateExternalFolder: false,
      });
      setDriveMessage(`Created Drive folder ${folder.name}`);
      setNotice(`Project folder created in Google Drive.`);
    } catch (reason) {
      setDriveMessage(reason instanceof Error ? reason.message : "The Drive folder could not be created.");
      setNotice(reason instanceof Error ? reason.message : "The Drive folder could not be created.");
    }
  };

  const createProjectFromWizard = async (draft: ProjectWizardDraft) => {
    if (!user || !workspace) return;
    const successCriteria = splitProjectWizardLines(draft.successCriteriaText);
    const targetDate = draft.noTargetDate ? "" : draft.targetDate;
    const projectRef = await addDoc(collection(db, "projects"), {
      userId: user.uid,
      workspaceId: workspace.id,
      ...buildOwnedAccessPatch({ userId: user.uid, email: user.email }),
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
      defaultProjectWizardFirstAction(draft).slice(0, 500),
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
    if (draft.firstAction.trim()) {
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
    }
    setProjectConsoleId(projectId);
    setPanel("project");
    goCenterView("conversation");
    navigate(`/work/projects/${projectId}`);
    setNotice(`${draft.title.trim()} updated with Project Wizard.`);
  };

  const createMagicProjectItems = async (
    projectId: string,
    items: MagicProjectItem[],
    parentId: string,
    parentKind: string | null,
  ) => {
    for (const item of items) {
      if (!item.title) continue;
      const createdId = await addProjectTask(projectId, item.title, "backlog", {
        workItemType: item.kind,
        itemType: item.kind,
        type: item.kind,
        parentId: parentId || null,
        epicId: parentKind === "epic" ? parentId : null,
        featureId: parentKind === "feature" ? parentId : null,
        dueDate: item.dueDate || null,
        source: "magic_project",
      });
      if (item.children?.length && createdId) {
        await createMagicProjectItems(projectId, item.children, createdId, item.kind);
      }
    }
  };

  const createMagicProject = async (blueprint: MagicProjectBlueprint) => {
    if (!user || !workspace) return;
    const successCriteria = blueprint.successCriteria.filter(Boolean);
    const targetDate = blueprint.noTargetDate ? "" : blueprint.targetDate;
    const projectRef = await addDoc(collection(db, "projects"), {
      userId: user.uid,
      workspaceId: workspace.id,
      ...buildOwnedAccessPatch({ userId: user.uid, email: user.email }),
      title: blueprint.title.trim(),
      normalizedTitle: blueprint.title.trim().toLowerCase().replace(/\s+/g, " "),
      description: blueprint.why.trim(),
      outcome: blueprint.outcome.trim(),
      objective: blueprint.outcome.trim(),
      status: "planning",
      health: "on_track",
      methodology: blueprint.methodology,
      projectManager: blueprint.owner.trim(),
      targetDate,
      dueDate: targetDate,
      successCriteria,
      definitionOfDone: blueprint.definitionOfDone.trim(),
      createdFromSkill: "magic_project",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const milestone of blueprint.milestones) {
      await addProjectMilestone(projectRef.id, milestone.title);
    }
    for (const phase of blueprint.phases) {
      await addProjectTask(projectRef.id, phase.title, "backlog", {
        workItemType: "epic",
        itemType: "epic",
        type: "epic",
        description: phase.description || "",
        dueDate: phase.targetDate || null,
        source: "magic_project",
      });
    }
    await createMagicProjectItems(projectRef.id, blueprint.items, "", null);
    await addProjectTask(projectRef.id, blueprint.kickoff.title, "backlog", {
      workItemType: "pbi",
      itemType: "pbi",
      type: "pbi",
      description: blueprint.kickoff.description || "Align on outcome, owners, and first next actions.",
      dueDate: blueprint.kickoff.date || targetDate || null,
      source: "magic_project",
      gtdActionType: "next_action",
    });
    const meetings = blueprint.meetings.length
      ? blueprint.meetings
      : [{
          title: `${blueprint.kickoff.title} meeting`,
          date: blueprint.kickoff.date || targetDate,
          description: blueprint.kickoff.description || "",
        }];
    for (const meeting of meetings) {
      await addProjectTask(projectRef.id, meeting.title, "backlog", {
        workItemType: "task",
        itemType: "meeting",
        type: "meeting",
        description: meeting.description || "",
        dueDate: meeting.date || null,
        source: "magic_project",
      });
    }

    const notebookRef = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "notebook",
      title: blueprint.title.trim(),
      projectId: projectRef.id,
      status: "active",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const sectionRef = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "section",
      title: "Definition",
      notebookId: notebookRef.id,
      projectId: projectRef.id,
      status: "active",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "note",
      title: blueprint.noteTitle,
      content: blueprint.noteContent || blueprint.sourceText,
      notebookId: notebookRef.id,
      sectionId: sectionRef.id,
      projectId: projectRef.id,
      tags: ["project-definition", "magic-project"],
      status: "active",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const conversationRef = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: blueprint.title.trim(),
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
    setConversationId(conversationRef.id);
    setMessages([]);
    setProjectConsoleId(projectRef.id);
    setPanel("project");
    goCenterView("conversation");
    navigate(`/work/projects/${projectRef.id}`);
    setNotice(`${blueprint.title.trim()} created with Magic Project. Definition note, kickoff, and meetings are in place.`);
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
        "What's blocking us?",
        "Summarize progress this week",
        "Find overdue work",
        "Prepare a status report",
        "Recommend next actions",
      ]
    : [
        "Review projects at risk",
        "Prepare my weekly portfolio report",
        "Find overdue work and follow up",
        "Which projects need attention today?",
        "Create follow-ups for the biggest blockers",
      ];

  const commandPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [
      {
        id: "nav-home",
        label: "Go to Home",
        group: "Navigate",
        onSelect: () => navigate("/home"),
      },
      {
        id: "nav-my-work",
        label: "Go to My Work",
        group: "Navigate",
        onSelect: () => navigate("/my-work"),
      },
      {
        id: "nav-projects",
        label: "Go to Projects",
        group: "Navigate",
        keywords: "work portfolio command center",
        onSelect: () => navigate("/projects"),
      },
      {
        id: "nav-agents",
        label: "Go to Agents",
        group: "Navigate",
        keywords: "odysseus ai automations",
        onSelect: () => navigate("/agents"),
      },
      {
        id: "nav-approvals",
        label: "Go to Approvals",
        group: "Navigate",
        onSelect: () => navigate("/approvals"),
      },
      {
        id: "nav-invoices",
        label: "Open invoices",
        group: "Navigate",
        keywords: "finance billing ap ariba paid invoice portal",
        onSelect: () => navigate("/invoices"),
      },
      {
        id: "nav-feedback",
        label: "Report a bug or feature",
        group: "Navigate",
        keywords: "feedback bug feature pbi request",
        onSelect: () => navigate("/feedback"),
      },
      {
        id: "nav-workspace",
        label: "Workspace & team",
        group: "Navigate",
        onSelect: () => navigate("/workspace"),
      },
      {
        id: "nav-collab",
        label: "Open Chat Collab",
        group: "Navigate",
        keywords: "chat slack teams chatwoot messages",
        onSelect: () => navigate("/collab"),
      },
      ...activeProjects.slice(0, 12).map((project) => ({
        id: `nav-collab-room-${project.id}`,
        label: `Open room · ${entityTitle(project)}`,
        group: "Navigate",
        keywords: "chat collab room chatwoot",
        onSelect: () => navigate(collabProjectPath(String(project.id))),
      })),
      {
        id: "nav-settings",
        label: "Go to Settings",
        group: "Navigate",
        onSelect: () => navigate("/settings"),
      },
      {
        id: "odiseus",
        label: "Open Odysseus",
        group: "Actions",
        keywords: "ai employee hire agent",
        onSelect: () => {
          void openChiefOfStaff("/agents");
        },
      },
      {
        id: "talk-odysseus",
        label: "Talk with Odysseus",
        group: "Actions",
        keywords: "voice call speak microphone conversation",
        onSelect: startVoiceCall,
      },
      {
        id: "quick-capture",
        label: "Quick Capture",
        group: "Create",
        onSelect: () => {
          setComposer("Capture this: ");
          navigate("/home");
        },
      },
      {
        id: "new-conversation",
        label: "New conversation",
        group: "Create",
        onSelect: () => void createConversation(),
      },
      {
        id: "new-project",
        label: "Create project",
        group: "Create",
        onSelect: () => setProjectWizardOpen(true),
      },
      {
        id: "report-bug",
        label: "Report a bug",
        group: "Create",
        onSelect: () => navigate("/report-bug"),
      },
      {
        id: "request-feature",
        label: "Request a feature",
        group: "Create",
        onSelect: () => navigate("/feature-request"),
      },
      {
        id: "feedback-queue",
        label: "Open feedback queue",
        group: "Navigate",
        keywords: "admin triage pbi bug feature",
        onSelect: () => navigate("/workspace/feedback"),
      },
    ];
    for (const project of activeProjects.slice(0, 30)) {
      items.push({
        id: `project-${project.id}`,
        label: entityTitle(project),
        group: "Projects",
        onSelect: () => openProjectRecord(project),
      });
    }
    if (!mobileCore) return items;
    const mobileIds = new Set([
      "nav-home",
      "nav-my-work",
      "nav-projects",
      "nav-collab",
      "quick-capture",
      "new-conversation",
      "new-project",
      "talk-odysseus",
    ]);
    return items.filter(
      (item) =>
        mobileIds.has(item.id) ||
        item.id.startsWith("project-") ||
        item.id.startsWith("nav-collab-room-"),
    );
  }, [
    activeProjects,
    createConversation,
    mobileCore,
    navigate,
    openChiefOfStaff,
    openProjectRecord,
    startVoiceCall,
  ]);

  const workPane = (
    <div className={`do-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""} ${mobileCore ? "is-mobile-core" : ""} do-page-${lens.kind === "more" || lens.kind === "agents" ? "settings" : lens.kind === "project" || lens.kind === "my-work" || lens.kind === "invoices" || lens.kind === "feedback" || lens.kind === "notes" ? "work" : lens.kind === "work" ? "work" : lens.kind}`}>
      <CommandPalette
        items={commandPaletteItems}
        onClose={() => setCommandPaletteOpen(false)}
        open={commandPaletteOpen}
      />
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
        <ProductSwitcher product="work" />
        <div className="do-brand-row">
          <button
            className="do-brand"
            onClick={() => {
              setWorkspaceOpen((open) => !open);
            }}
            type="button"
            aria-label="Workspace switcher"
            title="Workspace switcher"
          >
            <span className="do-logo">
              <CertoMark size={18} />
            </span>
            <span className="do-brand-copy">
              <strong>{workspace?.name || "Certo Work"}</strong>
              <small>Certo Work</small>
            </span>
            <ChevronDown className="do-brand-chevron" size={13} />
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
          className="do-sidebar-search"
          data-testid="sidebar-search"
          onClick={() => {
            setCommandPaletteOpen(true);
            setSidebarOpen(false);
          }}
          type="button"
        >
          <Search size={14} />
          <span>{t("headerSearch")}</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="do-nav-primary" aria-label="Primary">
          <button
            className={`do-nav-item is-home ${lens.kind === "home" ? "is-active" : ""}`}
            data-testid="nav-home"
            onClick={() => {
              navigate("/home");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <Home size="sm" />
            <span>{t("navHome")}</span>
          </button>
          <button
            className={`do-nav-item is-my-work ${lens.kind === "my-work" ? "is-active" : ""}`}
            data-testid="nav-my-work"
            onClick={() => {
              navigate("/my-work");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <CheckCircle2 size="sm" />
            <span>{t("navMyWork")}</span>
          </button>
          <button
            className={`do-nav-item is-projects ${lens.kind === "work" || lens.kind === "project" ? "is-active" : ""}`}
            data-testid="nav-projects"
            onClick={() => {
              navigate("/projects");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <Folder size="sm" />
            <span>{t("navProjects")}</span>
          </button>
          <button
            className={`do-nav-item is-notes ${lens.kind === "notes" || (lens.kind === "project" && lens.tab === "notes") ? "is-active" : ""}`}
            data-testid="nav-notes"
            onClick={() => {
              navigate("/notes");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <BookOpen size="sm" />
            <span>{t("navNotes")}</span>
          </button>
          <button
            className={`do-nav-item is-agents do-mobile-advanced ${lens.kind === "agents" ? "is-active" : ""}`}
            data-testid="nav-agents"
            onClick={() => {
              navigate("/agents");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <Bot size="sm" />
            <span>{t("navAgents")}</span>
          </button>
          <button
            className={`do-nav-item is-approvals do-mobile-advanced ${lens.kind === "approvals" ? "is-active" : ""}`}
            data-testid="nav-approvals"
            onClick={() => {
              navigate("/approvals");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <ShieldCheck size="sm" />
            <span>{t("navApprovals")}</span>
            {reviewItems.length > 0 && (
              <em
                className={`do-nav-badge ${reviewItems.some((item) => Date.now() - timestamp(item.createdAt) > 48 * 3600 * 1000) ? "is-critical" : ""}`}
              >
                {reviewItems.length}
              </em>
            )}
          </button>
          <button
            className={`do-nav-item is-invoices do-mobile-advanced ${lens.kind === "invoices" ? "is-active" : ""}`}
            data-testid="nav-invoices"
            onClick={() => {
              navigate("/invoices");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <Receipt size="sm" />
            <span>{t("navInvoices")}</span>
            {(pendingInvoiceQueue.length > 0 ||
              invoiceDocuments.some((item) => isInvoiceOverdue(item))) && (
              <em className="do-nav-badge">
                {pendingInvoiceQueue.length +
                  invoiceDocuments.filter((item) => isInvoiceOverdue(item)).length}
              </em>
            )}
          </button>
          <button
            className={`do-nav-item is-feedback do-mobile-advanced ${lens.kind === "feedback" ? "is-active" : ""}`}
            data-testid="nav-feedback"
            onClick={() => {
              navigate("/feedback");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <Flag size="sm" />
            <span>{t("navFeedback")}</span>
            {canManageMembers &&
              feedbackReports.filter((item) => isOpenFeedback(item.status)).length > 0 && (
                <em className="do-nav-badge">
                  {feedbackReports.filter((item) => isOpenFeedback(item.status)).length}
                </em>
              )}
          </button>
        </nav>

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
          <span>{creatingConversation ? "Starting…" : "New"}</span>
          <kbd>N</kbd>
        </button>

        <div className="do-sidebar-scroll">
          <div className="do-sidebar-section">
            <div className="do-section-head">
              <button
                aria-expanded={sidebarSections.projects}
                className="do-section-toggle"
                onClick={() => toggleSidebarSection("projects")}
                type="button"
              >
                <ChevronDown
                  className={sidebarSections.projects ? "" : "is-collapsed"}
                  size={13}
                />
                <span>Projects</span>
              </button>
              <button
                aria-label="Open projects portfolio"
                onClick={() => {
                  goCenterView("portfolio");
                  setPanel(null);
                  setSidebarOpen(false);
                }}
                type="button"
              >
                All projects
              </button>
            </div>
            {sidebarSections.projects && (
            <div className="do-project-list">
              {sidebarProjects.favorites.length > 0 && (
                <button
                  aria-expanded={sidebarSections.favorites}
                  className="do-project-group-label is-toggle"
                  onClick={() => toggleSidebarSection("favorites")}
                  type="button"
                >
                  <ChevronDown
                    className={sidebarSections.favorites ? "" : "is-collapsed"}
                    size={11}
                  />
                  <Star size={10} /> Favorites
                </button>
              )}
              {sidebarSections.favorites &&
                sidebarProjects.favorites.map((project) => {
                  const health = projectHealth(
                    project,
                    openTasks.filter((task) => task.projectId === project.id),
                    risks.filter((risk) => risk.projectId === project.id),
                  );
                  const openCount = openTasks.filter(
                    (task) => task.projectId === project.id,
                  ).length;
                  return (
                <div
                  className={`do-project-row ${activeProject?.id === project.id ? "is-active" : ""} ${
                    health === "blocked" ? "is-blocked" : ""
                  }`}
                  key={project.id}
                >
                  <button
                    className="do-project-context"
                    data-testid={`open-project-${project.id}`}
                    onClick={() => openProjectRecord(project)}
                    title={entityTitle(project)}
                    type="button"
                  >
                    <StatusLight
                      status={healthToStatus(health)}
                      label={false}
                      size="sm"
                    />
                    <span className="do-project-title">{entityTitle(project)}</span>
                    {openCount > 0 && <small>{openCount}</small>}
                  </button>
                  <span className="do-project-actions do-mobile-advanced">
                    <button
                      aria-label={`Archive ${entityTitle(project)}`}
                      className="do-project-icon"
                      onClick={() => void archiveProject(project)}
                      title={`Archive ${entityTitle(project)}`}
                      type="button"
                    >
                      <Archive size={11} />
                    </button>
                    <button
                      aria-label={`Delete ${entityTitle(project)}`}
                      className="do-project-icon is-danger"
                      onClick={() => void deleteProject(project)}
                      title={`Delete ${entityTitle(project)}`}
                      type="button"
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                </div>
                  );
                })}
              {sidebarProjects.recent.length > 0 && (
                <button
                  aria-expanded={sidebarSections.recent}
                  className="do-project-group-label is-toggle"
                  onClick={() => toggleSidebarSection("recent")}
                  type="button"
                >
                  <ChevronDown
                    className={sidebarSections.recent ? "" : "is-collapsed"}
                    size={11}
                  />
                  Recent
                </button>
              )}
              {sidebarSections.recent &&
                sidebarProjects.recent.map((project) => {
                  const health = projectHealth(
                    project,
                    openTasks.filter((task) => task.projectId === project.id),
                    risks.filter((risk) => risk.projectId === project.id),
                  );
                  const openCount = openTasks.filter(
                    (task) => task.projectId === project.id,
                  ).length;
                  return (
                <div
                  className={`do-project-row ${activeProject?.id === project.id ? "is-active" : ""} ${
                    health === "blocked" ? "is-blocked" : ""
                  }`}
                  key={project.id}
                >
                  <button
                    className="do-project-context"
                    data-testid={`open-project-${project.id}`}
                    onClick={() => openProjectRecord(project)}
                    title={entityTitle(project)}
                    type="button"
                  >
                    <StatusLight
                      status={healthToStatus(health)}
                      label={false}
                      size="sm"
                    />
                    <span className="do-project-title">{entityTitle(project)}</span>
                    {openCount > 0 && <small>{openCount}</small>}
                  </button>
                  <span className="do-project-actions do-mobile-advanced">
                    <button
                      aria-label={`Archive ${entityTitle(project)}`}
                      className="do-project-icon"
                      onClick={() => void archiveProject(project)}
                      title={`Archive ${entityTitle(project)}`}
                      type="button"
                    >
                      <Archive size={11} />
                    </button>
                    <button
                      aria-label={`Delete ${entityTitle(project)}`}
                      className="do-project-icon is-danger"
                      onClick={() => void deleteProject(project)}
                      title={`Delete ${entityTitle(project)}`}
                      type="button"
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                </div>
                  );
                })}
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
            )}
          </div>

          <div className="do-sidebar-section do-conversations">
            <div className="do-section-head">
              <button
                aria-expanded={sidebarSections.conversations}
                className="do-section-toggle"
                onClick={() => toggleSidebarSection("conversations")}
                type="button"
              >
                <ChevronDown
                  className={sidebarSections.conversations ? "" : "is-collapsed"}
                  size={13}
                />
                <span>Recent</span>
              </button>
              <button
                aria-label="Search conversations"
                onClick={() => setSearchOpen((open) => !open)}
                type="button"
              >
                <Search size={13} />
              </button>
            </div>
            {sidebarSections.conversations && (
            <>
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
                          : "/home",
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
                    <span className="do-conversation-title">
                      {conversation.title || "New conversation"}
                    </span>
                  </button>
                  <div className="do-conversation-meta">
                    <small>
                      {conversationScopeLabel(conversation, projects, tasks)} ·{" "}
                      {timeAgo(
                        conversation.updatedAt || conversation.createdAt,
                      )}
                    </small>
                    <span className="do-conversation-actions">
                      <button
                        aria-label={`Archive ${conversation.title || "conversation"}`}
                        className="do-conversation-action"
                        onClick={() => void archiveConversation(conversation)}
                        type="button"
                      >
                        <Archive size={11} />
                      </button>
                      {!conversation.isChiefOfStaff && (
                        <button
                          aria-label={`Delete ${conversation.title || "conversation"}`}
                          className="do-conversation-action is-danger"
                          onClick={() => void deleteConversation(conversation)}
                          type="button"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </span>
                  </div>
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
            </>
            )}
          </div>
        </div>

        <nav className="do-nav-admin do-mobile-advanced" aria-label="Workspace administration">
          <button
            className={`do-nav-item ${lens.kind === "more" && lens.section === "workspace" ? "is-active" : ""}`}
            data-testid="nav-workspace"
            onClick={() => {
              navigate("/workspace");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <Users size="sm" />
            <span>{t("navWorkspace")}</span>
          </button>
          <button
            className={`do-nav-item ${lens.kind === "settings" ? "is-active" : ""}`}
            data-testid="nav-settings"
            onClick={() => {
              navigate("/settings");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <Settings size="sm" />
            <span>{t("navSettings")}</span>
          </button>
          <button
            className="do-nav-item"
            data-testid="nav-help"
            onClick={() => {
              setComposer("Help me understand Certo Work navigation: ");
              navigate("/home");
              setSidebarOpen(false);
            }}
            type="button"
          >
            <HelpCircle size="sm" />
            <span>{t("navHelp")}</span>
          </button>
        </nav>

        <div className="do-account">
          <button
            onClick={() => setWorkspaceOpen((open) => !open)}
            type="button"
          >
            <span className="do-avatar">
              {memberAvatar(currentWorkspaceMember || {})}
            </span>
            <span>
              <strong>{memberLabel(currentWorkspaceMember || { status: "active" })}</strong>
              <small>{workspace?.name || "Certo Work"}</small>
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
                className="do-mobile-advanced"
                onClick={() => {
                  setPanel("workspace");
                  setWorkspaceOpen(false);
                }}
                type="button"
              >
                <Users size={14} /> Workspace & team
                {accessRequests.length > 0 && (
                  <em className="do-menu-badge">{accessRequests.length}</em>
                )}
              </button>
              <button
                onClick={() => {
                  setPanel("settings");
                  setWorkspaceOpen(false);
                }}
                type="button"
              >
                <Settings size={14} /> Settings
              </button>
              <button
                className="do-mobile-advanced"
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
            aria-label={t("openNav")}
            className="do-icon-button do-menu-button"
            onClick={() => setSidebarOpen(true)}
            title={t("openNav")}
            type="button"
          >
            <Menu size={18} />
          </button>
          <div className="do-breadcrumb">
            <AppBreadcrumbs
              segments={[
                {
                  label: workspace?.name || "Workspace",
                  onClick: () => navigate("/home"),
                },
                ...(centerView === "portfolio"
                  ? [{ label: "Projects" }]
                  : []),
                ...(lens.kind === "my-work"
                  ? [
                      {
                        label: "My Work",
                        onClick: () => navigate("/my-work"),
                      },
                      ...(lens.section === "inbox"
                        ? [{ label: "Inbox" }]
                        : lens.section === "waiting"
                          ? [{ label: "Waiting" }]
                          : [{ label: "Assigned" }]),
                    ]
                  : []),
                ...(lens.kind === "notes"
                  ? [{ label: "Notes" }]
                  : []),
                ...(lens.kind === "agents"
                  ? [
                      {
                        label: "Agents",
                        onClick: () => navigate("/agents"),
                      },
                      ...(lens.section === "automations"
                        ? [{ label: "Automations" }]
                        : lens.section === "activity"
                          ? [{ label: "Activity" }]
                          : []),
                    ]
                  : []),
                ...(lens.kind === "invoices" ? [{ label: "Invoices" }] : []),
                ...(lens.kind === "feedback"
                  ? [
                      {
                        label: "Feedback",
                        onClick: () => navigate("/feedback"),
                      },
                      ...(lens.section === "queue" ? [{ label: "Queue" }] : []),
                    ]
                  : []),
                ...(activeProject
                  ? [
                      {
                        label: entityTitle(activeProject),
                        onClick: () => openProjectRecord(activeProject),
                      },
                    ]
                  : lens.kind === "home"
                    ? [{ label: "Home" }]
                    : lens.kind === "approvals"
                      ? [{ label: "Approvals" }]
                      : lens.kind === "settings"
                        ? [{ label: "Settings" }]
                        : centerView === "conversation"
                          ? [{ label: currentContextLabel || "Odysseus" }]
                          : []),
                ...(selectedWorkItem
                  ? [{ label: entityTitle(selectedWorkItem) }]
                  : []),
              ]}
            />
          </div>
          <div className="do-header-actions">
            {mobileCore && (
              <button
                aria-label={t("productCollab")}
                className="do-icon-button"
                data-testid="header-collab"
                onClick={() =>
                  navigate(
                    lens.kind === "project"
                      ? collabProjectPath(lens.projectId)
                      : "/collab",
                  )
                }
                title={t("productCollab")}
                type="button"
              >
                <MessageSquare size={15} />
              </button>
            )}
            <button
              aria-label="Open command palette"
              className="do-icon-button"
              onClick={() => setCommandPaletteOpen(true)}
              title="Command palette (⌘K)"
              type="button"
            >
              <Search size={15} />
            </button>
            <div className="do-create-menu" ref={createMenuRef}>
              <button
                aria-expanded={createMenuOpen}
                aria-haspopup="menu"
                aria-label={t("headerCreate")}
                className="cw-btn cw-btn-primary cw-btn-sm"
                onClick={() => setCreateMenuOpen((open) => !open)}
                title={t("headerCreate")}
                type="button"
              >
                <Plus size={15} />
                <span>{t("headerCreate")}</span>
              </button>
              {createMenuOpen && createPortal(
                <>
                  <button
                    aria-label="Close create menu"
                    className="do-create-menu-backdrop"
                    onClick={() => setCreateMenuOpen(false)}
                    type="button"
                  />
                  <div
                    className="do-create-menu-list"
                    role="menu"
                    style={{ top: createMenuPos.top, right: createMenuPos.right }}
                  >
                    <button onClick={() => { setCreateMenuOpen(false); setComposer("Create a task: "); }} type="button">
                      {t("createTask")}
                    </button>
                    <button onClick={() => { setCreateMenuOpen(false); setProjectWizardOpen(true); }} type="button">
                      {t("createProject")}
                    </button>
                    <button className="do-mobile-advanced" onClick={() => { setCreateMenuOpen(false); setMagicProjectOpen(true); }} type="button">
                      {t("createMagicProject")}
                    </button>
                    <button onClick={() => { setCreateMenuOpen(false); setComposer("Capture this: "); }} type="button">
                      {t("createCapture")}
                    </button>
                    <button className="do-mobile-advanced" onClick={() => { setCreateMenuOpen(false); navigate("/report-bug"); }} type="button">
                      {t("createBug")}
                    </button>
                    <button className="do-mobile-advanced" onClick={() => { setCreateMenuOpen(false); navigate("/feature-request"); }} type="button">
                      {t("createFeature")}
                    </button>
                  </div>
                </>,
                document.body,
              )}
            </div>
          </div>
        </header>

        {notice && (
          <Toast kind="success" onDismiss={() => setNotice("")}>
            {notice}
          </Toast>
        )}

        {lens.kind === "project" && (
        <section
          className="do-center-bar"
          aria-label="Project views"
        >
          <div
            className="do-view-switch"
            role="tablist"
            aria-label="Project views"
          >
            <button
              aria-selected={centerView === "project"}
              className={centerView === "project" ? "is-active" : ""}
              onClick={() => goCenterView("project")}
              role="tab"
              type="button"
            >
              Overview
            </button>
            <button
              aria-selected={centerView === "notes"}
              className={centerView === "notes" ? "is-active" : ""}
              onClick={() => goCenterView("notes")}
              role="tab"
              type="button"
            >
              Notes
            </button>
            <button
              aria-selected={centerView === "strategy"}
              className={`do-mobile-advanced ${centerView === "strategy" ? "is-active" : ""}`}
              onClick={() => goCenterView("strategy")}
              role="tab"
              type="button"
            >
              Strategy
            </button>
          </div>
        </section>
        )}

        {centerView === "conversation" ? (
          <>
            <div className="do-thread-viewport">
              <div className="do-thread">
                {contextualMessages.length === 0 && !submitting ? (
                  <section className="do-opening">
                    {isFocusedConversation ? (
                      <div className="do-welcome">
                        <OdysseusMark size="lg" />
                        <span className="do-context-eyebrow">
                          FOCUSED · {currentContextLabel}
                        </span>
                        <h1>{t("odiseusFocusedPrompt")}</h1>
                        <p>
                          {routeOrPrimaryProject
                            ? routeOrPrimaryProject.outcome ||
                              routeOrPrimaryProject.description ||
                              `${projectTasks.length} open tasks in this context.`
                            : `${projectTasks.length} open items are connected to this conversation.`}
                        </p>
                      </div>
                    ) : (
                      <>
                        {!isFocusedConversation && (
                          <HomeAttention
                            projects={projects}
                            tasks={tasks}
                            risks={risks}
                            reviewItems={reviewItems}
                            todayTasks={personalTodayTasks}
                            onOpenProject={openProjectRecord}
                            onOpenApprovals={() => setPanel("approvals")}
                            onAsk={setComposer}
                            activityItems={odiseusActivity}
                          />
                        )}
                        <OdysseusAgentHome
                          examples={openingPrompts}
                          onExample={(prompt) => sendMessage(prompt)}
                          pendingApprovals={reviewItems.length}
                          onTalk={startVoiceCall}
                        />
                      </>
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

                    {isFocusedConversation && (
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
                    )}
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
                              <OdysseusMark size="sm" />
                            </div>
                            <div className="do-assistant-content">
                              <div className="do-assistant-name">
                                <OdysseusBadge />
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
                              {message.odiseusRun?.steps?.length ? (
                                <OdysseusWorkLog
                                  steps={message.odiseusRun.steps}
                                />
                              ) : null}
                              {message.odiseusRun?.artifact ? (
                                <OdysseusArtifactCard
                                  meta="Generated by Odysseus"
                                  summary={
                                    message.odiseusRun.artifact.summary ||
                                    undefined
                                  }
                                  title={message.odiseusRun.artifact.title}
                                  onOpen={
                                    message.odiseusRun.artifact.body
                                      ? () =>
                                          setComposer(
                                            `Here is the report you prepared:\n\n${message.odiseusRun.artifact.body}`,
                                          )
                                      : undefined
                                  }
                                />
                              ) : null}
                              {message.actionPlan?.status !== "rejected" && (
                                <ActionProposal
                                  activeProject={
                                    primaryProject || activeProject || null
                                  }
                                  message={message}
                                  onReject={rejectPlan}
                                  onStage={async (message) => {
                                    await stagePlan(message);
                                  }}
                                  projects={projects}
                                />
                              )}
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
                            <OdysseusMark size="sm" />
                          </div>
                          <div className="do-assistant-content">
                            <div className="do-assistant-name">
                              <OdysseusBadge />
                            </div>
                            {streamed ? (
                              <RichText text={streamed} />
                            ) : (
                              <OdysseusWorkLog steps={liveOdysseusSteps} working />
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
                      ? `Give Odysseus a job for ${currentContextLabel}…`
                      : "Give Odysseus a job…"
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
                    <button
                      aria-label="Talk with Odysseus"
                      className={voiceCallOpen ? "is-active" : ""}
                      onClick={startVoiceCall}
                      type="button"
                    >
                      <Phone size={16} />
                    </button>
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
          <div className="do-my-work-shell" data-testid="my-work-shell">
            {lens.kind === "my-work" && (
              <div className="do-my-work-tabs" role="tablist" aria-label="My Work views">
                <button
                  className={lens.section === "assigned" ? "is-active" : ""}
                  onClick={() => navigate("/my-work")}
                  role="tab"
                  type="button"
                >
                  {t("myWorkAssigned")}
                </button>
                <button
                  className={lens.section === "inbox" ? "is-active" : ""}
                  onClick={() => navigate("/my-work/inbox")}
                  role="tab"
                  type="button"
                >
                  {t("myWorkInbox")}
                </button>
                <button
                  className={lens.section === "waiting" ? "is-active" : ""}
                  onClick={() => navigate("/my-work/waiting")}
                  role="tab"
                  type="button"
                >
                  {t("myWorkWaiting")}
                </button>
              </div>
            )}
            <WorkItemsCenter
            activeProject={null}
            onAddTask={async (...args) => addProjectTask(...args)}
            onAsk={(prompt) => {
              setComposer(prompt);
              goCenterView("conversation");
            }}
            onCreateSprint={createSprint}
            onOpenProjectConsole={openProjectRecord}
            onSelectItem={setSelectedWorkItemId}
            onCreateControlledOption={createControlledOption}
            onUpdateSprint={updateSprint}
            onUpdateTask={updateProjectTask}
            projects={projects}
            selectedItemId={selectedWorkItemId}
            sprints={sprints}
            tags={categories}
            tasks={myWorkTasks}
            workspaceMembers={workspaceMembers}
          />
          </div>
        ) : centerView === "invoices" ? (
          <InvoiceCenter
            busyId={invoiceBusyId}
            canOperate={canOperateInvoiceQueue}
            invoices={invoiceDocuments}
            onOpenProject={(projectId) => {
              const project = projects.find((item) => item.id === projectId);
              if (project) openProjectRecord(project);
            }}
            onPush={pushPendingInvoice}
            onUpdateStatus={updateInvoiceStatus}
            pending={pendingInvoiceQueue}
          />
        ) : centerView === "feedback" ? (
          <FeedbackCenter
            canManage={canManageMembers}
            initialKind={
              lens.kind === "feedback" && lens.intent ? lens.intent : "bug"
            }
            mode={
              lens.kind === "feedback" &&
              lens.section === "queue" &&
              canManageMembers
                ? "queue"
                : "submit"
            }
            onConvert={convertFeedbackToPbi}
            onOpenItem={(taskId) => {
              setSelectedWorkItemId(taskId);
              navigate("/my-work");
            }}
            onOpenQueue={() => navigate("/workspace/feedback")}
            onSubmit={submitFeedbackReport}
            onUpdateStatus={updateFeedbackStatus}
            projects={projects}
            reports={
              lens.kind === "feedback" && lens.section === "queue" && canManageMembers
                ? feedbackReports
                : feedbackReports.filter((item) => item.userId === user?.uid)
            }
          />
        ) : centerView === "agents" ? (
          agentBuilderOpen ? (
            <AgentBuilderDraft
              onChange={setAgentOutcomeDraft}
              onContinue={() => {
                setNotice(
                  `Draft Agent captured: “${agentOutcomeDraft.trim().slice(0, 80)}”. Publish + Hermes provision comes next.`,
                );
                setAgentBuilderOpen(false);
                setAgentOutcomeDraft("");
              }}
              outcome={agentOutcomeDraft}
            />
          ) : (
            <AgentsLibrary
              activityItems={odiseusActivity}
              pendingApprovals={reviewItems.length}
              viewerUserId={user?.uid}
              onCreateAgent={() => setAgentBuilderOpen(true)}
              onOpenActivity={() => navigate("/agents/activity")}
              onOpenApprovals={() => setPanel("approvals")}
              onOpenAutomations={() => navigate("/agents/automations")}
              onOpenOdysseus={() => void openChiefOfStaff()}
            />
          )
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
              currentUser={user}
              documents={knowledgeItems.filter(
                (item) =>
                  item.projectId === consoleProject.id &&
                  item.status !== "archived",
              )}
              initialTab={projectConsoleInitialTab}
              milestones={milestones.filter(
                (item) => item.projectId === consoleProject.id,
              )}
              onAddDocument={(payload) => addProjectDocument(consoleProject.id, payload)}
              onAddRisk={(title, patch) =>
                addProjectRisk(consoleProject.id, title, patch)
              }
              onAddTask={async (title, status, patch) =>
                addProjectTask(consoleProject.id, title, status, patch)
              }
              onArchiveProject={archiveProject}
              onCreateCostTemplate={createCostTemplate}
              onCreateControlledOption={createControlledOption}
              onCreateShareLink={async () => {
                if (!user || !workspace) return;
                const token = createShareToken();
                const snapshot = sanitizeStatusReportSnapshot(
                  buildProjectStatusReport(
                    consoleProject,
                    tasks.filter((item) => item.projectId === consoleProject.id),
                    risks.filter((item) => item.projectId === consoleProject.id),
                    milestones.filter((item) => item.projectId === consoleProject.id),
                  ),
                );
                await setDoc(doc(db, "project_status_shares", token), {
                  userId: user.uid,
                  workspaceId: workspace.id,
                  projectId: consoleProject.id,
                  token,
                  snapshot,
                  revoked: false,
                  createdAt: serverTimestamp(),
                });
                const url = `${window.location.origin}/report/${token}`;
                setNotice("Read-only status link created.");
                return url;
              }}
              onConnectGoogleDrive={connectProjectDrive}
              onCreateProjectFolder={() => createProjectDriveFolder(consoleProject)}
              onSelectDriveRoot={selectDriveRoot}
              driveFolders={driveFolders}
              driveRoot={driveRoot}
              driveConnected={Boolean(storedDriveAccessToken() || driveRoot)}
              driveMessage={driveMessage}
              onCreateSprint={createSprint}
              onDeleteProject={deleteProject}
              onRestoreProject={restoreProject}
              onAsk={(prompt) => {
                setComposer(prompt);
                goCenterView("conversation");
              }}
              onUpdateProject={updateProject}
              onUpdateCostTemplate={updateCostTemplate}
              onUpdateSprint={updateSprint}
              onUpdateTask={updateProjectTask}
              project={consoleProject}
              risks={risks.filter(
                (item) => item.projectId === consoleProject.id,
              )}
              sprints={sprints.filter((sprint) => sprint.projectId === consoleProject.id)}
              tags={categories}
              tasks={tasks.filter(
                (item) => item.projectId === consoleProject.id,
              )}
              workspace={workspace}
              workspaceMembers={workspaceMembers}
              projects={projects}
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

      <nav aria-label="Mobile core" className="do-mobile-dock">
        <button
          className={mobileCoreTab(location.pathname) === "home" ? "is-active" : ""}
          onClick={() => navigate("/home")}
          type="button"
        >
          <Home size={16} />
          Home
        </button>
        <button
          className={mobileCoreTab(location.pathname) === "my-work" ? "is-active" : ""}
          onClick={() => navigate("/my-work")}
          type="button"
        >
          <CheckCircle2 size={16} />
          My Work
        </button>
        <button
          className={mobileCoreTab(location.pathname) === "projects" ? "is-active" : ""}
          onClick={() => navigate("/projects")}
          type="button"
        >
          <Folder size={16} />
          Projects
        </button>
        <button
          className={mobileCoreTab(location.pathname) === "notes" ? "is-active" : ""}
          onClick={() => navigate("/notes")}
          type="button"
        >
          <BookOpen size={16} />
          Notes
        </button>
      </nav>

      {createPortal(
        <OdysseusVoiceCall
          activeProject={primaryProject || activeProject}
          liveSteps={liveOdysseusSteps}
          onApplyPlans={applyVoicePlans}
          onClose={closeVoiceCall}
          onTranscribe={async (blob) => {
            if (!user) return "";
            const token = await user.getIdToken();
            return transcribeVoiceAudio({ token, userId: user.uid, blob });
          }}
          onWrapUp={(transcript) =>
            sendMessage(buildVoiceWrapUpMessage(transcript), {
              voiceSession: true,
              voiceWrapUp: true,
            })
          }
          open={voiceCallOpen}
          projects={projects}
        />,
        document.body,
      )}

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
                      ? "AUTOMATIONS"
                      : panel === "digest"
                        ? "UPDATES"
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
                      ? "Automations"
                      : panel === "digest"
                        ? "Updates"
                        : panel === "workspace"
                          ? "Workspace & team"
                          : panel === "settings"
                            ? "Settings"
                          : "Pending changes"}
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
                onAddTask={async (title, status, patch) =>
                  addProjectTask(consoleProject.id, title, status, patch)
                }
                onArchiveProject={archiveProject}
                onCreateCostTemplate={createCostTemplate}
                onCreateControlledOption={createControlledOption}
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
                sprints={sprints.filter((sprint) => sprint.projectId === consoleProject.id)}
                tags={categories}
                tasks={tasks.filter(
                  (item) => item.projectId === consoleProject.id,
                )}
                workspaceMembers={workspaceMembers}
                projects={projects}
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
                    <strong>{ODISEUS_NAME} · general</strong>
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
                <span className="do-context-section-label">Items</span>
                <input
                  aria-label="Find items for this conversation"
                  onChange={(event) => setContextTaskSearch(event.target.value)}
                  placeholder="Find an item"
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
                Project portfolio
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
              <OdysseusSchedules onRunNow={(prompt) => sendMessage(prompt)} />
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

          {panel === "settings" && (
            <div className="do-panel-settings">
              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Public profile</span>
                  <strong>Alias and icon</strong>
                </div>
                <p className="do-panel-intro">
                  Teammates only see your alias and emoji. Your email stays private.
                </p>
                <AliasProfileEditor
                  alias={aliasDraft}
                  emoji={emojiDraft}
                  onAliasChange={setAliasDraft}
                  onEmojiChange={setEmojiDraft}
                />
                <button
                  disabled={!normalizeAlias(aliasDraft)}
                  onClick={saveAliasProfile}
                  type="button"
                >
                  Save alias
                </button>
              </section>
              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Account security</span>
                  <strong>{user?.email || "Signed-in account"}</strong>
                </div>
                <p className="do-panel-intro">
                  {passwordProviderMessage(
                    user?.providerData.map((provider) => provider.providerId),
                  )}
                </p>
                <button
                  disabled={
                    !canChangePasswordForProvider(
                      user?.providerData.map((provider) => provider.providerId),
                    )
                  }
                  onClick={requestPasswordReset}
                  type="button"
                >
                  Send password reset
                </button>
              </section>
              <section className="do-settings-appearance">
                <div>
                  <span>Appearance</span>
                  <h2>Text size</h2>
                  <p>
                    Choose how dense or readable Certo Work feels on this
                    device.
                  </p>
                </div>
                <TextSizeControl />
              </section>
              <AppleWidgetSettings
                busy={widgetBusy}
                enabled={Boolean(widgetToken)}
                error={widgetError}
                onEnable={() => void enableAppleWidget()}
                onRevoke={() => void revokeAppleWidget()}
                token={widgetToken}
              />
              <ControlledListsSettings
                categories={categories}
                onBack={() => setPanel(null)}
                onCreateOption={createControlledOption}
                onDeleteOption={deleteControlledOption}
                onRenameOption={renameControlledOption}
                projects={projects}
                tasks={tasks}
              />
            </div>
          )}

          {panel === "workspace" && (
            <>
              <p className="do-panel-intro">
                Workspaces separate companies, teams, or operating contexts.
                This version supports up to {WORKSPACE_LIMIT}; conversations
                stay personal, while projects and tasks live inside the selected
                workspace. People are shown by alias only.
              </p>

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Your profile</span>
                  <strong>Alias required</strong>
                </div>
                <p className="do-panel-intro">
                  Set the name and icon teammates will see when they assign work.
                  Email is never shown in the workspace.
                </p>
                <AliasProfileEditor
                  alias={aliasDraft}
                  emoji={emojiDraft}
                  onAliasChange={setAliasDraft}
                  onEmojiChange={setEmojiDraft}
                />
                <button
                  disabled={!normalizeAlias(aliasDraft)}
                  onClick={saveAliasProfile}
                  type="button"
                >
                  Save alias
                </button>
              </section>

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

              {canManageMembers && (
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
              )}

              {canOperateInvoiceQueue && (
              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Invoices</span>
                  <strong>
                    {pendingInvoiceQueue.length} ready to push
                    {" · "}
                    {invoiceDocuments.filter((item) => isInvoiceOverdue(item)).length} overdue
                  </strong>
                </div>
                <p className="do-panel-intro">
                  Push pending project invoices into the AP queue. Finance marks billed, sent,
                  approved, paid, rejected, void, or problem. Clients can confirm payment from a portal link.
                </p>
                <button onClick={() => navigate("/invoices")} type="button">
                  Open invoice queue
                </button>
              </section>
              )}

              {canManageMembers && (
              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Feedback</span>
                  <strong>
                    {feedbackReports.filter((item) => isOpenFeedback(item.status)).length} open
                    {" "}report
                    {feedbackReports.filter((item) => isOpenFeedback(item.status)).length === 1 ? "" : "s"}
                  </strong>
                </div>
                <p className="do-panel-intro">
                  Bugs and feature requests from the workspace. Convert accepted ones into backlog PBIs.
                </p>
                <button
                  onClick={() => navigate("/workspace/feedback")}
                  type="button"
                >
                  Open feedback queue
                </button>
              </section>
              )}

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Beta access</span>
                  <strong>
                    {accessRequests.length} pending request
                    {accessRequests.length === 1 ? "" : "s"}
                  </strong>
                </div>
                <p className="do-panel-intro">
                  People who request beta access by email appear here. Approve
                  only the users you want to join the current workspace.
                </p>
                <div className="do-member-list do-access-request-list">
                  {accessRequests.map((request) => (
                    <article key={request.id}>
                      <span className="do-avatar">
                        {request.displayName?.trim()
                          ? initials(request.displayName)
                          : "?"}
                      </span>
                      <div>
                        <strong>
                          {normalizeAlias(request.displayName) ||
                            normalizeInviteEmail(request.email || request.emailLower || "") ||
                            "Pending user"}
                        </strong>
                        <small>
                          {normalizeInviteEmail(request.email || request.emailLower || "") ||
                            "No email"}
                          {" · "}
                          {request.provider || "email/password"} ·{" "}
                          {timeAgo(request.requestedAt || request.updatedAt)}
                        </small>
                      </div>
                      <select
                        aria-label={`Approval role for ${request.email || "request"}`}
                        defaultValue="member"
                        onChange={(event) => {
                          const value = event.target.value as
                            | "admin"
                            | "member"
                            | "viewer";
                          event.currentTarget.dataset.role = value;
                        }}
                      >
                        {WORKSPACE_ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <div className="do-access-request-actions">
                        <button
                          onClick={(event) => {
                            const role =
                              (event.currentTarget.parentElement
                                ?.previousElementSibling as HTMLSelectElement | null)
                                ?.value || "member";
                            approveAccessRequest(
                              request,
                              role as "admin" | "member" | "viewer",
                            );
                          }}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="is-danger"
                          onClick={() => rejectAccessRequest(request)}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                  {accessRequests.length === 0 && (
                    <div className="do-panel-empty">
                      <ShieldCheck size={20} />
                      <strong>No pending beta requests.</strong>
                      <span>
                        New email/password requests will appear here for
                        approval.
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className="do-workspace-admin-card">
                <div className="do-workspace-admin-head">
                  <span className="do-kicker">Members</span>
                  <strong>{directoryMembers.length} people</strong>
                </div>
                <div className="do-member-list">
                  {directoryMembers.map((member) => {
                    const isOwner =
                      isWorkspaceOwnerRole(member.role) ||
                      member.userId === workspace?.ownerId;
                    const email = normalizeInviteEmail(member.email || member.emailLower || "");
                    const label = memberManageLabel(member);
                    return (
                      <article key={member.id}>
                        <span className="do-member-avatar">
                          {memberAvatar(member)}
                        </span>
                        <div>
                          <strong>{label}</strong>
                          <small>
                            {memberStatusLabel(member.status)}
                            {member.userId === user?.uid ? " · You" : ""}
                            {email && email !== label.toLowerCase() ? ` · ${email}` : ""}
                          </small>
                        </div>
                        {isOwner ? (
                          <em>Owner</em>
                        ) : (
                          <select
                            aria-label={`Role for ${label}`}
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
                        {!isOwner && canManageMembers && (
                          <>
                            <label className="do-member-finance">
                              <input
                                checked={Boolean(member.financeAccess)}
                                onChange={() => toggleMemberFinanceAccess(member)}
                                type="checkbox"
                              />
                              Finance
                            </label>
                            <button
                              className="do-member-remove"
                              onClick={() => removeWorkspaceMember(member)}
                              type="button"
                            >
                              <UserMinus size={13} /> Remove
                            </button>
                          </>
                        )}
                      </article>
                    );
                  })}
                  {directoryMembers.length === 0 && (
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
                <div className="do-pending-invites">
                  <div className="do-workspace-admin-head">
                    <span className="do-kicker">Pending invites</span>
                    <strong>{pendingInvites.length} waiting</strong>
                  </div>
                  {pendingInvites.map((row) => {
                    const invite = row.invite;
                    const delivery = String(row.deliveryStatus || invite?.emailDeliveryStatus || "")
                      .replace(/_/g, " ");
                    return (
                      <article className="do-pending-invite-row" key={row.key}>
                        <div>
                          <strong>{row.email}</strong>
                          <small>
                            {roleLabel(row.role)} · Invited
                            {delivery ? ` · email ${delivery}` : " · email not sent yet"}
                            {inviteIsExpired(invite) ? " · expired" : ""}
                          </small>
                        </div>
                        {canManageMembers && (
                          <div className="do-pending-invite-actions">
                            <button
                              onClick={() => void resendWorkspaceInvite(row)}
                              type="button"
                            >
                              <Mail size={13} /> Resend
                            </button>
                            {invite?.inviteToken && (
                              <button
                                onClick={() => void copyInviteLink(invite)}
                                type="button"
                              >
                                Copy link
                              </button>
                            )}
                            <button
                              onClick={() => void copyInviteMessage(invite || { email: row.email })}
                              type="button"
                            >
                              Copy message
                            </button>
                            <button
                              className="do-member-remove"
                              onClick={() =>
                                invite
                                  ? revokeWorkspaceInvite(invite)
                                  : row.member
                                    ? removeWorkspaceMember(row.member)
                                    : undefined
                              }
                              type="button"
                            >
                              Remove invite
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {pendingInvites.length === 0 && (
                    <div className="do-panel-empty">
                      <Mail size={20} />
                      <strong>No pending invites.</strong>
                      <span>New invites show the person’s email here until they join.</span>
                    </div>
                  )}
                </div>
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
                                {memberManageLabel(member)}
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
        onOpenMagicProject={() => {
          setProjectWizardOpen(false);
          setMagicProjectOpen(true);
        }}
        onUpdateProject={updateProjectFromWizard}
        projects={activeProjects}
      />
      <MagicProjectModal
        isOpen={magicProjectOpen}
        onClose={() => setMagicProjectOpen(false)}
        onCreate={createMagicProject}
      />

      {needsAlias && (
        <div className="do-alias-gate" role="dialog" aria-modal="true" aria-label="Choose a public alias">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveAliasProfile();
            }}
          >
            <span className="do-kicker">Required</span>
            <h2>Choose a public alias</h2>
            <p>
              Teammates assign work using your alias and icon. Your email stays
              private and will not be shown in Certo Work.
            </p>
            <AliasProfileEditor
              alias={aliasDraft}
              emoji={emojiDraft}
              onAliasChange={setAliasDraft}
              onEmojiChange={setEmojiDraft}
            />
            <button disabled={!normalizeAlias(aliasDraft)} type="submit">
              Save alias and continue
            </button>
          </form>
        </div>
      )}
    </div>
  );

  return (
    <>
      {workOpened ? (
        <div aria-hidden={onCollab} className="do-product-pane" hidden={onCollab}>
          {workPane}
        </div>
      ) : null}
      {collabOpened ? (
        <div aria-hidden={!onCollab} className="do-product-pane" hidden={!onCollab}>
          <ChatCollabModule
            projects={activeProjects.map((project) => ({
              id: String(project.id),
              name: entityTitle(project),
            }))}
            workspaceName={workspace?.name}
          />
        </div>
      ) : null}
    </>
  );
}
