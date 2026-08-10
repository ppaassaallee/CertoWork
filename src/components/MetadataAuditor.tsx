import React, { useState } from "react";
import { 
  ShieldAlert, 
  Sparkles, 
  Check, 
  HelpCircle, 
  Loader2, 
  CheckCircle2, 
  X,
  Wand2
} from "lucide-react";
import { doc, updateDoc, deleteField } from "firebase/firestore";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: any;
  dueDate?: string | null;
  gtdContext?: string | null;
  itemType?: string | null;
  projectId?: string | null;
  status?: string;
}

interface Project {
  id: string;
  name: string;
}

interface MetadataAuditorProps {
  tasks: Task[];
  projects: Project[];
  db: any;
  user: any;
  workspace: any;
}

export const MetadataAuditor: React.FC<MetadataAuditorProps> = ({
  tasks,
  projects,
  db,
  user,
  workspace
}) => {
  const [filterType, setFilterType] = useState<"all" | "priority" | "date" | "context" | "project" | "actionType">("all");
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, {
    priority: number | null;
    dueDate: string | null;
    context: string | null;
    actionType: string | null;
    projectId: string | null;
    reason: string;
    loading: boolean;
  }>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkAuditResults, setBulkAuditResults] = useState<{
    scanned: number;
    incomplete: number;
    results: any[];
  } | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResults, setEnrichResults] = useState<{
    count: number;
    updatedTasks: any[];
  } | null>(null);

  const runAutoEnrichOnServer = async () => {
    setEnrichLoading(true);
    setEnrichResults(null);
    try {
      const response = await fetch("/api/boldi/bulk-enrich-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          workspaceId: workspace?.id
        })
      });
      if (response.ok) {
        const data = await response.json();
        setEnrichResults({
          count: data.count,
          updatedTasks: data.updatedTasks || []
        });
        // Clear any bulk audit results to refresh the state
        setBulkAuditResults(null);
      } else {
        const errorData = await response.json();
        console.error("Bulk enrichment failed:", errorData.error);
        alert(`Bulk enrichment failed: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred during bulk enrichment.");
    } finally {
      setEnrichLoading(false);
    }
  };

  const getNormalizedPriority = (priority: any): number | null => {
    if (priority === undefined || priority === null || priority === "") return null;
    if (typeof priority === "number") {
      if (priority >= 1 && priority <= 4) return priority;
      return null;
    }
    if (typeof priority === "string") {
      const clean = priority.toUpperCase().replace("P", "").trim();
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num >= 1 && num <= 4) return num;
    }
    return null;
  };

  const isTaskMissingMetadata = (t: Task) => {
    const p = getNormalizedPriority(t.priority);
    const hasPriority = p !== null;
    const hasDueDate = !!t.dueDate;
    const hasContext = !!t.gtdContext && t.gtdContext !== "" && t.gtdContext !== "all";
    const hasActionType = !!t.itemType && t.itemType !== "task" && t.itemType !== "";
    const hasProject = !!t.projectId;

    return !hasPriority || !hasDueDate || !hasContext || !hasActionType || !hasProject;
  };

  const getMissingFieldsList = (t: Task) => {
    const list: string[] = [];
    if (getNormalizedPriority(t.priority) === null) list.push("priority");
    if (!t.dueDate) list.push("dueDate");
    if (!t.gtdContext || t.gtdContext === "" || t.gtdContext === "all") list.push("context");
    if (!t.itemType || t.itemType === "task" || t.itemType === "") list.push("actionType");
    if (!t.projectId) list.push("projectId");
    return list;
  };

  // Filter tasks missing metadata
  const incompleteTasks = tasks.filter(t => t.status !== "done" && t.status !== "archived" && isTaskMissingMetadata(t));

  const filteredTasks = incompleteTasks.filter(t => {
    if (filterType === "all") return true;
    if (filterType === "priority") return getNormalizedPriority(t.priority) === null;
    if (filterType === "date") return !t.dueDate;
    if (filterType === "context") return !t.gtdContext || t.gtdContext === "" || t.gtdContext === "all";
    if (filterType === "project") return !t.projectId;
    if (filterType === "actionType") return !t.itemType || t.itemType === "task" || t.itemType === "";
    return true;
  });

  const handleUpdateField = async (taskId: string, field: string, value: any) => {
    try {
      const docRef = doc(db, "tasks", taskId);
      let firestoreValue = value;
      if (value === "" || value === null) {
        firestoreValue = deleteField();
      }
      
      const updateData: any = {};
      if (field === "priority") updateData.priority = firestoreValue;
      else if (field === "dueDate") updateData.dueDate = firestoreValue;
      else if (field === "context") updateData.gtdContext = firestoreValue;
      else if (field === "actionType") updateData.itemType = firestoreValue;
      else if (field === "projectId") updateData.projectId = firestoreValue;

      await updateDoc(docRef, updateData);
    } catch (e) {
      console.error("Failed to update task field", e);
    }
  };

  const handleAskBoldiForTask = async (task: Task) => {
    setAiSuggestions(prev => ({
      ...prev,
      [task.id]: {
        priority: null,
        dueDate: null,
        context: null,
        actionType: null,
        projectId: null,
        reason: "",
        loading: true
      }
    }));

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/boldi/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          messages: [
            {
              role: "user",
              content: `Please analyze this single task and suggest the optimal metadata attributes (Priority, Due Date, GTD Context, Action Type, Project) to categorize it.
              
              TASK DETAILS:
              - Title: "${task.title}"
              - Description: "${task.description || "None"}"
              - Current Priority: ${task.priority || "Unprioritized"}
              - Current Due Date: ${task.dueDate || "None"}
              - Current Context: ${task.gtdContext || "None"}
              - Current Action Type: ${task.itemType || "None"}
              - Current Project ID: ${task.projectId || "None"}

              AVAILABLE PROJECTS:
              ${JSON.stringify(projects)}

              Recommend:
              - priority: a number (1, 2, 3, or 4) based on leverage (P1=highest, P4=lowest) or null if cannot suggest confidently.
              - dueDate: ISO string date (YYYY-MM-DD) or null if no fixed date. Recommend a realistic target.
              - context: One of [@computer, @home, @office, @calls, @anywhere] or null if unsure.
              - actionType: One of [next_action, waiting_for, someday, routine_follow_up] or null.
              - projectId: One of the available project IDs or null if standalone task.
              
              Explain your strategic justification briefly (1 short sentence).`
            }
          ],
          workspaceContext: {
            mode: "co_work",
            tasks: [task],
            projects,
            userId: user.uid,
            workspaceId: workspace.id
          }
        })
      });

      if (!response.ok) throw new Error("API call failed");
      const data = await response.json();
      
      // Extract from the response's actionPlan
      const plan = data.actionPlan;
      const action = plan?.proposedActions?.[0]?.proposedChange;
      
      if (action) {
        setAiSuggestions(prev => ({
          ...prev,
          [task.id]: {
            priority: getNormalizedPriority(action.priority),
            dueDate: action.dueDate || null,
            context: action.context || action.gtdContext || null,
            actionType: action.actionType || action.itemType || null,
            projectId: action.projectId || null,
            reason: data.reply || plan?.summary || "Recommended alignment suggestion",
            loading: false
          }
        }));
      } else {
        // Fallback parsing or general suggestion
        setAiSuggestions(prev => ({
          ...prev,
          [task.id]: {
            priority: 3,
            dueDate: null,
            context: "@computer",
            actionType: "next_action",
            projectId: null,
            reason: data.reply || "Suggested next action status",
            loading: false
          }
        }));
      }
    } catch (err) {
      console.error(err);
      setAiSuggestions(prev => ({
        ...prev,
        [task.id]: {
          priority: null,
          dueDate: null,
          context: null,
          actionType: null,
          projectId: null,
          reason: "Failed to load Certo Work intelligence recommendation.",
          loading: false
        }
      }));
    }
  };

  const handleApproveSuggestion = async (taskId: string) => {
    const sugg = aiSuggestions[taskId];
    if (!sugg) return;

    try {
      const docRef = doc(db, "tasks", taskId);
      const updateData: any = {};
      
      if (sugg.priority !== null) updateData.priority = sugg.priority;
      if (sugg.dueDate !== null) updateData.dueDate = sugg.dueDate;
      if (sugg.context !== null) updateData.gtdContext = sugg.context;
      if (sugg.actionType !== null) updateData.itemType = sugg.actionType;
      if (sugg.projectId !== null) updateData.projectId = sugg.projectId;

      await updateDoc(docRef, updateData);

      // Clean up suggestion
      setAiSuggestions(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    } catch (e) {
      console.error("Failed to apply suggestion", e);
    }
  };

  const runBulkAuditOnServer = async () => {
    setBulkLoading(true);
    setBulkAuditResults(null);
    try {
      const response = await fetch("/api/boldi/audit-task-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          workspaceId: workspace?.id
        })
      });
      if (response.ok) {
        const data = await response.json();
        setBulkAuditResults({
          scanned: data.totalScanned,
          incomplete: data.incompleteCount,
          results: data.items
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Top Card */}
      <div className="bg-gradient-to-br from-red-50 to-neutral-50 p-6 rounded-3xl border border-red-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-2xl flex-shrink-0 shadow-inner">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
              Data Integrity & Metadata Auditor
              <span className="text-[10px] font-black uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full tracking-wider">
                Auditor
              </span>
            </h2>
            <p className="text-sm text-neutral-600 font-medium max-w-xl mt-1">
              Identify tasks missing essential attributes (priority, dates, contexts, projects, or action types). 
              Standardized metadata empowers Certo Work to build accurate briefings, calendars, and dashboards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center flex-wrap">
          <button
            onClick={runBulkAuditOnServer}
            disabled={bulkLoading || enrichLoading}
            className="px-4 py-2.5 bg-neutral-900 text-white font-bold text-xs rounded-xl hover:bg-neutral-800 transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {bulkLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            )}
            Run Bulk Agentic Audit
          </button>

          <button
            onClick={runAutoEnrichOnServer}
            disabled={enrichLoading || bulkLoading}
            className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {enrichLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-yellow-300" />
            )}
            AI Auto-Enrich All (Max 15)
          </button>
        </div>
      </div>

      {enrichResults && (
        <div className="bg-gradient-to-br from-violet-900 to-indigo-900 text-white p-5 rounded-3xl border border-violet-800 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-violet-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="font-extrabold text-sm tracking-tight">AI Bulk Enrichment Complete</span>
            </div>
            <button 
              onClick={() => setEnrichResults(null)}
              className="p-1 hover:bg-violet-800 rounded-lg text-neutral-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-violet-200 font-medium">
            Certo Work has scanned your incomplete items and automatically aligned their metadata fields (Priority, Due Date, Context, Action Type, Project, and Tags) using high-fidelity contextual reasoning:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {enrichResults.updatedTasks.map(task => (
              <div key={task.id} className="bg-violet-950/40 border border-violet-800/60 p-3 rounded-2xl space-y-1.5">
                <div className="text-xs font-bold text-white truncate">{task.title}</div>
                <div className="flex flex-wrap gap-1">
                  {task.updates.priority !== null && (
                    <span className="text-[8px] font-extrabold bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">
                      P{task.updates.priority}
                    </span>
                  )}
                  {task.updates.dueDate && (
                    <span className="text-[8px] font-extrabold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                      {task.updates.dueDate}
                    </span>
                  )}
                  {task.updates.context && (
                    <span className="text-[8px] font-extrabold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                      {task.updates.context}
                    </span>
                  )}
                  {task.updates.actionType && (
                    <span className="text-[8px] font-extrabold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                      {task.updates.actionType}
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-violet-300 leading-snug italic truncate">
                  "{task.reason}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bulkAuditResults && (
        <div className="bg-neutral-900 text-white p-5 rounded-3xl border border-neutral-800 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="font-extrabold text-sm tracking-tight">Audit Scan Complete</span>
            </div>
            <button 
              onClick={() => setBulkAuditResults(null)}
              className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-neutral-800/50 p-3 rounded-2xl">
              <div className="text-lg font-black text-neutral-300">{bulkAuditResults.scanned}</div>
              <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Scanned Records</div>
            </div>
            <div className="bg-neutral-800/50 p-3 rounded-2xl">
              <div className="text-lg font-black text-red-400">{bulkAuditResults.incomplete}</div>
              <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Incomplete Items</div>
            </div>
            <div className="bg-neutral-800/50 p-3 rounded-2xl">
              <div className="text-lg font-black text-emerald-400">{bulkAuditResults.scanned - bulkAuditResults.incomplete}</div>
              <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Healthy Items</div>
            </div>
          </div>
        </div>
      )}

      {/* Auditor Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-1.5 rounded-2xl border border-gray-100 w-max max-w-full overflow-x-auto">
        <button
          onClick={() => setFilterType("all")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${filterType === "all" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
        >
          All Incomplete ({incompleteTasks.length})
        </button>
        <button
          onClick={() => setFilterType("priority")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${filterType === "priority" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
        >
          No Priority ({incompleteTasks.filter(t => getNormalizedPriority(t.priority) === null).length})
        </button>
        <button
          onClick={() => setFilterType("date")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${filterType === "date" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
        >
          No Due Date ({incompleteTasks.filter(t => !t.dueDate).length})
        </button>
        <button
          onClick={() => setFilterType("context")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${filterType === "context" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
        >
          No Context ({incompleteTasks.filter(t => !t.gtdContext || t.gtdContext === "" || t.gtdContext === "all").length})
        </button>
        <button
          onClick={() => setFilterType("project")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${filterType === "project" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
        >
          No Project ({incompleteTasks.filter(t => !t.projectId).length})
        </button>
        <button
          onClick={() => setFilterType("actionType")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${filterType === "actionType" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
        >
          No Action Type ({incompleteTasks.filter(t => !t.itemType || t.itemType === "task" || t.itemType === "").length})
        </button>
      </div>

      {/* Audit List Container */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-md font-extrabold text-neutral-900">Workspace Data Cleared!</h3>
            <p className="text-xs text-neutral-500 font-medium max-w-sm mx-auto mt-1">
              Every single task for the current filters contains fully healthy, complete metadata attributes.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-150 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {filteredTasks.map(task => {
            const missing = getMissingFieldsList(task);
            const sugg = aiSuggestions[task.id];

            return (
              <div key={task.id} className="p-5 hover:bg-neutral-50/50 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="font-extrabold text-neutral-800 text-sm">{task.title}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {missing.map(f => (
                        <span key={f} className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">
                          Missing {f === "gtdContext" ? "context" : f === "itemType" ? "actionType" : f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500 max-w-2xl font-semibold leading-relaxed">
                    {task.description || "No description provided."}
                  </p>

                  {/* Manual Quick Editors */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    {/* Priority Editor */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase block">Priority</label>
                      <select
                        value={getNormalizedPriority(task.priority) || ""}
                        onChange={(e) => handleUpdateField(task.id, "priority", e.target.value === "" ? null : parseInt(e.target.value))}
                        className="w-full text-xs font-extrabold border border-gray-200/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                      >
                        <option value="">Sin prioridad</option>
                        <option value={1}>P1 (Urgent)</option>
                        <option value={2}>P2 (Important)</option>
                        <option value={3}>P3 (Normal)</option>
                        <option value={4}>P4 (Low)</option>
                      </select>
                    </div>

                    {/* Due Date Editor */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase block">Due Date</label>
                      <input
                        type="date"
                        value={task.dueDate && /^\d{4}-\d{2}-\d{2}/.test(task.dueDate) ? task.dueDate.substring(0, 10) : ""}
                        onChange={(e) => handleUpdateField(task.id, "dueDate", e.target.value || null)}
                        className="w-full text-xs font-semibold border border-gray-200/80 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                      />
                    </div>

                    {/* Context Editor */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase block">GTD Context</label>
                      <select
                        value={task.gtdContext || ""}
                        onChange={(e) => handleUpdateField(task.id, "context", e.target.value || null)}
                        className="w-full text-xs font-extrabold border border-gray-200/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                      >
                        <option value="">No Context</option>
                        <option value="@computer">@computer</option>
                        <option value="@home">@home</option>
                        <option value="@office">@office</option>
                        <option value="@calls">@calls</option>
                        <option value="@anywhere">@anywhere</option>
                      </select>
                    </div>

                    {/* Project Editor */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase block">Project / Deal</label>
                      <select
                        value={task.projectId || ""}
                        onChange={(e) => handleUpdateField(task.id, "projectId", e.target.value || null)}
                        className="w-full text-xs font-extrabold border border-gray-200/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                      >
                        <option value="">Standalone Task</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Action Type Editor */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase block">Action Type</label>
                      <select
                        value={task.itemType || ""}
                        onChange={(e) => handleUpdateField(task.id, "actionType", e.target.value || null)}
                        className="w-full text-xs font-extrabold border border-gray-200/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                      >
                        <option value="">No Action Type</option>
                        <option value="next_action">Next Action</option>
                        <option value="waiting_for">Waiting For</option>
                        <option value="someday">Someday/Maybe</option>
                        <option value="routine_follow_up">Routine Follow-up</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* AI Suggestions Panel */}
                <div className="flex-shrink-0 w-full lg:w-72 bg-neutral-50/50 p-4 rounded-2xl border border-gray-150 flex flex-col justify-between gap-3">
                  {sugg ? (
                    sugg.loading ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-neutral-600" />
                        <span className="text-[10px] text-neutral-500 font-extrabold uppercase">Consulting Certo Work...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                          <span className="text-[10px] font-black uppercase text-neutral-800 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400" />
                            Certo Work suggests
                          </span>
                          <button
                            onClick={() => handleApproveSuggestion(task.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg transition-all flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                        </div>

                        <div className="text-[10px] space-y-1 text-neutral-600 font-semibold">
                          {sugg.priority !== null && (
                            <div>Priority: <strong className="text-neutral-950">P{sugg.priority}</strong></div>
                          )}
                          {sugg.dueDate !== null && (
                            <div>Due Date: <strong className="text-neutral-950">{sugg.dueDate}</strong></div>
                          )}
                          {sugg.context !== null && (
                            <div>Context: <strong className="text-neutral-950">{sugg.context}</strong></div>
                          )}
                          {sugg.actionType !== null && (
                            <div>Type: <strong className="text-neutral-950">{sugg.actionType}</strong></div>
                          )}
                          {sugg.projectId !== null && (
                            <div>Project: <strong className="text-neutral-950">{projects.find(p => p.id === sugg.projectId)?.name || "Linked"}</strong></div>
                          )}
                        </div>

                        <p className="text-[10px] text-neutral-500 italic leading-snug border-t border-gray-100 pt-2">
                          "{sugg.reason}"
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                      <HelpCircle className="w-6 h-6 text-neutral-400" />
                      <p className="text-[10px] text-neutral-500 font-medium px-2">
                        Unsure of what attributes to assign to this task?
                      </p>
                      <button
                        onClick={() => handleAskBoldiForTask(task)}
                        className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] rounded-xl transition-all flex items-center gap-1 shadow-md hover:shadow-lg"
                      >
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        Ask Certo Work to Suggest
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
