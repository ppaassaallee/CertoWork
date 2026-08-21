import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Archive,
  ArrowUp,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Command,
  Download,
  FileText,
  FolderKanban,
  Gauge,
  History,
  Inbox,
  Layers3,
  Menu,
  MessageSquareText,
  Mic,
  MicOff,
  MoreHorizontal,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from "./ui/Icon";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { useUndo } from "../lib/UndoContext";
import {
  evaluateJudgment,
  type JudgmentAssessment,
  type JudgmentContext,
} from "../lib/judgment";
import { handleFirestoreError, OperationType } from "../lib/firestore-error-helper";
import { SPECIALIST_AGENTS } from "../lib/agentContracts";
import { shouldQueueOfflineCapture } from "../lib/assistantFallback";

type MessageRole = "user" | "assistant" | "system";

interface Conversation {
  id: string;
  title: string;
  status?: string;
  updatedAt?: any;
  createdAt?: any;
}

interface Citation {
  id: string;
  title: string;
  type?: string;
}

interface ProposedAction {
  type: string;
  proposedChange: Record<string, any>;
  reason?: string;
  safetyLevel?: number;
  confidence?: number;
}

interface ActionPlan {
  id?: string;
  title: string;
  summary: string;
  riskLevel?: string;
  safetyLevel?: number;
  proposedActions: ProposedAction[];
}

interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: any;
  citations?: Citation[];
  suggestedChips?: string[];
  actionPlan?: ActionPlan;
  provider?: { provider?: string; model?: string };
  offline?: boolean;
}

interface WorkspaceSnapshot extends JudgmentContext {
  loaded: boolean;
}

const OFFLINE_QUEUE_KEY = "gazelle_offline_capture_queue_v1";
const NEW_CONVERSATION_PENDING_KEY = "gazelle_new_conversation_pending";
const SELECTED_CONVERSATION_KEY = "gazelle_selected_conversation_id";

const MODULES = [
  { label: "Today", to: "/today", icon: CalendarDays },
  { label: "Capture", to: "/capture", icon: Inbox },
  { label: "Tasks", to: "/work/action-board", icon: CheckCircle2 },
  { label: "Projects", to: "/work/projects", icon: FolderKanban },
  { label: "Planning", to: "/plan", icon: Layers3 },
  { label: "Review", to: "/review", icon: RotateCcw },
  { label: "Habits", to: "/review/habits", icon: Zap },
  { label: "Workouts", to: "/review/workouts", icon: Activity },
  { label: "Knowledge", to: "/capture/documents", icon: BookOpen },
  { label: "War Room", to: "/work/agent-workspace", icon: Users },
  { label: "Boldr OS", to: "/boldr", icon: Command },
  { label: "Settings", to: "/settings", icon: Gauge },
];

const BASE_PROMPTS = [
  {
    eyebrow: "Plan",
    title: "Make today realistic",
    text: "Build a realistic plan for today from my calendar, capacity, and 2+8 priorities.",
    icon: CalendarDays,
  },
  {
    eyebrow: "Capture",
    title: "Clear what’s on my mind",
    text: "Help me capture and triage what is on my mind. Ask only what you truly need.",
    icon: Inbox,
  },
  {
    eyebrow: "Judgment",
    title: "Pressure-test a commitment",
    text: "Pressure-test a new commitment against my workload, opportunity cost, and sustainability.",
    icon: ShieldCheck,
  },
  {
    eyebrow: "Projects",
    title: "Turn an idea into a project",
    text: "Guide me from a rough idea to a project with an outcome, phases, and one credible next action.",
    icon: Target,
  },
];

function timestampValue(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (typeof value === "number") return value;
  return 0;
}

function firstName(displayName?: string | null, email?: string | null) {
  if (displayName?.trim()) return displayName.trim().split(/\s+/)[0];
  return email?.split("@")[0] || "there";
}

function relativeDate(value: any) {
  const time = timestampValue(value);
  if (!time) return "Now";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d`;
}

function actionLabel(action: ProposedAction) {
  const labels: Record<string, string> = {
    create_task: "Create task",
    update_task: "Update task",
    reschedule_task: "Reschedule task",
    create_project: "Create project",
    create_decision: "Record decision",
    create_followup: "Create follow-up",
    outbox_communication: "Draft communication",
    kill_or_archive: "Archive item",
  };
  return labels[action.type] || action.type.replace(/_/g, " ");
}

function actionTitle(action: ProposedAction) {
  const change = action.proposedChange || {};
  return change.title || change.recipient || change.content || action.reason || "Review proposed change";
}

function citationHref(citation: Citation) {
  if (citation.type === "task") return `/work/action-board/${citation.id}`;
  if (citation.type === "project") return `/work/projects/${citation.id}`;
  if (citation.type === "goal") return "/plan/strategy";
  if (citation.type === "conversation") return "/boldi";
  return `/work/knowledge/${citation.id}`;
}

function downloadMarkdown(text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Certo Work_Snapshot_${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function readOfflineQueue(): Array<{ id: string; text: string; createdAt: string }> {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function storeOfflineCapture(text: string) {
  const queue = readOfflineQueue();
  queue.push({
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

function buildOfflineReply(text: string, judgment: JudgmentAssessment) {
  if (judgment.verdict === "stop") {
    return `${judgment.recommendation}\n\nI saved your request to the offline capture queue, so it is not lost. Nothing has been executed.`;
  }
  if (judgment.verdict === "challenge") {
    return `${judgment.userNeedsToHear}\n\nI saved this safely for review. When the AI provider is available again, I can turn it into a concrete, approval-gated plan.`;
  }
  if (/\b(report|summary|snapshot)\b/i.test(text)) {
    return "The AI provider is unavailable, but your workspace is still usable. I saved this report request and will keep all source records unchanged.";
  }
  return "Captured. The AI provider is unavailable right now, so I placed this in the offline queue instead of pretending it was processed. Nothing else changed.";
}

function buildProviderUnavailableReply(judgment: JudgmentAssessment, providerError?: string) {
  const lead =
    judgment.verdict === "stop"
      ? judgment.recommendation
      : judgment.verdict === "challenge"
        ? judgment.userNeedsToHear
        : "Your request passed the deterministic safety checks.";
  const safeError = providerError?.trim();
  const detail = safeError
    ? `OpenAI returned this provider error: ${safeError}`
    : "OpenAI did not return a usable response.";
  return `${lead}\n\n${detail}\n\nI did not execute anything or add this to the offline queue.`;
}

function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="gazelle-rich-text">
      {lines.map((line, index) => {
        const clean = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
        if (!clean.trim()) return <div className="h-2" key={index} />;
        if (/^#{1,3}\s/.test(line)) {
          return (
            <h3 key={index} className="mt-4 mb-1 font-semibold text-[15px] text-[#171a17]">
              {clean}
            </h3>
          );
        }
        if (/^\s*[-*]\s/.test(line)) {
          return (
            <div key={index} className="flex gap-2.5 py-0.5">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#6d765f]" />
              <span>{clean.replace(/^\s*[-*]\s*/, "")}</span>
            </div>
          );
        }
        return <p key={index}>{clean}</p>;
      })}
    </div>
  );
}

function JudgmentArtifact({ assessment }: { assessment: JudgmentAssessment }) {
  const tone =
    assessment.verdict === "stop"
      ? "border-[#e7b9aa] bg-[#fff8f5]"
      : assessment.verdict === "challenge"
        ? "border-[#e7d7a4] bg-[#fffdf5]"
        : "border-[#cbdcc5] bg-[#f8fcf6]";
  const label =
    assessment.verdict === "stop"
      ? "Pause"
      : assessment.verdict === "challenge"
        ? "Challenge"
        : "Clear";

  return (
    <section className={`mt-5 overflow-hidden rounded-[18px] border ${tone}`}>
      <div className="flex items-start justify-between gap-4 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white p-1.5 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-[#566149]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#757a70]">
              Judgment preflight
            </p>
            <p className="mt-1 text-sm font-semibold text-[#20231f]">{assessment.recommendation}</p>
          </div>
        </div>
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      {assessment.signals.length > 0 && (
        <div className="border-t border-black/[0.06] bg-white/55 px-4 py-3">
          {assessment.signals.slice(0, 3).map((signal) => (
            <div key={signal.id} className="flex gap-2.5 py-1.5 text-xs">
              <CircleDot
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  signal.severity === "blocking"
                    ? "text-[#bd5e46]"
                    : signal.severity === "warning"
                      ? "text-[#9b7a20]"
                      : "text-[#65715c]"
                }`}
              />
              <div>
                <span className="font-semibold text-[#292c27]">{signal.title}. </span>
                <span className="text-[#686d64]">{signal.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ActionPlanArtifact({
  plan,
  status,
  onApprove,
  onEdit,
  onDismiss,
}: {
  plan: ActionPlan;
  status?: "staging" | "staged" | "dismissed";
  onApprove: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  if (status === "dismissed") return null;
  return (
    <section className="mt-5 overflow-hidden rounded-[20px] border border-[#d9d9d1] bg-[#fbfbf8] shadow-[0_8px_25px_rgba(30,35,25,0.05)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#e7e6df] px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#e6efd9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#516043]">
              Proposed actions
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8b8e86]">
              {plan.riskLevel || "low"} risk
            </span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold text-[#191c18]">{plan.title}</h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[#73766f]">{plan.summary}</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-[#9a9d96]" />
      </div>
      <div className="divide-y divide-[#e8e7e1] bg-white">
        {(plan.proposedActions || []).map((action, index) => (
          <div key={`${action.type}-${index}`} className="flex items-start gap-3 px-4 py-3.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#d9ddd1] bg-[#f4f7ef] text-[10px] font-bold text-[#59624f]">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#20231f]">{actionLabel(action)}</p>
              <p className="mt-0.5 truncate text-xs text-[#6f736b]">{actionTitle(action)}</p>
              {action.reason && <p className="mt-1 text-[11px] text-[#95988f]">{action.reason}</p>}
            </div>
            <span className="rounded-md bg-[#f2f2ee] px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#767a72]">
              S{action.safetyLevel || plan.safetyLevel || 1}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7e6df] px-4 py-3">
        <p className="flex items-center gap-1.5 text-[10px] text-[#7f827a]">
          <ShieldCheck className="h-3 w-3" />
          Review only. Nothing executes without another explicit approval.
        </p>
        <div className="flex items-center gap-2">
          <button className="gazelle-subtle-button" onClick={onDismiss} type="button">
            Dismiss
          </button>
          <button className="gazelle-subtle-button" onClick={onEdit} type="button">
            Edit
          </button>
          <button
            className="gazelle-primary-button"
            disabled={status === "staging" || status === "staged"}
            onClick={onApprove}
            type="button"
          >
            {status === "staged" ? (
              <>
                <Check className="h-3.5 w-3.5" /> Staged for review
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                {status === "staging" ? "Staging…" : "Approve to review"}
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

export function BoldiAssistant({
  embedded = false,
  onOpenNavigation,
  onOpenContext,
}: {
  embedded?: boolean;
  onOpenNavigation?: () => void;
  onOpenContext?: () => void;
}) {
  const { user, workspace, workspaces, setWorkspace } = useAuth();
  const { pushAction } = useUndo();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [latestJudgment, setLatestJudgment] = useState<JudgmentAssessment | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({ loaded: false });
  const [planStatuses, setPlanStatuses] = useState<Record<string, "staging" | "staged" | "dismissed">>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [offlineCount, setOfflineCount] = useState(() => readOfflineQueue().length);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [providerLabel, setProviderLabel] = useState("Chief of Staff");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const loadWorkspaceSnapshot = useCallback(async (): Promise<WorkspaceSnapshot> => {
    if (!user || !workspace) return { loaded: false };
    const load = async (name: string) => {
      try {
        const snap = await getDocs(
          query(
            collection(db, name),
            where("userId", "==", user.uid),
            where("workspaceId", "==", workspace.id),
          ),
        );
        return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      } catch {
        return [];
      }
    };
    const [tasks, projects, goals, events] = await Promise.all([
      load("tasks"),
      load("projects"),
      load("strategic_goals"),
      load("calendar_events"),
    ]);
    const next = { tasks, projects, goals, events, dailyCapacityMinutes: 360, loaded: true };
    setSnapshot(next);
    return next;
  }, [user, workspace]);

  useEffect(() => {
    loadWorkspaceSnapshot();
  }, [loadWorkspaceSnapshot]);

  useEffect(() => {
    if (!user || !workspace) return;
    const conversationsQuery = query(
      collection(db, "boldi_conversations"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "active"),
    );
    return onSnapshot(
      conversationsQuery,
      (snap) => {
        const items = snap.docs
          .map((item) => ({ id: item.id, ...item.data() }) as Conversation)
          .sort((a, b) => timestampValue(b.updatedAt || b.createdAt) - timestampValue(a.updatedAt || a.createdAt));
        setConversations(items);
        setConversationId((current) => current || items[0]?.id || null);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "boldi_conversations"),
    );
  }, [user, workspace]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const messageQuery = query(
      collection(db, "boldi_messages"),
      where("conversationId", "==", conversationId),
      where("userId", "==", user?.uid || ""),
      where("workspaceId", "==", workspace?.id || ""),
    );
    return onSnapshot(
      messageQuery,
      (snap) => {
        const items = snap.docs
          .map((item) => ({ id: item.id, ...item.data() }) as ConversationMessage)
          .sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));
        setMessages(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "boldi_messages"),
    );
  }, [conversationId, user, workspace]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingReply, submitting]);

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
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join(" ");
      setInput(transcript);
    };
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createConversation();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  useEffect(() => {
    const flushQueue = async () => {
      if (!navigator.onLine || !user || !workspace) return;
      const queue = readOfflineQueue();
      if (!queue.length) return;
      const remaining = [];
      for (const item of queue) {
        try {
          await addDoc(collection(db, "inbox_items"), {
            userId: user.uid,
            workspaceId: workspace.id,
            createdBy: user.uid,
            content: item.text,
            typeHint: "offline_capture",
            status: "captured",
            timeSector: "inbox",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      setOfflineCount(remaining.length);
    };
    window.addEventListener("online", flushQueue);
    flushQueue();
    return () => window.removeEventListener("online", flushQueue);
  }, [user, workspace]);

  const dynamicPrompts = useMemo(() => {
    if ((snapshot.tasks?.length || 0) > 10) {
      return [
        {
          eyebrow: "Focus",
          title: "Reduce task overload",
          text: "Challenge my open-task load and show me what to finish, defer, delegate, or delete.",
          icon: ShieldCheck,
        },
        ...BASE_PROMPTS.slice(0, 3),
      ];
    }
    return BASE_PROMPTS;
  }, [snapshot.tasks]);

  const activeProjects = useMemo(
    () =>
      (snapshot.projects || [])
        .filter((project: any) => !["done", "completed", "archived"].includes(String(project.status || "").toLowerCase()))
        .slice(0, 4),
    [snapshot.projects],
  );
  const filteredConversations = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(normalized),
    );
  }, [conversations, searchQuery]);

  const visibleMessages = messages.filter((message) => message.role !== "system");

  const ensureConversation = async (title: string) => {
    if (conversationId) return conversationId;
    if (!user || !workspace) throw new Error("Workspace is not ready");
    const ref = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: title.slice(0, 54) || "New conversation",
      status: "active",
      sourceContext: "conversational_home",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    return ref.id;
  };

  const createConversation = async () => {
    if (!user || !workspace) return;
    const ref = await addDoc(collection(db, "boldi_conversations"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: "New conversation",
      status: "active",
      sourceContext: "conversational_home",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    setMessages([]);
    setLatestJudgment(null);
    setInput("");
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  useEffect(() => {
    if (!embedded || !user || !workspace) return;

    const consumePendingSelection = () => {
      const selectedConversationId = sessionStorage.getItem(SELECTED_CONVERSATION_KEY);
      if (selectedConversationId) {
        sessionStorage.removeItem(SELECTED_CONVERSATION_KEY);
        setConversationId(selectedConversationId);
        setMessages([]);
        setLatestJudgment(null);
        setInput("");
        requestAnimationFrame(() => textareaRef.current?.focus());
        return true;
      }
      return false;
    };

    const consumePendingNewConversation = () => {
      if (sessionStorage.getItem(NEW_CONVERSATION_PENDING_KEY) !== "true") return false;
      sessionStorage.removeItem(NEW_CONVERSATION_PENDING_KEY);
      createConversation();
      return true;
    };

    consumePendingSelection();
    consumePendingNewConversation();

    const handleNewConversation = () => {
      sessionStorage.removeItem(NEW_CONVERSATION_PENDING_KEY);
      createConversation();
    };
    const handleSelectConversation = (event: Event) => {
      const conversationIdFromEvent = (event as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      const nextConversationId = conversationIdFromEvent || sessionStorage.getItem(SELECTED_CONVERSATION_KEY);
      if (!nextConversationId) return;
      sessionStorage.removeItem(SELECTED_CONVERSATION_KEY);
      setConversationId(nextConversationId);
      setMessages([]);
      setLatestJudgment(null);
      setInput("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    window.addEventListener("gazelle-new-conversation", handleNewConversation);
    window.addEventListener("gazelle-select-conversation", handleSelectConversation);
    return () => {
      window.removeEventListener("gazelle-new-conversation", handleNewConversation);
      window.removeEventListener("gazelle-select-conversation", handleSelectConversation);
    };
  }, [embedded, user, workspace]);

  const streamText = async (text: string) => {
    const chunkSize = Math.max(4, Math.ceil(text.length / 90));
    setStreamingReply("");
    for (let index = 0; index < text.length; index += chunkSize) {
      setStreamingReply(text.slice(0, index + chunkSize));
      await new Promise((resolve) => window.setTimeout(resolve, 12));
    }
  };

  const sendMessage = async (explicitText?: string) => {
    const text = (explicitText || input).trim();
    if (!text || !user || !workspace || submitting) return;
    setInput("");
    setSubmitting(true);
    setStreamingReply("");
    const localId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: localId, role: "user", content: text, createdAt: Date.now() },
    ]);

    let activeConversationId = conversationId;
    let judgment: JudgmentAssessment;
    let assistantRequestStarted = false;
    let assistantResponseReceived = false;
    try {
      activeConversationId = await ensureConversation(text);
      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        role: "user",
        content: text,
        inputType: "text",
        createdAt: serverTimestamp(),
      });

      const liveSnapshot = await loadWorkspaceSnapshot();
      judgment = evaluateJudgment(text, liveSnapshot);
      setLatestJudgment(judgment);

      if (!navigator.onLine) throw new Error("offline");

      const idToken = await user.getIdToken();
      assistantRequestStarted = true;
      const response = await fetch("/api/boldi/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          conversationId: activeConversationId,
          messages: [
            ...visibleMessages.map((message) => ({ role: message.role, content: message.content })),
            { role: "user", content: text },
          ],
          workspaceContext: {
            tasks: liveSnapshot.tasks || [],
            projects: liveSnapshot.projects || [],
            goals: liveSnapshot.goals || [],
            events: liveSnapshot.events || [],
            judgment,
            mode: "co_work",
            userId: user.uid,
            workspaceId: workspace.id,
          },
        }),
      });
      assistantResponseReceived = true;
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Assistant provider unavailable");
      }
      const result = await response.json();
      const reply = result.reply || "I completed the review, but there is no response to display.";
      await streamText(reply);

      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: activeConversationId,
        role: "assistant",
        content: reply,
        inputType: "text",
        toolName: result.toolName || null,
        citations: result.citations || [],
        suggestedChips: result.suggestedChips || [],
        actionPlan: result.actionPlan || null,
        provider: result.provider || null,
        judgment,
        createdAt: serverTimestamp(),
      });
      setProviderLabel(
        result.provider?.provider
          ? `${result.provider.provider === "openai" ? "OpenAI" : "Legacy AI adapter"} · Chief of Staff`
          : "Chief of Staff",
      );
      if (activeConversationId) {
        await updateDoc(doc(db, "boldi_conversations", activeConversationId), {
          title: visibleMessages.length === 0 ? text.slice(0, 54) : conversations.find((item) => item.id === activeConversationId)?.title,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      const liveSnapshot = snapshot.loaded ? snapshot : await loadWorkspaceSnapshot();
      judgment = evaluateJudgment(text, liveSnapshot);
      setLatestJudgment(judgment);
      const shouldQueue = shouldQueueOfflineCapture({
        isOnline: navigator.onLine,
        requestStarted: assistantRequestStarted,
        responseReceived: assistantResponseReceived,
        errorName: error instanceof Error ? error.name : undefined,
      });
      if (shouldQueue) {
        const queueLength = storeOfflineCapture(text);
        setOfflineCount(queueLength);
      }
      const providerError = error instanceof Error ? error.message : undefined;
      const reply = shouldQueue
        ? buildOfflineReply(text, judgment)
        : buildProviderUnavailableReply(judgment, providerError);
      await streamText(reply);
      const fallbackMessage: ConversationMessage = {
        id: `${shouldQueue ? "offline" : "provider-unavailable"}-${Date.now()}`,
        role: "assistant",
        content: reply,
        offline: shouldQueue,
        createdAt: Date.now(),
      };
      if (activeConversationId && navigator.onLine) {
        try {
          await addDoc(collection(db, "boldi_messages"), {
            userId: user.uid,
            workspaceId: workspace.id,
            conversationId: activeConversationId,
            role: "assistant",
            content: reply,
            inputType: "text",
            provider: { provider: "offline-safe", model: "deterministic" },
            judgment,
            offline: shouldQueue,
            createdAt: serverTimestamp(),
          });
        } catch {
          // The local fallback below remains visible.
        }
      }
      setMessages((current) => {
        const withoutLocal = current.filter((message) => message.id !== localId);
        const userAlreadyPersisted = withoutLocal.some(
          (message) => message.role === "user" && message.content === text,
        );
        return [
          ...withoutLocal,
          ...(userAlreadyPersisted
            ? []
            : [{ id: localId, role: "user" as const, content: text, createdAt: Date.now(), offline: shouldQueue }]),
          fallbackMessage,
        ];
      });
      setProviderLabel(shouldQueue ? "Offline-safe mode" : "AI unavailable · deterministic mode");
    } finally {
      setStreamingReply("");
      setSubmitting(false);
    }
  };

  const approvePlan = async (message: ConversationMessage, plan: ActionPlan) => {
    if (!user || !workspace) return;
    const statusKey = message.id;
    setPlanStatuses((current) => ({ ...current, [statusKey]: "staging" }));
    try {
      const planRef = await addDoc(collection(db, "boldi_action_plans"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId,
        title: plan.title,
        summary: plan.summary,
        riskLevel: plan.riskLevel || "low",
        safetyLevel: plan.safetyLevel || 1,
        status: "approved_for_review",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const candidateRefs: string[] = [];
      const actionRefs: string[] = [];
      for (const action of plan.proposedActions || []) {
        const actionRef = await addDoc(collection(db, "boldi_actions"), {
          userId: user.uid,
          workspaceId: workspace.id,
          actionPlanId: planRef.id,
          type: action.type,
          proposedChange: action.proposedChange || {},
          reason: action.reason || "Proposed by the Chief of Staff",
          confidence: action.confidence || 0.85,
          safetyLevel: action.safetyLevel || plan.safetyLevel || 1,
          status: "approved_for_review",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        actionRefs.push(actionRef.id);
        const candidateRef = await addDoc(collection(db, "review_candidates"), {
          userId: user.uid,
          workspaceId: workspace.id,
          createdBy: user.uid,
          title: actionTitle(action),
          type:
            action.type === "create_project"
              ? "project"
              : action.type === "outbox_communication"
                ? "outbox"
                : "task",
          why: action.reason || "Proposed by the Chief of Staff",
          action: actionLabel(action),
          confidence: (action.confidence || 0.85) >= 0.8 ? "high" : "medium",
          proposed: action.proposedChange || {},
          source: plan.summary,
          sourceType: "boldi",
          sourceId: planRef.id,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        candidateRefs.push(candidateRef.id);
      }

      const undoStaging = async () => {
        await updateDoc(planRef, { status: "undone", updatedAt: serverTimestamp() });
        await Promise.all([
          ...candidateRefs.map((id) =>
            updateDoc(doc(db, "review_candidates", id), {
              status: "dismissed",
              updatedAt: serverTimestamp(),
            }),
          ),
          ...actionRefs.map((id) =>
            updateDoc(doc(db, "boldi_actions", id), {
              status: "undone",
              updatedAt: serverTimestamp(),
            }),
          ),
        ]);
        setPlanStatuses((current) => ({ ...current, [statusKey]: "dismissed" }));
      };
      const redoStaging = async () => {
        await updateDoc(planRef, { status: "approved_for_review", updatedAt: serverTimestamp() });
        await Promise.all([
          ...candidateRefs.map((id) =>
            updateDoc(doc(db, "review_candidates", id), {
              status: "pending",
              updatedAt: serverTimestamp(),
            }),
          ),
          ...actionRefs.map((id) =>
            updateDoc(doc(db, "boldi_actions", id), {
              status: "approved_for_review",
              updatedAt: serverTimestamp(),
            }),
          ),
        ]);
        setPlanStatuses((current) => ({ ...current, [statusKey]: "staged" }));
      };
      pushAction({
        id: `stage-${planRef.id}`,
        description: `Stage “${plan.title}” for review`,
        undo: undoStaging,
        redo: redoStaging,
      });
      setPlanStatuses((current) => ({ ...current, [statusKey]: "staged" }));
    } catch {
      setPlanStatuses((current) => {
        const next = { ...current };
        delete next[statusKey];
        return next;
      });
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) recognition.stop();
    else recognition.start();
  };

  const currentConversation = conversations.find((conversation) => conversation.id === conversationId);
  const capacity = latestJudgment?.capacity;
  const userName = firstName(user?.displayName, user?.email);
  const todayLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const conversationMain = (
      <main className="gazelle-conversation-main">
        <header className="gazelle-chat-header">
          <button
            aria-label="Open navigation"
            className="gazelle-mobile-icon-button"
            onClick={() =>
              onOpenNavigation
                ? onOpenNavigation()
                : embedded
                  ? window.dispatchEvent(new CustomEvent("gazelle-open-navigation"))
                  : setSidebarOpen(true)
            }
            type="button"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-[#96998f]">
              <span>{workspace?.name || "Personal Focus"}</span>
              <ChevronRight className="h-2.5 w-2.5" />
              <span className="truncate">{currentConversation?.title || "Chief of Staff"}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#72885d]" />
              <p className="text-[11px] font-medium text-[#676c62]">{providerLabel}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {offlineCount > 0 && (
              <span className="hidden rounded-full bg-[#f2ead5] px-2.5 py-1 text-[9px] font-semibold text-[#7b672c] sm:inline">
                {offlineCount} queued
              </span>
            )}
            <Link
              className="gazelle-header-button"
              title="Review queue"
              to="/capture/review"
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Review queue</span>
            </Link>
            <button
              aria-label="Open context"
              className="gazelle-mobile-icon-button"
              onClick={() =>
                onOpenContext
                  ? onOpenContext()
                  : embedded
                    ? window.dispatchEvent(new CustomEvent("gazelle-open-context"))
                    : setRailOpen(true)
              }
              type="button"
            >
              <PanelRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        <div className="gazelle-message-viewport">
          {visibleMessages.length === 0 && !submitting ? (
            <div className="gazelle-opening">
              <div className="gazelle-opening-mark">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#899080]">
                {todayLabel}
              </p>
              <h1 className="mt-2 text-balance text-[clamp(28px,4vw,42px)] font-medium leading-[1.08] tracking-[-0.035em] text-[#20231e]">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},{" "}
                {userName}.
              </h1>
              <p className="mt-3 max-w-xl text-balance text-[15px] leading-6 text-[#777c71]">
                What are we making clearer, lighter, or more achievable?
              </p>
              <div className="gazelle-prompt-grid">
                {dynamicPrompts.map(({ eyebrow, title, text, icon: Icon }) => (
                  <button
                    className="gazelle-prompt-card"
                    key={title}
                    onClick={() => sendMessage(text)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#89917f]">
                        {eyebrow}
                      </span>
                      <Icon className="h-3.5 w-3.5 text-[#828b77]" />
                    </div>
                    <p className="mt-3 text-left text-[13px] font-semibold text-[#272a25]">{title}</p>
                    <p className="mt-1 text-left text-[11px] leading-[1.5] text-[#858980]">{text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="gazelle-thread">
              {visibleMessages.map((message) => (
                <article className={`gazelle-message gazelle-message-${message.role}`} key={message.id}>
                  {message.role === "user" ? (
                    <div className="gazelle-user-bubble">{message.content}</div>
                  ) : (
                    <div className="flex items-start gap-3.5">
                      <div className="gazelle-assistant-avatar">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-[#343832]">Certo Work</span>
                          {message.offline && (
                            <span className="rounded-full bg-[#f2ead5] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#806a2d]">
                              Offline-safe
                            </span>
                          )}
                        </div>
                        <RichText text={message.content} />
                        {/\b(weekly theme|executive progress|progress snapshot|weekly report)\b/i.test(
                          message.content,
                        ) && (
                          <button
                            className="gazelle-citation mt-3"
                            onClick={() => downloadMarkdown(message.content)}
                            type="button"
                          >
                            <Download className="h-3 w-3" />
                            Download snapshot
                          </button>
                        )}
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {message.citations.map((citation) => (
                              <Link
                                className="gazelle-citation"
                                key={citation.id}
                                to={citationHref(citation)}
                              >
                                <FileText className="h-3 w-3" />
                                {citation.title}
                              </Link>
                            ))}
                          </div>
                        )}
                        {message.actionPlan && (
                          <ActionPlanArtifact
                            onApprove={() => approvePlan(message, message.actionPlan!)}
                            onDismiss={() =>
                              setPlanStatuses((current) => ({ ...current, [message.id]: "dismissed" }))
                            }
                            onEdit={() => {
                              setInput(`Revise this plan before staging: ${message.actionPlan?.summary || ""}`);
                              textareaRef.current?.focus();
                            }}
                            plan={message.actionPlan}
                            status={planStatuses[message.id]}
                          />
                        )}
                        {message.suggestedChips && message.suggestedChips.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {message.suggestedChips.slice(0, 4).map((chip) => (
                              <button
                                className="gazelle-chip"
                                key={chip}
                                onClick={() => sendMessage(chip)}
                                type="button"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {streamingReply && (
                <article className="gazelle-message gazelle-message-assistant">
                  <div className="flex items-start gap-3.5">
                    <div className="gazelle-assistant-avatar">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 text-[11px] font-semibold text-[#343832]">Certo Work</div>
                      <RichText text={streamingReply} />
                      <span className="gazelle-stream-cursor" />
                    </div>
                  </div>
                </article>
              )}
              {submitting && !streamingReply && (
                <div className="flex items-center gap-3.5 py-6">
                  <div className="gazelle-assistant-avatar">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="gazelle-thinking-dot" />
                    <span className="gazelle-thinking-dot" />
                    <span className="gazelle-thinking-dot" />
                    <span className="ml-2 text-[10px] text-[#92968d]">
                      Checking capacity, conflicts, and context
                    </span>
                  </div>
                </div>
              )}
              {latestJudgment && latestJudgment.signals.length > 0 && (
                <JudgmentArtifact assessment={latestJudgment} />
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="gazelle-composer-wrap">
          <div className="gazelle-composer">
            <textarea
              aria-label="Message Certo Work"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Capture anything, plan the day, or pressure-test a commitment..."
              ref={textareaRef}
              rows={1}
              value={input}
            />
            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  aria-label={isListening ? "Stop voice capture" : "Start voice capture"}
                  className={`gazelle-composer-icon ${isListening ? "is-active" : ""}`}
                  disabled={!voiceSupported}
                  onClick={toggleListening}
                  title="Voice capture"
                  type="button"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <span className="hidden text-[9px] text-[#9a9d95] sm:inline">
                  {isListening ? "Listening..." : "Enter to send - Shift+Enter for a new line"}
                </span>
              </div>
              <button
                aria-label="Send message"
                className="gazelle-send-button"
                disabled={!input.trim() || submitting}
                onClick={() => sendMessage()}
                type="button"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[9px] text-[#a1a49b]">
            Certo Work shows assumptions and asks before making changes. You always retain override authority.
          </p>
        </div>
      </main>
  );

  if (embedded) return conversationMain;

  return (
    <div className="gazelle-conversation-shell">
      <button
        aria-label="Close navigation"
        className={`gazelle-mobile-scrim ${sidebarOpen || railOpen ? "is-open" : ""}`}
        onClick={() => {
          setSidebarOpen(false);
          setRailOpen(false);
        }}
        type="button"
      />

      <aside className={`gazelle-conversation-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="flex h-full flex-col">
          <div className="px-3.5 pb-2 pt-3.5">
            <button
              className="gazelle-workspace-button"
              onClick={() => setWorkspaceMenuOpen((current) => !current)}
              type="button"
            >
              <span className="gazelle-brand-mark">C</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-semibold text-[#242720]">
                  {workspace?.name || "Personal Focus"}
                </span>
                <span className="block text-[10px] text-[#8a8e82]">
                  {workspaces.length > 1 ? `${workspaces.length} workspaces` : "Private workspace"}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#8a8e82]" />
            </button>
            {workspaces.length > 1 && workspaceMenuOpen && (
              <div className="mt-1 rounded-xl border border-[#dfded7] bg-white p-1 shadow-lg">
                {workspaces.map((item) => (
                  <button
                    className="w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[#f3f3ed]"
                    key={item.id}
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      setWorkspace(item);
                    }}
                    type="button"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3.5 py-1">
            <button className="gazelle-new-chat" onClick={createConversation} type="button">
              <Plus className="h-3.5 w-3.5" />
              New conversation
              <span className="ml-auto hidden text-[9px] text-[#9a9c94] xl:inline">⌘ K</span>
            </button>
          </div>

          <div className="px-3.5 py-2">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#6f7369] hover:bg-[#eaeae3]"
              onClick={() => setSearchOpen((current) => !current)}
              type="button"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
            {searchOpen && (
              <input
                autoFocus
                className="mt-1 w-full rounded-lg border border-[#d7d7cf] bg-white px-3 py-2 text-xs outline-none focus:border-[#9da58f]"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations"
                value={searchQuery}
              />
            )}
          </div>

          <div className="gazelle-sidebar-scroll">
            <div className="px-3.5 pt-2">
              <p className="gazelle-sidebar-heading">Conversations</p>
              <div className="mt-1 space-y-0.5">
                {filteredConversations.slice(0, 8).map((conversation) => (
                  <button
                    className={`gazelle-conversation-row ${
                      conversation.id === conversationId ? "is-active" : ""
                    }`}
                    key={conversation.id}
                    onClick={() => {
                      setConversationId(conversation.id);
                      setSidebarOpen(false);
                    }}
                    type="button"
                  >
                    <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{conversation.title}</span>
                    <span className="text-[9px] text-[#a0a299]">{relativeDate(conversation.updatedAt)}</span>
                  </button>
                ))}
                {filteredConversations.length === 0 && (
                  <p className="px-2.5 py-2 text-[11px] leading-4 text-[#989b92]">
                    Your conversations will appear here.
                  </p>
                )}
              </div>
            </div>

            <div className="px-3.5 pt-5">
              <div className="flex items-center justify-between px-2">
                <p className="gazelle-sidebar-heading !px-0">Projects</p>
                <Link aria-label="View all projects" to="/work/projects">
                  <Plus className="h-3.5 w-3.5 text-[#94978f]" />
                </Link>
              </div>
              <div className="mt-1 space-y-0.5">
                {activeProjects.map((project: any, index) => (
                  <Link
                    className="gazelle-conversation-row"
                    key={project.id || index}
                    to={`/work/projects/${project.id}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-[3px] ${
                        index === 0
                          ? "bg-[#788a63]"
                          : index === 1
                            ? "bg-[#b68d58]"
                            : "bg-[#74808d]"
                      }`}
                    />
                    <span className="truncate">{project.title || project.name || "Untitled project"}</span>
                  </Link>
                ))}
                {activeProjects.length === 0 && (
                  <Link className="gazelle-conversation-row" to="/work/projects">
                    <FolderKanban className="h-3.5 w-3.5" />
                    Create your first project
                  </Link>
                )}
              </div>
            </div>

            <div className="px-3.5 pb-5 pt-5">
              <p className="gazelle-sidebar-heading">Your system</p>
              <div className="mt-1 grid grid-cols-2 gap-0.5">
                {MODULES.map(({ label, to, icon: Icon }) => (
                  <Link className="gazelle-module-link" key={to} to={to}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-[#deded6] p-3.5">
            <Link className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-[#e8e8e0]" to="/me">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#252921] text-[10px] font-bold text-white">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[#33362f]">{user?.displayName || userName}</p>
                <p className="truncate text-[9px] text-[#92958c]">{user?.email}</p>
              </div>
              <MoreHorizontal className="h-3.5 w-3.5 text-[#90938a]" />
            </Link>
          </div>
        </div>
      </aside>

      {conversationMain}

      <aside className={`gazelle-context-rail ${railOpen ? "is-open" : ""}`}>
        <div className="flex items-center justify-between border-b border-[#e7e6df] px-4 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#91958b]">Live context</p>
            <p className="mt-0.5 text-xs font-semibold text-[#31352e]">Workspace snapshot</p>
          </div>
          <button
            aria-label="Close context"
            className="gazelle-mobile-icon-button"
            onClick={() => setRailOpen(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="gazelle-rail-scroll">
          <section className="gazelle-rail-section">
            <div className="flex items-center justify-between">
              <p className="gazelle-rail-heading">Capacity</p>
              <Link className="text-[9px] font-semibold text-[#6c765e]" to="/today">
                Open today
              </Link>
            </div>
            <div className="mt-3 rounded-2xl border border-[#e2e2db] bg-white p-3.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[24px] font-medium tracking-[-0.04em] text-[#252922]">
                    {capacity?.dueToday ?? 0}
                  </p>
                  <p className="text-[10px] text-[#8c9087]">items due today</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[#66705b]">
                    {capacity?.activeProjects ?? activeProjects.length} active
                  </p>
                  <p className="text-[9px] text-[#999c94]">projects</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ecece6]">
                <div
                  className="h-full rounded-full bg-[#7d9067] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((capacity?.estimatedLoadMinutes || 0) / (capacity?.availableMinutes || 360)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[9px] leading-4 text-[#92968d]">
                Based on open work and a six-hour planning capacity.
              </p>
            </div>
          </section>

          <section className="gazelle-rail-section">
            <div className="flex items-center justify-between">
              <p className="gazelle-rail-heading">Judgment engine</p>
              <span
                className={`h-2 w-2 rounded-full ${
                  latestJudgment?.verdict === "stop"
                    ? "bg-[#c46b54]"
                    : latestJudgment?.verdict === "challenge"
                      ? "bg-[#b79843]"
                      : "bg-[#72885d]"
                }`}
              />
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["Calendar conflicts", latestJudgment?.signals.some((signal) => signal.id.includes("date"))],
                ["Capacity & WIP", latestJudgment?.signals.some((signal) => ["daily-capacity", "wip-overload"].includes(signal.id))],
                ["Duplicate work", latestJudgment?.signals.some((signal) => signal.id === "duplicate-work")],
                ["Action clarity", latestJudgment?.signals.some((signal) => ["vague-action", "missing-outcome"].includes(signal.id))],
              ].map(([label, flagged]) => (
                <div className="flex items-center justify-between text-[11px]" key={String(label)}>
                  <span className="text-[#656a61]">{String(label)}</span>
                  {flagged ? (
                    <span className="rounded-full bg-[#f2ead5] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#7e692b]">
                      Review
                    </span>
                  ) : (
                    <Check className="h-3.5 w-3.5 text-[#748466]" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {latestJudgment && (
            <section className="gazelle-rail-section">
              <p className="gazelle-rail-heading">Assessment</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(latestJudgment.dimensions).map(([label, value]) => (
                  <div className="rounded-xl bg-[#f2f2ed] px-2.5 py-2" key={label}>
                    <p className="truncate text-[8px] font-bold uppercase tracking-wider text-[#94978e]">
                      {label.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold capitalize text-[#53594f]">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="gazelle-rail-section">
            <div className="flex items-center justify-between">
              <p className="gazelle-rail-heading">Memory & evidence</p>
              <Brain className="h-3.5 w-3.5 text-[#8a8f83]" />
            </div>
            <div className="mt-3 rounded-xl border border-dashed border-[#d9d9d1] px-3 py-3">
              <p className="text-[10px] leading-4 text-[#7f837a]">
                Answers use workspace-scoped tasks, projects, goals, conversations, and cited knowledge. No cross-workspace memory is mixed.
              </p>
            </div>
          </section>

          <section className="gazelle-rail-section">
            <p className="gazelle-rail-heading">Bounded team</p>
            <div className="mt-3 space-y-2">
              {SPECIALIST_AGENTS.map((agent, index) => {
                const icons = [
                  Inbox,
                  FolderKanban,
                  CalendarDays,
                  ShieldCheck,
                  Brain,
                  FileText,
                  MessageSquareText,
                  FileText,
                ];
                const Icon = icons[index];
                return (
                <div className="flex items-center gap-2.5 text-[10px] text-[#676c62]" key={agent.id}>
                  <div className="rounded-md bg-[#eef0e9] p-1.5">
                    <Icon className="h-3 w-3" />
                  </div>
                  <span>{agent.name}</span>
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#7e916a]" />
                </div>
                );
              })}
            </div>
          </section>

          <section className="gazelle-rail-section">
            <div className="flex items-center gap-2 text-[10px] text-[#8d9187]">
              <History className="h-3.5 w-3.5" />
              <span>Actions are logged and recoverable.</span>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
