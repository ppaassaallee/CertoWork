import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Clock, Layers, Award, ChevronLeft, ChevronRight, 
  Sparkles, Check, BookOpen, Brain, Star, ArrowRight, Plus, Trash2, Heart
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { 
  collection, query, where, onSnapshot, doc, setDoc, getDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";

const LIFE_AREAS = [
  { id: "health", name: "Health & Fitness", icon: "🍏", desc: "Sleep, workouts, energy" },
  { id: "family", name: "Family & Relationships", icon: "❤️", desc: "Partners, kids, friends" },
  { id: "career", name: "Career / Core Work", icon: "💼", desc: "Core delivery, growth" },
  { id: "finances", name: "Finances", icon: "💰", desc: "Savings, budget, investments" },
  { id: "learning", name: "Learning & Self-dev", icon: "📚", desc: "Skills, reading, courses" },
  { id: "purpose", name: "Purpose & Contribution", icon: "✨", desc: "Meaning, volunteering, help" },
  { id: "spirituality", name: "Spirituality & Inner Life", icon: "🧘", desc: "Mindfulness, peace, recovery" },
  { id: "lifestyle", name: "Lifestyle & Environment", icon: "🏡", desc: "Home, hobbies, experiences" }
];

export function MonthlyPlanningRitual() {
  const { user, workspace } = useAuth();
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Selected Month state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  // State for Monthly Plan
  const [planId, setPlanId] = useState("");
  const [reflectionText, setReflectionText] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [theme, setTheme] = useState("");
  const [areaScores, setAreaScores] = useState<Record<string, number>>({});
  const [areaFocusNotes, setAreaFocusNotes] = useState<Record<string, string>>({});
  const [objectives, setObjectives] = useState<string[]>(["", "", ""]);
  const [focusProjectIds, setFocusProjectIds] = useState<string[]>([]);
  const [perfectMonthBlueprint, setPerfectMonthBlueprint] = useState("");

  // Fetched projects
  const [projects, setProjects] = useState<any[]>([]);

  // Loaded/Saved status
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 1. Fetch Projects for Step 4
  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(
      collection(db, "projects"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.status !== "completed") {
          list.push({ id: d.id, ...data });
        }
      });
      setProjects(list);
    });
    return unsub;
  }, [user, workspace]);

  // 2. Load Plan for Selected Month
  useEffect(() => {
    if (!user || !workspace || !selectedMonth) return;
    setLoading(true);
    setSavedSuccess(false);

    // Document ID: userId_workspaceId_YYYY-MM
    const docId = `${user.uid}_${workspace.id}_${selectedMonth}`;
    setPlanId(docId);

    const docRef = doc(db, "monthly_plans", docId);
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setReflectionText(data.reflectionText || "");
        setLessonsLearned(data.lessonsLearned || "");
        setTheme(data.theme || "");
        setAreaScores(data.areaScores || {});
        setAreaFocusNotes(data.areaFocusNotes || {});
        setObjectives(data.objectives || ["", "", ""]);
        setFocusProjectIds(data.focusProjectIds || []);
        setPerfectMonthBlueprint(data.perfectMonthBlueprint || "");
      } else {
        // Reset to default empty values
        setReflectionText("");
        setLessonsLearned("");
        setTheme("");
        setAreaScores({});
        setAreaFocusNotes({});
        setObjectives(["", "", ""]);
        setFocusProjectIds([]);
        setPerfectMonthBlueprint("");
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading monthly plan:", err);
      setLoading(false);
    });
  }, [user, workspace, selectedMonth]);

  // 3. Save Plan handler
  const handleSave = async (showNotification = true) => {
    if (!user || !workspace || !planId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "monthly_plans", planId), {
        userId: user.uid,
        workspaceId: workspace.id,
        month: selectedMonth,
        reflectionText,
        lessonsLearned,
        theme,
        areaScores,
        areaFocusNotes,
        objectives: objectives.filter(o => o.trim() !== ""),
        focusProjectIds,
        perfectMonthBlueprint,
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (showNotification) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error saving monthly plan:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const addObjectiveRow = () => {
    setObjectives([...objectives, ""]);
  };

  const removeObjectiveRow = (idx: number) => {
    const next = [...objectives];
    next.splice(idx, 1);
    setObjectives(next);
  };

  const handleObjectiveChange = (idx: number, val: string) => {
    const next = [...objectives];
    next[idx] = val;
    setObjectives(next);
  };

  const toggleProjectFocus = (projId: string) => {
    setFocusProjectIds(prev => 
      prev.includes(projId) ? prev.filter(id => id !== projId) : [...prev, projId]
    );
  };

  const handleScoreChange = (areaId: string, score: number) => {
    setAreaScores(prev => ({ ...prev, [areaId]: score }));
  };

  const handleFocusNoteChange = (areaId: string, note: string) => {
    setAreaFocusNotes(prev => ({ ...prev, [areaId]: note }));
  };

  const nextStep = () => {
    handleSave(false);
    setActiveStep(prev => Math.min(prev + 1, 5));
  };

  const prevStep = () => {
    handleSave(false);
    setActiveStep(prev => Math.max(prev - 1, 1));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Clock className="w-8 h-8 text-black animate-spin" />
        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading Monthly Ritual...</span>
      </div>
    );
  }

  // Format month label
  const [yearNum, monthNum] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(yearNum), parseInt(monthNum) - 1, 1);
  const formattedMonthLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <span className="text-[10px] font-black tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase">Monthly Horizon Ritual</span>
          <h1 className="text-3xl font-black text-black tracking-tight mt-1.5 flex items-center gap-2">
            <Layers className="w-8 h-8 text-black" /> {formattedMonthLabel} Strategy
          </h1>
          <p className="text-gray-500 text-sm mt-1">Audit life balance, establish core project focus, and build your Perfect Month blueprint.</p>
        </div>

        {/* Month Picker dropdown & Save button */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-1 focus:ring-black"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - 3 + i);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const val = `${y}-${m}`;
              const lbl = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return <option key={val} value={val}>{lbl}</option>;
            })}
          </select>

          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              savedSuccess 
                ? 'bg-emerald-500 text-white' 
                : 'bg-black hover:bg-neutral-900 text-white disabled:opacity-50'
            }`}
          >
            {isSaving ? (
              <Clock className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {savedSuccess ? "Saved!" : "Save Progress"}
          </button>
        </div>
      </header>

      {/* Progress Wizard Header */}
      <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Step {activeStep} of 5</span>
          <span className="text-xs font-extrabold text-black">
            {activeStep === 1 && "1. Reflection & Lessons"}
            {activeStep === 2 && "2. Areas of Focus Scorecard"}
            {activeStep === 3 && "3. Core Monthly Objectives"}
            {activeStep === 4 && "4. Primary Project Focus"}
            {activeStep === 5 && "5. Blueprint & Theme"}
          </span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-black h-full transition-all duration-300" 
            style={{ width: `${(activeStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Step Canvas */}
      <div className="bg-white border border-gray-200/85 rounded-3xl p-6 md:p-8 min-h-[400px] shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* STEP 1: REFLECTION */}
            {activeStep === 1 && (
              <div className="space-y-5">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="text-xl font-extrabold text-black flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-500" /> Reflection & Clean Slate</h2>
                  <p className="text-xs text-gray-500 mt-1">Look back at the preceding 30 days. Capture what went exceptionally well and the key lessons before designing this month.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">What went well & key wins?</label>
                  <textarea
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    placeholder="Reflect on major projects finished, positive habits held, family time, workouts..."
                    rows={5}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-black focus:bg-white outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Key Lessons & Adjustments</label>
                  <textarea
                    value={lessonsLearned}
                    onChange={(e) => setLessonsLearned(e.target.value)}
                    placeholder="What friction did you experience? What must change in your routines, calendar blocks, or commitments?"
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-black focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: AREAS OF FOCUS SCORECARD */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="text-xl font-extrabold text-black flex items-center gap-2"><Heart className="w-5 h-5 text-red-500" /> Areas of Focus Audit</h2>
                  <p className="text-xs text-gray-500 mt-1">Rate your satisfaction across the 8 Areas of Focus (1-10) and define a single primary commitment for each area.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {LIFE_AREAS.map((area) => {
                    const score = areaScores[area.id] || 5;
                    const note = areaFocusNotes[area.id] || "";
                    return (
                      <div key={area.id} className="p-4 border border-gray-150 rounded-2xl hover:border-gray-200 transition-all bg-gray-50/30">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{area.icon}</span>
                            <div>
                              <h4 className="font-bold text-sm text-gray-900">{area.name}</h4>
                              <p className="text-[10px] text-gray-400">{area.desc}</p>
                            </div>
                          </div>
                          
                          {/* Score Dropdown */}
                          <div className="flex items-center gap-1.5 bg-white border border-gray-250 px-2 py-1 rounded-xl">
                            <span className="text-[10px] font-black text-gray-400">Score:</span>
                            <select
                              value={score}
                              onChange={(e) => handleScoreChange(area.id, parseInt(e.target.value))}
                              className="text-xs font-bold text-gray-700 bg-transparent border-none p-0 focus:ring-0 outline-none cursor-pointer"
                            >
                              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Focus Note input */}
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => handleFocusNoteChange(area.id, e.target.value)}
                          placeholder="This month focus/habit commitment..."
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: MONTHLY OBJECTIVES */}
            {activeStep === 3 && (
              <div className="space-y-6">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="text-xl font-extrabold text-black flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" /> Core Monthly Objectives</h2>
                  <p className="text-xs text-gray-500 mt-1">Establish up to 3-5 massive outcomes for this month. Keep them highly practical and measurable.</p>
                </div>

                <div className="space-y-3">
                  {objectives.map((obj, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="font-black text-gray-300 text-lg w-6 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={obj}
                        onChange={(e) => handleObjectiveChange(idx, e.target.value)}
                        placeholder="Establish a clear, measurable monthly milestone..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-black focus:bg-white outline-none"
                      />
                      {objectives.length > 1 && (
                        <button 
                          onClick={() => removeObjectiveRow(idx)}
                          className="p-3 hover:bg-gray-100 rounded-xl text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addObjectiveRow}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-250 text-gray-800 rounded-xl text-xs font-bold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Objective Row
                </button>
              </div>
            )}

            {/* STEP 4: PROJECT ALIGNMENT */}
            {activeStep === 4 && (
              <div className="space-y-6">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="text-xl font-extrabold text-black flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Primary Project Focus</h2>
                  <p className="text-xs text-gray-500 mt-1">Which active projects are the absolute core of your attention this month? Pin them to protect focus.</p>
                </div>

                {projects.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-150 rounded-2xl bg-gray-50/50">
                    <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">No active projects found. Create projects in the action board / operational core first.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {projects.map((proj) => {
                      const isPinned = focusProjectIds.includes(proj.id);
                      return (
                        <div 
                          key={proj.id}
                          onClick={() => toggleProjectFocus(proj.id)}
                          className={`p-4 border-2 rounded-2xl cursor-pointer transition-all flex justify-between items-center ${
                            isPinned 
                              ? 'border-indigo-500 bg-indigo-50/30' 
                              : 'border-gray-150 hover:border-gray-300'
                          }`}
                        >
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              {proj.projectType === 'deal' ? 'Deal' : 'Project'}
                            </span>
                            <h4 className="font-bold text-xs text-gray-900 truncate mt-0.5">{proj.name}</h4>
                            <p className="text-[9px] text-gray-400 truncate mt-0.5">{proj.description || "No description provided"}</p>
                          </div>

                          <div className="p-1.5 rounded-xl transition-all">
                            <Star className={`w-4.5 h-4.5 ${isPinned ? 'text-indigo-600 fill-indigo-500' : 'text-gray-300 hover:text-indigo-500'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: BLUEPRINT & THEME */}
            {activeStep === 5 && (
              <div className="space-y-6">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="text-xl font-extrabold text-black flex items-center gap-2"><Brain className="w-5 h-5 text-purple-500" /> Perfect Month Blueprint & Theme</h2>
                  <p className="text-xs text-gray-500 mt-1">Conclude your planning ritual by defining your core Monthly Theme and outlining your perfect week execution plan.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Monthly Core Theme</label>
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g., Focus & Delivery, Deep Scaling, Recovery & Play, Build Mode..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-black focus:bg-white outline-none transition-all font-black text-gray-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Perfect Month Outline / Weekly Cadences</label>
                  <textarea
                    value={perfectMonthBlueprint}
                    onChange={(e) => setPerfectMonthBlueprint(e.target.value)}
                    placeholder="Define execution structure: Week 1 focus, Week 2 delivery, recurring routines, admin block boundaries..."
                    rows={6}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-black focus:bg-white outline-none transition-all"
                  />
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-950">Confirm and Commit Strategy</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">Commitment locks your focus targets in place. You can revisit this dashboard any time.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Commit Month Plan
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Wizard Footer Navigation */}
      <div className="flex justify-between items-center bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <button
          onClick={prevStep}
          disabled={activeStep === 1}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Previous Step
        </button>

        {activeStep < 5 ? (
          <button
            onClick={nextStep}
            className="flex items-center gap-1.5 px-4 py-2 bg-black hover:bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all"
          >
            Next Step <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => handleSave(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-black hover:bg-neutral-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            All Done! Commit <ArrowRight className="w-4 h-4 text-indigo-400" />
          </button>
        )}
      </div>
    </div>
  );
}
