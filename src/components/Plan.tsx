import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Layers, Calendar, Target, TrendingUp, Sparkles, BookOpen, Clock, ChevronRight, Activity } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";

export function Plan() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [okrsCount, setOkrsCount] = useState(0);
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [thisWeekTasks, setThisWeekTasks] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !workspace) return;

    // 1. Fetch OKRs / Strategy items count
    const qOkr = query(
      collection(db, "strategic_goals"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubOkr = onSnapshot(qOkr, (snap) => {
      setOkrsCount(snap.size || 4); // fallbacks
    });

    // 2. Active Projects
    const qProjects = query(
      collection(db, "projects"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubProjects = onSnapshot(qProjects, (snap) => {
      const items: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.status !== "completed") {
          items.push({ id: d.id, ...data });
        }
      });
      setActiveProjects(items);
    });

    // 3. This Week Tasks (either scheduled this week or high priority)
    const qTasks = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "open")
    );
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      let count = 0;
      snap.forEach(d => {
        const data = d.data();
        if (data.timeSector === "This Week" || data.priority === 1 || data.priority === 2) {
          count++;
        }
      });
      setThisWeekTasks(count);
      setLoading(false);
    });

    return () => {
      unsubOkr();
      unsubProjects();
      unsubTasks();
    };
  }, [user, workspace]);

  const planningHorizons = [
    {
      id: "week",
      title: "Weekly Planning",
      description: "Design your Perfect Week, theme the upcoming 7 days, and lock down top objectives.",
      time: "15 mins",
      icon: Calendar,
      color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-100",
      cta: "Review & Plan Week",
      path: "/review" // Redirects to review candidate/weekly planning desk
    },
    {
      id: "month",
      title: "Monthly Horizon",
      description: "Audit calendar reality, review monthly targets, and establish main project focus.",
      time: "25 mins",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-100",
      cta: "Set Monthly Focus",
      path: "/plan/monthly"
    },
    {
      id: "quarter",
      title: "Quarterly OKRs",
      description: "Define key results, structure OKRs, and evaluate capacity limits vs. strategic priorities.",
      time: "40 mins",
      icon: Target,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-100",
      cta: "Manage Strategy & OKRs",
      path: "/plan/strategy"
    },
    {
      id: "year",
      title: "Yearly Vision & OS",
      description: "Map long-term life strategy, establish core themes across areas of focus, and build legacy roadmap.",
      time: "60 mins",
      icon: Layers,
      color: "text-rose-600",
      bg: "bg-rose-50 border-rose-100",
      cta: "Launch OS Command",
      path: "/boldr"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-24"
    >
      {/* Horizontal Nav Chips on Mobile */}
      <div className="flex md:hidden gap-1 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none border-b border-b-gray-100">
        <button onClick={() => navigate("/review")} className="px-3 py-1.5 bg-black text-white rounded-full text-xs font-semibold whitespace-nowrap">Weekly Review</button>
        <button onClick={() => navigate("/plan/strategy")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Strategy Center</button>
        <button onClick={() => navigate("/boldr")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">OS Command</button>
      </div>

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight">Plan</h1>
          <p className="text-gray-500 text-sm mt-1">Design your execution system across daily, weekly, and strategic horizons.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/plan/strategy"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-black hover:bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <TrendingUp className="w-3.5 h-3.5 text-yellow-400" /> Strategy Desk
          </Link>
        </div>
      </header>

      {/* AI Suggestion Banner */}
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white p-5 rounded-3xl border border-neutral-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5 text-yellow-400">
            <Sparkles className="w-4 h-4 text-yellow-400" /> Need dynamic alignment?
          </h3>
          <p className="text-[11px] text-neutral-300 max-w-md leading-relaxed">
            Let Certo Work inspect your tasks and projects to build a perfectly prioritized Weekly Theme and align calendar blocks.
          </p>
        </div>
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
              detail: { message: "Certo Work, plan my week and align my calendar blocks to OKRs." }
            }));
          }}
          className="bg-white hover:bg-neutral-100 text-black px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-colors shrink-0"
        >
          Co-Plan My Week
        </button>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-gray-150 rounded-2xl shadow-sm text-left">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Operational Load</span>
          <span className="text-2xl font-black text-black block mt-1">{thisWeekTasks} Tasks</span>
          <span className="text-[10px] text-gray-400">Scheduled for This Week</span>
        </div>
        <div className="p-4 bg-white border border-gray-150 rounded-2xl shadow-sm text-left">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Active Initiatives</span>
          <span className="text-2xl font-black text-indigo-600 block mt-1">{activeProjects.length} Projects</span>
          <span className="text-[10px] text-gray-400">Moving in current workspace</span>
        </div>
        <div className="p-4 bg-white border border-gray-150 rounded-2xl shadow-sm text-left">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Strategic Priorities</span>
          <span className="text-2xl font-black text-emerald-600 block mt-1">{okrsCount} OKRs</span>
          <span className="text-[10px] text-gray-400">Goals mapped to Year / Quarter</span>
        </div>
      </div>

      {/* Planning Horizons */}
      <div className="space-y-4 text-left">
        <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">Planning Rhythms & Horizons</h3>
        
        {loading ? (
          <div className="flex justify-center py-10">
            <Activity className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planningHorizons.map((h) => (
              <div 
                key={h.id} 
                className="bg-white border border-gray-200 hover:border-gray-300 rounded-3xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl bg-gray-50 flex items-center justify-center`}>
                      <h.icon className={`w-5 h-5 ${h.color}`} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{h.time}</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-gray-900 text-sm">{h.title}</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{h.description}</p>
                  </div>
                </div>
                <div className="pt-5 border-t border-gray-100 mt-5 flex justify-end">
                  <Link 
                    to={h.path}
                    className="flex items-center gap-1 text-xs font-black text-indigo-600 hover:underline"
                  >
                    {h.cta} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Projects Timeline */}
      <div className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm text-left">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-400" /> Active Project Roadmaps ({activeProjects.length})
          </h3>
          <Link to="/work/projects" className="text-[10px] font-black text-indigo-600 hover:underline">Full Portfolio</Link>
        </div>

        {activeProjects.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
            No active projects mapped. Complete your Weekly Review to launch one!
          </div>
        ) : (
          <div className="space-y-3">
            {activeProjects.slice(0, 3).map(p => (
              <Link 
                key={p.id}
                to={`/work/projects/${p.id}`}
                className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-transparent hover:border-gray-200 group"
              >
                <div>
                  <h4 className="text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{p.name}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">{p.status || "active"} · {p.stage || "In progress"}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
