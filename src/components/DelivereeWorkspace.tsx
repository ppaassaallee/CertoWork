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
  ArrowUp,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Folder,
  Inbox,
  ListTodo,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { evaluateJudgment, type JudgmentAssessment } from "../lib/judgment";
import { actionLabel, resolveDelivereeLens } from "../lib/delivereeRoutes";
import { sidebarProjectGroups, sortProjectsByRecency, type WorkLane } from "../lib/projectPortfolio";
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

type Panel = "today" | "projects" | "project" | "approvals" | null;

function timestamp(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
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
  if (["urgent", "critical", "p0", "p1", "high"].includes(normalized)) return "Priority";
  return "Open";
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
  };
  return types[String(type || "")] || "task";
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
  const visible = isDocument && !expanded ? `${text.slice(0, 1_400).trimEnd()}…` : text;
  return (
    <div className={`do-user-message ${isDocument ? "is-document" : ""}`}>
      {isDocument && (
        <div className="do-user-document-head">
          <span>Long project input · {text.length.toLocaleString()} characters</span>
          <button onClick={() => setExpanded((value) => !value)} type="button">{expanded ? "Collapse" : "Show full"}</button>
        </div>
      )}
      <div>{visible}</div>
    </div>
  );
}

function ActionProposal({
  message,
  onStage,
}: {
  message: Message;
  onStage: (message: Message) => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const plan = message.actionPlan;
  if (!plan?.proposedActions?.length) return null;
  return (
    <section className="do-proposal" data-testid="action-proposal">
      <div className="do-proposal-head">
        <div>
          <span className="do-kicker">Draft</span>
          <h3>{plan.title || "Proposed changes"}</h3>
          <p>{plan.summary}</p>
        </div>
        <ShieldCheck size={17} />
      </div>
      <div className="do-proposal-items">
        {plan.proposedActions.map((action: any, index: number) => (
          <div className="do-proposal-item" key={`${action.type}-${index}`}>
            <span className="do-proposal-number">{index + 1}</span>
            <div>
              <strong>{actionLabel(action.type)}</strong>
              <p>{action.proposedChange?.title || action.reason || "Review details"}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="do-proposal-foot">
        <span>Nothing changes until you approve.</span>
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
          {status === "done" ? "Ready to approve" : "Review draft"}
        </button>
      </div>
    </section>
  );
}

export function DelivereeWorkspace() {
  const { user, workspace, workspaces, setWorkspace, logOut } = useAuth();
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
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [judgment, setJudgment] = useState<JudgmentAssessment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contextTaskSearch, setContextTaskSearch] = useState("");
  const [chatsExpanded, setChatsExpanded] = useState(false);
  const [projectConsoleId, setProjectConsoleId] = useState<string | null>(null);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !workspace) return;
    const makeQuery = (name: string, callback: (items: any[]) => void, activeOnly = false) => {
      const clauses: any[] = [where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)];
      if (activeOnly) clauses.push(where("status", "==", "active"));
      return onSnapshot(
        query(collection(db, name), ...clauses),
        (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        () => callback([]),
      );
    };
    const unsubscribers = [
      makeQuery(
        "boldi_conversations",
        (items) => {
          const sorted = items.sort(
            (left, right) => timestamp(right.updatedAt || right.createdAt) - timestamp(left.updatedAt || left.createdAt),
          );
          setConversations(sorted);
          setConversationId((current) => current || sorted[0]?.id || null);
        },
        true,
      ),
      makeQuery("projects", setProjects),
      makeQuery("tasks", setTasks),
      makeQuery("milestones", setMilestones),
      makeQuery("boldr_risks", setRisks),
      makeQuery("knowledge_items", setKnowledgeItems),
      makeQuery("review_candidates", (items) =>
        setReviewItems(items.filter((item) => ["pending", "approved_for_review"].includes(item.status))),
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
            .sort((left, right) => timestamp(left.createdAt) - timestamp(right.createdAt)),
        ),
      () => setMessages([]),
    );
  }, [conversationId, user, workspace]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamed, submitting]);

  useEffect(() => {
    if (lens.kind === "review") setPanel("approvals");
    if (lens.kind === "work") setPanel(lens.section === "portfolio" ? "projects" : "today");
  }, [lens.kind, lens.kind === "work" ? lens.section : null]);

  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
      setInput(Array.from(event.results).map((result: any) => result[0].transcript).join(" "));
    };
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const activeProjects = useMemo(
    () => sortProjectsByRecency(projects.filter((project) => !isClosed(project.status))),
    [projects],
  );
  const sidebarProjects = useMemo(() => sidebarProjectGroups(projects), [projects]);
  const openTasks = useMemo(() => tasks.filter((task) => !isClosed(task.status)), [tasks]);
  const activeProject = useMemo(
    () => (lens.kind === "project" ? projects.find((project) => project.id === lens.projectId) : null),
    [lens, projects],
  );
  const currentConversation = conversations.find((conversation) => conversation.id === conversationId);
  const impliedConversationScope = currentConversation || (activeProject
    ? { linkedProjectIds: [activeProject.id], linkedTaskIds: [], conversationType: "project" as const }
    : null);
  const directContextProjectIds = conversationProjectIds(impliedConversationScope);
  const contextTaskIds = conversationTaskIds(impliedConversationScope);
  const contextTasks = openTasks.filter((task) => contextTaskIds.includes(task.id));
  const contextProjectIds = [...new Set([
    ...directContextProjectIds,
    ...contextTasks.map((task) => String(task.projectId || "")).filter(Boolean),
  ])];
  const contextProjects = projects.filter((project) => contextProjectIds.includes(project.id));
  const primaryProject = contextProjects.length === 1 ? contextProjects[0] : null;
  const routeOrPrimaryProject = primaryProject || activeProject;
  const isFocusedConversation = directContextProjectIds.length > 0 || contextTaskIds.length > 0;
  const projectTasks = useMemo(
    () => openTasks.filter((task) => (
      directContextProjectIds.includes(String(task.projectId || "")) || contextTaskIds.includes(task.id)
    )),
    [contextTaskIds, directContextProjectIds, openTasks],
  );
  const consoleProject = useMemo(
    () => projects.find((project) => project.id === projectConsoleId) || routeOrPrimaryProject || null,
    [projectConsoleId, projects, routeOrPrimaryProject],
  );
  const projectDocuments = useMemo(
    () => knowledgeItems.filter((item) => contextProjectIds.includes(item.projectId) && item.status !== "archived"),
    [contextProjectIds, knowledgeItems],
  );
  const todayKey = localDateKey(new Date());
  const todayTasks = useMemo(
    () =>
      openTasks
        .filter((task) => dateKey(task.dueDate) === todayKey || String(task.timeSector || "").toLowerCase() === "today")
        .sort((left, right) => String(left.priority || "z").localeCompare(String(right.priority || "z"))),
    [openTasks, todayKey],
  );
  const visibleMessages = messages.filter((message) => message.role !== "system");
  const contextualMessages = visibleMessages;
  const currentContextLabel = conversationScopeLabel(impliedConversationScope, projects, tasks);
  const filteredConversations = conversations.filter((conversation) =>
    String(conversation.title || "").toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (!activeProject) return;
    setConversationId((currentId) => {
      const current = conversations.find((conversation) => conversation.id === currentId);
      if (conversationIncludesProject(current, activeProject.id)) return currentId;
      return conversations.find((conversation) => (
        conversationProjectIds(conversation).length === 1 &&
        conversationTaskIds(conversation).length === 0 &&
        conversationIncludesProject(conversation, activeProject.id)
      ))?.id || null;
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
      setNotice("A new conversation could not be created. Check workspace access and try again.");
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
    const existing = conversations.find((conversation) => conversation.isChiefOfStaff) ||
      conversations.find((conversation) => conversationProjectIds(conversation).length === 0 && conversationTaskIds(conversation).length === 0);
    if (existing) {
      if (!existing.isChiefOfStaff || existing.conversationType !== "chief_of_staff") {
        await updateDoc(doc(db, "boldi_conversations", existing.id), {
          conversationType: "chief_of_staff",
          isChiefOfStaff: true,
          updatedAt: serverTimestamp(),
        });
        setConversations((current) => current.map((conversation) => conversation.id === existing.id
          ? { ...conversation, conversationType: "chief_of_staff", isChiefOfStaff: true, updatedAt: Date.now() }
          : conversation));
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

  const updateConversationContext = async (projectIds: string[], taskIds: string[], asChiefOfStaff = false) => {
    if (!user || !workspace) return;
    const targetId = await ensureConversation("New conversation");
    const normalizedProjects = [...new Set(projectIds)].filter(Boolean);
    const normalizedTasks = [...new Set(taskIds)].filter(Boolean);
    const derivedScopeType = conversationScopeType(normalizedProjects, normalizedTasks);
    const scopeType: ConversationScopeType = asChiefOfStaff && normalizedProjects.length === 0 && normalizedTasks.length === 0
      ? "chief_of_staff"
      : derivedScopeType;
    await updateDoc(doc(db, "boldi_conversations", targetId), {
      sourceContext: scopeType.includes("project") || scopeType === "mixed" ? "project" : scopeType.includes("task") ? "task" : "home",
      contextEntityId: normalizedProjects.length === 1 && normalizedTasks.length === 0 ? normalizedProjects[0] : null,
      conversationType: scopeType,
      linkedProjectIds: normalizedProjects,
      linkedTaskIds: normalizedTasks,
      isChiefOfStaff: scopeType === "chief_of_staff",
      updatedAt: serverTimestamp(),
    });
    setConversations((current) => current.map((conversation) => conversation.id === targetId ? {
      ...conversation,
      sourceContext: scopeType.includes("project") || scopeType === "mixed" ? "project" : scopeType.includes("task") ? "task" : "home",
      contextEntityId: normalizedProjects.length === 1 && normalizedTasks.length === 0 ? normalizedProjects[0] : null,
      conversationType: scopeType,
      linkedProjectIds: normalizedProjects,
      linkedTaskIds: normalizedTasks,
      isChiefOfStaff: scopeType === "chief_of_staff",
      updatedAt: Date.now(),
    } : conversation));
    if (normalizedProjects.length === 1 && normalizedTasks.length === 0) navigate(`/work/projects/${normalizedProjects[0]}`);
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
    setInput("");
    setActionMenuOpen(false);
    setSubmitting(true);
    setStreamed("");
    setNotice("");
    const localId = `local-${Date.now()}`;
    setMessages((current) => [...current, { id: localId, role: "user", content: text, createdAt: Date.now() }]);
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
        contextType: conversationScopeType(directContextProjectIds, contextTaskIds),
        contextEntityId: primaryProject?.id || null,
        createdAt: serverTimestamp(),
      });

      const operatingScope = isFocusedConversation ? "focused_delivery" : "chief_of_staff";
      const scopedTasks = isFocusedConversation
        ? projectTasks
        : openTasks;
      const scopedProjects = isFocusedConversation ? contextProjects : activeProjects;
      const scopedMilestones = isFocusedConversation
        ? milestones.filter((item) => contextProjectIds.includes(item.projectId))
        : milestones;
      const scopedRisks = isFocusedConversation
        ? risks.filter((item) => contextProjectIds.includes(item.projectId))
        : risks;
      const scopedTodayTasks = isFocusedConversation
        ? todayTasks.filter((task) => scopedTasks.some((scopedTask) => scopedTask.id === task.id))
        : todayTasks;
      const previousLongProjectMessage = [...contextualMessages]
        .reverse()
        .find((message) => message.role === "user" && message.content.trim().length >= 2_500);
      const projectArtifactSourceMessageId = text.length >= 2_500
        ? userMessageRef.id
        : previousLongProjectMessage?.id || userMessageRef.id;
      const workspaceSnapshot = {
        tasks: scopedTasks,
        projects: scopedProjects,
        milestones: scopedMilestones,
        risks: scopedRisks,
        goals: [],
        events: [],
        dailyCapacityMinutes: 360,
        loaded: true,
        scope: (isFocusedConversation ? "project_delivery" : "chief_of_staff") as "chief_of_staff" | "project_delivery",
        activeProjectId: primaryProject?.id || null,
      };
      const nextJudgment = evaluateJudgment(text, workspaceSnapshot);
      setJudgment(nextJudgment);
      const token = await user.getIdToken();
      const response = await fetch("/api/boldi/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          conversationId: activeConversationId,
          messages: [
            ...contextualMessages.map((message) => ({ role: message.role, content: message.content })),
            { role: "user", content: text },
          ],
          workspaceContext: {
            ...workspaceSnapshot,
            judgment: nextJudgment,
            mode: operatingScope,
            activeProject: primaryProject,
            contextProjects,
            contextTasks,
            conversationType: conversationScopeType(directContextProjectIds, contextTaskIds),
            conversationDirectory: conversations.slice(0, 30).map((conversation) => ({
              id: conversation.id,
              title: conversation.title || "New conversation",
              scope: conversationScopeLabel(conversation, projects, tasks),
              conversationType: conversation.conversationType || conversationScopeType(
                conversationProjectIds(conversation),
                conversationTaskIds(conversation),
              ),
            })),
            todayTaskCount: scopedTodayTasks.length,
            pendingReviewCount: isFocusedConversation
              ? reviewItems.filter((item) => contextProjectIds.includes(item.projectId || item.proposed?.projectId)).length
              : reviewItems.length,
            currentUserMessageId: userMessageRef.id,
            projectArtifactSourceMessageId,
            documents: isFocusedConversation ? buildProjectDocumentContext(projectDocuments, text) : [],
            userId: user.uid,
            workspaceId: workspace.id,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The AI service is temporarily unavailable.");
      const reply = result.reply || "I reviewed the workspace, but there is no response to display.";
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
          title: contextualMessages.length === 0 ? text.slice(0, 64) : currentConversation?.title || text.slice(0, 64),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      const reply = `I couldn't complete that request: ${error instanceof Error ? error.message : "the service is unavailable"}\n\nNothing was changed.`;
      await streamReply(reply);
      setMessages((current) => [
        ...current.filter((message) => message.id !== localId),
        { id: localId, role: "user", content: text, createdAt: Date.now() },
        { id: `error-${Date.now()}`, role: "assistant", content: reply, createdAt: Date.now(), offline: true },
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
      const reviewType = reviewTypeForAction(action.type);
      const projectId = action.proposedChange?.projectId || primaryProject?.id || "";
      await addDoc(collection(db, "review_candidates"), {
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        title: action.proposedChange?.title || actionLabel(action.type),
        type: reviewType,
        why: action.reason || "Proposed in conversation",
        action: actionLabel(action.type),
        confidence: Number(action.confidence || 0.8) >= 0.8 ? "high" : "medium",
        proposed: {
          ...(action.proposedChange || {}),
          projectId,
        },
        projectId,
        source: plan.summary || "DelivereeOS conversation",
        sourceType: "delivereeos",
        sourceId: planRef.id,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setNotice("Draft ready. Review it before anything changes.");
    setPanel("approvals");
  };

  const processReview = async (candidate: any, decision: "approve" | "dismiss") => {
    if (!user || !workspace) return;
    try {
      if (decision === "dismiss") {
        await updateDoc(doc(db, "review_candidates", candidate.id), {
          status: "dismissed",
          updatedAt: serverTimestamp(),
        });
        setNotice("Draft dismissed. Nothing changed.");
        return;
      }
      const proposed = candidate.proposed || {};
      const reviewType = String(candidate.type || "task");
      const projectId = proposed.projectId || candidate.projectId || primaryProject?.id || "";
      let convertedToType = reviewType;
      let convertedToId = "";

      if (["task_update", "milestone_update", "risk_update"].includes(reviewType)) {
        const targetId = String(
          proposed.taskId || proposed.milestoneId || proposed.riskId || proposed.id || "",
        );
        const collectionName = reviewType === "task_update"
          ? "tasks"
          : reviewType === "milestone_update" ? "milestones" : "boldr_risks";
        const allowedFields = reviewType === "task_update"
          ? ["title", "description", "status", "priority", "dueDate", "owner", "projectId", "timeSector", "definitionOfDone"]
          : reviewType === "milestone_update"
            ? ["title", "description", "status", "dueDate", "targetDate", "owner", "projectId"]
            : ["title", "description", "status", "severity", "owner", "mitigation", "projectId", "type"];
        if (!targetId) throw new Error("The item to update is required");
        const patch = Object.fromEntries(
          allowedFields.filter((field) => proposed[field] !== undefined).map((field) => [field, proposed[field]]),
        );
        await updateDoc(doc(db, collectionName, targetId), { ...patch, updatedAt: serverTimestamp() });
        convertedToType = collectionName;
        convertedToId = targetId;
      } else if (reviewType === "conversation_message") {
        const targetConversationId = String(proposed.targetConversationId || "");
        const targetConversation = conversations.find((conversation) => conversation.id === targetConversationId);
        const content = String(proposed.content || proposed.message || proposed.summary || "").trim();
        if (!targetConversation || !content) throw new Error("A valid target conversation and message are required");
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
        await updateDoc(doc(db, "boldi_conversations", targetConversationId), { updatedAt: serverTimestamp() });
        convertedToType = "conversation";
        convertedToId = targetConversationId;
      } else if (reviewType === "project_update") {
        if (!projectId) throw new Error("Project context is required");
        const allowedFields = [
          "title", "outcome", "objective", "description", "status", "methodology", "targetDate",
          "dueDate", "priority", "projectType", "category", "health", "sprintGoal", "projectManager",
          "sponsor", "teamMembers", "definitionOfDone",
        ];
        const patch = Object.fromEntries(
          allowedFields.filter((field) => proposed[field] !== undefined).map((field) => [field, proposed[field]]),
        );
        await updateDoc(doc(db, "projects", projectId), { ...patch, updatedAt: serverTimestamp() });
        convertedToType = "project";
        convertedToId = projectId;
      } else {
        let collectionName = "tasks";
        let payload: Record<string, unknown> = {
          ...proposed,
          userId: user.uid,
          workspaceId: workspace.id,
          projectId,
          title: candidate.title || proposed.title || "Untitled",
          status: proposed.status || "open",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (reviewType === "project") {
          collectionName = "projects";
          payload = { ...payload, status: proposed.status || "planning" };
          delete payload.projectId;
        } else if (reviewType === "milestone") {
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
            const sourceMessage = await getDoc(doc(db, "boldi_messages", String(proposed.sourceMessageId)));
            if (sourceMessage.exists()) sourceContent = String(sourceMessage.data().content || sourceContent);
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
      setNotice(`${reviewTypeLabel(reviewType)} ${reviewType === "project_update" ? "updated" : "created"}.`);
    } catch {
      setNotice("That draft could not be processed. It is still waiting for you.");
    }
  };

  const setComposer = (value: string) => {
    setInput(value);
    setPanel(null);
    setActionMenuOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const selectProjectContext = (project: any) => {
    const projectConversation = conversations.find((conversation) => (
      conversationProjectIds(conversation).length === 1 &&
      conversationTaskIds(conversation).length === 0 &&
      conversationIncludesProject(conversation, project.id)
    ));
    setConversationId(projectConversation?.id || null);
    navigate(`/work/projects/${project.id}`);
    setPanel(null);
    setSidebarOpen(false);
  };

  const openProjectRecord = (project: any) => {
    selectProjectContext(project);
    setCommandCenterOpen(false);
    setProjectConsoleId(project.id);
    setPanel("project");
  };

  const updateProject = async (projectId: string, patch: Record<string, unknown>) => {
    await updateDoc(doc(db, "projects", projectId), { ...patch, updatedAt: serverTimestamp() });
  };

  const archiveProject = async (project: any) => {
    await updateProject(project.id, { status: "archived", archivedAt: serverTimestamp() });
    if (projectConsoleId === project.id) {
      setProjectConsoleId(null);
      setPanel(null);
    }
    if (activeProject?.id === project.id) navigate("/");
    setNotice(`${entityTitle(project)} archived. Its history is preserved.`);
  };

  const addProjectTask = async (projectId: string, title: string, status: WorkLane, patch: Record<string, unknown> = {}) => {
    if (!user || !workspace) return;
    await addDoc(collection(db, "tasks"), {
      ...patch,
      userId: user.uid,
      workspaceId: workspace.id,
      projectId,
      title,
      status,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const updateProjectTask = async (taskId: string, patch: Record<string, unknown>) => {
    await updateDoc(doc(db, "tasks", taskId), { ...patch, updatedAt: serverTimestamp() });
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

  const addProjectRisk = async (projectId: string, title: string) => {
    if (!user || !workspace) return;
    await addDoc(collection(db, "boldr_risks"), {
      userId: user.uid,
      workspaceId: workspace.id,
      projectId,
      title,
      type: "project_risk",
      severity: "medium",
      status: "open",
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
    <div className="do-shell">
      <button
        aria-label="Close navigation"
        className={`do-scrim ${sidebarOpen || panel ? "is-open" : ""}`}
        onClick={() => {
          setSidebarOpen(false);
          setPanel(null);
        }}
        type="button"
      />

      <aside className={`do-sidebar ${sidebarOpen ? "is-open" : ""}`} data-testid="primary-sidebar">
        <div className="do-brand-row">
          <button className="do-brand" onClick={() => { navigate("/"); setSidebarOpen(false); }} type="button">
            <span className="do-logo">D</span>
            <span><strong>DelivereeOS</strong><small>Think. Choose. Move.</small></span>
          </button>
          <button aria-label="Close navigation" className="do-mobile-close" onClick={() => setSidebarOpen(false)} type="button"><X size={16} /></button>
        </div>

        <button className="do-new-conversation" data-testid="new-conversation" disabled={creatingConversation} onClick={createConversation} type="button">
          {creatingConversation ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
          {creatingConversation ? "Starting…" : "New conversation"}
          <kbd>⌘K</kbd>
        </button>

        <button className="do-chief-conversation" onClick={openChiefOfStaff} type="button">
          <span><Sparkles size={14} /></span>
          <div><strong>Chief of Staff</strong><small>Coordinate across all work</small></div>
          <ChevronRight size={13} />
        </button>

        <div className="do-sidebar-scroll">
          <div className="do-sidebar-section">
            <div className="do-section-head">
              <span>Projects</span>
              <button aria-label="Open project command center" onClick={() => { setCommandCenterOpen(true); setSidebarOpen(false); }} type="button">Command center</button>
            </div>
            <div className="do-project-list">
              {sidebarProjects.favorites.length > 0 && <span className="do-project-group-label"><Star size={10} /> Favorites</span>}
              {sidebarProjects.favorites.map((project) => (
                <div className={`do-project-row ${activeProject?.id === project.id ? "is-active" : ""}`} key={project.id}>
                  <button className="do-project-context" onClick={() => selectProjectContext(project)} type="button"><Star fill="currentColor" size={12} /><span>{entityTitle(project)}</span><small>{openTasks.filter((task) => task.projectId === project.id).length || ""}</small></button>
                  <button className="do-project-open" data-testid={`open-project-${project.id}`} onClick={() => openProjectRecord(project)} type="button">Open</button>
                </div>
              ))}
              {sidebarProjects.recent.length > 0 && <span className="do-project-group-label">Recent</span>}
              {sidebarProjects.recent.map((project) => (
                <div className={`do-project-row ${activeProject?.id === project.id ? "is-active" : ""}`} key={project.id}>
                  <button className="do-project-context" onClick={() => selectProjectContext(project)} type="button"><Folder size={12} /><span>{entityTitle(project)}</span><small>{openTasks.filter((task) => task.projectId === project.id).length || ""}</small></button>
                  <button className="do-project-open" data-testid={`open-project-${project.id}`} onClick={() => openProjectRecord(project)} type="button">Open</button>
                </div>
              ))}
              {activeProjects.length === 0 && (
                <button className="do-empty-link" onClick={() => setComposer("Help me create a project for ")} type="button">Create your first project</button>
              )}
            </div>
          </div>

          <div className="do-sidebar-section do-conversations">
            <div className="do-section-head">
              <span>Conversations</span>
              <button aria-label="Search conversations" onClick={() => setSearchOpen((open) => !open)} type="button"><Search size={13} /></button>
            </div>
            {searchOpen && <input aria-label="Search conversations" autoFocus onChange={(event) => setSearch(event.target.value)} placeholder="Search" value={search} />}
            {filteredConversations.slice(0, chatsExpanded || search.trim() ? 50 : 5).map((conversation) => (
              <button
                className={conversation.id === conversationId ? "is-active" : ""}
                key={conversation.id}
                onClick={() => {
                  setConversationId(conversation.id);
                  const projectIds = conversationProjectIds(conversation);
                  const taskIds = conversationTaskIds(conversation);
                  navigate(projectIds.length === 1 && taskIds.length === 0 ? `/work/projects/${projectIds[0]}` : "/");
                  setSidebarOpen(false);
                }}
                type="button"
              >
                {conversationProjectIds(conversation).length > 0
                  ? <Folder size={13} />
                  : conversationTaskIds(conversation).length > 0
                    ? <ListTodo size={13} />
                    : conversation.isChiefOfStaff ? <Sparkles size={13} /> : <MessageSquare size={13} />}
                <span>{conversation.title || "New conversation"}</span>
                <small>{conversationScopeLabel(conversation, projects, tasks)} · {timeAgo(conversation.updatedAt || conversation.createdAt)}</small>
              </button>
            ))}
            {!search.trim() && filteredConversations.length > 5 && (
              <button className="do-expand-chats" onClick={() => setChatsExpanded((expanded) => !expanded)} type="button"><ChevronDown className={chatsExpanded ? "is-up" : ""} size={13} /><span>{chatsExpanded ? "Show less" : `Show ${filteredConversations.length - 5} more`}</span></button>
            )}
          </div>
        </div>

        <div className="do-account">
          <button onClick={() => setWorkspaceOpen((open) => !open)} type="button">
            <span className="do-avatar">{initials(user?.displayName, user?.email)}</span>
            <span><strong>{workspace?.name || "Workspace"}</strong><small>{user?.email}</small></span>
            <MoreHorizontal size={15} />
          </button>
          {workspaceOpen && (
            <div className="do-account-menu">
              {workspaces.length > 1 && workspaces.map((item) => <button key={item.id} onClick={() => setWorkspace(item)} type="button">{item.name}</button>)}
              <button onClick={() => { navigate("/settings"); setWorkspaceOpen(false); }} type="button"><Settings size={14} /> Settings</button>
              <button onClick={logOut} type="button">Sign out</button>
            </div>
          )}
        </div>
      </aside>

      <main className="do-main">
        <header className="do-header">
          <button aria-label="Open navigation" className="do-icon-button do-menu-button" onClick={() => setSidebarOpen(true)} type="button"><Menu size={18} /></button>
          <button className="do-context-title" onClick={() => setPanel("projects")} type="button">
            <span>{currentContextLabel}</span><ChevronRight size={13} />
          </button>
          <div className="do-header-actions">
            {routeOrPrimaryProject && (
              <button
                className={`do-header-button ${panel === "project" ? "is-active" : ""}`}
                onClick={() => {
                  setProjectConsoleId(routeOrPrimaryProject.id);
                  setPanel(panel === "project" ? null : "project");
                }}
                type="button"
              >
                <Folder size={15} /><span>Project console</span>
              </button>
            )}
            <button className="do-header-button" onClick={() => setPanel("today")} type="button"><ListTodo size={15} /><span>Today</span>{todayTasks.length > 0 && <small>{todayTasks.length}</small>}</button>
            <button className="do-header-button" onClick={() => setPanel("approvals")} type="button"><ShieldCheck size={15} /><span>Drafts</span>{reviewItems.length > 0 && <small className="is-attention">{reviewItems.length}</small>}</button>
          </div>
        </header>

        {notice && <div className="do-notice" role="status"><CheckCircle2 size={15} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")} type="button"><X size={14} /></button></div>}

        <div className="do-thread-viewport">
          <div className="do-thread">
            {contextualMessages.length === 0 && !submitting ? (
              <section className="do-opening">
                <div className="do-welcome">
                  <span className="do-orb"><Sparkles size={21} /></span>
                  {isFocusedConversation && <span className="do-context-eyebrow">FOCUSED · {currentContextLabel}</span>}
                  <h1>{isFocusedConversation ? "What should move next?" : `What matters now, ${displayName(user?.displayName, user?.email)}?`}</h1>
                  <p>{routeOrPrimaryProject ? routeOrPrimaryProject.outcome || routeOrPrimaryProject.description || `${projectTasks.length} open tasks in this context.` : isFocusedConversation ? `${projectTasks.length} open items are connected to this conversation.` : "Capture anything. Make a plan. Finish the right work."}</p>
                </div>

                {!isFocusedConversation && (
                  <button className="do-daily-pulse" onClick={() => sendMessage("Give me a realistic plan for today using my current work.")} type="button">
                    <span><CalendarDays size={15} /> Today</span>
                    <strong>{todayTasks.length ? `${todayTasks.length} tasks need attention` : "Your day is open"}</strong>
                    <ChevronRight size={15} />
                  </button>
                )}

                {isFocusedConversation && (
                  <div className="do-project-pulse">
                    <span>{projectTasks.length} open in context</span>
                    <span>{currentContextLabel}</span>
                    {routeOrPrimaryProject && <button onClick={() => openProjectRecord(routeOrPrimaryProject)} type="button">Project console</button>}
                  </div>
                )}

                <div className="do-prompt-list">
                  {openingPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)} type="button"><span>{prompt}</span><ArrowUp size={14} /></button>)}
                </div>
              </section>
            ) : (
              <>
                {isFocusedConversation && (
                  <div className="do-inline-context">
                    {directContextProjectIds.length > 0 ? <Folder size={12} /> : <ListTodo size={12} />}
                    <strong>{currentContextLabel}</strong>
                    <span>{projectTasks.length} open</span>
                    <button aria-label="Edit conversation context" onClick={() => setPanel("projects")} type="button"><ChevronDown size={12} /></button>
                  </div>
                )}
                {contextualMessages.map((message) => (
                  <article className={`do-message is-${message.role}`} key={message.id}>
                    {message.role === "user" ? <UserMessage text={message.content} /> : (
                      <div className="do-assistant-message">
                        <div className="do-assistant-mark"><Bot size={16} /></div>
                        <div className="do-assistant-content">
                          <div className="do-assistant-name">DelivereeOS {message.offline && <span>safe mode</span>}</div>
                          <RichText text={message.content} />
                          {message.citations && message.citations.length > 0 && <div className="do-citations">{message.citations.map((citation) => <span key={`${citation.type}-${citation.id}`}>{citation.title}</span>)}</div>}
                          <ActionProposal message={message} onStage={stagePlan} />
                          {message.suggestedChips && <div className="do-chips">{message.suggestedChips.map((chip) => <button key={chip} onClick={() => sendMessage(chip)} type="button">{chip}</button>)}</div>}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
                {(submitting || streamed) && (
                  <article className="do-message is-assistant">
                    <div className="do-assistant-message">
                      <div className="do-assistant-mark"><Bot size={16} /></div>
                      <div className="do-assistant-content">{streamed ? <RichText text={streamed} /> : <div className="do-thinking"><span /><span /><span /></div>}</div>
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
              <button onClick={() => setComposer("Capture this as a task: ")} type="button"><Inbox size={15} /><span><strong>Capture</strong><small>Turn a thought into a clear task</small></span></button>
              <button onClick={() => sendMessage("Plan my day realistically using the 2 must-dos and up to 8 should-dos method.")} type="button"><CalendarDays size={15} /><span><strong>Plan today</strong><small>Choose work that fits the day</small></span></button>
              <button onClick={() => setComposer("Help me create a project for ")} type="button"><Folder size={15} /><span><strong>New project</strong><small>Define the outcome and first step</small></span></button>
            </div>
          )}
          {isFocusedConversation && <div className="do-composer-context">{directContextProjectIds.length > 0 ? <Folder size={12} /> : <ListTodo size={12} />}<span>{currentContextLabel}</span><button aria-label="Edit conversation context" onClick={() => setPanel("projects")} type="button"><ChevronDown size={12} /></button></div>}
          <div className="do-composer">
            <textarea
              aria-label="Message DelivereeOS"
              data-testid="message-composer"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={isFocusedConversation ? `Ask about ${currentContextLabel}…` : "Ask, capture, or plan…"}
              ref={composerRef}
              rows={1}
              value={input}
            />
            <div className="do-composer-foot">
              <div>
                <button aria-label="Open quick actions" className={actionMenuOpen ? "is-active" : ""} onClick={() => setActionMenuOpen((open) => !open)} type="button"><Plus size={16} /></button>
                {voiceSupported && <button aria-label={isListening ? "Stop listening" : "Start voice input"} className={isListening ? "is-listening" : ""} onClick={() => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start()} type="button">{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button>}
              </div>
              <button aria-label="Send message" className="do-send" disabled={!input.trim() || submitting} onClick={() => sendMessage()} type="button">{submitting ? <Loader2 className="spin" size={16} /> : <ArrowUp size={17} />}</button>
            </div>
          </div>
          <p className="do-composer-note">You stay in control. Suggested changes remain drafts until approved.</p>
        </div>
      </main>

      <aside className={`do-panel ${panel ? "is-open" : ""} ${panel === "project" ? "is-project-console" : ""}`} aria-hidden={!panel}>
        <div className="do-panel-head">
          <div>
            <span>{panel === "today" ? "FOCUS" : panel === "projects" ? "CONTEXT" : panel === "project" ? "PROJECT" : "CONTROL"}</span>
            <h2>{panel === "today" ? "Today" : panel === "projects" ? "Conversation context" : panel === "project" ? "Project console" : "Drafts"}</h2>
          </div>
          <button aria-label="Close panel" onClick={() => setPanel(null)} type="button"><X size={17} /></button>
        </div>

        <div className="do-panel-body">
          {panel === "project" && (
            consoleProject ? (
              <ProjectConsolePanel
                documents={knowledgeItems.filter((item) => item.projectId === consoleProject.id && item.status !== "archived")}
                milestones={milestones.filter((item) => item.projectId === consoleProject.id)}
                onAddMilestone={(title) => addProjectMilestone(consoleProject.id, title)}
                onAddRisk={(title) => addProjectRisk(consoleProject.id, title)}
                onAddTask={(title, status, patch) => addProjectTask(consoleProject.id, title, status, patch)}
                onArchiveProject={archiveProject}
                onAsk={setComposer}
                onUpdateProject={updateProject}
                onUpdateTask={updateProjectTask}
                project={consoleProject}
                risks={risks.filter((item) => item.projectId === consoleProject.id)}
                tasks={tasks.filter((item) => item.projectId === consoleProject.id)}
              />
            ) : (
              <div className="do-panel-empty"><Folder size={20} /><strong>No project selected.</strong><span>Choose a project from the sidebar, then open its console.</span></div>
            )
          )}

          {panel === "today" && (
            <>
              <p className="do-panel-intro">Only the work that may need your attention now.</p>
              <div className="do-panel-list">
                {(isFocusedConversation ? projectTasks : todayTasks).slice(0, 10).map((task) => (
                  <button key={task.id} onClick={() => setComposer(`Help me move this task forward: ${entityTitle(task)}`)} type="button">
                    <Circle size={13} />
                    <span><strong>{entityTitle(task)}</strong><small>{priorityLabel(task.priority)}{task.projectId ? ` · ${entityTitle(projects.find((project) => project.id === task.projectId))}` : ""}</small></span>
                    <ChevronRight size={13} />
                  </button>
                ))}
                {(isFocusedConversation ? projectTasks : todayTasks).length === 0 && <div className="do-panel-empty"><CheckCircle2 size={20} /><strong>Nothing urgent here.</strong><span>Use the conversation to decide what deserves focus.</span></div>}
              </div>
              <button className="do-panel-primary" onClick={() => sendMessage("Plan my day realistically using my current work and available capacity.")} type="button"><Sparkles size={15} /> Plan with DelivereeOS</button>
            </>
          )}

          {panel === "projects" && (
            <>
              <p className="do-panel-intro">A conversation can stay general or focus on one or several projects and tasks.</p>
              <div className="do-panel-list do-context-options">
                <button className={!isFocusedConversation ? "is-selected" : ""} onClick={() => updateConversationContext([], [], true)} type="button">
                  <Sparkles size={14} /><span><strong>Chief of Staff · general</strong><small>Coordinate and manage anything in the workspace</small></span>{!isFocusedConversation ? <Check size={13} /> : <ChevronRight size={13} />}
                </button>
                <span className="do-context-section-label">Projects</span>
                {activeProjects.map((project) => {
                  const count = openTasks.filter((task) => task.projectId === project.id).length;
                  const selected = directContextProjectIds.includes(project.id);
                  return <button className={selected ? "is-selected" : ""} key={project.id} onClick={() => updateConversationContext(selected ? directContextProjectIds.filter((id) => id !== project.id) : [...directContextProjectIds, project.id], contextTaskIds)} type="button"><Folder size={14} /><span><strong>{entityTitle(project)}</strong><small>{count} open task{count === 1 ? "" : "s"}</small></span>{selected ? <Check size={13} /> : <Plus size={13} />}</button>;
                })}
                <span className="do-context-section-label">Tasks</span>
                <input aria-label="Find tasks for this conversation" onChange={(event) => setContextTaskSearch(event.target.value)} placeholder="Find a task" value={contextTaskSearch} />
                {openTasks
                  .filter((task) => !contextTaskSearch.trim() || `${entityTitle(task)} ${entityTitle(projects.find((project) => project.id === task.projectId))}`.toLowerCase().includes(contextTaskSearch.toLowerCase()))
                  .sort((left, right) => Number(contextTaskIds.includes(right.id)) - Number(contextTaskIds.includes(left.id)))
                  .slice(0, 15)
                  .map((task) => {
                    const selected = contextTaskIds.includes(task.id);
                    return <button className={selected ? "is-selected" : ""} key={task.id} onClick={() => updateConversationContext(directContextProjectIds, selected ? contextTaskIds.filter((id) => id !== task.id) : [...contextTaskIds, task.id])} type="button"><ListTodo size={14} /><span><strong>{entityTitle(task)}</strong><small>{task.projectId ? entityTitle(projects.find((project) => project.id === task.projectId)) : "No project"}</small></span>{selected ? <Check size={13} /> : <Plus size={13} />}</button>;
                  })}
              </div>
              {routeOrPrimaryProject && <button className="do-panel-primary" onClick={() => openProjectRecord(routeOrPrimaryProject)} type="button"><Folder size={15} /> Open project console</button>}
              <button className="do-panel-primary" onClick={() => setPanel(null)} type="button"><Check size={15} /> Done</button>
              <button className="do-panel-secondary" onClick={() => { setPanel(null); setCommandCenterOpen(true); }} type="button">Project command center</button>
            </>
          )}

          {panel === "approvals" && (
            <>
              <p className="do-panel-intro">Nothing enters your workspace until you say so.</p>
              <div className="do-approval-list">
                {reviewItems.map((item) => (
                  <div className="do-approval-item" key={item.id}>
                    <span className="do-kicker">{item.type || "change"}</span>
                    <strong>{item.title}</strong>
                    <p>{item.why || item.action || "Proposed in conversation"}</p>
                    <div>
                      <button onClick={() => processReview(item, "dismiss")} type="button">Dismiss</button>
                      <button onClick={() => processReview(item, "approve")} type="button"><Check size={13} /> Approve</button>
                    </div>
                  </div>
                ))}
                {reviewItems.length === 0 && <div className="do-panel-empty"><CheckCircle2 size={20} /><strong>No drafts waiting.</strong><span>New suggestions will appear here before they change your workspace.</span></div>}
              </div>
            </>
          )}
        </div>

        {judgment && panel === "today" && judgment.signals.length > 0 && (
          <div className="do-panel-judgment"><ShieldCheck size={15} /><span><strong>{judgment.verdict === "stop" ? "A conflict needs attention" : "A planning signal"}</strong><small>{judgment.signals[0].detail}</small></span></div>
        )}
      </aside>

      {commandCenterOpen && (
        <ProjectCommandCenter
          onArchiveProject={archiveProject}
          onClose={() => setCommandCenterOpen(false)}
          onOpenProject={openProjectRecord}
          onUpdateProject={updateProject}
          projects={projects}
          risks={risks}
          tasks={tasks}
        />
      )}

    </div>
  );
}
