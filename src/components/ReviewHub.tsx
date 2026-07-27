import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { CheckSquare, Sparkles, TrendingUp, Zap, Dumbbell, Activity, Calendar, ChevronRight, Award } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";
import { Review } from "./Review"; // Re-use the existing AI Triage candidates view!

export function ReviewHub() {
  const { user, workspace } = useAuth();
  const [activeTab, setActiveTab] = useState("ai-triage");
  const [triageCount, setTriageCount] = useState(0);
  const [reviewsHistory, setReviewsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !workspace) return;

    // 1. Triage Count
    const qTriage = query(
      collection(db, "review_candidates"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "pending")
    );
    const unsubTriage = onSnapshot(qTriage, (snap) => {
      setTriageCount(snap.size);
    });

    // 2. System reviews history
    const qReviews = query(
      collection(db, "system_reviews"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setReviewsHistory(items);
      setLoading(false);
    });

    return () => {
      unsubTriage();
      unsubReviews();
    };
  }, [user, workspace]);

  const reviewModules = [
    {
      title: "System Reviews",
      desc: "Weekly, Monthly, and Quarterly alignment boards. Reflect on metrics, learn, and iterate.",
      icon: Calendar,
      path: "/me/reviews",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      actionLabel: "Start Review"
    },
    {
      title: "Performance & Analytics",
      desc: "Deep visual metrics, productivity logs, and workspace task velocity charts.",
      icon: TrendingUp,
      path: "/me/analytics",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      actionLabel: "View Analytics"
    },
    {
      title: "Habits Consistency",
      desc: "Maintain your streak, review self-mastery routines, and configure daily habits.",
      icon: Zap,
      path: "/work/habits",
      color: "text-amber-600",
      bg: "bg-amber-50",
      actionLabel: "Log Habits"
    },
    {
      title: "Workouts & Rituals",
      desc: "Plan and track workout sessions, log weights, and monitor athletic performance.",
      icon: Dumbbell,
      path: "/work/workouts",
      color: "text-rose-600",
      bg: "bg-rose-50",
      actionLabel: "Log Workout"
    },
    {
      title: "Health & Whoop Signals",
      desc: "Integrate biometrics, track sleep, strain, HRV, and log daily recovery metrics.",
      icon: Activity,
      path: "/me/metrics",
      color: "text-purple-600",
      bg: "bg-purple-50",
      actionLabel: "View Health Signal"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24"
    >
      {/* Horizontal Nav Chips on Mobile */}
      <div className="flex md:hidden gap-1 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none border-b border-b-gray-100">
        <button 
          onClick={() => setActiveTab("ai-triage")} 
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === 'ai-triage' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          AI Suggestions ({triageCount})
        </button>
        <button 
          onClick={() => setActiveTab("alignment")} 
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === 'alignment' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Reflection & Habits
        </button>
      </div>

      <header className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight">Review</h1>
          <p className="text-gray-500 text-sm mt-1">Reflect on metrics, approve AI suggestions, and complete planning rhythms.</p>
        </div>
        
        {/* Tab switchers on desktop */}
        <div className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("ai-triage")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all ${activeTab === 'ai-triage' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-500" /> AI Suggestions ({triageCount})
          </button>
          <button
            onClick={() => setActiveTab("alignment")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all ${activeTab === 'alignment' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-500" /> Reflection & Habits
          </button>
        </div>
      </header>

      {/* Dynamic Tab Rendering */}
      {activeTab === "ai-triage" ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 p-5 rounded-3xl border border-indigo-100/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
            <div>
              <h3 className="font-extrabold text-sm text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" /> Review Candidate Desktop
              </h3>
              <p className="text-xs text-indigo-900/80 mt-1 max-w-xl">
                Gazelle extracts candidates from your raw inbox dumps. Approve them to convert them into prioritized tasks, goals, decisions, or projects.
              </p>
            </div>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
                  detail: { message: "Boldi, show me my pending review items and tell me what is stuck." }
                }));
              }}
              className="bg-black hover:bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
            >
              Ask Boldi's Opinion
            </button>
          </div>

          {/* Render the full AI Review list directly */}
          <Review />
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Main Reflection & Habits Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {reviewModules.map((m) => (
              <div 
                key={m.title}
                className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${m.bg}`}>
                      <m.icon className={`w-5 h-5 ${m.color}`} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm">{m.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-150 mt-4 flex justify-end">
                  <Link 
                    to={m.path}
                    className="flex items-center gap-1 text-xs font-black text-indigo-600 hover:underline"
                  >
                    {m.actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Historical Reviews and Self-Improvement Ledger */}
          <div className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm text-left">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-gray-400" /> Historical Reviews & Growth Ledger ({reviewsHistory.length})
              </h3>
              <Link to="/me/reviews" className="text-[10px] font-black text-indigo-600 hover:underline">Full Ledger</Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <Activity className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : reviewsHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-250 rounded-2xl bg-gray-50/50">
                No reflection cycles recorded yet. Align your weekly metrics now!
              </div>
            ) : (
              <div className="space-y-3">
                {reviewsHistory.slice(0, 3).map((r) => (
                  <div 
                    key={r.id}
                    className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{r.title || "Reflection Cycle"}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Logged: {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : "Historical"}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100">
                      Aligned
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </motion.div>
  );
}
