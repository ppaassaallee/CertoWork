import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Activity, ArrowLeft, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, Send, Calendar, Folder, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";

export function ProjectHealthCommandCenter() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const [savingFeedback, setSavingFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user || !workspace) return;

    // Fetch projects
    const qProjects = query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubProjects = onSnapshot(qProjects, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setProjects(list);
      setLoading(false);
    });

    // Fetch milestones
    const qMilestones = query(collection(db, "milestones"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubMilestones = onSnapshot(qMilestones, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setMilestones(list);
    });

    // Fetch tasks
    const qTasks = query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTasks(list);
    });

    return () => { unsubProjects(); unsubMilestones(); unsubTasks(); };
  }, [user, workspace]);

  const handleUpdateField = async (projectId: string, field: string, value: any) => {
    try {
      await updateDoc(doc(db, "projects", projectId), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to update project field", err);
    }
  };

  const runPortfolioAnalysis = async () => {
    if (projects.length === 0) return;
    setAnalyzing(true);
    setAiReport(null);

    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects, milestones, tasks })
      });
      if (!res.ok) throw new Error("Backend portfolio analyzer failed.");
      const data = await res.json();
      setAiReport(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Something went wrong.");
    } finally {
      setAnalyzing(false);
    }
  };

  const sendToReviewBoard = async (recId: string, item: any) => {
    if (!user || !workspace) return;
    setSavingFeedback(prev => ({ ...prev, [recId]: 'saving' }));
    
    try {
      await addDoc(collection(db, "review_candidates"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: item.title,
        type: "project_health",
        why: item.reason,
        action: item.proposedAction,
        source: `AI Health recommendation for project: ${projects.find(p => p.id === item.projectId)?.title || 'Unknown'}`,
        confidence: "high",
        status: "pending",
        createdAt: serverTimestamp(),
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // Proposed due date: 3 days in future
        proposed: {
          projectId: item.projectId,
          autoAction: "create_task"
        }
      });
      setSavingFeedback(prev => ({ ...prev, [recId]: 'saved' }));
    } catch (e) {
      console.error(e);
      setSavingFeedback(prev => ({ ...prev, [recId]: 'error' }));
    }
  };

  // Counting health stats
  const onTrackCount = projects.filter(p => p.healthStatus === "On Track").length;
  const atRiskCount = projects.filter(p => p.healthStatus === "At Risk").length;
  const offTrackCount = projects.filter(p => p.healthStatus === "Off Track").length;
  const proposedCount = projects.filter(p => p.healthStatus === "Proposed" || !p.healthStatus).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 max-w-6xl mx-auto pb-24"
    >
      <header className="mb-8 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/work/projects")}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-7 h-7 text-indigo-600" />
              Project Health Command Center
            </h1>
            <p className="text-gray-500 text-sm mt-1">Real-time portfolio metrics, indicators, and AI strategic risk reviews.</p>
          </div>
        </div>

        <button
          onClick={runPortfolioAnalysis}
          disabled={projects.length === 0 || analyzing}
          className="bg-black text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          {analyzing ? "AI Diagnosing..." : "Run Portfolio Analysis"}
        </button>
      </header>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">On Track</p>
          <p className="text-3xl font-black text-emerald-600 mt-2 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            {onTrackCount}
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">At Risk</p>
          <p className="text-3xl font-black text-amber-500 mt-2 flex items-center justify-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            {atRiskCount}
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Off Track</p>
          <p className="text-3xl font-black text-rose-500 mt-2 flex items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-rose-500" />
            {offTrackCount}
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Proposed / Draft</p>
          <p className="text-3xl font-black text-sky-500 mt-2 flex items-center justify-center gap-2">
            <Folder className="w-6 h-6 text-sky-400" />
            {proposedCount}
          </p>
        </div>
      </div>

      {/* AI Strategy Insights Block */}
      <AnimatePresence>
        {analyzing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-indigo-50/50 border-2 border-dashed border-indigo-200/60 rounded-3xl p-8 mb-8 text-center flex flex-col items-center justify-center"
          >
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
            <p className="font-bold text-indigo-950 text-lg">Certo Work Portfolio Strategic Assessment</p>
            <p className="text-indigo-700 text-sm mt-1 max-w-md">Scanning active focus areas, evaluating milestone dependencies, and checking task slippages...</p>
          </motion.div>
        )}

        {aiReport && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-indigo-50/40 border border-indigo-100 rounded-3xl p-6 mb-8 space-y-6"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <h2 className="text-lg font-black text-indigo-950">Certo Work Portfolio Diagnostics</h2>
            </div>

            <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-2">Executive Summary</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{aiReport.executiveSummary}</p>
            </div>

            {/* Recommendations Group */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-widest pl-1">Risk Mitigation Candidates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiReport.recommendations?.map((rec: any, idx: number) => {
                  const status = savingFeedback[idx];
                  const linkedProj = projects.find(p => p.id === rec.projectId);
                  return (
                    <div key={idx} className="bg-white border border-indigo-50 p-5 rounded-2xl shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            rec.urgency === "High" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {rec.urgency} Urgency
                          </span>
                          <span className="text-xs text-gray-400 font-medium">{linkedProj?.title || "Portfolio Level"}</span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm mb-1">{rec.title}</h4>
                        <p className="text-xs text-gray-500 mb-3">{rec.description}</p>
                        <p className="text-xs bg-gray-50 p-2.5 rounded-lg italic text-gray-600">"{rec.reason}"</p>
                      </div>

                      <div className="border-t border-gray-100 mt-4 pt-3 flex items-center justify-between">
                        <span className="text-[10px] text-indigo-600 font-bold">Action: {rec.proposedAction}</span>
                        <button
                          onClick={() => sendToReviewBoard(`${idx}`, rec)}
                          disabled={status === 'saved'}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                            status === 'saved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-black text-white hover:bg-gray-800'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          {status === 'saving' ? 'Sending...' : status === 'saved' ? 'In Review Board' : 'Send to Review'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projects interactive sheet */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Project Portfolio Review</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50/40">
                <th className="px-6 py-4">Project / Deal Name</th>
                <th className="px-6 py-4">Health Indicator</th>
                <th className="px-6 py-4">Priority Level</th>
                <th className="px-6 py-4">Timeline / Due Date</th>
                <th className="px-6 py-4">Status Update / Key Blocker Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p) => {
                const projMilestones = milestones.filter(m => m.projectId === p.id);
                const projTasks = tasks.filter(t => t.projectId === p.id);
                const openTasksCount = projTasks.filter(t => t.status === "open").length;
                
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Title */}
                    <td className="px-6 py-4">
                      <div>
                        <span 
                          onClick={() => navigate(`/work/projects/${p.id}`)}
                          className="font-bold text-gray-900 cursor-pointer hover:text-indigo-600 block transition-colors"
                        >
                          {p.title}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5 block">
                          {p.projectType === 'deal' ? '💰 Deal' : '📁 Project'} • {projMilestones.length} milestones • {openTasksCount} open tasks
                        </span>
                      </div>
                    </td>

                    {/* Health Status drop-down */}
                    <td className="px-6 py-4">
                      <select
                        value={p.healthStatus || "Proposed"}
                        onChange={(e) => handleUpdateField(p.id, "healthStatus", e.target.value)}
                        className={`text-xs font-bold border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          p.healthStatus === "On Track"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : p.healthStatus === "At Risk"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : p.healthStatus === "Off Track"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        <option value="On Track">On Track</option>
                        <option value="At Risk">At Risk</option>
                        <option value="Off Track">Off Track</option>
                        <option value="Proposed">Proposed</option>
                      </select>
                    </td>

                    {/* Priority drop-down */}
                    <td className="px-6 py-4">
                      <select
                        value={p.priority || 4}
                        onChange={(e) => handleUpdateField(p.id, "priority", Number(e.target.value))}
                        className="text-xs border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value={1}>High Priority</option>
                        <option value={2}>Medium Priority</option>
                        <option value={3}>Low Priority</option>
                        <option value={4}>No Priority</option>
                      </select>
                    </td>

                    {/* Due Date picker */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="date"
                          value={p.dueDate && /^\d{4}-\d{2}-\d{2}/.test(p.dueDate) ? p.dueDate.substring(0, 10) : ""}
                          onChange={(e) => handleUpdateField(p.id, "dueDate", e.target.value)}
                          className="bg-transparent border-none text-xs p-0 text-gray-600 hover:bg-gray-100 rounded px-1 cursor-pointer focus:ring-0"
                        />
                      </div>
                    </td>

                    {/* Health note update field */}
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        defaultValue={p.healthNote || ""}
                        placeholder="Add quick status or bottleneck..."
                        onBlur={(e) => handleUpdateField(p.id, "healthNote", e.target.value)}
                        className="text-xs bg-transparent border-none border-b border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-0 w-full p-0 py-1"
                      />
                    </td>
                  </tr>
                );
              })}

              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center bg-gray-50">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No projects found in this workspace.</p>
                    <p className="text-gray-400 text-sm mt-1">Create projects or deals first to review portfolio health.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </motion.div>
  );
}
