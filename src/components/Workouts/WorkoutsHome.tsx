import { useState, useEffect } from "react";
import {
  Dumbbell,
  Waves,
  Footprints,
  Bike,
  Loader2,
  Calendar,
  Activity,
  Zap,
  AlertCircle,
  TrendingUp,
  Award,
  Plus,
  Clock,
  History,
  Target,
  Sparkles
} from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { FitnessProfile, WorkoutSession } from "../../types";

// Import modular subcomponents
import { FitnessProfileForm } from "./FitnessProfileForm";
import { ManualWorkoutForm } from "./ManualWorkoutForm";
import { PlanTrainingWeekFlow } from "./PlanTrainingWeekFlow";
import { WorkoutDetailView } from "./WorkoutDetailView";

const C3NTRO_SHORTCUTS = [
  { title: "C3NTRO Spinning Rush", type: "spinning", duration: 45, intensity: "hard", desc: "45m high tempo cardio stationary bike class, high strain output." },
  { title: "C3NTRO Boxing Combat", type: "boxing", duration: 50, intensity: "hard", desc: "50m explosive bag rounds, shadow boxing, and core conditioning." },
  { title: "C3NTRO Strength Power Lifts", type: "strength", duration: 60, intensity: "moderate", desc: "60m progressive barbell squats, deadlifts, chest pressing & form check." },
  { title: "C3NTRO Recovery Swim", type: "swim", duration: 30, intensity: "easy", desc: "30m relaxed steady-state pacing, zero impact joint recovery." }
];

export function WorkoutsHome() {
  const { user, workspace } = useAuth();
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [historySessions, setHistorySessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"training" | "c3ntro" | "history">("training");

  // Flow / Modal states
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showPlanWeekFlow, setShowPlanWeekFlow] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Load Real-time Data
  useEffect(() => {
    if (!user || !workspace) return;

    // A. Profile Listener
    const qProfile = query(
      collection(db, "fitness_profiles"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      limit(1)
    );
    const unsubProfile = onSnapshot(qProfile, (snap) => {
      if (!snap.empty) {
        setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() } as FitnessProfile);
      } else {
        setProfile(null);
      }
    }, (err) => console.error("Error fetching fitness profile:", err));

    // B. Sessions for current and future (upcoming planned or completed today/ahead)
    const qSessions = query(
      collection(db, "workout_sessions"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      orderBy("date", "asc")
    );
    const unsubSessions = onSnapshot(qSessions, (snap) => {
      const all: WorkoutSession[] = [];
      const pastHistory: WorkoutSession[] = [];
      const upcomingThisWeek: WorkoutSession[] = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      snap.forEach(d => {
        const item = { id: d.id, ...d.data() } as WorkoutSession;
        all.push(item);

        const sessionDate = new Date(item.date + "T00:00:00");
        if (sessionDate < today && item.status !== "planned") {
          pastHistory.push(item);
        } else {
          upcomingThisWeek.push(item);
        }
      });

      setSessions(all);
      // History sorted descending (latest first)
      setHistorySessions(pastHistory.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching workout sessions list:", err);
      setLoading(false);
    });

    return () => {
      unsubProfile();
      unsubSessions();
    };
  }, [user, workspace]);

  // C3NTRO Shortcut Quick-Scheduler
  const handleQuickScheduleClass = async (preset: typeof C3NTRO_SHORTCUTS[number], targetDay: "today" | "tomorrow") => {
    if (!user || !workspace) return;
    const targetDate = new Date();
    if (targetDay === "tomorrow") {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateStr = targetDate.toISOString().split("T")[0];

    try {
      await addDoc(collection(db, "workout_sessions"), {
        userId: user.uid,
        workspaceId: workspace.id,
        workoutPlanId: "c3ntro_shortcut",
        title: preset.title,
        type: preset.type,
        date: dateStr,
        durationMinutes: preset.duration,
        intensity: preset.intensity,
        location: preset.type === "swim" ? "pool" : "gym",
        status: "planned",
        notes: preset.desc,
        calendarVisible: true,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error quick scheduling C3NTRO class:", err);
    }
  };

  // Gamified Consistency Formula Calculations (NO MOCK DATA)
  const getConsistencyStats = () => {
    if (sessions.length === 0) return { rate: 0, levelName: "Level 1: Started", levelNum: 1, color: "text-red-500", progressWidth: "0%" };
    
    // Evaluate rolling 30 days of workouts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const rollingSessions = sessions.filter(s => new Date(s.date) >= thirtyDaysAgo);

    if (rollingSessions.length === 0) return { rate: 0, levelName: "Level 1: Started", levelNum: 1, color: "text-red-500", progressWidth: "0%" };

    const completed = rollingSessions.filter(s => s.status === "completed").length;
    // Calculate relative planned vs done ratio
    const rate = Math.round((completed / rollingSessions.length) * 100);

    let levelName = "Level 1: Started";
    let levelNum = 1;
    let color = "text-red-500";
    if (rate >= 80) {
      levelName = "Level 5: Locked In";
      levelNum = 5;
      color = "text-emerald-500";
    } else if (rate >= 60) {
      levelName = "Level 4: Disciplined";
      levelNum = 4;
      color = "text-indigo-500";
    } else if (rate >= 40) {
      levelName = "Level 3: Consistent";
      levelNum = 3;
      color = "text-amber-500";
    } else if (rate >= 20) {
      levelName = "Level 2: Building";
      levelNum = 2;
      color = "text-orange-500";
    }

    return { rate, levelName, levelNum, color, progressWidth: `${rate}%` };
  };

  const levelsStats = getConsistencyStats();

  const selectedSession = sessions.find(s => s.id === selectedSessionId) || historySessions.find(s => s.id === selectedSessionId);

  if (loading) {
    return (
      <div className="p-12 flex justify-center items-center">
        <Loader2 className="animate-spin text-gray-400 w-8 h-8" />
      </div>
    );
  }

  // Active Individual Session Detail Screen overrides page
  if (selectedSession) {
    return (
      <WorkoutDetailView
        session={selectedSession}
        onBack={() => setSelectedSessionId(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 pb-20">
      {/* Page header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Workout Planner</h1>
          <p className="text-gray-500 text-xs font-medium mt-0.5">Habit-linked personal training operating room for Alejandro.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManualForm(true)}
            className="bg-black hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Schedule Workout
          </button>
          <button
            onClick={() => setShowProfileForm(true)}
            className="bg-gray-50 border border-gray-100 hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
          >
            {profile ? "Edit Fitness Profile" : "Create Profile"}
          </button>
        </div>
      </header>

      {/* Fitness Profile Required Empty State */}
      {!profile ? (
        <div className="bg-orange-50/50 border border-orange-100 p-8 md:p-12 rounded-[2rem] text-center space-y-4">
          <Dumbbell className="w-12 h-12 text-orange-600 mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-orange-950">Unlock Your C3NTRO Training Matrix</h2>
          <p className="text-orange-700/70 max-w-sm mx-auto text-xs font-medium">Configure workouts frequency, goals, and available gears to start tracking streaks and automatic routines.</p>
          <button
            onClick={() => setShowProfileForm(true)}
            className="bg-orange-600 text-white text-xs font-bold px-6 py-3 rounded-2xl hover:bg-orange-700 transition-all shadow-md shadow-orange-100"
          >
            Setup Training Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Dashboard Panel - 3 cols */}
          <div className="lg:col-span-3 space-y-6">
            {/* Nav tabs bar */}
            <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 gap-1 shadow-sm">
              <button
                onClick={() => setActiveTab("training")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5 ${
                  activeTab === "training" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
                }`}
              >
                <Calendar className="w-4 h-4" /> Planned Training
              </button>
              <button
                onClick={() => setActiveTab("c3ntro")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5 ${
                  activeTab === "c3ntro" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
                }`}
              >
                <Zap className="w-4 h-4" /> C3NTRO Shortcuts
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5 ${
                  activeTab === "history" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
                }`}
              >
                <History className="w-4 h-4" /> Past Logs
              </button>
            </div>

            {/* TAB CONTENT: Planned Training */}
            {activeTab === "training" && (
              <div className="space-y-4">
                {/* Banner Call-To-Action for Weekly Scheduler if no workouts are scheduled for this week */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-5 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1 w-max">
                      <Sparkles className="w-3 h-3 text-indigo-600 animate-spin" /> Training Blueprint Builder
                    </span>
                    <h3 className="font-extrabold text-gray-900 text-sm md:text-base">Is your training week planned correctly?</h3>
                    <p className="text-xs text-indigo-800/70 font-medium max-w-md">Design a clean, injury-free weekly calendar matching your C3NTRO workouts, recovery days, and active Sunday mountain trails.</p>
                  </div>
                  <button
                    onClick={() => setShowPlanWeekFlow(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-100 shrink-0"
                  >
                    Plan My Training Week
                  </button>
                </div>

                {/* Planned Sessions Loop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessions.filter(s => s.status === "planned" || s.date === todayStr).map((session) => {
                    const isToday = session.date === todayStr;
                    const isCompleted = session.status === "completed";

                    const IconMap: any = {
                      strength: Dumbbell,
                      swim: Waves,
                      walk: Footprints,
                      run: Footprints,
                      mountain_bike: Bike,
                      spinning: Bike,
                      boxing: Target,
                      mobility: Activity
                    };
                    const Icon = IconMap[session.type] || Dumbbell;

                    return (
                      <div
                        key={session.id}
                        className={`p-5 rounded-3xl border transition-all flex flex-col justify-between bg-white ${
                          isToday && !isCompleted ? "ring-2 ring-indigo-500 border-indigo-100" : "border-gray-100"
                        } ${isCompleted ? "opacity-60 grayscale" : ""}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <div className={`p-2.5 rounded-xl ${isToday && !isCompleted ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-600"}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex gap-1">
                              {session.isRoutineWorkout && (
                                <span className="bg-gray-100 border border-gray-200/50 text-[8px] font-bold text-gray-500 px-2 py-0.5 rounded-lg uppercase">Routine</span>
                              )}
                              {isToday && (
                                <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tight">Today</span>
                              )}
                            </div>
                          </div>
                          
                          <h3 className="font-extrabold text-sm text-gray-900 leading-tight block">{session.title}</h3>
                          
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold mt-1.5 uppercase tracking-wide">
                            <span className="text-gray-500">{session.type}</span>
                            <span>•</span>
                            <span>{session.durationMinutes} min</span>
                            <span>•</span>
                            <span>{session.intensity}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-1.5">
                          <button
                            onClick={() => setSelectedSessionId(session.id)}
                            className="flex-1 bg-black hover:bg-gray-800 text-white py-2.5 rounded-xl text-xs font-bold transition-all"
                          >
                            {isToday ? "Start Training Now" : "Open Workout"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {sessions.filter(s => s.status === "planned" || s.date === todayStr).length === 0 && (
                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                      <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 font-semibold">No planned workout sessions left for this week.</p>
                      <button
                        onClick={() => setShowPlanWeekFlow(true)}
                        className="text-xs text-indigo-600 font-bold mt-2 hover:underline"
                      >
                        Plan upcoming week sessions now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: C3NTRO Membership Preset Shortcuts */}
            {activeTab === "c3ntro" && (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-xs text-orange-950 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-orange-600" />
                  <div>
                    <p className="font-bold text-orange-900">Alejandro's C3NTRO Gym Membership presets</p>
                    <p className="text-orange-900/70 mt-0.5">Click "Book Today" or "Book Tomorrow" to immediately index one of your C3NTRO studio fitness routines into your active daily plan.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {C3NTRO_SHORTCUTS.map((preset) => (
                    <div key={preset.title} className="p-5 rounded-3xl border border-gray-100 bg-white hover:border-gray-200 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">C3NTRO Preset</span>
                          <span className="text-[10px] font-bold text-gray-400">{preset.duration} min</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-gray-900">{preset.title}</h4>
                        <p className="text-xs text-gray-500 mt-1 font-medium">{preset.desc}</p>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2">
                        <button
                          onClick={() => handleQuickScheduleClass(preset, "today")}
                          className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-800 text-[10px] font-black py-2 rounded-lg border border-gray-100 transition-all uppercase"
                        >
                          Schedule Today
                        </button>
                        <button
                          onClick={() => handleQuickScheduleClass(preset, "tomorrow")}
                          className="flex-1 bg-gray-900 hover:bg-black text-white text-[10px] font-black py-2 rounded-lg transition-all uppercase"
                        >
                          Schedule Tomorrow
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Past Logs / History */}
            {activeTab === "history" && (
              <div className="space-y-3">
                {historySessions.map((session) => (
                  <div key={session.id} className="p-4 bg-white border border-gray-100 rounded-2xl flex justify-between items-center hover:border-gray-200 transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.2 rounded uppercase">Completed</span>
                        <span className="text-[10px] font-mono text-gray-400">{session.date}</span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900 mt-1">{session.title}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{session.type} • {session.durationMinutes} min</p>
                    </div>

                    <button
                      onClick={() => setSelectedSessionId(session.id)}
                      className="px-4 py-2 border border-gray-100 bg-gray-50/50 hover:bg-gray-100 text-xs font-bold text-gray-700 rounded-xl"
                    >
                      Review Log data
                    </button>
                  </div>
                ))}

                {historySessions.length === 0 && (
                  <div className="py-12 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200 text-xs font-semibold text-gray-400">
                    No historically logged sessions indexed. Complete sessions to build streaks!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gamification Column Panel - 1 col */}
          <div className="space-y-6">
            {/* Gamified visual gauge metrics */}
            <div className="bg-white border border-gray-100 p-6 rounded-3xl shadow-sm text-center space-y-4">
              <div className="flex justify-center items-center gap-1.5">
                <Award className="w-5 h-5 text-indigo-500 animate-pulse bg-indigo-50 p-1 rounded-lg shrink-0" />
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Consistency Rank</span>
              </div>

              {/* Graphical level badge with percentage */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-indigo-600 transition-all duration-500"
                    strokeDasharray={`${levelsStats.rate}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xl font-black text-gray-900 tracking-wider block">{levelsStats.rate}%</span>
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">Planned Done</span>
                </div>
              </div>

              <div>
                <h3 className={`font-black text-sm tracking-tight ${levelsStats.color}`}>{levelsStats.levelName}</h3>
                <p className="text-[10px] text-gray-400 font-medium mt-1">Consistency rating based on rolling 30-days metrics.</p>
              </div>
            </div>

            {/* Goals summary widget */}
            <div className="bg-white border border-gray-100 p-6 rounded-3xl shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-gray-900 border-b border-gray-50 pb-2 uppercase tracking-wide text-[9px] text-gray-400 block">Training Target Allocation</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center leading-none">
                  <span className="font-semibold text-gray-500 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Goal Focus</span>
                  <span className="font-bold text-gray-900 uppercase">{profile.goal.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between items-center leading-none">
                  <span className="font-semibold text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Sessions / Week</span>
                  <span className="font-bold text-gray-900">{profile.preferredTrainingDays?.length || 4} Days</span>
                </div>
                <div className="flex justify-between items-center leading-none">
                  <span className="font-semibold text-gray-500 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Target Length</span>
                  <span className="font-bold text-gray-900">{profile.preferredWorkoutDurationMinutes || 60}m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Profile */}
      {showProfileForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <FitnessProfileForm
            userId={user?.uid || ""}
            workspaceId={workspace?.id || ""}
            initialData={profile}
            onClose={() => setShowProfileForm(false)}
            onSave={() => setShowProfileForm(false)}
          />
        </div>
      )}

      {/* MODAL: Manual schedule form */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <ManualWorkoutForm
            userId={user?.uid || ""}
            workspaceId={workspace?.id || ""}
            onClose={() => setShowManualForm(false)}
            onSave={() => setShowManualForm(false)}
          />
        </div>
      )}

      {/* MODAL: Plan my training week wizard */}
      {showPlanWeekFlow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <PlanTrainingWeekFlow
            userId={user?.uid || ""}
            workspaceId={workspace?.id || ""}
            profile={profile}
            onClose={() => setShowPlanWeekFlow(false)}
            onCompleted={() => setShowPlanWeekFlow(false)}
          />
        </div>
      )}
    </div>
  );
}
