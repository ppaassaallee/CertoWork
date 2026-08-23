import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Brain, Flame, ChevronRight, Loader2, Sparkles, Plus, Trash2, Play, Pause, RefreshCw } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { DailyBrief } from "../types";

export function StartMyDay({ onComplete }: { onComplete?: () => void }) {
  const { user, workspace } = useAuth();
  const [step, setStep] = useState<number>(1); // 1: Mental Reset, 2: Load Brief, 3: Priorities, 4: Confirmed Day
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [brief, setBrief] = useState<DailyBrief | null>(null);

  // Step 1 states (Mental Reset)
  const [seconds, setSeconds] = useState(60);
  const [isActive, setIsActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale");
  const [mindClearItems, setMindClearItems] = useState<{ id: string, title: string, type: string }[]>([]);
  const [newClearItem, setNewClearItem] = useState("");
  const [clearItemType, setClearItemType] = useState<"pendiente" | "decision" | "idea">("pendiente");

  // Step 3 states
  const [oneThing, setOneThing] = useState<string>("");
  const [top3, setTop3] = useState<string[]>([]);

  // Breathing Timer
  useEffect(() => {
    let interval: any = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((prev) => prev - 1);
        // Toggle phase every 4 seconds
        const phaseVal = (60 - seconds) % 12;
        if (phaseVal < 4) {
          setBreathPhase("Inhale");
        } else if (phaseVal < 8) {
          setBreathPhase("Hold");
        } else {
          setBreathPhase("Exhale");
        }
      }, 1000);
    } else if (seconds === 0 && isActive) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const handleAddClearItem = () => {
    if (!newClearItem.trim()) return;
    setMindClearItems([...mindClearItems, {
      id: Math.random().toString(),
      title: newClearItem.trim(),
      type: clearItemType
    }]);
    setNewClearItem("");
  };

  const handleRemoveClearItem = (id: string) => {
    setMindClearItems(mindClearItems.filter(item => item.id !== id));
  };

  // Step 2 Action: Generate Brief
  const generateDailyBrief = async () => {
    if (!user || !workspace) return;
    setLoadingBrief(true);
    setStep(2);

    try {
      // 1. Fetch relevant databases
      const [tasksSnap, projectsSnap, goalsSnap, stakeholdersSnap, alertsSnap] = await Promise.all([
        getDocs(query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "open"))),
        getDocs(query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id))),
        getDocs(query(collection(db, "strategic_goals"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id))),
        getDocs(query(collection(db, "stakeholders"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id))),
        getDocs(query(collection(db, "strategic_alerts"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "active")))
      ]);

      const tasksList = tasksSnap.docs.map(t => ({ id: t.id, title: t.data().title, priority: t.data().priority, dueDate: t.data().dueDate }));
      const projectsList = projectsSnap.docs.map(p => ({ id: p.id, title: p.data().title, status: p.data().status }));
      const goalsList = goalsSnap.docs.map(g => ({ id: g.id, title: g.data().title, type: g.data().type }));
      const stakeholdersList = stakeholdersSnap.docs.map(s => ({ id: s.id, name: s.data().name }));
      const alertsList = alertsSnap.docs.map(a => ({ id: a.id, title: a.data().title, severity: a.data().severity }));

      // 2. Query endpoint
      const response = await fetch("/api/boldi/daily-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasksList,
          projects: projectsList,
          goals: goalsList,
          stakeholders: stakeholdersList,
          alerts: alertsList
        })
      });

      if (!response.ok) throw new Error("Daily Brief Generation failed");
      const summary = await response.json();
      setBrief(summary);

      // Seed defaults
      setOneThing(summary.recommendedOneThing?.title || "");
      setTop3(summary.recommendedTop3?.map((t: any) => t.title) || []);

      setStep(3);
    } catch (err) {
      console.error(err);
      setStep(1); // rollback
    } finally {
      setLoadingBrief(false);
    }
  };

  // Step 3 Action: Approve Day
  const handleApproveDayExecution = async () => {
    if (!user || !workspace || !brief) return;

    try {
      // 1. Audit brief PDF / text storage
      const briefRef = await addDoc(collection(db, "daily_briefs"), {
        userId: user.uid,
        workspaceId: workspace.id,
        date: new Date().toISOString().split("T")[0],
        status: "accepted",
        summary: brief.summary,
        strategicObjective: brief.strategicObjective,
        recommendedOneThing: {
          title: oneThing,
          reason: brief.recommendedOneThing?.reason || "High Priority Focus",
          linkedGoalIds: brief.recommendedOneThing?.linkedGoalIds || [],
          linkedTaskId: brief.recommendedOneThing?.linkedTaskId || null
        },
        recommendedTop3: top3.map(title => {
          const match = brief.recommendedTop3?.find((r: any) => r.title === title);
          return {
            title,
            reason: match?.reason || "Critical task for today",
            linkedTaskId: match?.linkedTaskId || null,
            linkedProjectId: match?.linkedProjectId || null
          };
        }),
        projectAlerts: brief.projectAlerts || [],
        stakeholderFollowUps: brief.stakeholderFollowUps || [],
        timeBlockSuggestions: brief.timeBlockSuggestions || [],
        recommendations: brief.recommendations || [],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Create StartDaySession logging details
      await addDoc(collection(db, "start_day_sessions"), {
        userId: user.uid,
        workspaceId: workspace.id,
        date: new Date().toISOString().split("T")[0],
        status: "completed",
        dailyBriefId: briefRef.id,
        startedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Update tasks as prioritized today or P1
      // Save clear items as review candidates
      for (const item of mindClearItems) {
        await addDoc(collection(db, "review_candidates"), {
          userId: user.uid,
          workspaceId: workspace.id,
          createdBy: user.uid,
          title: item.title,
          type: item.type === 'decision' ? 'decision' : 'task',
          why: "Added via Start My Day mental reset capture.",
          action: "Process",
          confidence: "high",
          proposed: {},
          source: item.title,
          sourceType: "start_day",
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setStep(4);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-xl max-w-2xl mx-auto space-y-6">
      {/* Progress timeline */}
      <div className="flex justify-between items-center pb-4 border-b border-neutral-100">
        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
          <Flame className="w-5 h-5 text-neutral-800" /> Start My Day Onboarding
        </h2>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 w-6 rounded-full ${step >= s ? 'bg-black' : 'bg-neutral-100'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: MENTAL RESET */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="bg-neutral-50 p-4 rounded-2xl flex items-center gap-4 border border-neutral-100">
              <Brain className="w-10 h-10 text-neutral-800" />
              <div>
                <h3 className="font-extrabold text-sm text-neutral-800">Step 1: Executive Mental Reset</h3>
                <p className="text-xs text-neutral-500">Take a breath, release residual load, and capture raw cognitive items before looking at metrics.</p>
              </div>
            </div>

            {/* Breathing circles */}
            <div className="flex flex-col items-center justify-center py-6 bg-neutral-900 rounded-3xl text-white space-y-4">
              <motion.div
                animate={{
                  scale: isActive 
                    ? (breathPhase === "Inhale" ? 1.4 : breathPhase === "Hold" ? 1.4 : 1.0) 
                    : 1.0
                }}
                transition={{ duration: 4, ease: "easeInOut" }}
                className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-xs uppercase tracking-wider ${
                  breathPhase === "Hold" ? "bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]" : "bg-white text-black"
                }`}
              >
                {breathPhase}
              </motion.div>
              <div className="text-center">
                <div className="text-xs text-neutral-400 mt-1">Recommended Duration: 60s</div>
                <div className="text-lg font-mono font-bold mt-1">{seconds}s</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsActive(!isActive)}
                  className="bg-white text-black text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-neutral-100"
                >
                  {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {isActive ? "Pause" : "Start"}
                </button>
                <button
                  onClick={() => { setIsActive(false); setSeconds(60); }}
                  className="border border-white/20 text-white hover:bg-white/10 text-xs px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>

            {/* Brain Dump Form */}
            <div className="space-y-3">
              <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest block">Release & Capture Cognitive Items</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Capture pending node, task, decision, or let-go..."
                  value={newClearItem}
                  onChange={(e) => setNewClearItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddClearItem(); }}
                  className="flex-1 text-xs p-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-black"
                />
                <select
                  value={clearItemType}
                  onChange={(e: any) => setClearItemType(e.target.value)}
                  className="text-xs p-2 bg-neutral-50 rounded-xl border border-neutral-200"
                >
                  <option value="pendiente">Pending Task</option>
                  <option value="decision">Decision</option>
                  <option value="idea">Raw Idea</option>
                </select>
                <button
                  onClick={handleAddClearItem}
                  className="bg-black text-white p-3 rounded-xl hover:bg-neutral-800"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Cognitive dumping list */}
              {mindClearItems.length > 0 && (
                <div className="space-y-1.5 py-1 max-h-24 overflow-y-auto">
                  {mindClearItems.map(item => (
                    <div key={item.id} className="text-xs p-2.5 bg-neutral-50 border border-neutral-100 rounded-xl flex justify-between items-center">
                      <span className="font-semibold text-neutral-800">
                        <span className="uppercase text-[9px] bg-neutral-200 px-1.5 py-0.5 rounded mr-2 font-bold">{item.type}</span>
                        {item.title}
                      </span>
                      <button onClick={() => handleRemoveClearItem(item.id)} className="text-neutral-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={generateDailyBrief}
              disabled={loadingBrief}
              className="w-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              Analyze Workspace & Load Daily Brief <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* STEP 2: LOAD BRIEF LOADING */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center space-y-4"
          >
            <Loader2 className="w-10 h-10 animate-spin text-neutral-800 mx-auto" />
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">Retrieving High-Priority Context</div>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">Chief of Co-Pilot is checking active corporate alignment nodes, missing reviews, metrics trends, and unaligned project workloads.</p>
          </motion.div>
        )}

        {/* STEP 3: PRIORITIZE 2+8 */}
        {step === 3 && brief && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary */}
            <div className="bg-neutral-50 p-4.5 rounded-2xl border border-neutral-100 space-y-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Certo Work Strategic Overview
              </h3>
              <p className="text-xs text-neutral-800 font-medium leading-relaxed italic">{brief.strategicObjective}</p>
              <p className="text-xs text-neutral-500 leading-relaxed pt-1 border-t border-neutral-100">{brief.summary}</p>
            </div>

            {/* Task selections Form */}
            <div className="space-y-4">
              {/* One Thing (Non-negotiable) */}
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Today's ONE Thing (Non-negotiable)</label>
                <input
                  type="text"
                  value={oneThing}
                  onChange={(e) => setOneThing(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 rounded-xl border border-neutral-200 outline-none bold font-semibold focus:ring-1 focus:ring-black"
                />
                <p className="text-[10px] text-neutral-400 mt-1 italic">Reason: {brief.recommendedOneThing?.reason}</p>
              </div>

              {/* Should Dos */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">Top Recommended should-dos (Up to 8)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-neutral-100 p-2.5 rounded-2xl bg-neutral-50">
                  {brief.recommendedTop3?.map((item: any, idx: number) => {
                    const isSelected = top3.includes(item.title);
                    return (
                      <label key={idx} className="flex items-start gap-2.5 p-1 text-xs text-neutral-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setTop3(top3.filter(v => v !== item.title));
                            } else {
                              if (top3.length < 8) {
                                setTop3([...top3, item.title]);
                              }
                            }
                          }}
                          className="rounded text-black mt-0.5"
                        />
                        <div>
                          <div className="font-semibold text-neutral-800">{item.title}</div>
                          <div className="text-[9px] text-neutral-400">"{item.reason}"</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Project alerts & stakeholder check */}
              {brief.projectAlerts?.length > 0 && (
                <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-1">
                  <span className="text-[9px] font-bold text-red-700 uppercase tracking-wider">Active Strategic Drift alerts</span>
                  {brief.projectAlerts.slice(0, 2).map((a: any, i: number) => (
                    <div key={i} className="text-xs text-red-800 font-semibold">• {a.reason} (<span className="text-[10px]">Action: {a.suggestedAction}</span>)</div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border hover:bg-neutral-50 py-3 rounded-xl text-xs font-bold"
              >
                Back to Reset
              </button>
              <button
                onClick={handleApproveDayExecution}
                className="flex-1 bg-black text-white hover:bg-neutral-800 py-3 rounded-xl text-xs font-bold"
              >
                Approve Day Priority Plan
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: CONFIRMED */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-12 text-center space-y-4"
          >
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto animate-bounce" />
            <h3 className="text-lg font-extrabold text-neutral-800">Your Perfect Day Blueprint is Locked!</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">All mental dumps have been mapped to System Review. Today's ONE Thing and 2+8 prioritizations are registered for maximum performance.</p>
            <button
              onClick={() => {
                if (onComplete) onComplete();
              }}
              className="mt-4 bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold"
            >
              Enter Workspace
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
