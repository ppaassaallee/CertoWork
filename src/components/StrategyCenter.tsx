import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Target, TrendingUp, Compass, Plus, Loader2, CheckCircle2, AlertTriangle, Layers } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { StrategicGoal, KeyResult, StrategicInitiative } from "../types";

export function StrategyCenter() {
  const { user, workspace } = useAuth();
  const [activeTab, setActiveTab] = useState<'goals' | 'initiatives' | 'alignment'>('goals');
  const [goals, setGoals] = useState<StrategicGoal[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [initiatives, setInitiatives] = useState<StrategicInitiative[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalType, setGoalType] = useState<StrategicGoal['type']>('wig');
  const [goalPriority, setGoalPriority] = useState<StrategicGoal['priority']>('P1');

  const [showAddInitiative, setShowAddInitiative] = useState(false);
  const [initTitle, setInitTitle] = useState("");
  const [initDesc, setInitDesc] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const [showAddKR, setShowAddKR] = useState<string | null>(null);
  const [krTitle, setKrTitle] = useState("");
  const [krTarget, setKrTarget] = useState(100);
  const [krStart, setKrStart] = useState(0);
  const [krType, setKrType] = useState<KeyResult['metricType']>('percent');

  // Load Data
  useEffect(() => {
    if (!user || !workspace) return;

    const qGoals = query(collection(db, "strategic_goals"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubGoals = onSnapshot(qGoals, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setGoals(items);
    });

    const qKRs = query(collection(db, "key_results"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubKRs = onSnapshot(qKRs, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setKeyResults(items);
    });

    const qInits = query(collection(db, "strategic_initiatives"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubInits = onSnapshot(qInits, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setInitiatives(items);
    });

    const qProj = query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubProj = onSnapshot(qProj, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setProjects(items);
      setLoading(false);
    });

    return () => {
      unsubGoals();
      unsubKRs();
      unsubInits();
      unsubProj();
    };
  }, [user, workspace]);

  // Actions
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspace || !goalTitle.trim()) return;

    try {
      await addDoc(collection(db, "strategic_goals"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: goalTitle.trim(),
        description: goalDesc.trim(),
        type: goalType,
        status: "active",
        priority: goalPriority,
        periodStart: new Date().toISOString().split('T')[0],
        periodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days default
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setGoalTitle("");
      setGoalDesc("");
      setShowAddGoal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateKR = async (goalId: string) => {
    if (!user || !workspace || !krTitle.trim()) return;

    try {
      await addDoc(collection(db, "key_results"), {
        userId: user.uid,
        workspaceId: workspace.id,
        strategicGoalId: goalId,
        title: krTitle.trim(),
        metricType: krType,
        startValue: Number(krStart),
        targetValue: Number(krTarget),
        currentValue: Number(krStart),
        confidence: "medium",
        status: "not_started",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setKrTitle("");
      setKrTarget(100);
      setKrStart(0);
      setShowAddKR(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInitiative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspace || !initTitle.trim() || !selectedGoalId) return;

    try {
      await addDoc(collection(db, "strategic_initiatives"), {
        userId: user.uid,
        workspaceId: workspace.id,
        strategicGoalId: selectedGoalId,
        title: initTitle.trim(),
        description: initDesc.trim(),
        status: "active",
        projectIds: selectedProjectIds,
        health: "on_track",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setInitTitle("");
      setInitDesc("");
      setSelectedGoalId("");
      setSelectedProjectIds([]);
      setShowAddInitiative(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateKRValue = async (krId: string, currentVal: number, targetVal: number) => {
    if (!user) return;
    const finalVal = Math.min(Number(currentVal), Number(targetVal));
    const status = finalVal >= targetVal ? 'achieved' : finalVal > 0 ? 'on_track' : 'not_started';
    
    try {
      await updateDoc(doc(db, "key_results", krId), {
        currentValue: finalVal,
        status: status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Stats
  const northStars = goals.filter(g => g.type === 'north_star');
  const wigs = goals.filter(g => g.type === 'wig');
  const okrs = goals.filter(g => g.type === 'okr_objective');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto p-6 space-y-8 pb-24"
    >
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Strategy Center</h1>
          <p className="text-sm text-neutral-500">Corporate alignment, Wildly Important Goals, and key deliverables dashboard.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddGoal(true)}
            className="flex items-center gap-1.5 bg-black hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Strategic Goal
          </button>
          <button
            onClick={() => setShowAddInitiative(true)}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <Layers className="w-4 h-4" /> New Initiative
          </button>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">North Stars</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-0.5">{northStars.length}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Active WIGs</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-0.5">{wigs.length}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">OKRs / Priorities</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-0.5">{okrs.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-100 gap-4">
        <button
          onClick={() => setActiveTab('goals')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'goals' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
        >
          WIGs & Strategic Goals
        </button>
        <button
          onClick={() => setActiveTab('initiatives')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'initiatives' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
        >
          Workflow Initiatives
        </button>
        <button
          onClick={() => setActiveTab('alignment')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'alignment' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
        >
          Corporate Alignment Screen
        </button>
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {/* GOALS TAB */}
          {activeTab === 'goals' && (
            <motion.div
              key="goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {goals.length === 0 ? (
                <div className="bg-neutral-50 rounded-2xl p-8 border border-dashed border-neutral-200 text-center text-neutral-500">
                  <Target className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <div className="font-semibold text-neutral-800">Define your first Strategic Goal</div>
                  <p className="text-xs mt-1 max-w-sm mx-auto">Establish critical, measurable variables driving your corporate success.</p>
                  <button onClick={() => setShowAddGoal(true)} className="mt-4 bg-black text-white px-4 py-2 rounded-xl text-xs font-bold">Add Goal</button>
                </div>
              ) : (
                goals.map(goal => {
                  const goalKRs = keyResults.filter(kr => kr.strategicGoalId === goal.id);
                  return (
                    <div key={goal.id} className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide ${
                              goal.type === 'wig' ? 'bg-rose-50 text-rose-600' :
                              goal.type === 'north_star' ? 'bg-red-50 text-red-600' : 'bg-neutral-50 text-neutral-600'
                            }`}>
                              {goal.type.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-bold text-neutral-400">{goal.priority} Priority</span>
                          </div>
                          <h3 className="text-lg font-bold text-neutral-800 mt-2">{goal.title}</h3>
                          <p className="text-xs text-neutral-500 mt-1">{goal.description}</p>
                        </div>
                        <button
                          onClick={() => setShowAddKR(showAddKR === goal.id ? null : goal.id)}
                          className="text-xs font-bold text-neutral-500 hover:text-black flex items-center gap-1 px-2.5 py-1.5 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Metric (KR)
                        </button>
                      </div>

                      {/* Add KR Panel */}
                      {showAddKR === goal.id && (
                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-2 space-y-3">
                          <h4 className="text-xs font-bold text-neutral-700">Add Key Result (KR)</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="Key Result title (e.g. Increase revenue)"
                              value={krTitle}
                              onChange={(e) => setKrTitle(e.target.value)}
                              className="text-xs p-2 bg-white rounded-lg border border-neutral-200 w-full"
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Start value"
                                value={krStart}
                                onChange={(e) => setKrStart(Number(e.target.value))}
                                className="text-xs p-2 bg-white rounded-lg border border-neutral-200 w-1/2"
                              />
                              <input
                                type="number"
                                placeholder="Target value"
                                value={krTarget}
                                onChange={(e) => setKrTarget(Number(e.target.value))}
                                className="text-xs p-2 bg-white rounded-lg border border-neutral-200 w-1/2"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <select
                              value={krType}
                              onChange={(e: any) => setKrType(e.target.value)}
                              className="text-xs p-1.5 bg-white border border-neutral-200 rounded-lg"
                            >
                              <option value="percent">Percentage (%)</option>
                              <option value="number">Absolute Number</option>
                              <option value="currency">Currency ($)</option>
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => setShowAddKR(null)} className="text-xs px-3 py-1.5 border hover:bg-neutral-100 rounded-lg">Cancel</button>
                              <button onClick={() => handleCreateKR(goal.id)} className="text-xs bg-black text-white px-3 py-1.5 rounded-lg font-bold">Add KR</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Key Results Checklist */}
                      {goalKRs.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          <label className="text-[10px] font-bold text-neutral-400 tracking-widest uppercase">Measurable Key Results</label>
                          <div className="space-y-2">
                            {goalKRs.map(kr => {
                              const progressPct = Math.round((kr.currentValue / kr.targetValue) * 100) || 0;
                              return (
                                <div key={kr.id} className="bg-neutral-50/50 p-3.5 rounded-xl border border-neutral-100 flex items-center justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-neutral-800 truncate">{kr.title}</div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <div className="h-1.5 w-32 bg-neutral-200 rounded-full overflow-hidden">
                                        <div className="bg-black h-full" style={{ width: `${Math.min(100, progressPct)}%` }} />
                                      </div>
                                      <span className="text-[10px] font-bold text-neutral-500">
                                        {kr.currentValue} / {kr.targetValue} ({progressPct}%)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      className="w-16 text-center text-xs p-1 bg-white border border-neutral-200 rounded-md"
                                      value={kr.currentValue}
                                      onChange={(e) => handleUpdateKRValue(kr.id, Number(e.target.value), kr.targetValue)}
                                    />
                                    {kr.status === 'achieved' && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">No Key Results linked yet. Add one above to measure performance.</p>
                      )}
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* INITIATIVES TAB */}
          {activeTab === 'initiatives' && (
            <motion.div
              key="initiatives"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {initiatives.length === 0 ? (
                <div className="bg-neutral-50 rounded-2xl p-8 border border-dashed border-neutral-200 text-center text-neutral-500">
                  <Layers className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <div className="font-semibold text-neutral-800">Identify Strategic Initiatives</div>
                  <p className="text-xs mt-1 max-w-sm mx-auto">Link multiple high-value projects into modular pipelines representing active company workflows.</p>
                  <button onClick={() => setShowAddInitiative(true)} className="mt-4 bg-black text-white px-4 py-2 rounded-xl text-xs font-bold">Add Initiative</button>
                </div>
              ) : (
                initiatives.map(ini => {
                  const correlatedGoal = goals.find(g => g.id === ini.strategicGoalId);
                  const linkedProjectsNum = ini.projectIds?.length || 0;
                  return (
                    <div key={ini.id} className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md uppercase">
                            Health: {ini.health.replace('_', ' ')}
                          </span>
                          {correlatedGoal && (
                            <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                              <Target className="w-3.5 h-3.5 text-neutral-300" /> goal: {correlatedGoal.title}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-neutral-800 mt-2">{ini.title}</h3>
                        <p className="text-xs text-neutral-500 mt-1">{ini.description}</p>
                      </div>
                      <div className="flex items-center gap-6 self-start md:self-center">
                        <div className="text-center">
                          <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">Projects</div>
                          <div className="text-xl font-bold text-neutral-800 mt-0.5">{linkedProjectsNum}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">Status</div>
                          <span className="text-xs font-semibold px-2 py-1 bg-green-50 text-green-700 rounded-lg">{ini.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ALIGNMENT TAB */}
          {activeTab === 'alignment' && (
            <motion.div
              key="alignment"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm"
            >
              <h2 className="text-base font-bold text-neutral-800 mb-2 flex items-center gap-2">
                <Compass className="w-5 h-5 text-neutral-400" /> Strategic Drift Analysis
              </h2>
              <p className="text-xs text-neutral-500">Corporate projects must map back to an approved Strategic Goal. Projects operating without strategic backing generate drift risks.</p>
              
              <div className="mt-6 space-y-4">
                {projects.map(proj => {
                  const linkedInits = initiatives.filter(ini => ini.projectIds?.includes(proj.id));
                  const isUnaligned = linkedInits.length === 0;
                  return (
                    <div key={proj.id} className="p-4 rounded-xl border border-neutral-100 flex items-center justify-between gap-4 bg-neutral-50/50">
                      <div>
                        <div className="text-sm font-bold text-neutral-800">{proj.title}</div>
                        <div className="text-[10px] text-neutral-400 mt-1">Company: {proj.companyName || "N/A"} · Stage: {proj.stage || "Default"}</div>
                      </div>
                      <div>
                        {isUnaligned ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-100 rounded-lg text-[10px] font-extrabold uppercase tracking-wide">
                            <AlertTriangle className="w-3.5 h-3.5" /> Drift Risk: Unaligned
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-lg text-[10px] font-extrabold uppercase tracking-wide">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aligned
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {projects.length === 0 && (
                  <p className="text-xs text-neutral-400 italic text-center p-6 bg-neutral-50 rounded-xl">No corporate projects resolved yet.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ADD GOAL MODAL */}
      {showAddGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-neutral-100 shadow-2xl space-y-4"
          >
            <div className="font-extrabold text-lg text-neutral-800">Add Strategic Goal</div>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Goal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expand LATAM ARR"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 mt-1 rounded-xl focus:ring-1 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Goal Description</label>
                <textarea
                  placeholder="Justify and describe details..."
                  value={goalDesc}
                  onChange={(e) => setGoalDesc(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 mt-1 rounded-xl focus:ring-1 focus:ring-black outline-none h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Category</label>
                  <select
                    value={goalType}
                    onChange={(e: any) => setGoalType(e.target.value)}
                    className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 mt-1 rounded-xl outline-none"
                  >
                    <option value="wig">WIG (Wildly Important)</option>
                    <option value="north_star">North Star Focus</option>
                    <option value="okr_objective">OKR Objective</option>
                    <option value="quarterly_priority">Quarterly Priority</option>
                    <option value="weekly_outcome">Weekly Outcome</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Priority</label>
                  <select
                    value={goalPriority}
                    onChange={(e: any) => setGoalPriority(e.target.value)}
                    className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 mt-1 rounded-xl outline-none"
                  >
                    <option value="P1">P1 (Immediate)</option>
                    <option value="P2">P2 (Strategic)</option>
                    <option value="P3">P3 (Secondary)</option>
                    <option value="P4">P4 (Distraction)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGoal(false)}
                  className="text-xs px-4 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl font-bold"
                >
                  Add Strategic goal
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ADD INITIATIVE MODAL */}
      {showAddInitiative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-neutral-100 shadow-2xl space-y-4"
          >
            <div className="font-extrabold text-lg text-neutral-800">Add Strategic Initiative</div>
            <form onSubmit={handleCreateInitiative} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Initiative Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client Retention Workflow Optimization"
                  value={initTitle}
                  onChange={(e) => setInitTitle(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 mt-1 rounded-xl focus:ring-1 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Description</label>
                <textarea
                  placeholder="Details of the operational workspace..."
                  value={initDesc}
                  onChange={(e) => setInitDesc(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 mt-1 rounded-xl focus:ring-1 focus:ring-black outline-none h-16"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Strategic Goal Backing</label>
                <select
                  required
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 mt-1 rounded-xl outline-none text-neutral-800"
                >
                  <option value="">Select correlated strategic objective...</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{getStrategicGoalLabel(g.type)}: {g.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 block">Correlated Deals & Projects</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-neutral-100 p-2.5 rounded-xl bg-neutral-50">
                  {projects.map(p => {
                    const isChecked = selectedProjectIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedProjectIds(selectedProjectIds.filter(id => id !== p.id));
                            } else {
                              setSelectedProjectIds([...selectedProjectIds, p.id]);
                            }
                          }}
                          className="rounded text-black"
                        />
                        {p.title}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddInitiative(false)}
                  className="text-xs px-4 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl font-bold"
                >
                  Add Initiative
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function getStrategicGoalLabel(type: StrategicGoal['type']): string {
  switch (type) {
    case "north_star": return "North Star Focus";
    case "wig": return "WIG (Wildly Important)";
    case "okr_objective": return "OKR Objective";
    case "quarterly_priority": return "Quarterly Focus";
    case "weekly_outcome": return "Weekly Priority";
  }
}
