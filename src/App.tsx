import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, Settings, CheckSquare, LogIn, Loader2, 
  Layers, Briefcase, Zap, Activity, TrendingUp, Dumbbell, Brain, Sparkles, 
  ChevronRight, MessageSquare, Inbox,
  Clock, BookOpen, ArrowUp, ShieldCheck, Menu, X, PanelRight, Plus, Search,
  MoreHorizontal
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from './lib/AuthContext';
import { UndoProvider } from './lib/UndoContext';
import { BoldiAssistant } from './components/BoldiAssistant';
import { db } from './lib/firebase';

function lazyNamed<T extends React.ComponentType<any>>(
  loader: () => Promise<any>,
  exportName: string,
) {
  return React.lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as T };
  });
}

const Today = lazyNamed(() => import('./components/Today'), 'Today');
const PlanPage = lazyNamed(() => import('./components/Plan'), 'Plan');
const ReviewHub = lazyNamed(() => import('./components/ReviewHub'), 'ReviewHub');
const Capture = lazyNamed(() => import('./components/Capture'), 'Capture');
const Work = lazyNamed(() => import('./components/Work'), 'Work');
const Me = lazyNamed(() => import('./components/Me'), 'Me');
const WarRoom = lazyNamed(() => import('./components/warroom/WarRoom'), 'WarRoom');
const TasksList = lazyNamed(() => import('./components/TasksList'), 'TasksList');
const TaskDetails = lazyNamed(() => import('./components/TaskDetails'), 'TaskDetails');
const ProjectsList = lazyNamed(() => import('./components/ProjectsList'), 'ProjectsList');
const ProjectDetails = lazyNamed(() => import('./components/ProjectDetails'), 'ProjectDetails');
const PlaybookDetails = lazyNamed(() => import('./components/PlaybookDetails'), 'PlaybookDetails');
const KnowledgeBase = lazyNamed(() => import('./components/KnowledgeBase'), 'KnowledgeBase');
const SkillDetail = lazyNamed(() => import('./components/SkillDetail'), 'SkillDetail');
const KnowledgeDetail = lazyNamed(() => import('./components/KnowledgeDetail'), 'KnowledgeDetail');
const StakeholdersList = lazyNamed(() => import('./components/StakeholdersList'), 'StakeholdersList');
const ProjectHealthCommandCenter = lazyNamed(
  () => import('./components/ProjectHealthCommandCenter'),
  'ProjectHealthCommandCenter',
);
const TimeBlocksPlanner = lazyNamed(() => import('./components/TimeBlocksPlanner'), 'TimeBlocksPlanner');
const GenericModulePage = lazyNamed(() => import('./components/GenericModulePage'), 'GenericModulePage');
const GenericModuleDetail = lazyNamed(() => import('./components/GenericModuleDetail'), 'GenericModuleDetail');
const NotionConnector = lazyNamed(() => import('./components/NotionConnector'), 'NotionConnector');
const DailyShutdown = lazyNamed(() => import('./components/DailyShutdown'), 'DailyShutdown');
const MonthlyPlanningRitual = lazyNamed(
  () => import('./components/MonthlyPlanningRitual'),
  'MonthlyPlanningRitual',
);
const DataIntegrity = lazyNamed(() => import('./components/DataIntegrity'), 'DataIntegrity');
const GlobalUndoRedo = lazyNamed(() => import('./components/GlobalUndoRedo'), 'GlobalUndoRedo');
const HabitsHome = lazyNamed(() => import('./components/Habits/HabitsHome'), 'HabitsHome');
const WorkoutsHome = lazyNamed(() => import('./components/Workouts/WorkoutsHome'), 'WorkoutsHome');
const ProgressDashboard = lazyNamed(() => import('./components/ProgressDashboard'), 'ProgressDashboard');
const UnifiedCalendar = lazyNamed(
  () => import('./components/Calendar/UnifiedCalendar'),
  'UnifiedCalendar',
);
const DailyMetrics = lazyNamed(() => import('./components/DailyMetrics'), 'DailyMetrics');
const PerformanceHub = lazyNamed(
  () => import('./components/PeakPerformance/PerformanceHub'),
  'PerformanceHub',
);
const BoldrOSHub = lazyNamed(() => import('./components/BoldrOS/BoldrOSHub'), 'BoldrOSHub');
const StrategyCenter = lazyNamed(() => import('./components/StrategyCenter'), 'StrategyCenter');
const BoldiFloatingWidget = lazyNamed(
  () => import('./components/BoldiFloatingWidget'),
  'BoldiFloatingWidget',
);
const RoutineTasksView = lazyNamed(() => import('./components/RoutineTasksView'), 'RoutineTasksView');
const WorkspaceSettings = lazyNamed(() => import('./components/WorkspaceSettings'), 'WorkspaceSettings');
const PlatformHealth = lazyNamed(
  () => import('./components/Settings/PlatformHealth'),
  'PlatformHealth',
);
const SetupSettings = lazyNamed(() => import('./components/Settings/SetupSettings'), 'SetupSettings');
const BoldiSettings = lazyNamed(() => import('./components/Settings/BoldiSettings'), 'BoldiSettings');
const Integrations = lazyNamed(() => import('./components/Settings/Integrations'), 'Integrations');
const SettingsIndex = lazyNamed(() => import('./components/Settings/SettingsIndex'), 'SettingsIndex');
const ReviewQueue = lazyNamed(() => import('./components/ReviewQueue'), 'ReviewQueue');
const DailyClarityModal = lazyNamed(
  () => import('./components/DailyClarityModal'),
  'DailyClarityModal',
);

function RedirectToTask() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/work/action-board/${id}`} replace />;
}

export function checkRouteActive(to: string, path: string) {
  if (to === "/") {
    return path === "/";
  }
  return path.startsWith(to);
}

const SECTIONS = [
  {
    id: "today",
    title: "Today",
    path: "/today",
    description: "Run the day.",
    icon: CalendarIcon,
    items: [
      { to: "/today/focus", label: "Focus", icon: Brain },
      { to: "/today/agenda", label: "Agenda", icon: Clock },
      { to: "/today/routines", label: "Routines", icon: Zap }
    ]
  },
  {
    id: "capture",
    title: "Capture",
    path: "/capture",
    description: "Collect and clarify inputs.",
    icon: Inbox,
    items: [
      { to: "/capture/inbox", label: "Inbox", icon: Inbox },
      { to: "/capture/documents", label: "Docs", icon: BookOpen },
      { to: "/capture/ideas", label: "Ideas", icon: Sparkles },
      { to: "/capture/review", label: "Needs Review", icon: Activity }
    ]
  },
  {
    id: "work",
    title: "Work",
    path: "/work",
    description: "Execute tasks and move projects/deals.",
    icon: Briefcase,
    items: [
      { to: "/work/action-board", label: "Action Board", icon: CheckSquare },
      { to: "/work/projects", label: "Projects & Deals", icon: Layers },
      { to: "/work/agent-workspace", label: "Agent Workspace", icon: MessageSquare },
      { to: "/work/documents", label: "Documents", icon: BookOpen }
    ]
  },
  {
    id: "plan",
    title: "Plan",
    path: "/plan",
    description: "Plan across time horizons.",
    icon: Layers,
    items: [
      { to: "/plan/week", label: "Week", icon: CalendarIcon },
      { to: "/plan/month", label: "Month", icon: Clock },
      { to: "/plan/quarter", label: "Quarter", icon: Layers },
      { to: "/plan/year", label: "Year", icon: TrendingUp },
      { to: "/plan/strategy", label: "Strategy", icon: Activity }
    ]
  },
  {
    id: "review",
    title: "Review",
    path: "/review",
    description: "Reflect, measure, improve.",
    icon: Activity,
    items: [
      { to: "/review/weekly", label: "Weekly Review", icon: CalendarIcon },
      { to: "/review/metrics", label: "Metrics", icon: TrendingUp },
      { to: "/review/habits", label: "Habits", icon: Zap },
      { to: "/review/health", label: "Health", icon: Activity },
      { to: "/review/workouts", label: "Workouts", icon: Dumbbell }
    ]
  }
];

function isSectionActive(sec: any, pathname: string) {
  if (sec.path === "/today") {
    return pathname === "/" || pathname === "/today" || sec.items.some((item: any) => pathname.startsWith(item.to));
  }
  return pathname.startsWith(sec.path) || sec.items.some((item: any) => pathname.startsWith(item.to));
}

function timestampValue(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (typeof value === "number") return value;
  return 0;
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

function sectionForPath(pathname: string) {
  if (pathname === "/boldi" || pathname === "/") {
    return {
      title: "Chief of Staff",
      description: "Conversation, judgment, and action proposals.",
      eyebrow: "Conversation home",
    };
  }
  if (pathname.startsWith("/settings") || pathname.startsWith("/me")) {
    return {
      title: "Settings",
      description: "Account, workspace, platform health, and connected services.",
      eyebrow: "System profile",
    };
  }
  if (pathname.startsWith("/boldr")) {
    return {
      title: "Boldr OS",
      description: "Operating rhythm, delivery health, and internal coordination.",
      eyebrow: "Company operating layer",
    };
  }
  const section = SECTIONS.find((item) => isSectionActive(item, pathname));
  return {
    title: section?.title || "Workspace",
    description: section?.description || "Move between your work without changing context.",
    eyebrow: section ? "Workspace module" : "Gazelle",
  };
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, workspace } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [railOpen, setRailOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [conversations, setConversations] = React.useState<any[]>([]);
  const [projects, setProjects] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!user || !workspace) return;
    const q = query(
      collection(db, "boldi_conversations"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "active"),
    );
    return onSnapshot(q, (snap) => {
      setConversations(
        (snap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a: any, b: any) => timestampValue(b.updatedAt || b.createdAt) - timestampValue(a.updatedAt || a.createdAt)) as any[]),
      );
    });
  }, [user, workspace]);

  React.useEffect(() => {
    if (!user || !workspace) return;
    const q = query(
      collection(db, "projects"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
    );
    return onSnapshot(q, (snap) => {
      setProjects(
        (snap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((project: any) => !["done", "completed", "archived"].includes(String(project.status || "").toLowerCase()))
          .sort((a: any, b: any) => timestampValue(b.updatedAt || b.createdAt) - timestampValue(a.updatedAt || a.createdAt))
          .slice(0, 6) as any[]),
      );
    });
  }, [user, workspace]);

  const currentSection = sectionForPath(location.pathname);
  const isConversationHome = location.pathname === "/boldi";
  const filteredConversations = conversations.filter((conversation) =>
    !searchQuery.trim() || String(conversation.title || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const renderedChild = React.cloneElement(children as React.ReactElement, {
    key: location.pathname,
    location,
    ...(isConversationHome
      ? {
          embedded: true,
          onOpenNavigation: () => setSidebarOpen(true),
          onOpenContext: () => setRailOpen(true),
        }
      : {}),
  });

  return (
    <div className="gazelle-conversation-shell gazelle-app-shell">
      <button
        aria-label="Close panels"
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
            <Link className="gazelle-workspace-button" to="/boldi" onClick={() => setSidebarOpen(false)}>
              <span className="gazelle-brand-mark">G</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-semibold text-[#242720]">
                  {workspace?.name || "Personal Focus"}
                </span>
                <span className="block text-[10px] text-[#8a8e82]">Gazelle workspace</span>
              </span>
              <Sparkles className="h-3.5 w-3.5 text-[#7c8a6c]" />
            </Link>
          </div>

          <div className="px-3.5 py-1">
            <Link className="gazelle-new-chat" to="/boldi" onClick={() => setSidebarOpen(false)}>
              <Plus className="h-3.5 w-3.5" />
              New conversation
            </Link>
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
                {filteredConversations.slice(0, 6).map((conversation) => (
                  <Link
                    className={`gazelle-conversation-row ${isConversationHome ? "is-active" : ""}`}
                    key={conversation.id}
                    onClick={() => setSidebarOpen(false)}
                    to="/boldi"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{conversation.title || "New conversation"}</span>
                    <span className="text-[9px] text-[#a0a299]">{relativeDate(conversation.updatedAt)}</span>
                  </Link>
                ))}
                {filteredConversations.length === 0 && (
                  <Link className={`gazelle-conversation-row ${isConversationHome ? "is-active" : ""}`} to="/boldi">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>Chief of Staff home</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="px-3.5 pt-5">
              <div className="flex items-center justify-between px-2">
                <p className="gazelle-sidebar-heading !px-0">Projects</p>
                <Link aria-label="View all projects" to="/work/projects" onClick={() => setSidebarOpen(false)}>
                  <Plus className="h-3.5 w-3.5 text-[#94978f]" />
                </Link>
              </div>
              <div className="mt-1 space-y-0.5">
                {projects.map((project, index) => (
                  <Link
                    className={`gazelle-conversation-row ${location.pathname === `/work/projects/${project.id}` ? "is-active" : ""}`}
                    key={project.id || index}
                    onClick={() => setSidebarOpen(false)}
                    to={`/work/projects/${project.id}`}
                  >
                    <span className="h-2 w-2 rounded-[3px] bg-[#788a63]" />
                    <span className="truncate">{project.title || "Untitled project"}</span>
                  </Link>
                ))}
                {projects.length === 0 && (
                  <Link className="gazelle-conversation-row" to="/work/projects" onClick={() => setSidebarOpen(false)}>
                    <Layers className="h-3.5 w-3.5" />
                    Create your first project
                  </Link>
                )}
              </div>
            </div>

            <div className="px-3.5 pb-5 pt-5">
              <p className="gazelle-sidebar-heading">Your system</p>
              <div className="mt-1 space-y-3">
                {SECTIONS.map((section) => {
                  const active = isSectionActive(section, location.pathname);
                  return (
                    <div key={section.id}>
                      <Link
                        className={`gazelle-system-section ${active ? "is-active" : ""}`}
                        onClick={() => setSidebarOpen(false)}
                        to={section.path}
                      >
                        <section.icon className="h-3.5 w-3.5" />
                        <span>{section.title}</span>
                      </Link>
                      {active && (
                        <div className="ml-4 mt-1 space-y-0.5 border-l border-[#deded6] pl-2">
                          {section.items.map((item) => (
                            <Link
                              className={`gazelle-module-link ${checkRouteActive(item.to, location.pathname) ? "is-active" : ""}`}
                              key={item.to}
                              onClick={() => setSidebarOpen(false)}
                              to={item.to}
                            >
                              <item.icon className="h-3.5 w-3.5" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-[#deded6] p-3.5">
            <button
              className="mb-2 flex w-full items-center gap-2.5 rounded-xl p-2 text-left text-[11px] font-semibold text-[#594923] hover:bg-[#efe6cf]"
              onClick={() => {
                setSidebarOpen(false);
                window.dispatchEvent(new CustomEvent('open-clarity-reset'));
              }}
              type="button"
            >
              <Brain className="h-3.5 w-3.5" />
              Clarity Reset
            </button>
            <Link className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-[#e8e8e0]" to="/me" onClick={() => setSidebarOpen(false)}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#252921] text-[10px] font-bold text-white">
                {user?.email?.slice(0, 2).toUpperCase() || "EX"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[#33362f]">{user?.email?.split("@")[0] || "Executive"}</p>
                <p className="truncate text-[9px] text-[#92958c]">{user?.email || "Settings"}</p>
              </div>
              <MoreHorizontal className="h-3.5 w-3.5 text-[#90938a]" />
            </Link>
          </div>
        </div>
      </aside>

      {isConversationHome ? (
        <AnimatePresence mode="wait">{renderedChild}</AnimatePresence>
      ) : (
        <main className="gazelle-conversation-main gazelle-page-main">
          <header className="gazelle-chat-header">
            <button
              aria-label="Open navigation"
              className="gazelle-mobile-icon-button"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] text-[#96998f]">
                <span>{currentSection.eyebrow}</span>
                <ChevronRight className="h-2.5 w-2.5" />
                <span className="truncate">{workspace?.name || "Personal Focus"}</span>
              </div>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-[#343832]">{currentSection.title}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Link className="gazelle-header-button" to="/boldi">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ask Gazelle</span>
              </Link>
              <button
                aria-label="Open context"
                className="gazelle-mobile-icon-button"
                onClick={() => setRailOpen(true)}
                type="button"
              >
                <PanelRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </header>
          <div className="gazelle-message-viewport gazelle-page-viewport">
            <AnimatePresence mode="wait">{renderedChild}</AnimatePresence>
          </div>
        </main>
      )}

      <aside className={`gazelle-context-rail ${railOpen ? "is-open" : ""}`}>
        <div className="flex items-center justify-between border-b border-[#e7e6df] px-4 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#91958b]">Live context</p>
            <p className="mt-0.5 text-xs font-semibold text-[#31352e]">{currentSection.title}</p>
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
            <p className="gazelle-rail-heading">Where you are</p>
            <p className="mt-3 text-[11px] leading-5 text-[#676c62]">{currentSection.description}</p>
          </section>
          <section className="gazelle-rail-section">
            <p className="gazelle-rail-heading">Fast moves</p>
            <div className="mt-3 space-y-1">
              {[
                { to: "/boldi", label: "Open conversation", icon: Sparkles },
                { to: "/capture", label: "Capture input", icon: Inbox },
                { to: "/work/action-board", label: "Open tasks", icon: CheckSquare },
                { to: "/capture/review", label: "Review proposals", icon: ShieldCheck },
              ].map((item) => (
                <Link
                  className="gazelle-conversation-row"
                  key={item.to}
                  onClick={() => setRailOpen(false)}
                  to={item.to}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
          <section className="gazelle-rail-section">
            <p className="gazelle-rail-heading">Continuity</p>
            <div className="mt-3 rounded-xl border border-dashed border-[#d9d9d1] px-3 py-3">
              <p className="text-[10px] leading-4 text-[#7f837a]">
                Projects, tasks, planning, review, and capture now open inside the same workspace frame. Use the left rail to move without losing orientation.
              </p>
            </div>
          </section>
          <section className="gazelle-rail-section">
            <div className="flex items-center gap-2 text-[10px] text-[#8d9187]">
              <Settings className="h-3.5 w-3.5" />
              <span>Actions remain approval-gated and recoverable.</span>
            </div>
          </section>
        </div>
      </aside>

      {!isConversationHome && <BoldiFloatingWidget />}
    </div>
  );
}

export default function App() {
  const { user, loading, signIn, workspace } = useAuth();
  const [isClarityOpen, setIsClarityOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpenClarity = () => {
      setIsClarityOpen(true);
    };
    window.addEventListener("open-clarity-reset", handleOpenClarity);
    return () => {
      window.removeEventListener("open-clarity-reset", handleOpenClarity);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] overflow-hidden bg-[#f7f6f1] text-[#20231e]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_30%,rgba(190,207,167,0.5),transparent_31%)]" />
        <header className="relative z-10 flex h-16 items-center justify-between border-b border-black/[0.06] px-5 md:px-9">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#242821] text-xs font-bold text-white shadow-sm">
              G
            </div>
            <div>
              <p className="text-xs font-black tracking-[0.15em]">GAZELLE</p>
              <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#8b8f85]">by Boldr AI</p>
            </div>
          </div>
          <span className="rounded-full border border-[#d7ddcf] bg-white/60 px-3 py-1.5 text-[9px] font-semibold text-[#647057]">
            Accountable by design
          </span>
        </header>
        <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-64px)] max-w-6xl items-center gap-12 px-6 py-12 md:grid-cols-[1.05fr_0.95fr] md:px-10">
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#748265]">
              Your AI Chief of Staff
            </p>
            <h1 className="mt-5 max-w-xl text-balance text-[clamp(42px,6vw,72px)] font-medium leading-[0.98] tracking-[-0.055em]">
              Your work, with judgment.
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-7 text-[#747970]">
              Capture anything. Build realistic plans. Pressure-test commitments. Approve every action before it changes your system.
            </p>
            <button
              onClick={signIn}
              className="mt-9 flex items-center gap-2.5 rounded-xl bg-[#242821] px-5 py-3 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(31,36,28,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#3b4434]"
            >
              <LogIn className="h-4 w-4" />
              Continue with Google
            </button>
            <p className="mt-3 text-[9px] text-[#9a9e95]">Workspace-scoped memory · Approval-gated actions · Recoverable changes</p>
          </section>
          <section className="rounded-[28px] border border-white/80 bg-white/68 p-3 shadow-[0_24px_70px_rgba(43,52,35,0.12)] backdrop-blur-xl">
            <div className="rounded-[21px] border border-[#e0e2da] bg-[#fbfbf8] p-5">
              <div className="flex items-center justify-between border-b border-[#e8e8e2] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#e6eddc] text-[#627153]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Chief of Staff</p>
                    <p className="text-[9px] text-[#92968d]">Live workspace context</p>
                  </div>
                </div>
                <span className="h-2 w-2 rounded-full bg-[#73885f]" />
              </div>
              <div className="py-6">
                <p className="text-sm font-semibold">“Add the new launch project for this week.”</p>
                <div className="mt-5 rounded-2xl border border-[#e5d8ab] bg-[#fffdf5] p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#89712e]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Judgment preflight
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#55594f]">
                    This week is already tight. Four projects are active and two deadlines conflict. Finish or pause one before committing.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] text-[#73776e]">Review trade-offs</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] text-[#73776e]">Capture for next week</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#e2e2dc] bg-white px-3 py-2.5">
                <span className="text-[10px] text-[#9a9d95]">Nothing changes without your approval</span>
                <ArrowUp className="h-4 w-4 text-[#66745a]" />
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <UndoProvider>
      <BrowserRouter>
        <React.Suspense
          fallback={
            <div className="grid min-h-[100dvh] place-items-center bg-[#faf9f5]">
              <div className="flex items-center gap-2 text-xs font-medium text-[#7c8276]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening your workspace
              </div>
            </div>
          }
        >
          <Layout>
            <Routes>
            <Route path="/" element={<Navigate to="/boldi" replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/today/focus" element={<Today />} />
            <Route path="/today/agenda" element={<UnifiedCalendar />} />
            <Route path="/today/routines" element={<RoutineTasksView />} />

            <Route path="/capture" element={<Capture />} />
            <Route path="/capture/inbox" element={<Navigate to="/capture" replace />} />
            <Route path="/capture/meeting-intake" element={<Navigate to="/capture" replace />} />
            <Route path="/capture/documents" element={<KnowledgeBase />} />
            <Route path="/capture/ideas" element={<GenericModulePage title="Ideas" collectionName="someday" entityName="Idea" />} />
            <Route path="/capture/ideas/:id" element={<GenericModuleDetail collectionName="someday" />} />
            <Route path="/capture/review" element={<ReviewQueue />} />
            <Route path="/capture/review/:id" element={<Navigate to="/capture/review" replace />} />

            <Route path="/work" element={<Work />} />
            <Route path="/work/action-board" element={<TasksList />} />
            <Route path="/work/action-board/:id" element={<TaskDetails />} />
            <Route path="/work/projects" element={<ProjectsList />} />
            <Route path="/work/projects/:id" element={<ProjectDetails />} />
            <Route path="/work/deals" element={<ProjectsList />} />
            <Route path="/work/agent-workspace" element={<WarRoom />} />
            <Route path="/work/agent-workspace/:id" element={<WarRoom />} />
            <Route path="/work/documents" element={<Navigate to="/capture/documents?tab=documents" replace />} />
            <Route path="/work/documents/:id" element={<KnowledgeDetail />} />
            <Route path="/work/knowledge" element={<Navigate to="/capture/documents?tab=documents" replace />} />
            <Route path="/work/knowledge/:id" element={<KnowledgeDetail />} />
            <Route path="/work/timeblocks" element={<TimeBlocksPlanner />} />
            <Route path="/work/calendar" element={<Navigate to="/today/agenda" replace />} />
            <Route path="/work/routines" element={<Navigate to="/today/routines" replace />} />
            <Route path="/work/meeting-intake" element={<Navigate to="/capture" replace />} />
            <Route path="/work/warroom" element={<Navigate to="/work/agent-workspace" replace />} />
            <Route path="/work/habits" element={<Navigate to="/review/habits" replace />} />
            <Route path="/work/workouts" element={<Navigate to="/review/workouts" replace />} />
            <Route path="/work/strategy" element={<Navigate to="/plan/strategy" replace />} />

            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/week" element={<ReviewHub />} />
            <Route path="/plan/month" element={<MonthlyPlanningRitual />} />
            <Route path="/plan/quarter" element={<PlanPage />} />
            <Route path="/plan/year" element={<PlanPage />} />
            <Route path="/plan/strategy" element={<StrategyCenter />} />

            <Route path="/review" element={<ReviewHub />} />
            <Route path="/review/weekly" element={<ReviewHub />} />
            <Route path="/review/monthly" element={<ReviewHub />} />
            <Route path="/review/quarterly" element={<ReviewHub />} />
            <Route path="/review/metrics" element={<ProgressDashboard />} />
            <Route path="/review/habits" element={<HabitsHome />} />
            <Route path="/review/health" element={<DailyMetrics />} />
            <Route path="/review/workouts" element={<WorkoutsHome />} />
            <Route path="/boldi" element={<BoldiAssistant />} />

            {/* Other routes that exist */}
            <Route path="/work/stakeholders" element={<StakeholdersList />} />
            <Route path="/work/playbooks" element={<Navigate to="/capture/documents?tab=playbooks" replace />} />
            <Route path="/work/playbooks/:id" element={<PlaybookDetails />} />
            <Route path="/work/projects/health" element={<ProjectHealthCommandCenter />} />
            <Route path="/work/decisions" element={<GenericModulePage title="Decisions" collectionName="decisions" entityName="Decision" />} />
            <Route path="/work/decisions/:id" element={<GenericModuleDetail collectionName="decisions" />} />
            <Route path="/work/waiting" element={<GenericModulePage title="Waiting For" collectionName="waiting_for" entityName="Waiting For" />} />
            <Route path="/work/waiting/:id" element={<GenericModuleDetail collectionName="waiting_for" />} />
            <Route path="/work/presentations" element={<GenericModulePage title="Presentations" collectionName="presentations" entityName="Presentation" />} />
            <Route path="/work/presentations/:id" element={<GenericModuleDetail collectionName="presentations" />} />
            <Route path="/work/skills" element={<Navigate to="/capture/documents?tab=skills" replace />} />
            <Route path="/work/skills/:id" element={<SkillDetail />} />
            <Route path="/work/health" element={<GenericModulePage title="Health Actions" collectionName="health_actions" entityName="Health Action" />} />
            <Route path="/work/health/:id" element={<GenericModuleDetail collectionName="health_actions" />} />
            <Route path="/work/daily-shutdown" element={<DailyShutdown />} />
            
            {/* New Settings Routes */}
            <Route path="/settings/workspace" element={<WorkspaceSettings />} />
            <Route path="/settings/integrations" element={<Integrations />} />
            <Route path="/settings/integrations/notion" element={<NotionConnector />} />
            <Route path="/settings/boldi" element={<BoldiSettings />} />
            <Route path="/settings/boldi/context" element={<GenericModulePage title="System Context" collectionName="system_context" entityName="Context File" />} />
            <Route path="/settings/boldi/context/:id" element={<GenericModuleDetail collectionName="system_context" />} />
            <Route path="/settings/boldi/tools" element={<GenericModulePage title="Tool Permissions" collectionName="tool_permissions" entityName="Permission" />} />
            <Route path="/settings/boldi/tools/:id" element={<GenericModuleDetail collectionName="tool_permissions" />} />
            <Route path="/settings/boldi/automations" element={<GenericModulePage title="Scheduled Tasks" collectionName="scheduled_tasks" entityName="Schedule" />} />
            <Route path="/settings/boldi/automations/:id" element={<GenericModuleDetail collectionName="scheduled_tasks" />} />
            <Route path="/settings/platform-health" element={<PlatformHealth />} />
            <Route path="/settings/data" element={<DataIntegrity />} />
            <Route path="/settings/setup" element={<SetupSettings />} />
            <Route path="/settings" element={<SettingsIndex />} />

            <Route path="/me" element={<Me />} />
            <Route path="/me/analytics" element={<ProgressDashboard />} />
            <Route path="/me/self-mastery" element={<PerformanceHub />} />
            <Route path="/me/metrics" element={<DailyMetrics />} />

            <Route path="/boldr/*" element={<BoldrOSHub />} />

            {/* Redirects */}
            <Route path="/me/system-context" element={<Navigate to="/settings/boldi/context" replace />} />
            <Route path="/me/tool-permissions" element={<Navigate to="/settings/boldi/tools" replace />} />
            <Route path="/me/scheduled-tasks" element={<Navigate to="/settings/boldi/automations" replace />} />
            <Route path="/me/system-review" element={<Navigate to="/settings/platform-health" replace />} />
            <Route path="/me/data-integrity-export" element={<Navigate to="/settings/data" replace />} />
            <Route path="/me/data-integrity" element={<Navigate to="/settings/data" replace />} />
            <Route path="/me/create-starter-system" element={<Navigate to="/settings/setup" replace />} />
            <Route path="/me/create-starter-context" element={<Navigate to="/settings/setup" replace />} />
            <Route path="/me/workspace-settings" element={<Navigate to="/settings/workspace" replace />} />
            <Route path="/me/workspace" element={<Navigate to="/settings/workspace" replace />} />
            <Route path="/me/context" element={<Navigate to="/settings/boldi/context" replace />} />
            <Route path="/me/permissions" element={<Navigate to="/settings/boldi/tools" replace />} />
            <Route path="/me/scheduled" element={<Navigate to="/settings/boldi/automations" replace />} />
            <Route path="/me/reviews" element={<Navigate to="/settings/platform-health" replace />} />
            <Route path="/me/notion" element={<Navigate to="/settings/integrations/notion" replace />} />

            <Route path="/inbox" element={<Navigate to="/capture/inbox" replace />} />
            <Route path="/rich-capture" element={<Navigate to="/capture/inbox" replace />} />
            <Route path="/meeting-intake" element={<Navigate to="/capture" replace />} />
            <Route path="/documents" element={<Navigate to="/capture/documents" replace />} />
            <Route path="/ideas-someday" element={<Navigate to="/capture/ideas" replace />} />
            
            <Route path="/action-board" element={<Navigate to="/work/action-board" replace />} />
            <Route path="/work/tasks" element={<Navigate to="/work/action-board" replace />} />
            <Route path="/work/tasks/:id" element={<RedirectToTask />} />
            <Route path="/projects-deals" element={<Navigate to="/work/projects" replace />} />
            <Route path="/operations-hub" element={<Navigate to="/work" replace />} />
            
            <Route path="/weekly-plan" element={<Navigate to="/plan/week" replace />} />
            <Route path="/monthly-plan" element={<Navigate to="/plan/month" replace />} />
            <Route path="/strategy-center" element={<Navigate to="/plan/strategy" replace />} />
            <Route path="/os-command" element={<Navigate to="/plan/strategy" replace />} />
            
            <Route path="/system-review" element={<Navigate to="/review/weekly" replace />} />
            <Route path="/progress-metrics" element={<Navigate to="/review/metrics" replace />} />
            <Route path="/habits-tracker" element={<Navigate to="/review/habits" replace />} />
            <Route path="/health-whoop" element={<Navigate to="/review/health" replace />} />
            <Route path="/workouts-rituals" element={<Navigate to="/review/workouts" replace />} />
            <Route path="/routine-tasks" element={<Navigate to="/today/routines" replace />} />
            <Route path="/unified-calendar" element={<Navigate to="/today/agenda" replace />} />
            
            <Route path="/agent-workspace" element={<Navigate to="/work/agent-workspace" replace />} />
            </Routes>
          </Layout>
          <GlobalUndoRedo />
          {isClarityOpen && (
            <DailyClarityModal 
              isOpen={isClarityOpen} 
              onClose={() => setIsClarityOpen(false)} 
              workspaceId={workspace?.id || ""} 
            />
          )}
        </React.Suspense>
      </BrowserRouter>
    </UndoProvider>
  );
}
