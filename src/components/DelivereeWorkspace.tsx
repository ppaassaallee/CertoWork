import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Command,
  FolderKanban,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  MoreHorizontal,
  PanelRight,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
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
import {
  actionLabel,
  normalizeDeliveryStage,
  projectHealth,
  resolveDelivereeLens,
} from "../lib/delivereeRoutes";

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

const STAGES = ["idea", "assessment", "approved", "planning", "delivery", "uat", "production", "support"];

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

function titleCase(value?: string) {
  return String(value || "assessment")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entityTitle(entity: any) {
  return entity?.title || entity?.name || "Untitled";
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

function StatusDot({ health }: { health: string }) {
  return <span className={`do-status-dot is-${health}`} aria-label={health.replace(/_/g, " ")} />;
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
          <span className="do-kicker">Proposed change</span>
          <h3>{plan.title || "Review the proposed work"}</h3>
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
        <span>Nothing executes until it is approved in Review.</span>
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
          {status === "saving" ? <Loader2 className="spin" size={14} /> : status === "done" ? <Check size={14} /> : <ShieldCheck size={14} />}
          {status === "done" ? "Sent to Review" : "Review changes"}
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
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [judgment, setJudgment] = useState<JudgmentAssessment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [notice, setNotice] = useState("");
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
      makeQuery("boldi_conversations", (items) => {
        const sorted = items.sort((a, b) => timestamp(b.updatedAt || b.createdAt) - timestamp(a.updatedAt || a.createdAt));
        setConversations(sorted);
        setConversationId((current) => current || sorted[0]?.id || null);
      }, true),
      makeQuery("projects", setProjects),
      makeQuery("tasks", setTasks),
      makeQuery("review_candidates", (items) => setReviewItems(items.filter((item) => ["pending", "approved_for_review"].includes(item.status)))),
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
            .sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt)),
        ),
      () => setMessages([]),
    );
  }, [conversationId, user, workspace]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamed, submitting]);

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

  const activeProject = useMemo(
    () => (lens.kind === "project" ? projects.find((project) => project.id === lens.projectId) : null),
    [lens, projects],
  );
  const activeProjects = useMemo(
    () => projects.filter((project) => !["done", "completed", "closed", "archived"].includes(String(project.status || "").toLowerCase())),
    [projects],
  );
  const openTasks = useMemo(
    () => tasks.filter((task) => !["done", "completed", "closed", "archived"].includes(String(task.status || "").toLowerCase())),
    [tasks],
  );
  const projectTasks = useMemo(
    () => (activeProject ? openTasks.filter((task) => task.projectId === activeProject.id) : []),
    [activeProject, openTasks],
  );
  const visibleMessages = messages.filter((message) => message.role !== "system");
  const filteredConversations = conversations.filter((conversation) =>
    String(conversation.title || "").toLowerCase().includes(search.toLowerCase()),
  );

  const contextTitle = activeProject
    ? entityTitle(activeProject)
    : lens.kind === "review"
      ? "Review"
      : lens.kind === "work"
        ? lens.section === "issues"
          ? "Issues"
          : lens.section === "intake"
            ? "Intake"
            : "Portfolio"
        : lens.kind === "settings"
          ? "Settings"
          : "Delivery room";

  const currentConversation = conversations.find((conversation) => conversation.id === conversationId);
  const conversationInContext = activeProject
    ? currentConversation?.contextEntityId === activeProject.id
    : !currentConversation?.contextEntityId;
  const contextualMessages = conversationInContext ? visibleMessages : [];

  useEffect(() => {
    const targetEntityId = activeProject?.id || null;
    setConversationId((currentId) => {
      const current = conversations.find((conversation) => conversation.id === currentId);
      if ((current?.contextEntityId || null) === targetEntityId) return currentId;
      return conversations.find((conversation) => (conversation.contextEntityId || null) === targetEntityId)?.id || currentId;
    });
  }, [activeProject, conversations]);

  const createConversation = useCallback(async () => {
    if (!user || !workspace) return;
    try {
      const ref = await addDoc(collection(db, "boldi_conversations"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: "New conversation",
        status: "active",
        sourceContext: lens.kind,
        contextEntityId: activeProject?.id || null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setConversationId(ref.id);
      setMessages([]);
      setInput("");
      setJudgment(null);
      setSidebarOpen(false);
      navigate(activeProject ? `/work/projects/${activeProject.id}` : "/");
      requestAnimationFrame(() => composerRef.current?.focus());
    } catch {
      setNotice("A new conversation could not be created. Check workspace access and try again.");
    }
  }, [activeProject, lens.kind, navigate, user, workspace]);

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
      sourceContext: lens.kind,
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
        contextType: lens.kind,
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
            mode: "delivery_co_work",
            activeLens: lens,
            activeProject: activeProject || null,
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
      const reply = error instanceof Error && error.message.includes("OpenAI")
        ? `${error.message}\n\nYour work is unchanged. Configure OpenAI in this deployment, then retry.`
        : `I couldn't complete that request: ${error instanceof Error ? error.message : "the service is unavailable"}\n\nNothing was executed.`;
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
        why: action.reason || "Proposed by DelivereeOS",
        action: actionLabel(action.type),
        confidence: Number(action.confidence || 0.8) >= 0.8 ? "high" : "medium",
        proposed: { ...(action.proposedChange || {}), projectId: action.proposedChange?.projectId || activeProject?.id || "" },
        source: plan.summary || "DelivereeOS conversation",
        sourceType: "delivereeos",
        sourceId: planRef.id,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setNotice("The proposal is ready in Review. Nothing has been executed yet.");
  };

  const processReview = async (candidate: any, decision: "approve" | "dismiss") => {
    if (!user || !workspace) return;
    try {
      if (decision === "dismiss") {
        await updateDoc(doc(db, "review_candidates", candidate.id), {
          status: "dismissed",
          updatedAt: serverTimestamp(),
        });
        setNotice("Proposal dismissed. No workspace record was changed.");
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
      setNotice(`${candidate.type === "project" ? "Project" : "Issue"} created from the approved proposal.`);
    } catch {
      setNotice("That proposal could not be processed. The original is still in Review.");
    }
  };

  const setComposer = (value: string) => {
    setInput(value);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const openingPrompts = activeProject
    ? [
        `Give me a concise status of ${entityTitle(activeProject)} and call out what needs attention.`,
        `Create the next highest-value issue for ${entityTitle(activeProject)}.`,
        `Pressure-test whether ${entityTitle(activeProject)} is ready for its next delivery stage.`,
      ]
    : lens.kind === "review"
      ? ["Summarize what is waiting for my approval.", "Which proposed changes carry the most risk?", "What can I safely dismiss?"]
      : lens.kind === "work" && lens.section === "issues"
        ? ["What should the team work on next?", "Find blocked or stale issues.", "Turn my priorities into a focused sprint plan."]
        : lens.kind === "work" && lens.section === "intake"
          ? ["Capture a new AI opportunity.", "Help me qualify an incoming request.", "What information is missing from recent intake?"]
          : ["What needs my attention across delivery?", "Which project is most at risk?", "Plan the next realistic delivery move."];

  const renderLensArtifact = () => {
    if (lens.kind === "settings") {
      return (
        <section className="do-lens-card do-settings-card" data-testid="settings-lens">
          <span className="do-kicker">Workspace settings</span>
          <h2>Keep the operating system honest.</h2>
          <p>DelivereeOS uses this Firebase workspace for identity and records. External tools remain disconnected until a real connector is configured.</p>
          <div className="do-integration-list">
            {["OpenAI", "Jira", "GitHub", "Hermes Harness"].map((name, index) => (
              <div key={name}><span>{name}</span><strong>{index === 0 ? "Deployment managed" : "Not connected"}</strong></div>
            ))}
          </div>
        </section>
      );
    }
    if (activeProject) {
      const health = projectHealth(activeProject, projectTasks.length);
      return (
        <section className="do-lens-card do-project-lens" data-testid="project-lens">
          <div className="do-lens-topline">
            <span className="do-kicker">Project context</span>
            <span className="do-health-label"><StatusDot health={health} />{health.replace(/_/g, " ")}</span>
          </div>
          <h2>{entityTitle(activeProject)}</h2>
          <p>{activeProject.description || activeProject.outcome || "No delivery outcome has been written yet. Ask DelivereeOS to draft one."}</p>
          <div className="do-project-facts">
            <div><span>Stage</span><strong>{titleCase(normalizeDeliveryStage(activeProject.deliveryStage || activeProject.status))}</strong></div>
            <div><span>Open issues</span><strong>{projectTasks.length}</strong></div>
            <div><span>Priority</span><strong>{activeProject.portfolioPriority || activeProject.priority || "Unranked"}</strong></div>
          </div>
        </section>
      );
    }
    if (lens.kind === "review") {
      return (
        <section className="do-lens-card" data-testid="review-lens">
          <div className="do-lens-topline"><span className="do-kicker">Approval gate</span><strong>{reviewItems.length} waiting</strong></div>
          <h2>Review proposed changes</h2>
          <p>DelivereeOS drafts the work. You decide what enters the system.</p>
          <div className="do-review-stack">
            {reviewItems.slice(0, 5).map((item) => (
              <div className="do-review-item" key={item.id}>
                <div><strong>{item.title}</strong><p>{item.why || item.action}</p></div>
                <div className="do-review-actions">
                  <button aria-label={`Dismiss ${item.title}`} onClick={() => processReview(item, "dismiss")} type="button"><X size={14} /></button>
                  <button aria-label={`Approve ${item.title}`} onClick={() => processReview(item, "approve")} type="button"><Check size={14} /> Approve</button>
                </div>
              </div>
            ))}
            {reviewItems.length === 0 && <div className="do-empty-row"><CheckCircle2 size={16} /> Nothing is waiting for approval.</div>}
          </div>
        </section>
      );
    }
    if (lens.kind === "work") {
      const isIssues = lens.section === "issues";
      const isIntake = lens.section === "intake";
      return (
        <section className="do-lens-card" data-testid="work-lens">
          <div className="do-lens-topline"><span className="do-kicker">{isIssues ? "Delivery queue" : isIntake ? "Single intake" : "Live portfolio"}</span><strong>{isIssues ? `${openTasks.length} open` : `${activeProjects.length} active`}</strong></div>
          <h2>{isIssues ? "Issues, without the board noise." : isIntake ? "Start with the request, not the form." : "Your AI delivery system."}</h2>
          <p>{isIssues ? "Ask what should move next, then approve the changes DelivereeOS proposes." : isIntake ? "Describe the opportunity in plain language. DelivereeOS will qualify it and propose the right project or issue." : "Move from opportunity to production while the conversation keeps the reasoning attached."}</p>
          {!isIntake && (
            <div className="do-stage-strip">
              {STAGES.map((stage) => {
                const count = activeProjects.filter((project) => normalizeDeliveryStage(project.deliveryStage || project.status) === stage).length;
                return <div className={count ? "has-items" : ""} key={stage}><span>{count}</span><small>{titleCase(stage)}</small></div>;
              })}
            </div>
          )}
        </section>
      );
    }
    return null;
  };

  return (
    <div className="do-shell">
      <button
        aria-label="Close panels"
        className={`do-scrim ${sidebarOpen || railOpen ? "is-open" : ""}`}
        onClick={() => { setSidebarOpen(false); setRailOpen(false); }}
        type="button"
      />

      <aside className={`do-sidebar ${sidebarOpen ? "is-open" : ""}`} data-testid="primary-sidebar">
        <div className="do-brand-row">
          <Link className="do-brand" to="/" onClick={() => setSidebarOpen(false)}>
            <span className="do-logo">D</span>
            <span><strong>DelivereeOS</strong><small>AI delivery, in conversation</small></span>
          </Link>
          <button aria-label="Close navigation" className="do-mobile-close" onClick={() => setSidebarOpen(false)} type="button"><X size={16} /></button>
        </div>

        <button className="do-new-conversation" data-testid="new-conversation" onClick={createConversation} type="button">
          <Plus size={15} /> New conversation <kbd>⌘K</kbd>
        </button>

        <nav className="do-primary-nav" aria-label="Primary">
          <Link className={lens.kind === "home" ? "is-active" : ""} to="/" onClick={() => setSidebarOpen(false)}><MessageSquare size={16} /> Conversation</Link>
          <Link className={lens.kind === "work" || lens.kind === "project" ? "is-active" : ""} to="/work" onClick={() => setSidebarOpen(false)}><FolderKanban size={16} /> Work <span>{activeProjects.length}</span></Link>
          <Link className={lens.kind === "review" ? "is-active" : ""} to="/capture/review" onClick={() => setSidebarOpen(false)}><ShieldCheck size={16} /> Review {reviewItems.length > 0 && <span className="is-attention">{reviewItems.length}</span>}</Link>
        </nav>

        <div className="do-sidebar-scroll">
          <div className="do-sidebar-section">
            <div className="do-section-head"><span>Projects</span><button aria-label="Create project with AI" onClick={() => { navigate("/"); setComposer("Create a new delivery project for: "); setSidebarOpen(false); }} type="button"><Plus size={13} /></button></div>
            <div className="do-project-list">
              {activeProjects.slice(0, 8).map((project) => {
                const count = openTasks.filter((task) => task.projectId === project.id).length;
                const health = projectHealth(project, count);
                return (
                  <Link className={activeProject?.id === project.id ? "is-active" : ""} key={project.id} to={`/work/projects/${project.id}`} onClick={() => setSidebarOpen(false)}>
                    <StatusDot health={health} />
                    <span>{entityTitle(project)}</span>
                    {count > 0 && <small>{count}</small>}
                  </Link>
                );
              })}
              {activeProjects.length === 0 && <button className="do-empty-link" onClick={() => setComposer("Create my first AI delivery project for: ")} type="button">Create your first project</button>}
            </div>
          </div>

          <div className="do-sidebar-section do-conversations">
            <div className="do-section-head"><span>Recent</span><button aria-label="Search conversations" onClick={() => setSearchOpen((open) => !open)} type="button"><Search size={13} /></button></div>
            {searchOpen && <input aria-label="Search conversations" autoFocus onChange={(event) => setSearch(event.target.value)} placeholder="Search" value={search} />}
            {filteredConversations.slice(0, 8).map((conversation) => (
              <button className={conversation.id === conversationId && conversationInContext ? "is-active" : ""} key={conversation.id} onClick={() => { setConversationId(conversation.id); navigate(conversation.contextEntityId ? `/work/projects/${conversation.contextEntityId}` : "/"); setSidebarOpen(false); }} type="button">
                <MessageSquare size={13} /><span>{conversation.title || "New conversation"}</span><small>{timeAgo(conversation.updatedAt || conversation.createdAt)}</small>
              </button>
            ))}
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
              <Link to="/settings" onClick={() => setWorkspaceOpen(false)}><Settings size={14} /> Settings</Link>
              <button onClick={logOut} type="button">Sign out</button>
            </div>
          )}
        </div>
      </aside>

      <main className="do-main">
        <header className="do-header">
          <button aria-label="Open navigation" className="do-icon-button do-menu-button" onClick={() => setSidebarOpen(true)} type="button"><Menu size={18} /></button>
          <div className="do-breadcrumb">
            <span>{workspace?.name || "Workspace"}</span><ChevronRight size={12} /><strong>{contextTitle}</strong>
          </div>
          <div className="do-header-status"><span /><small>OpenAI · DelivereeOS</small></div>
          <button aria-label="Open context" className="do-icon-button do-context-button" onClick={() => setRailOpen(true)} type="button"><PanelRight size={18} /></button>
        </header>

        {notice && <div className="do-notice" role="status"><CheckCircle2 size={15} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")} type="button"><X size={14} /></button></div>}

        <div className="do-thread-viewport">
          <div className="do-thread">
            {contextualMessages.length === 0 && !submitting ? (
              <div className="do-opening">
                {renderLensArtifact()}
                {!activeProject && lens.kind === "home" && (
                  <section className="do-welcome">
                    <span className="do-orb"><Sparkles size={22} /></span>
                    <p>DELIVERY ROOM</p>
                    <h1>What are we shipping, {displayName(user?.displayName, user?.email)}?</h1>
                    <span>Ask about the portfolio, open a project, or describe the work in plain language.</span>
                  </section>
                )}
                <div className="do-prompt-list">
                  {openingPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)} type="button"><span>{prompt}</span><ArrowUp size={14} /></button>)}
                </div>
              </div>
            ) : (
              <>
                {activeProject && <div className="do-inline-context">Working in <strong>{entityTitle(activeProject)}</strong><span>{titleCase(normalizeDeliveryStage(activeProject.deliveryStage || activeProject.status))}</span></div>}
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
                {(submitting || streamed) && <article className="do-message is-assistant"><div className="do-assistant-message"><div className="do-assistant-mark"><Bot size={16} /></div><div className="do-assistant-content">{streamed ? <RichText text={streamed} /> : <div className="do-thinking"><span /><span /><span /></div>}</div></div></article>}
              </>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="do-composer-wrap">
          {activeProject && <div className="do-composer-context"><FolderKanban size={12} /><span>{entityTitle(activeProject)}</span><button aria-label="Clear project context" onClick={() => navigate("/")} type="button"><X size={12} /></button></div>}
          <div className="do-composer">
            <textarea
              aria-label="Message DelivereeOS"
              data-testid="message-composer"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); }
              }}
              placeholder={activeProject ? `Ask about ${entityTitle(activeProject)}…` : "Ask, plan, capture, or create an issue…"}
              ref={composerRef}
              rows={1}
              value={input}
            />
            <div className="do-composer-foot">
              <div>
                {voiceSupported && <button aria-label={isListening ? "Stop listening" : "Start voice input"} className={isListening ? "is-listening" : ""} onClick={() => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start()} type="button">{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button>}
                <button onClick={() => setComposer(activeProject ? `Create an issue in ${entityTitle(activeProject)}: ` : "Capture a new AI opportunity: ")} type="button"><Plus size={15} /><span>Work</span></button>
              </div>
              <button aria-label="Send message" className="do-send" disabled={!input.trim() || submitting} onClick={() => sendMessage()} type="button">{submitting ? <Loader2 className="spin" size={16} /> : <ArrowUp size={17} />}</button>
            </div>
          </div>
          <p className="do-composer-note">DelivereeOS proposes. You approve. Every approved change stays attributable.</p>
        </div>
      </main>

      <aside className={`do-rail ${railOpen ? "is-open" : ""}`} data-testid="context-rail">
        <div className="do-rail-head"><div><span>Context</span><strong>{contextTitle}</strong></div><button aria-label="Close context" onClick={() => setRailOpen(false)} type="button"><X size={16} /></button></div>
        <div className="do-rail-scroll">
          {activeProject ? (
            <>
              <section className="do-rail-section">
                <span className="do-rail-label">Delivery</span>
                <div className="do-stage-path">
                  {STAGES.slice(1).map((stage) => {
                    const current = normalizeDeliveryStage(activeProject.deliveryStage || activeProject.status);
                    const complete = STAGES.indexOf(stage) <= STAGES.indexOf(current);
                    return <div className={stage === current ? "is-current" : complete ? "is-complete" : ""} key={stage}><span>{complete ? <Check size={10} /> : <Circle size={8} />}</span><strong>{titleCase(stage)}</strong></div>;
                  })}
                </div>
              </section>
              <section className="do-rail-section">
                <div className="do-rail-title"><span className="do-rail-label">Open issues</span><button onClick={() => setComposer(`Create an issue in ${entityTitle(activeProject)}: `)} type="button"><Plus size={12} /> Add</button></div>
                <div className="do-issue-list">
                  {projectTasks.slice(0, 7).map((task) => <div key={task.id}><CheckCircle2 size={14} /><span>{entityTitle(task)}</span><small>{task.priority || ""}</small></div>)}
                  {projectTasks.length === 0 && <p>No open issues. Ask DelivereeOS for the next credible action.</p>}
                </div>
              </section>
              <section className="do-rail-section">
                <span className="do-rail-label">Readiness</span>
                <div className="do-readiness-list">
                  {[['Support', activeProject.supportReadiness], ['Production', activeProject.productionReadiness], ['Observability', activeProject.observabilityStatus]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ? titleCase(value) : "Not assessed"}</strong></div>)}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="do-rail-section do-rail-summary">
                <span className="do-rail-label">Right now</span>
                <div><strong>{activeProjects.length}</strong><span>active projects</span></div>
                <div><strong>{openTasks.length}</strong><span>open issues</span></div>
                <div><strong>{reviewItems.length}</strong><span>waiting review</span></div>
              </section>
              <section className="do-rail-section">
                <span className="do-rail-label">Needs attention</span>
                <div className="do-attention-list">
                  {activeProjects.filter((project) => projectHealth(project, openTasks.filter((task) => task.projectId === project.id).length) !== "on_track").slice(0, 5).map((project) => (
                    <Link key={project.id} to={`/work/projects/${project.id}`} onClick={() => setRailOpen(false)}><StatusDot health={projectHealth(project)} /><span>{entityTitle(project)}</span><ChevronRight size={12} /></Link>
                  ))}
                  {activeProjects.every((project) => projectHealth(project) === "on_track") && <p>No explicit delivery blockers found.</p>}
                </div>
              </section>
              <section className="do-rail-section">
                <span className="do-rail-label">Judgment</span>
                <div className="do-judgment">
                  {judgment ? <><ShieldCheck size={16} /><div><strong>{titleCase(judgment.verdict)}</strong><p>{judgment.recommendation}</p></div></> : <><Command size={16} /><div><strong>Ready</strong><p>Capacity, duplicate work, dates, and workload are checked before AI advice.</p></div></>}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
