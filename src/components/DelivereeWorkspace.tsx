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
import { ProjectCommandCenter, ProjectRecordModal } from "./ProjectSurfaces";

type Conversation = {
  id: string;
  title?: string;
  contextEntityId?: string | null;
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

type Panel = "today" | "projects" | "approvals" | null;

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
  const [chatsExpanded, setChatsExpanded] = useState(false);
  const [projectModalId, setProjectModalId] = useState<string | null>(null);
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
  const projectTasks = useMemo(
    () => (activeProject ? openTasks.filter((task) => task.projectId === activeProject.id) : []),
    [activeProject, openTasks],
  );
  const modalProject = useMemo(
    () => projects.find((project) => project.id === projectModalId) || null,
    [projectModalId, projects],
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
  const currentConversation = conversations.find((conversation) => conversation.id === conversationId);
  const conversationInContext = activeProject
    ? currentConversation?.contextEntityId === activeProject.id
    : !currentConversation?.contextEntityId;
  const contextualMessages = conversationInContext ? visibleMessages : [];
  const filteredConversations = conversations.filter((conversation) =>
    String(conversation.title || "").toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    const targetEntityId = activeProject?.id || null;
    setConversationId((currentId) => {
      const current = conversations.find((conversation) => conversation.id === currentId);
      if ((current?.contextEntityId || null) === targetEntityId) return currentId;
      return conversations.find((conversation) => (conversation.contextEntityId || null) === targetEntityId)?.id || currentId;
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
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setConversations((current) => [
        {
          id: ref.id,
          title: "New conversation",
          contextEntityId: activeProject?.id || null,
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
    if (conversationId && conversationInContext) return conversationId;
    if (!user || !workspace) throw new Error("Workspace is still loading");
    const ref = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: title.slice(0, 64) || "New conversation",
      status: "active",
      sourceContext: activeProject ? "project" : "home",
      contextEntityId: activeProject?.id || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    return ref.id;
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
      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        role: "user",
        content: text,
        inputType: "text",
        contextType: activeProject ? "project" : "home",
        contextEntityId: activeProject?.id || null,
        createdAt: serverTimestamp(),
      });

      const workspaceSnapshot = {
        tasks: openTasks,
        projects: activeProjects,
        goals: [],
        events: [],
        dailyCapacityMinutes: 360,
        loaded: true,
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
            mode: "conversational_productivity",
            activeProject,
            todayTaskCount: todayTasks.length,
            pendingReviewCount: reviewItems.length,
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
          contextEntityId: activeProject?.id || null,
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
      contextEntityId: activeProject?.id || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    for (const action of plan.proposedActions || []) {
      await addDoc(collection(db, "review_candidates"), {
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        title: action.proposedChange?.title || actionLabel(action.type),
        type: action.type === "create_project" ? "project" : "task",
        why: action.reason || "Proposed in conversation",
        action: actionLabel(action.type),
        confidence: Number(action.confidence || 0.8) >= 0.8 ? "high" : "medium",
        proposed: {
          ...(action.proposedChange || {}),
          projectId: action.proposedChange?.projectId || activeProject?.id || "",
        },
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
      const collectionName = candidate.type === "project" ? "projects" : "tasks";
      const created = await addDoc(collection(db, collectionName), {
        ...proposed,
        userId: user.uid,
        workspaceId: workspace.id,
        title: candidate.title || proposed.title || "Untitled",
        status: proposed.status || (candidate.type === "project" ? "planning" : "open"),
        ...(candidate.type === "project" ? {} : { projectId: proposed.projectId || activeProject?.id || "" }),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "review_candidates", candidate.id), {
        status: "approved",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        convertedToType: candidate.type === "project" ? "project" : "task",
        convertedToId: created.id,
        updatedAt: serverTimestamp(),
      });
      setNotice(`${candidate.type === "project" ? "Project" : "Task"} created.`);
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
    navigate(`/work/projects/${project.id}`);
    setPanel(null);
    setSidebarOpen(false);
  };

  const openProjectRecord = (project: any) => {
    selectProjectContext(project);
    setCommandCenterOpen(false);
    setProjectModalId(project.id);
  };

  const updateProject = async (projectId: string, patch: Record<string, unknown>) => {
    await updateDoc(doc(db, "projects", projectId), { ...patch, updatedAt: serverTimestamp() });
  };

  const archiveProject = async (project: any) => {
    await updateProject(project.id, { status: "archived", archivedAt: serverTimestamp() });
    if (projectModalId === project.id) setProjectModalId(null);
    if (activeProject?.id === project.id) navigate("/");
    setNotice(`${entityTitle(project)} archived. Its history is preserved.`);
  };

  const addProjectTask = async (projectId: string, title: string, status: WorkLane) => {
    if (!user || !workspace) return;
    await addDoc(collection(db, "tasks"), {
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

  const openingPrompts = activeProject
    ? [
        `What needs attention in ${entityTitle(activeProject)}?`,
        `Turn the next step for ${entityTitle(activeProject)} into a clear task.`,
        `Give me a short, honest project update.`,
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
                className={conversation.id === conversationId && conversationInContext ? "is-active" : ""}
                key={conversation.id}
                onClick={() => {
                  setConversationId(conversation.id);
                  navigate(conversation.contextEntityId ? `/work/projects/${conversation.contextEntityId}` : "/");
                  setSidebarOpen(false);
                }}
                type="button"
              >
                <MessageSquare size={13} />
                <span>{conversation.title || "New conversation"}</span>
                <small>{timeAgo(conversation.updatedAt || conversation.createdAt)}</small>
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
            <span>{activeProject ? entityTitle(activeProject) : "All work"}</span><ChevronRight size={13} />
          </button>
          <div className="do-header-actions">
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
                  {activeProject && <span className="do-context-eyebrow">PROJECT · {entityTitle(activeProject)}</span>}
                  <h1>{activeProject ? `What should move next?` : `What matters now, ${displayName(user?.displayName, user?.email)}?`}</h1>
                  <p>{activeProject ? activeProject.outcome || activeProject.description || `${projectTasks.length} open tasks in this project.` : "Capture anything. Make a plan. Finish the right work."}</p>
                </div>

                {!activeProject && (
                  <button className="do-daily-pulse" onClick={() => sendMessage("Give me a realistic plan for today using my current work.")} type="button">
                    <span><CalendarDays size={15} /> Today</span>
                    <strong>{todayTasks.length ? `${todayTasks.length} tasks need attention` : "Your day is open"}</strong>
                    <ChevronRight size={15} />
                  </button>
                )}

                {activeProject && (
                  <div className="do-project-pulse">
                    <span>{projectTasks.length} open tasks</span>
                    <span>{activeProject.status || "Active"}</span>
                    <button onClick={() => openProjectRecord(activeProject)} type="button">Open project</button>
                  </div>
                )}

                <div className="do-prompt-list">
                  {openingPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)} type="button"><span>{prompt}</span><ArrowUp size={14} /></button>)}
                </div>
              </section>
            ) : (
              <>
                {activeProject && (
                  <div className="do-inline-context">
                    <Folder size={12} />
                    <strong>{entityTitle(activeProject)}</strong>
                    <span>{projectTasks.length} open</span>
                    <button aria-label="Clear project context" onClick={() => navigate("/")} type="button"><X size={12} /></button>
                  </div>
                )}
                {contextualMessages.map((message) => (
                  <article className={`do-message is-${message.role}`} key={message.id}>
                    {message.role === "user" ? <div className="do-user-message">{message.content}</div> : (
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
          {activeProject && <div className="do-composer-context"><Folder size={12} /><span>{entityTitle(activeProject)}</span><button aria-label="Clear project context" onClick={() => navigate("/")} type="button"><X size={12} /></button></div>}
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
              placeholder={activeProject ? `Ask about ${entityTitle(activeProject)}…` : "Ask, capture, or plan…"}
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

      <aside className={`do-panel ${panel ? "is-open" : ""}`} aria-hidden={!panel}>
        <div className="do-panel-head">
          <div>
            <span>{panel === "today" ? "FOCUS" : panel === "projects" ? "CONTEXT" : "CONTROL"}</span>
            <h2>{panel === "today" ? "Today" : panel === "projects" ? "Projects" : "Drafts"}</h2>
          </div>
          <button aria-label="Close panel" onClick={() => setPanel(null)} type="button"><X size={17} /></button>
        </div>

        <div className="do-panel-body">
          {panel === "today" && (
            <>
              <p className="do-panel-intro">Only the work that may need your attention now.</p>
              <div className="do-panel-list">
                {(activeProject ? projectTasks : todayTasks).slice(0, 10).map((task) => (
                  <button key={task.id} onClick={() => setComposer(`Help me move this task forward: ${entityTitle(task)}`)} type="button">
                    <Circle size={13} />
                    <span><strong>{entityTitle(task)}</strong><small>{priorityLabel(task.priority)}{task.projectId ? ` · ${entityTitle(projects.find((project) => project.id === task.projectId))}` : ""}</small></span>
                    <ChevronRight size={13} />
                  </button>
                ))}
                {(activeProject ? projectTasks : todayTasks).length === 0 && <div className="do-panel-empty"><CheckCircle2 size={20} /><strong>Nothing urgent here.</strong><span>Use the conversation to decide what deserves focus.</span></div>}
              </div>
              <button className="do-panel-primary" onClick={() => sendMessage("Plan my day realistically using my current work and available capacity.")} type="button"><Sparkles size={15} /> Plan with DelivereeOS</button>
            </>
          )}

          {panel === "projects" && (
            <>
              <p className="do-panel-intro">Choose a project to give the conversation its context.</p>
              <div className="do-panel-list">
                <button className={!activeProject ? "is-selected" : ""} onClick={() => { navigate("/"); setPanel(null); }} type="button">
                  <Sparkles size={14} /><span><strong>All work</strong><small>Think across your workspace</small></span><ChevronRight size={13} />
                </button>
                {activeProjects.map((project) => {
                  const count = openTasks.filter((task) => task.projectId === project.id).length;
                  return <button className={activeProject?.id === project.id ? "is-selected" : ""} key={project.id} onClick={() => selectProjectContext(project)} type="button"><Folder size={14} /><span><strong>{entityTitle(project)}</strong><small>{count} open task{count === 1 ? "" : "s"} · select chat context</small></span><ChevronRight size={13} /></button>;
                })}
              </div>
              {activeProject && <button className="do-panel-primary" onClick={() => openProjectRecord(activeProject)} type="button"><Folder size={15} /> Open project record</button>}
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

      {modalProject && (
        <ProjectRecordModal
          key={modalProject.id}
          milestones={milestones.filter((item) => item.projectId === modalProject.id)}
          onAddMilestone={(title) => addProjectMilestone(modalProject.id, title)}
          onAddRisk={(title) => addProjectRisk(modalProject.id, title)}
          onAddTask={(title, status) => addProjectTask(modalProject.id, title, status)}
          onArchiveProject={archiveProject}
          onAsk={setComposer}
          onClose={() => setProjectModalId(null)}
          onUpdateProject={updateProject}
          onUpdateTask={updateProjectTask}
          project={modalProject}
          risks={risks.filter((item) => item.projectId === modalProject.id)}
          tasks={tasks.filter((item) => item.projectId === modalProject.id)}
        />
      )}
    </div>
  );
}
