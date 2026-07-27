
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
    Zap, Activity, Moon, Heart, TrendingUp, ChevronRight, 
    Brain, Sparkles, Plus, Calendar, Dumbbell,
    MessageSquare, Smile, Thermometer, Battery,
    ArrowUpRight, Loader2
} from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { DailyMetric, Habit, HabitLog, WorkoutSession } from "../../types";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import { useNavigate } from "react-router-dom";

export function PerformanceHub() {
    const { user, workspace } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [metricsList, setMetricsList] = useState<DailyMetric[]>([]);
    const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [metrics, setMetrics] = useState<DailyMetric | null>(null);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
    const [workout, setWorkout] = useState<WorkoutSession | null>(null);
    const [showCheckIn, setShowCheckIn] = useState(false);

    useEffect(() => {
        if (!user || !workspace) return;

        // Fetch Daily Metrics for today
        const docId = `${user.uid}_${selectedDate}`;
        const unsubMetrics = onSnapshot(doc(db, "daily_metrics", docId), (snap) => {
            if (snap.exists()) {
                setMetrics({ id: snap.id, ...snap.data() } as DailyMetric);
            } else {
                setMetrics(null);
            }
        });

        // Fetch Last 7 days metrics
        const qMetricsHistory = query(
            collection(db, "daily_metrics"),
            where("userId", "==", user.uid),
            where("workspaceId", "==", workspace.id),
            orderBy("date", "desc"),
            limit(7)
        );
        const unsubMetricsHistory = onSnapshot(qMetricsHistory, (snap) => {
            const list: DailyMetric[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as DailyMetric));
            setMetricsList(list.reverse());
        });

        // Fetch Habits
        const qHabits = query(
            collection(db, "habits"),
            where("userId", "==", user.uid),
            where("workspaceId", "==", workspace.id),
            where("status", "==", "active")
        );
        const unsubHabits = onSnapshot(qHabits, (snap) => {
            const list: Habit[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as Habit));
            setHabits(list);
        });

        // Fetch Habit Logs for today
        const qLogs = query(
            collection(db, "habit_logs"),
            where("userId", "==", user.uid),
            where("workspaceId", "==", workspace.id),
            where("date", "==", selectedDate)
        );
        const unsubLogs = onSnapshot(qLogs, (snap) => {
            const list: HabitLog[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as HabitLog));
            setHabitLogs(list);
        });

        // Fetch Today's Workout
        const qWorkout = query(
            collection(db, "workout_sessions"),
            where("userId", "==", user.uid),
            where("workspaceId", "==", workspace.id),
            where("date", "==", selectedDate),
            limit(1)
        );
        const unsubWorkout = onSnapshot(qWorkout, (snap) => {
            if (!snap.empty) {
                setWorkout({ id: snap.docs[0].id, ...snap.docs[0].data() } as WorkoutSession);
            } else {
                setWorkout(null);
            }
            setLoading(false);
        });

        return () => {
            unsubMetrics();
            unsubMetricsHistory();
            unsubHabits();
            unsubLogs();
            unsubWorkout();
        };
    }, [user, workspace, selectedDate]);

    const habitProgress = habits.length > 0 
        ? (habitLogs.filter(l => l.status === 'done').length / habits.length) * 100 
        : 0;

    const readinessStatus = metrics?.whoopRecoveryScore 
        ? metrics.whoopRecoveryScore > 66 ? "PRIME" : metrics.whoopRecoveryScore > 33 ? "RECOVER" : "REST"
        : "UNKNOWN";

    const readinessColor = readinessStatus === "PRIME" ? "text-green-400" : readinessStatus === "RECOVER" ? "text-yellow-400" : "text-red-400";

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                    <Activity className="w-8 h-8 text-indigo-500" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Hero Section */}
            <header className="relative overflow-hidden bg-black text-white p-12 rounded-[3.5rem] shadow-2xl">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Sparkles className="w-64 h-64 rotate-12" />
                </div>
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-500 p-2 rounded-xl">
                            <Brain className="w-6 h-6" />
                        </div>
                        <span className="text-indigo-400 font-bold tracking-widest text-[10px] uppercase">Personal Development Hub</span>
                        <div className="h-4 w-[1px] bg-gray-800 mx-2" />
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${readinessColor}`}>● {readinessStatus} CONDITION</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tight leading-tight">
                        Self-Mastery <br/>
                        <span className="text-gray-500">starts with visibility.</span>
                    </h1>
                    <div className="flex gap-4 pt-4">
                        <button 
                            onClick={() => setShowCheckIn(true)}
                            className="bg-white text-black px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-all"
                        >
                            <Sparkles className="w-5 h-5" /> Daily Check-in
                        </button>
                        <button 
                            onClick={() => navigate('/me/analytics')}
                            className="bg-gray-800 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-700 transition-all text-sm"
                        >
                            <TrendingUp className="w-5 h-5" /> Insights
                        </button>
                    </div>
                </div>
            </header>

            {/* Bento Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* 1. Bio-Pulse (Whoop + Readiness) */}
                <div className="md:col-span-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black flex items-center gap-2">
                                <Zap className="w-6 h-6 text-red-500 fill-red-500" /> Bio-Pulse
                            </h2>
                            <p className="text-gray-400 text-sm font-medium">Physiological readiness based on Whoop & feeling.</p>
                        </div>
                        <button onClick={() => navigate('/me/metrics')} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                            <Plus className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard 
                            icon={Zap} 
                            label="Recovery" 
                            value={metrics?.whoopRecoveryScore ? `${metrics.whoopRecoveryScore}%` : '--'} 
                            color="text-red-500"
                            bg="bg-red-50"
                        />
                         <MetricCard 
                            icon={Moon} 
                            label="Sleep" 
                            value={metrics?.whoopSleepScore ? `${metrics.whoopSleepScore}%` : '--'} 
                            color="text-indigo-500"
                            bg="bg-indigo-50"
                        />
                         <MetricCard 
                            icon={Thermometer} 
                            label="Strain" 
                            value={metrics?.whoopStrain || '--'} 
                            color="text-orange-500"
                            bg="bg-orange-50"
                        />
                        <MetricCard 
                            icon={Heart} 
                            label="RHR / HRV" 
                            value={metrics?.whoopRHR ? `${metrics.whoopRHR} / ${metrics.whoopHRV || '--'}` : '--'} 
                            color="text-blue-500"
                            bg="bg-blue-50"
                        />
                    </div>

                    {/* Trend Line */}
                    <div className="h-16 w-full flex items-end gap-1 px-4">
                        {metricsList.map((m, i) => (
                           <div 
                             key={i} 
                             className="flex-1 bg-red-100 rounded-t-lg transition-all hover:bg-red-500/20 group relative"
                             style={{ height: `${m.whoopRecoveryScore || 0}%` }}
                           >
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    {m.whoopRecoveryScore || 0}%
                                </div>
                           </div>
                        ))}
                        {metricsList.length < 7 && Array.from({ length: 7 - metricsList.length }).map((_, i) => (
                             <div key={`empty-${i}`} className="flex-1 bg-gray-50 rounded-t-lg h-4" />
                        ))}
                    </div>

                    {/* How I Feel indicator */}
                    <div className="bg-gray-50 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h3 className="font-bold flex items-center gap-2 text-gray-700">
                                <Smile className="w-5 h-5 text-yellow-500" /> Subjective Well-being
                            </h3>
                            <p className="text-xs text-gray-400 font-medium">Your internal energy and mood signature for today.</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-black text-gray-900">{metrics?.mood?.toUpperCase() || 'UNKNOWN'}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Mood</div>
                            </div>
                            <div className="h-10 w-[1px] bg-gray-200" />
                            <div className="text-center">
                                <div className="text-2xl font-black text-gray-900">{metrics?.energyLevel || '0'}/10</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Energy Level</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Habit Momentum */}
                <div className="md:col-span-4 bg-indigo-600 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-xl shadow-indigo-100">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            <Sparkles className="w-6 h-6" /> Momentum
                        </h2>
                        <p className="text-indigo-200 text-sm font-medium">Daily consistency streaks.</p>
                    </div>

                    <div className="py-8 space-y-4">
                        <div className="relative h-24 w-24 mx-auto">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="48" cy="48" r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-indigo-500 opacity-30"
                                />
                                <motion.circle
                                    cx="48" cy="48" r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={251.2}
                                    initial={{ strokeDashoffset: 251.2 }}
                                    animate={{ strokeDashoffset: 251.2 - (251.2 * habitProgress) / 100 }}
                                    className="text-white"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black">{Math.round(habitProgress)}%</span>
                            </div>
                        </div>
                        <p className="text-center text-xs font-bold text-indigo-100">
                            {habitLogs.filter(l => l.status === 'done').length} of {habits.length} habits done
                        </p>
                    </div>

                    <button 
                        onClick={() => navigate('/review/habits')}
                        className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all"
                    >
                        Review Habits <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* 3. Growth Trajectory (Reflection + Intention) */}
                <div className="md:col-span-12 lg:col-span-5 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            <Brain className="w-6 h-6 text-gray-900" /> Mastery Logic
                        </h2>
                        <div className="text-xs font-bold text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Today
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Daily Intention</label>
                            {metrics?.dailyIntention ? (
                                <div className="bg-indigo-50 p-6 rounded-[2rem] text-indigo-900 font-bold text-lg">
                                    {metrics.dailyIntention}
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setShowCheckIn(true)}
                                    className="w-full p-6 border-2 border-dashed border-gray-100 rounded-[2rem] text-sm text-gray-400 font-medium hover:border-gray-200 transition-all text-left"
                                >
                                    + Set your anchor for today...
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Reflection</label>
                            {metrics?.journalNote ? (
                               <div className="bg-gray-50 p-6 rounded-[2rem] italic text-gray-600 text-sm">
                                  "{metrics.journalNote}"
                               </div>
                            ) : (
                               <button 
                                 onClick={() => setShowCheckIn(true)}
                                 className="w-full p-6 bg-gray-50/50 rounded-[2rem] text-center text-xs font-bold text-gray-400 hover:bg-gray-50 transition-all"
                               >
                                 + Add Reflection
                               </button>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 grid grid-cols-2 gap-4">
                        <div className="bg-orange-50 p-6 rounded-[2rem] space-y-1">
                            <div className="text-2xl font-black text-orange-600">{metrics?.weight || '--'} kg</div>
                            <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Weight</div>
                        </div>
                        <div className="bg-green-50 p-6 rounded-[2rem] space-y-1">
                            <div className="text-2xl font-black text-green-600">{metrics?.stressLevel || '--'}/10</div>
                            <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Stress</div>
                        </div>
                    </div>
                </div>

                {/* 4. Active Growth Block (Workouts) */}
                <div className="md:col-span-12 lg:col-span-7 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 flex items-center justify-between bg-gray-50/50">
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            <Dumbbell className="w-6 h-6 text-black" /> Training Block
                        </h2>
                        <button onClick={() => navigate('/review/workouts')} className="text-sm font-bold text-indigo-600 hover:underline">View All</button>
                    </div>
                    
                    <div className="p-8 flex-1 flex flex-col justify-center">
                        {workout ? (
                           <div className="flex items-center gap-6">
                              <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center text-white">
                                 <Activity className="w-10 h-10" />
                              </div>
                              <div className="flex-1 space-y-1">
                                 <h3 className="text-xl font-black">{workout.title}</h3>
                                 <div className="flex gap-4 text-xs font-bold text-gray-400">
                                    <span className="flex items-center gap-1"><Battery className="w-3 h-3" /> {workout.intensity.toUpperCase()}</span>
                                    <span className="flex items-center gap-1"><Moon className="w-3 h-3" /> {workout.durationMinutes} MIN</span>
                                 </div>
                              </div>
                              <button className={`px-6 py-2 rounded-xl font-bold text-sm ${workout.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-black text-white'}`}>
                                 {workout.status === 'completed' ? 'COMPLETED' : 'START NOW'}
                              </button>
                           </div>
                        ) : (
                           <div className="text-center py-8 space-y-2">
                               <p className="text-gray-400 font-medium">No workout scheduled for today.</p>
                               <button 
                                 onClick={() => navigate('/review/workouts')}
                                 className="px-8 py-3 bg-gray-100 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors"
                               >
                                 + Plan Session
                               </button>
                           </div>
                        )}
                    </div>
                    
                    <div className="p-8 bg-black text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-500 p-2 rounded-lg">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold">AI Tip: High recovery today, perfect for PRs.</span>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-indigo-400" />
                    </div>
                </div>

            </div>

            <AnimatePresence>
                {showCheckIn && (
                    <DailyCheckInModal 
                        onClose={() => setShowCheckIn(false)} 
                        initialData={metrics}
                        selectedDate={selectedDate}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color, bg }: { icon: any, label: string, value: any, color: string, bg: string }) {
    return (
        <div className={`${bg} p-6 rounded-[2rem] space-y-2 group transition-transform hover:-translate-y-1`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} border border-white/50 shadow-sm`}>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="space-y-0.5">
                <div className={`text-xl font-black ${color}`}>{value}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</div>
            </div>
        </div>
    );
}

function DailyCheckInModal({ onClose, initialData, selectedDate }: { onClose: () => void, initialData: DailyMetric | null, selectedDate: string }) {
    const { user, workspace } = useAuth();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        weight: initialData?.weight?.toString() || "",
        whoopRecoveryScore: initialData?.whoopRecoveryScore?.toString() || "",
        whoopStrain: initialData?.whoopStrain?.toString() || "",
        whoopSleepScore: initialData?.whoopSleepScore?.toString() || "",
        whoopRHR: initialData?.whoopRHR?.toString() || "",
        whoopHRV: initialData?.whoopHRV?.toString() || "",
        mood: initialData?.mood || "neutral",
        energyLevel: initialData?.energyLevel || 5,
        stressLevel: initialData?.stressLevel || 5,
        dailyIntention: initialData?.dailyIntention || "",
        journalNote: initialData?.journalNote || "",
        notes: initialData?.notes || ""
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !workspace) return;
        setSaving(true);
        try {
            const docId = `${user.uid}_${selectedDate}`;
            await setDoc(doc(db, "daily_metrics", docId), {
                userId: user.uid,
                workspaceId: workspace.id,
                date: selectedDate,
                weight: formData.weight ? parseFloat(formData.weight) : null,
                whoopRecoveryScore: formData.whoopRecoveryScore ? parseInt(formData.whoopRecoveryScore) : null,
                whoopStrain: formData.whoopStrain ? parseFloat(formData.whoopStrain) : null,
                whoopSleepScore: formData.whoopSleepScore ? parseInt(formData.whoopSleepScore) : null,
                whoopRHR: formData.whoopRHR ? parseInt(formData.whoopRHR) : null,
                whoopHRV: formData.whoopHRV ? parseInt(formData.whoopHRV) : null,
                mood: formData.mood,
                energyLevel: formData.energyLevel,
                stressLevel: formData.stressLevel,
                dailyIntention: formData.dailyIntention,
                journalNote: formData.journalNote,
                notes: formData.notes,
                updatedAt: serverTimestamp(),
                createdAt: initialData?.createdAt || serverTimestamp()
            }, { merge: true });
            onClose();
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, "daily_metrics");
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 space-y-8 my-auto"
            >
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black">Daily Check-in</h2>
                        <p className="text-gray-400 font-medium">How are you showing up today?</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Bio Column */}
                    <div className="space-y-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <Thermometer className="w-3 h-3" /> Bio-Stats
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Weight (kg)</label>
                                <input 
                                    type="number" step="0.1"
                                    value={formData.weight}
                                    onChange={e => setFormData({...formData, weight: e.target.value})}
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Recovery %</label>
                                <input 
                                    type="number"
                                    value={formData.whoopRecoveryScore}
                                    onChange={e => setFormData({...formData, whoopRecoveryScore: e.target.value})}
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg text-red-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Sleep %</label>
                                <input 
                                    type="number"
                                    value={formData.whoopSleepScore}
                                    onChange={e => setFormData({...formData, whoopSleepScore: e.target.value})}
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg text-indigo-600"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Strain</label>
                                <input 
                                    type="number" step="0.1"
                                    value={formData.whoopStrain}
                                    onChange={e => setFormData({...formData, whoopStrain: e.target.value})}
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg text-orange-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Vibe Column */}
                    <div className="space-y-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <Smile className="w-3 h-3" /> Subjective Vibe
                        </h3>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Mood</label>
                            <div className="flex gap-2">
                                {['bad', 'meh', 'neutral', 'good', 'great'].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setFormData({...formData, mood: m as any})}
                                        className={`flex-1 p-3 rounded-xl border-2 transition-all font-bold text-[10px] uppercase ${formData.mood === m ? 'border-black bg-black text-white' : 'border-gray-100 text-gray-400 hover:border-gray-300'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                                <span>Energy Level</span>
                                <span className="text-black">{formData.energyLevel}/10</span>
                            </div>
                            <input 
                                type="range" min="1" max="10"
                                value={formData.energyLevel}
                                onChange={e => setFormData({...formData, energyLevel: parseInt(e.target.value)})}
                                className="w-full accent-black"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                                <span>Stress Level</span>
                                <span className="text-black">{formData.stressLevel}/10</span>
                            </div>
                            <input 
                                type="range" min="1" max="10"
                                value={formData.stressLevel}
                                onChange={e => setFormData({...formData, stressLevel: parseInt(e.target.value)})}
                                className="w-full accent-black"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-indigo-500" /> Daily Intention
                            </label>
                            <input 
                                value={formData.dailyIntention}
                                onChange={e => setFormData({...formData, dailyIntention: e.target.value})}
                                className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="What is the one thing that makes today a win?"
                            />
                        </div>

                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare className="w-3 h-3" /> Journal Reflection
                            </label>
                            <textarea 
                                value={formData.journalNote}
                                onChange={e => setFormData({...formData, journalNote: e.target.value})}
                                className="w-full bg-gray-50 border-none rounded-3xl p-6 text-sm italic font-medium h-24 focus:ring-2 focus:ring-black transition-all"
                                placeholder="What's on your mind today?"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-5 text-gray-400 font-bold hover:text-black transition-colors">Cancel</button>
                        <button 
                            disabled={saving}
                            className="flex-[3] py-5 bg-black text-white rounded-[2rem] font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                            Complete Daily Check-in
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}
