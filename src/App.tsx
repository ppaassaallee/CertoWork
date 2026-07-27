import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, Settings, CheckSquare, LogIn, Loader2, 
  Layers, Briefcase, Zap, Activity, TrendingUp, Dumbbell, Brain, Sparkles, 
  ChevronLeft, ChevronRight, MessageSquare, Inbox, 
  Clock, BookOpen, ArrowUp, ShieldCheck
} from 'lucide-react';
import { useAuth } from './lib/AuthContext';
import { UndoProvider } from './lib/UndoContext';
import { BoldiAssistant } from './components/BoldiAssistant';

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
const WorkspaceSwitcher = lazyNamed(() => import('./components/WorkspaceSwitcher'), 'WorkspaceSwitcher');
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

function NavLink({ to, icon: Icon, label }: { to: string, icon: React.ElementType, label: string }) {
  const location = useLocation();
  const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  
  return (
    <Link 
      to={to} 
      className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-xl transition-all ${
        isActive 
          ? 'text-black font-extrabold' 
          : 'text-gray-400 hover:text-gray-700'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-black' : ''}`} />
      <span className="text-[9px] font-bold tracking-tight uppercase">{label}</span>
    </Link>
  );
}

export function checkRouteActive(to: string, path: string) {
  if (to === "/") {
    return path === "/";
  }
  return path.startsWith(to);
}

function SidebarLink({ to, icon: Icon, label }: { to: string, icon: React.ElementType, label: string, isCollapsed?: boolean }) {
  const location = useLocation();
  const isActive = checkRouteActive(to, location.pathname);

  return (
    <Link 
      to={to} 
      className={`relative flex items-center gap-2.5 py-1.5 px-3 rounded-lg transition-all text-xs group ${
        isActive 
          ? 'bg-gray-100 text-black font-bold' 
          : 'text-gray-500 hover:text-black hover:bg-gray-50'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-black' : 'text-gray-400 group-hover:text-black'}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
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

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    const saved = localStorage.getItem("gazelle_sidebar_collapsed");
    return saved ? saved === "true" : false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("gazelle_sidebar_collapsed", String(next));
      return next;
    });
  };

  const [activeHoveredSection, setActiveHoveredSection] = React.useState<string | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterSection = (sectionId: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setActiveHoveredSection(sectionId);
  };

  const handleMouseLeaveSection = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveHoveredSection(null);
    }, 150);
  };

  if (location.pathname === "/boldi") {
    return (
      <main className="h-[100dvh] w-full overflow-hidden bg-[#FAF9F5]">
        {React.cloneElement(children as React.ReactElement, { key: location.pathname, location })}
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] text-gray-900 md:flex-row font-sans selection:bg-black selection:text-white pb-16 md:pb-0">
      {/* Mobile Top Header (only visible on mobile) */}
      <div className="md:hidden">
        <WorkspaceSwitcher isMobile={true} />
      </div>

      {/* Desktop Navigation Sidebar */}
      <nav className={`hidden md:flex flex-col bg-white border-r border-gray-200/80 transition-all duration-300 ease-in-out relative ${
        isSidebarCollapsed ? 'w-20 overflow-visible' : 'w-64 overflow-y-auto no-scrollbar'
      }`}>
        
        {/* Sidebar Header */}
        <div className={`p-5 flex items-center justify-between border-b border-gray-100/50 mb-4 ${isSidebarCollapsed ? 'flex-col gap-4 px-2' : ''}`}>
          {!isSidebarCollapsed ? (
            <div className="flex flex-col text-left">
              <span className="font-black text-base tracking-widest text-black">GAZELLE</span>
              <span className="text-gray-400 text-[9px] mt-0.5 uppercase tracking-widest font-extrabold">Boldr AI OS</span>
            </div>
          ) : (
            <div className="font-black text-lg text-black bg-gray-50 border border-gray-100 rounded-xl w-10 h-10 flex items-center justify-center shadow-sm">G</div>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-black transition-colors"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className={`${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
          <WorkspaceSwitcher isCollapsed={isSidebarCollapsed} />
        </div>

        {/* Dynamic Nested Sidebar Items (Exactly 5 sections) */}
        <div className="flex-1 py-4 flex flex-col gap-2.5 px-3">
          {SECTIONS.map((sec) => {
            const active = isSectionActive(sec, location.pathname);

            return (
              <div 
                key={sec.id} 
                className="relative"
                onMouseEnter={() => isSidebarCollapsed && handleMouseEnterSection(sec.id)}
                onMouseLeave={() => isSidebarCollapsed && handleMouseLeaveSection()}
              >
                {/* Main section button/link */}
                <Link
                  to={sec.path}
                  className={`relative flex items-center gap-3 py-2.5 px-3.5 rounded-xl transition-all text-[13px] font-bold group ${
                    active 
                      ? 'bg-black text-white shadow-sm font-extrabold' 
                      : 'text-gray-600 hover:text-black hover:bg-gray-100/80'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                  title={isSidebarCollapsed ? sec.title : ""}
                >
                  <sec.icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${active ? 'text-white' : 'text-gray-400 group-hover:text-black'}`} />
                  {!isSidebarCollapsed && (
                    <span className="truncate">{sec.title}</span>
                  )}
                  {active && !isSidebarCollapsed && (
                    <span className="absolute right-3.5 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </Link>

                {/* Sub-navigation items (expanded below active section on desktop) */}
                {active && !isSidebarCollapsed && (
                  <div className="flex flex-col gap-0.5 pl-4 mt-1 border-l border-gray-100 ml-5">
                    {sec.items.map((item) => (
                      <SidebarLink
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                      />
                    ))}
                  </div>
                )}

                {/* Pop-up flyout submenu when sidebar is collapsed */}
                {isSidebarCollapsed && activeHoveredSection === sec.id && (
                  <div 
                    className="absolute left-14 top-0 ml-1.5 z-[100] bg-white border border-gray-200 rounded-2xl shadow-xl py-3 px-4 min-w-[200px] animate-in fade-in slide-in-from-left-2 duration-150 flex flex-col gap-1"
                    onMouseEnter={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                    }}
                    onMouseLeave={() => handleMouseLeaveSection()}
                  >
                    <div className="flex flex-col mb-2 border-b border-gray-100 pb-1 px-1 text-left">
                      <span className="text-[10px] font-extrabold text-black uppercase tracking-wider">{sec.title}</span>
                      <span className="text-[9px] text-gray-400">{sec.description}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {sec.items.map(item => {
                        const itemActive = checkRouteActive(item.to, location.pathname);
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs transition-all ${
                              itemActive 
                                ? 'bg-black text-white font-semibold' 
                                : 'text-gray-600 hover:text-black hover:bg-gray-50'
                            }`}
                          >
                            <item.icon className={`w-3.5 h-3.5 ${itemActive ? 'text-white' : 'text-gray-400'}`} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-100 mt-auto flex flex-col gap-2 bg-gray-50/30">
          {!isSidebarCollapsed ? (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-clarity-reset'))}
              className="w-full p-2.5 rounded-xl bg-amber-500/10 border border-amber-200/40 flex items-center justify-between hover:bg-amber-500/20 text-amber-900 cursor-pointer transition-all group shadow-sm mb-1"
              title="Start 10-Minute Mental Clarity Reset"
            >
              <div className="flex items-center gap-2.5 overflow-hidden text-left">
                <div className="bg-amber-500 text-black p-1 rounded-lg flex-shrink-0">
                  <Brain className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold tracking-tight">Clarity Reset</span>
                  <span className="text-[9px] text-amber-700/80">10-Min Session</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-amber-600/70 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-clarity-reset'))}
              className="w-12 h-12 mx-auto rounded-xl bg-amber-500/10 border border-amber-200/40 flex items-center justify-center hover:bg-amber-500/20 text-amber-600 cursor-pointer transition-all shadow-sm mb-1 group relative"
              title="10-Minute Mental Clarity Reset"
            >
              <Brain className="w-4 h-4 animate-pulse" />
              <div className="absolute left-14 ml-2 z-[100] bg-gray-900 text-white text-[10px] py-1 px-2 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                10-Min Clarity Reset
              </div>
            </button>
          )}

          {/* Settings Profile Link */}
          {!isSidebarCollapsed ? (
            <Link
              to="/me"
              className={`flex items-center justify-between p-2 rounded-xl transition-all border ${
                location.pathname === "/me" 
                  ? 'bg-gray-100 border-gray-200 text-black font-semibold' 
                  : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden text-left">
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-xs font-bold font-mono">
                  {user?.email?.substring(0, 2).toUpperCase() || 'EX'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[11px] font-bold text-gray-900 truncate">{user?.email?.split('@')[0] || 'Executive'}</span>
                  <span className="text-[9px] text-gray-400 truncate">{user?.email || 'Settings'}</span>
                </div>
              </div>
              <Settings className="w-3.5 h-3.5 text-gray-400 hover:text-black transition-colors" />
            </Link>
          ) : (
            <Link
              to="/me"
              className={`w-12 h-12 mx-auto rounded-xl border flex items-center justify-center transition-all group relative ${
                location.pathname === "/me"
                  ? 'bg-black border-black text-white'
                  : 'bg-white border-gray-100 hover:border-gray-200 text-gray-500 hover:text-black'
              }`}
              title="Executive Settings"
            >
              <Settings className="w-4 h-4" />
              <div className="absolute left-14 ml-2 z-[100] bg-gray-900 text-white text-[10px] py-1 px-2 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                System Profile & Settings
              </div>
            </Link>
          )}
        </div>
      </nav>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full relative">
        <AnimatePresence mode="wait">
          {React.cloneElement(children as React.ReactElement, { key: location.pathname, location })}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation bottom drawer bar (exactly 5 items) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-gray-200 flex justify-around items-center px-2 pb-safe z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
        <NavLink to="/" icon={CalendarIcon} label="Today" />
        <NavLink to="/inbox" icon={Inbox} label="Inbox" />
        <NavLink to="/work" icon={Briefcase} label="Work" />
        <NavLink to="/plan" icon={Layers} label="Plan" />
        <NavLink to="/review" icon={CheckSquare} label="Review" />
      </nav>

      {/* Global AI Co-Pilot overlay */}
      <BoldiFloatingWidget />
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
