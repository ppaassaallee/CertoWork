
import { useState, useEffect } from "react";
import { Scale, Zap, Moon, Heart, Activity, Loader2, Save, ChevronLeft, ChevronRight, TrendingUp } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { DailyMetric } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

export function DailyMetrics() {
  const { user, workspace } = useAuth();
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState({
    weight: "",
    whoopRecoveryScore: "",
    whoopStrain: "",
    whoopSleepScore: "",
    whoopRHR: "",
    whoopHRV: "",
    notes: ""
  });

  useEffect(() => {
    if (!user || !workspace) return;

    const q = query(
      collection(db, "daily_metrics"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      orderBy("date", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: DailyMetric[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as DailyMetric));
      setMetrics(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "daily_metrics");
    });

    return () => unsub();
  }, [user, workspace]);

  useEffect(() => {
    const existing = metrics.find(m => m.date === selectedDate);
    if (existing) {
      setFormData({
        weight: existing.weight?.toString() || "",
        whoopRecoveryScore: existing.whoopRecoveryScore?.toString() || "",
        whoopStrain: existing.whoopStrain?.toString() || "",
        whoopSleepScore: existing.whoopSleepScore?.toString() || "",
        whoopRHR: existing.whoopRHR?.toString() || "",
        whoopHRV: existing.whoopHRV?.toString() || "",
        notes: existing.notes || ""
      });
    } else {
      setFormData({
        weight: "",
        whoopRecoveryScore: "",
        whoopStrain: "",
        whoopSleepScore: "",
        whoopRHR: "",
        whoopHRV: "",
        notes: ""
      });
    }
  }, [selectedDate, metrics]);

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
        notes: formData.notes,
        updatedAt: serverTimestamp(),
        createdAt: metrics.find(m => m.date === selectedDate)?.createdAt || serverTimestamp()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "daily_metrics");
    } finally {
      setSaving(false);
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health & Metrics</h1>
          <p className="text-gray-500 text-sm">Track your physiological readiness and body weight.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">Daily Log</h2>
                <div className="flex items-center gap-2">
                   <button onClick={() => changeDate(-1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
                   <span className="text-sm font-bold bg-gray-50 px-3 py-1 rounded-full">{selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedDate}</span>
                   <button onClick={() => changeDate(1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight className="w-5 h-5" /></button>
                </div>
             </div>

             <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Scale className="w-3 h-3" /> Weight (kg)
                   </label>
                   <input 
                      type="number" step="0.1" 
                      value={formData.weight}
                      onChange={e => setFormData({...formData, weight: e.target.value})}
                      placeholder="0.0"
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-xl focus:ring-2 focus:ring-black transition-all"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                         <Zap className="w-3 h-3 text-red-500" /> Whoop Recovery
                      </label>
                      <input 
                        type="number" 
                        value={formData.whoopRecoveryScore}
                        onChange={e => setFormData({...formData, whoopRecoveryScore: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg focus:ring-2 focus:ring-red-500 transition-all text-red-600"
                        placeholder="%"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                         <Activity className="w-3 h-3 text-blue-500" /> Whoop Strain
                      </label>
                      <input 
                        type="number" step="0.1"
                        value={formData.whoopStrain}
                        onChange={e => setFormData({...formData, whoopStrain: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg focus:ring-2 focus:ring-blue-500 transition-all text-blue-600"
                        placeholder="0.0"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                         <Moon className="w-3 h-3 text-indigo-500" /> Sleep %
                      </label>
                      <input 
                        type="number" 
                        value={formData.whoopSleepScore}
                        onChange={e => setFormData({...formData, whoopSleepScore: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg focus:ring-2 focus:ring-indigo-500 transition-all text-indigo-600"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                         <Heart className="w-3 h-3 text-gray-500" /> RHR
                      </label>
                      <input 
                        type="number" 
                        value={formData.whoopRHR}
                        onChange={e => setFormData({...formData, whoopRHR: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-lg focus:ring-2 focus:ring-gray-500 transition-all"
                      />
                   </div>
                </div>
                
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</label>
                   <textarea 
                     value={formData.notes}
                     onChange={e => setFormData({...formData, notes: e.target.value})}
                     className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-black transition-all"
                     rows={3}
                   />
                </div>

                <button 
                  disabled={saving}
                  className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-all"
                >
                   {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                   Save Entry
                </button>
             </form>
          </div>
        </div>

        {/* Trends & Insights */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
                 <TrendingUp className="w-5 h-5 text-indigo-600" /> Weight Trend (30 Days)
              </h2>
              <div className="h-64 w-full bg-gray-50 rounded-2xl flex items-center justify-center relative overflow-hidden">
                 {metrics.length > 1 ? (
                    <WeightChart metrics={[...metrics].reverse()} />
                 ) : (
                    <p className="text-gray-400 text-sm">Need more data points to show trend.</p>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                 <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Avg Recovery</h3>
                 <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-red-600">
                       {Math.round(metrics.reduce((acc, curr) => acc + (curr.whoopRecoveryScore || 0), 0) / (metrics.filter(m => m.whoopRecoveryScore).length || 1))}%
                    </span>
                    <span className="text-xs text-gray-400 mb-1 font-bold">Last 30 days</span>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                 <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Avg Sleep</h3>
                 <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-indigo-600">
                       {Math.round(metrics.reduce((acc, curr) => acc + (curr.whoopSleepScore || 0), 0) / (metrics.filter(m => m.whoopSleepScore).length || 1))}%
                    </span>
                    <span className="text-xs text-gray-400 mb-1 font-bold">Consistency</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function WeightChart({ metrics }: { metrics: DailyMetric[] }) {
    const dataPoints = metrics.filter(m => m.weight).map(m => m.weight as number);
    if (dataPoints.length < 2) return null;

    const min = Math.min(...dataPoints) - 1;
    const max = Math.max(...dataPoints) + 1;
    const range = max - min;
    const width = 600;
    const height = 200;

    const points = dataPoints.map((val, i) => {
        const x = (i / (dataPoints.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full p-4 drop-shadow-xl" preserveAspectRatio="none">
           <defs>
             <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
             </linearGradient>
           </defs>
           <path 
             d={`M 0 ${height} L 0 ${height - ((dataPoints[0] - min) / range) * height} L ${points} L ${width} ${height} Z`}
             fill="url(#chartGradient)"
           />
           <polyline
             fill="none"
             stroke="var(--accent)"
             strokeWidth="4"
             strokeLinecap="round"
             strokeLinejoin="round"
             points={points}
           />
           {dataPoints.map((val, i) => (
             <circle 
                key={i} 
                cx={(i / (dataPoints.length - 1)) * width} 
                cy={height - ((val - min) / range) * height} 
                r="4" 
                fill="white" 
                stroke="var(--accent)"
                strokeWidth="2" 
             />
           ))}
        </svg>
    );
}
