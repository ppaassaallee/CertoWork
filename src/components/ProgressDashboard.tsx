import { useState, useEffect } from "react";
import { Loader2, Brain, BarChart3, Sparkles } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { computeAnalytics } from "../lib/analytics";
import { db } from "../lib/firebase";
import { collection, serverTimestamp, query, where, onSnapshot, orderBy, limit, addDoc } from "firebase/firestore";
import { chartColors } from "../lib/chartColors";
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";

export function ProgressDashboard() {
  const { user, workspace } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [period, setPeriod] = useState('30days');

  // Real Habits stats
  const [habitState, setHabitState] = useState({ consistency: 0, count: 0 });

  useEffect(() => {
    if (!user || !workspace) return;
    setLoading(true);
    
    const loadMetrics = async () => {
      const m = await computeAnalytics(user.uid, workspace.id, period === '30days' ? 30 : 7);
      setMetrics(m);
      setLoading(false);
    };
    
    loadMetrics();

    // Subscribe to task changes
    const qTasks = query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubscribe = onSnapshot(qTasks, loadMetrics);

    // Subscribe to analysis changes
    const qAnalysis = query(collection(db, "performance_analyses"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), orderBy("createdAt", "desc"), limit(1));
    const unsubAnalysis = onSnapshot(qAnalysis, (snap: any) => { if (!snap.empty) setAnalysis(snap.docs[0].data()); });

    // Active Habits and log calculations over range
    const qHabits = query(collection(db, "habits"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "active"));
    const unsubscribeHabits = onSnapshot(qHabits, (snap) => {
        const habitsList: any[] = [];
        snap.forEach(d => habitsList.push({ id: d.id, ...d.data() }));
        
        // Date limits
        const daysToFetch = period === '30days' ? 30 : 7;
        const now = new Date();
        const startLimit = new Date();
        startLimit.setDate(now.getDate() - daysToFetch);
        const startLimitStr = startLimit.toISOString().split('T')[0];

        const qLogs = query(
          collection(db, "habit_logs"),
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspace.id),
          where("date", ">=", startLimitStr)
        );

        onSnapshot(qLogs, (logsSnap) => {
           const logsList: any[] = [];
           logsSnap.forEach(d => logsList.push(d.data()));

           let totalEvaluated = 0;
           let score = 0;
           const logsMap = new Map<string, string>();
           logsList.forEach(l => logsMap.set(`${l.habitId}_${l.date}`, l.status));

           const loopDate = new Date(startLimit);
           const todayStr = now.toISOString().split('T')[0];

           while(loopDate <= now) {
              const dStr = loopDate.toISOString().split('T')[0];
              if (dStr <= todayStr) {
                 const dayIdx = loopDate.getDay();
                 habitsList.forEach(h => {
                    let due = false;
                    if (h.cadenceType === 'daily') due = true;
                    if (h.cadenceType === 'workdays' && dayIdx >= 1 && dayIdx <= 5) due = true;
                    if (h.cadenceType === 'weekly' && h.daysOfWeek?.includes(dayIdx)) due = true;

                    if (due) {
                       const currentStatus = logsMap.get(`${h.id}_${dStr}`);
                       if (currentStatus !== 'skipped') {
                          totalEvaluated++;
                          if (currentStatus === 'done') score += 1;
                          if (currentStatus === 'partial') score += 0.5;
                       }
                    }
                 });
              }
              loopDate.setDate(loopDate.getDate() + 1);
           }
           const consistency = totalEvaluated > 0 ? Math.round((score / totalEvaluated) * 100) : 0;
           setHabitState({ consistency, count: habitsList.length });
        });
    });

    return () => { 
      unsubscribe(); 
      unsubAnalysis(); 
      unsubscribeHabits();
    };
  }, [user, workspace, period]);

  const handleRunAnalysis = async () => {
    if (!user || !workspace || !metrics) return;
    setAnalyzing(true);
    try {
        const res = await fetch('/api/analytics/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metrics, period: { start: period } })
        });
        const data = await res.json();
        await addDoc(collection(db, "performance_analyses"), {
            userId: user.uid,
            workspaceId: workspace.id,
            ...data,
            metricsUsed: metrics,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        setAnalysis(data);
    } catch (e) {
        console.error(e);
    } finally {
        setAnalyzing(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center h-screen items-center"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>;

  return (
    <div className="space-y-8 pb-24 p-6 max-w-7xl mx-auto">
        <header className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Progress</h1>
                <p className="text-gray-500 font-medium text-sm font-sans">Strategic performance index indicators.</p>
            </div>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-gray-100 p-3 rounded-xl font-bold text-xs uppercase cursor-pointer">
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
            </select>
        </header>

        {/* Hero */}
        <div className="bg-indigo-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-indigo-300">Focus Score</h2>
                <div className="text-7xl font-black tracking-tighter mt-2">{metrics?.focusScore || 0}</div>
                <p className="text-indigo-200 mt-3 font-medium max-w-sm">Weighted index of ONE Thing completion, top tasks, and workflow parameters.</p>
            </div>
            <button onClick={handleRunAnalysis} disabled={analyzing} className="bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-indigo-50 transition-all flex items-center gap-2">
                {analyzing ? <Loader2 className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4" />}
                <span>Analyze My Performance</span>
            </button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard title="ONE Thing Done" value={`${metrics?.oneThingConsistency || 0}%`} color={metrics?.oneThingConsistency === 0 ? 'rose' : 'indigo'} />
            <StatCard title="Execution Quality" value={`${metrics?.executionQuality || 0}%`} color="emerald" />
            <StatCard title="Review Health" value={`${metrics?.reviewHealth?.score || 0}%`} color="amber" desc={`Pending: ${metrics?.reviewHealth?.pendingCount || 0}`} />
            <StatCard title="Habit Consistency" value={`${habitState.consistency}%`} color="indigo" desc={`Tracking ${habitState.count} active habits`} />
            <StatCard title="Flow Ratio" value={`${metrics?.flowRatio || 0}%`} color="rose" desc={`Created: ${metrics?.createdCount || 0}, Closed: ${metrics?.completedCount || 0}`} />
        </div>

        {/* Project Momentum */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
             <h3 className="text-xs font-black uppercase text-gray-400 mb-6 flex items-center gap-2">Project Momentum</h3>
             <div className="flex flex-wrap gap-4">
                  {metrics?.projectMomentum?.map((p: any, i: number) => (
                      <div key={i} className={`px-4 py-2 rounded-xl text-xs font-bold ${p.isMoving ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {p.title}: {p.isMoving ? 'Moving' : 'Stuck'}
                      </div>
                  ))}
             </div>
        </div>

        {/* Charts & AI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                <h3 className="text-xs font-black uppercase text-gray-400 mb-6 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Completion by Priority
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics?.tasksByPriority ? Object.entries(metrics.tasksByPriority).map(([name, value]) => ({ name, value })) : []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
             
             {/* AI Analysis View */}
             <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <h3 className="text-xs font-black uppercase text-gray-400 mb-6 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> AI Performance Analysis
                </h3>
                {analysis ? (
                    <div className="space-y-6">
                        <p className="text-sm font-semibold leading-relaxed">{analysis.executiveSummary}</p>
                        
                        <h4 className="text-[10px] font-black uppercase text-indigo-600">Recommendations</h4>
                        <div className="space-y-3">
                            {analysis.recommendations?.map((r: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                    <div>
                                        <p className="text-xs font-bold text-gray-900">{r.title}</p>
                                        <p className="text-[10px] text-gray-500">{r.description}</p>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            if (user && workspace) {
                                                await addDoc(collection(db, "review_candidates"), {
                                                    userId: user.uid,
                                                    workspaceId: workspace.id,
                                                    title: r.title,
                                                    type: r.type || 'task',
                                                    why: r.description,
                                                    source: 'Performance Analysis',
                                                    sourceType: 'performance_analysis',
                                                    sourceId: analysis.id || 'current',
                                                    proposed: r,
                                                    confidence: 'High',
                                                    action: 'Review and Execute',
                                                    status: 'pending',
                                                    createdAt: serverTimestamp()
                                                });
                                                alert("Sent to review!");
                                            }
                                        }}
                                        className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700"
                                    >
                                        Review
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : <div className="text-sm text-gray-400 italic">Not enough data to analyze yet, or run analysis manually.</div>}
             </div>
        </div>
    </div>
  );
}

function StatCard({ title, value, color, desc }: any) {
    const bg: any = { indigo: 'bg-indigo-50', emerald: 'bg-emerald-50', amber: 'bg-amber-50', rose: 'bg-rose-50' };
    const text: any = { indigo: 'text-indigo-900', emerald: 'text-emerald-950', amber: 'text-amber-900', rose: 'text-rose-900' };

    return (
        <div className={`p-6 rounded-2xl ${bg[color] || 'bg-gray-50'} ${text[color] || 'text-gray-900'} flex flex-col justify-between min-h-[110px]`}>
            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{title}</h4>
            <div>
              <div className="text-2xl font-black tracking-tight leading-none mb-1">{value}</div>
              {desc && <p className="text-[9px] font-bold opacity-60 leading-tight">{desc}</p>}
            </div>
        </div>
    );
}
