import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Clock, Plus, Sparkles, CheckSquare, Square, ChevronLeft, ChevronRight, Activity, Loader2, X } from "./ui/Icon";
import { motion, AnimatePresence } from "motion/react";

interface TimeBlockDef {
  id: string;
  name: string;
  hours: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const TIME_BLOCKS: TimeBlockDef[] = [
  { id: "morning_focus", name: "Morning Focus", hours: "08:00 - 11:00", description: "Golden focus window. Protect for your One Thing.", bgColor: "bg-amber-50/50", textColor: "text-amber-800", borderColor: "border-amber-100" },
  { id: "midday_admin", name: "Mid-day Admin", hours: "11:00 - 13:00", description: "Administrative actions, messages, quick loops.", bgColor: "bg-blue-50/55", textColor: "text-blue-800", borderColor: "border-blue-100" },
  { id: "afternoon_deep", name: "Afternoon Deep Work", hours: "14:00 - 17:00", description: "Secondary complex execution or collaboration blocks.", bgColor: "bg-indigo-50/50", textColor: "text-indigo-800", borderColor: "border-indigo-100" },
  { id: "evening_strategy", name: "Evening Strategy", hours: "17:00 - 18:30", description: "Inbox cleanup, daily shut down, planning tomorrow.", bgColor: "bg-purple-50/55", textColor: "text-purple-800", borderColor: "border-purple-100" }
];

export function TimeBlocksPlanner() {
  const { user, workspace } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [tasks, setTasks] = useState<any[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick task addition inside block
  const [quickInputs, setQuickInputs] = useState<Record<string, string>>({});

  // AI Optimizer States
  const [optimizing, setOptimizing] = useState(false);
  const [aiScheduleProposal, setAiScheduleProposal] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !workspace) return;

    // Listen to tasks for the selectedDate (or all tasks to allow unassigned ones)
    const qTasks = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTasks(list);
      setLoading(false);
    }, (err) => console.error(err));

    // Listen to daily performance/Whoop metrics
    const qMetrics = query(
      collection(db, "daily_metrics"),
      where("userId", "==", user.uid),
      where("date", "==", selectedDate)
    );
    const unsubMetrics = onSnapshot(qMetrics, (snap) => {
      if (!snap.empty) {
        setDailyMetrics({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setDailyMetrics(null);
      }
    });

    return () => { unsubTasks(); unsubMetrics(); };
  }, [user, workspace, selectedDate]);

  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
    setAiScheduleProposal(null);
  };

  const handleUpdateTaskBlock = async (taskId: string, blockId: string | null) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        timeBlock: blockId,
        timeBlockDate: blockId ? selectedDate : null,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: currentStatus === "open" ? "done" : "open",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBlockTask = async (e: React.FormEvent, blockId: string) => {
    e.preventDefault();
    const title = quickInputs[blockId]?.trim();
    if (!title || !user || !workspace) return;

    try {
      await addDoc(collection(db, "tasks"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title,
        status: "open",
        priority: blockId === "morning_focus" ? 1 : 2, // High priority inside morning
        timeBlock: blockId,
        timeBlockDate: selectedDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setQuickInputs(prev => ({ ...prev, [blockId]: "" }));
    } catch (err) {
      console.error(err);
    }
  };

  const runScheduleOptimizer = async () => {
    setOptimizing(true);
    setAiScheduleProposal(null);
    try {
      // Collect open tasks not fully closed
      const openTasks = tasks.filter(t => t.status === "open");

      const res = await fetch("/api/timeblocks/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: openTasks,
          metrics: dailyMetrics || { note: "Unspecified health metrics." },
          date: selectedDate
        })
      });

      if (!res.ok) throw new Error("Backend scheduler optimization rejected.");
      const data = await res.json();
      setAiScheduleProposal(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Something went wrong contact connection.");
    } finally {
      setOptimizing(false);
    }
  };

  const approveAndApplySchedule = async () => {
    if (!aiScheduleProposal?.blockPlan) return;
    try {
      for (const block of aiScheduleProposal.blockPlan) {
        const blockId = TIME_BLOCKS.find(tb => tb.name.toLowerCase().includes(block.blockName.split(" ")[0].toLowerCase()))?.id;
        if (!blockId) continue;

        for (const planItem of block.allocatedTasks) {
          if (planItem.taskId) {
            await updateDoc(doc(db, "tasks", planItem.taskId), {
              timeBlock: blockId,
              timeBlockDate: selectedDate,
              plannerStrategyNotes: block.blockStrategy || "",
              updatedAt: serverTimestamp()
            });
          }
        }
      }
      setAiScheduleProposal(null);
    } catch (err) {
      console.error(err);
      alert("Failed to apply optimizer schedule.");
    }
  };

  // Filter lists
  const unassignedTasks = tasks.filter(t => t.status === "open" && !t.timeBlock);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Energy/Whoop indicators
  const sleepPerformance = dailyMetrics?.sleepPerformance || dailyMetrics?.sleepScore;
  const whoopStrain = dailyMetrics?.strain || dailyMetrics?.whoopStrain;
  const hrv = dailyMetrics?.hrv;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 max-w-7xl mx-auto pb-24"
    >
      {/* Header details */}
      <header className="mb-8 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-7 h-7 text-amber-500" />
            Daily Time Blocks Planner
          </h1>
          <p className="text-gray-500 text-sm mt-1">Assign active commitments to specific focus vectors, synced with performance indicators.</p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center gap-2 self-start md:self-center bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm">
          <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-black">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-black text-gray-800 px-2 min-w-28 text-center">{selectedDate}</span>
          <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-black">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Wellness & Whoop Performance Ribbon */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-center text-amber-500 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Physiological Load Integration</p>
            {dailyMetrics ? (
              <p className="text-[11px] text-gray-500 mt-0.5">
                Whoop sleep/score: <span className="font-bold text-emerald-600">{sleepPerformance || 80}%</span> • Strain Load: <span className="font-bold text-indigo-600">{whoopStrain || 12.5}</span> • HRV: <span className="font-bold text-gray-700">{hrv || 65} ms</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-400 mt-0.5">No metrics registered today. Pulling workspace base schedule constraints.</p>
            )}
          </div>
        </div>

        <button
          onClick={runScheduleOptimizer}
          disabled={optimizing}
          className="bg-black text-white text-xs font-bold px-4 py-2 bg-gradient-to-r from-amber-550 to-amber-700 rounded-xl flex items-center gap-1.5 hover:bg-opacity-90 shadow-sm disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          {optimizing ? "Generating Block Plan..." : "Scan & AI Auto-Block Tasks"}
        </button>
      </div>

      {/* AI Schedule Optimizer Output */}
      <AnimatePresence>
        {aiScheduleProposal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50/30 border border-amber-200/50 rounded-3xl p-6 mb-8 space-y-5 shadow-inner"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Certo Work Block Optimization</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={approveAndApplySchedule}
                  className="bg-black text-white text-[10px] font-black px-4 py-1.5 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Apply AI Daily Schedule
                </button>
                <button
                  onClick={() => setAiScheduleProposal(null)}
                  className="border border-gray-300 text-gray-600 bg-white text-[10px] font-medium px-4 py-1.5 rounded-xl hover:bg-gray-50"
                >
                  Dismiss
                </button>
              </div>
            </div>

            <p className="text-xs text-amber-950 font-medium italic">"{aiScheduleProposal.energyReflection}"</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {aiScheduleProposal.blockPlan?.map((block: any, i: number) => (
                <div key={i} className="bg-white border border-amber-100 p-4 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">{block.blockName}</p>
                  <p className="text-[10px] text-gray-500 leading-normal mt-1 mb-2.5">Move Strategy: {block.blockStrategy}</p>
                  <div className="space-y-1.5 border-t border-gray-50 pt-2">
                    {block.allocatedTasks?.map((item: any, idx: number) => (
                      <div key={idx} className="bg-amber-50/20 px-2 py-1.5 rounded-lg border border-amber-100/30">
                        <p className="text-[10px] font-bold text-gray-800 truncate">{item.title}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{item.blockSpecificGoal}</p>
                      </div>
                    ))}
                    {block.allocatedTasks?.length === 0 && (
                      <p className="text-[9px] text-gray-400 italic">No tasks suggested here.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Unassigned / Backlog tasks repository (4 columns) */}
        <section className="lg:col-span-4 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Tasks backlog</h2>
            <p className="text-[10px] text-gray-500 pl-1 mt-0.5">Drag-and-drop actions or click Block tag to schedule.</p>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto pr-1">
            {unassignedTasks.map(t => (
              <div key={t.id} className="py-3 flex flex-col gap-2 group">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-bold text-gray-900 leading-tight">{t.title}</span>
                  <span className={`text-[8px] uppercase font-bold px-1 rounded shrink-0 ${
                    t.priority === 1 ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    P{t.priority || 2}
                  </span>
                </div>

                {/* Direct Action buttons to dispatch to blocks */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {TIME_BLOCKS.map(tb => (
                    <button
                      key={tb.id}
                      onClick={() => handleUpdateTaskBlock(t.id, tb.id)}
                      className="text-[8px] font-bold px-2 py-0.5 bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-all border border-gray-150"
                    >
                      + {tb.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {unassignedTasks.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400 italic">
                No unassigned tasks! Everything is scheduled or complete.
              </div>
            )}
          </div>
        </section>

        {/* Right Side: Hourly blocks planning board (8 columns) */}
        <section className="lg:col-span-8 space-y-5">
          {TIME_BLOCKS.map(block => {
            // Find tasks assigned to this block for selectedDate
            const blockTasks = tasks.filter(t => t.timeBlock === block.id && t.timeBlockDate === selectedDate);
            
            return (
              <div
                key={block.id}
                className={`bg-white border rounded-3xl p-5 shadow-sm transition-all flex flex-col md:flex-row gap-4 items-start ${block.borderColor}`}
              >
                {/* Block header name / description */}
                <div className="md:w-1/4 shrink-0 pr-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${block.bgColor} ${block.textColor}`}>
                    {block.name}
                  </span>
                  <p className="text-xs text-gray-900 font-bold mt-2.5">{block.hours}</p>
                  <p className="text-[10px] text-gray-400 leading-normal mt-1">{block.description}</p>
                </div>

                {/* Content assigned tasks list */}
                <div className="flex-1 w-full space-y-3">
                  
                  {/* Inline quick task form */}
                  <form onSubmit={(e) => handleAddBlockTask(e, block.id)} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add task straight inside block..."
                      value={quickInputs[block.id] || ""}
                      onChange={(e) => setQuickInputs(prev => ({ ...prev, [block.id]: e.target.value }))}
                      className="flex-1 bg-gray-50 border border-gray-150 rounded-xl px-3 py-1.5 text-xs focus:ring-0"
                    />
                    <button
                      type="submit"
                      disabled={!(quickInputs[block.id]?.trim())}
                      className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-500 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="divide-y divide-gray-100">
                    {blockTasks.map(t => {
                      const isDone = t.status === "done";
                      return (
                        <div key={t.id} className="py-2.5 flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleTaskStatus(t.id, t.status)}
                              className="text-gray-400 hover:text-indigo-600 shrink-0 transition-colors"
                            >
                              {isDone ? (
                                <CheckSquare className="w-4.5 h-4.5 text-emerald-600" />
                              ) : (
                                <Square className="w-4.5 h-4.5" />
                              )}
                            </button>
                            <div>
                              <span className={`text-xs font-semibold block ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
                                {t.title}
                              </span>
                              {t.plannerStrategyNotes && (
                                <span className="text-[8px] text-indigo-500 uppercase font-black tracking-wider block mt-0.5">
                                  Strategy: {t.plannerStrategyNotes}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] uppercase font-bold px-1 rounded ${
                              t.priority === 1 ? "bg-rose-50 text-rose-700" : "bg-gray-150 text-gray-600"
                            }`}>
                              P{t.priority || 2}
                            </span>
                            
                            <button
                              onClick={() => handleUpdateTaskBlock(t.id, null)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                              title="Unschedule task (Return to Backlog)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {blockTasks.length === 0 && (
                      <p className="text-[10px] text-gray-400 italic py-4 pl-1">No tasks scheduled in this block yet.</p>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </section>

      </div>
    </motion.div>
  );
}
