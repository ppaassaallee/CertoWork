import { motion } from "motion/react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Loader2, Plus, Kanban, 
  Settings, X, 
  Calendar, Folder, Zap, Trash2, Link as LinkIcon, 
  User, Tag, AlertTriangle, FileText, CheckCircle, 
  TrendingUp, Bot, ShieldAlert, Sparkles, Archive
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { 
  doc, collection, query, where, onSnapshot, 
  updateDoc, deleteDoc, setDoc 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { toggleTaskStatus } from "../lib/tasks";
import { useUndo } from "../lib/UndoContext";
import { GanttView } from "./GanttView";
import { ProjectMilestonesView } from "./ProjectMilestonesView";
import { TasksList } from "./TasksList";
import { getRoleForUser, canPerform } from "../lib/permissions";
import { BoldiCoPilotModal } from "./BoldiCoPilotModal";

type ViewType = "overview" | "board" | "timeline" | "documents" | "reports";

export function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const { pushAction } = useUndo();

  const userRole = getRoleForUser(workspace, user?.email, user?.uid);
  const canUpdateProject = canPerform(userRole, 'project.update');
  const canDeleteProject = canPerform(userRole, 'project.delete');
  const canArchiveProject = canPerform(userRole, 'project.archive');
  const canCreateTask = canPerform(userRole, 'task.create');
  const canUpdateTask = canPerform(userRole, 'task.update');
  const canCreateMilestone = canPerform(userRole, 'milestone.create');

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCoPilotOpen, setIsCoPilotOpen] = useState(false);
  
  // Navigation View
  const [currentView, setCurrentView] = useState<ViewType>("overview");

  // Local UI states
  const [isEditingStages, setIsEditingStages] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  
  // Custom Tag input
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  // Status updates & docs states
  const [statusUpdateText, setStatusUpdateText] = useState("");
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);

  // Workspace Document states
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docType, setDocType] = useState<"link" | "gdrive" | "note">("link");
  const [docNoteContent, setDocNoteContent] = useState("");
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [gdriveLinkInput, setGdriveLinkInput] = useState("");

  // Status Report Generator states
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportSummary, setReportSummary] = useState("");
  const [reportWins, setReportWins] = useState("");
  const [reportBlockers, setReportBlockers] = useState("");
  const [reportRisks, setReportRisks] = useState("");
  const [reportNextSteps, setReportNextSteps] = useState("");

  const [automations, setAutomations] = useState([
    { id: 1, name: "Auto-close task", trigger: "Stage changes to Done", action: "Mark task status as 'done'", active: true },
    { id: 2, name: "Notify lead", trigger: "Priority changes to High", action: "Send email to Lead", active: false }
  ]);

  // Load Real-time listeners
  useEffect(() => {
    if (!user || !id || !workspace) return;

    // Fetch Project
    const docRef = doc(db, "projects", id);
    const unsubProject = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setProject({ id: snap.id, ...snap.data() });
      }
    });

    // Fetch related tasks
    const qTasks = query(
      collection(db, "tasks"), 
      where("userId", "==", user.uid), 
      where("workspaceId", "==", workspace.id), 
      where("projectId", "==", id)
    );
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setTasks(items);
      setLoading(false);
    }, (err) => console.error(err));

    // Fetch related milestones
    const qMilestones = query(
      collection(db, "milestones"), 
      where("userId", "==", user.uid), 
      where("workspaceId", "==", workspace.id), 
      where("projectId", "==", id)
    );
    const unsubMilestones = onSnapshot(qMilestones, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      items.sort((a,b) => (a.order || 0) - (b.order || 0));
      setMilestones(items);
    }, (err) => console.error(err));

    return () => { unsubTasks(); unsubProject(); unsubMilestones(); };
  }, [user, id, workspace]);

  const defaultStages = [
    { id: 'todo', name: 'To Do' },
    { id: 'in_progress', name: 'In Progress' },
    { id: 'done', name: 'Done' }
  ];

  const projectStages = project?.stages || defaultStages;

  // Progress calculations
  const totalTasksCount = tasks.length;
  const doneTasksCount = tasks.filter(t => t.status === 'done').length;
  const progressPercent = totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;

  // Pipelines Stage Handlers
  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim() || !project) return;
    
    const newStage = {
      id: "stage-" + Math.random().toString(36).substring(2, 9),
      name: newStageName.trim()
    };
    
    try {
      await updateDoc(doc(db, "projects", project.id), {
        stages: [...projectStages, newStage]
      });
      setNewStageName("");
    } catch (err) {
      console.error("Failed to add stage", err);
    }
  };

  const handleRemoveStage = async (stageId: string) => {
    if (!project) return;
    try {
      await updateDoc(doc(db, "projects", project.id), {
        stages: projectStages.filter((s: any) => s.id !== stageId)
      });
    } catch (err) {
      console.error("Failed to remove stage", err);
    }
  };

  const handleApplyTemplate = async (templateName: string) => {
    if (!project) return;
    let templateStages: any[] = [];
    if (templateName === "software") {
      templateStages = [
        { id: "s-backlog", name: 'Backlog' },
        { id: "s-todo", name: 'To Do' },
        { id: "s-inprogress", name: 'In Progress' },
        { id: "s-review", name: 'In Review' },
        { id: "s-done", name: 'Done' }
      ];
    } else if (templateName === "content") {
      templateStages = [
        { id: "c-ideas", name: 'Ideas' },
        { id: "c-writing", name: 'Writing' },
        { id: "c-editing", name: 'Editing' },
        { id: "c-published", name: 'Published' }
      ];
    } else if (templateName === "sales") {
      templateStages = [
        { id: "sl-lead", name: 'Lead' },
        { id: "sl-contacted", name: 'Contacted' },
        { id: "sl-proposal", name: 'Proposal Sent' },
        { id: "sl-closedwon", name: 'Closed Won' }
      ];
    }

    if (templateStages.length > 0) {
      try {
        await updateDoc(doc(db, "projects", project.id), {
          stages: templateStages
        });
        setIsEditingStages(false);
      } catch (err) {
        console.error("Failed to apply template", err);
      }
    }
  };

  const handleToggleTask = async (taskId: string) => {
    if (!canUpdateTask) {
      alert("You do not have permission to update tasks in this workspace.");
      return;
    }
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const isCurrentlyDone = task.status === 'done';
        if (isCurrentlyDone) {
           await toggleTaskStatus({ ...task, userId: user?.uid });
           await updateDoc(doc(db, "tasks", task.id), {
             stageId: task.previousStageId || projectStages[0]?.id || "todo"
           });
        } else {
           const doneStage = projectStages.find((s: any) => s.name.toLowerCase() === 'done');
           await toggleTaskStatus({ ...task, userId: user?.uid });
           
           const updateData: any = {};
           if (doneStage && task.stageId !== doneStage.id) {
             updateData.stageId = doneStage.id;
             updateData.previousStageId = task.stageId || projectStages[0]?.id;
           } else if (!doneStage) {
             updateData.previousStageId = task.stageId || projectStages[0]?.id;
           }
           if (Object.keys(updateData).length > 0) {
             await updateDoc(doc(db, "tasks", task.id), updateData);
           }
        }
      }
    } catch(e) { console.error(e); }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      const projData = { ...project };
      delete projData.id;
      
      await deleteDoc(doc(db, "projects", project.id));
      
      pushAction({
        id: `delete-project-${project.id}`,
        description: `Delete project "${project.title || 'Untitled'}"`,
        undo: async () => {
          await setDoc(doc(db, "projects", project.id), projData);
        },
        redo: async () => {
          await deleteDoc(doc(db, "projects", project.id));
        }
      });
      
      navigate("/work/projects");
    } catch (err) {
      console.error(err);
    }
  };

  // Add / Delete Tag Handlers
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !project) return;
    const currentTags = project.tags || [];
    if (currentTags.includes(newTag.trim())) return;
    try {
      await updateDoc(doc(db, "projects", project.id), {
        tags: [...currentTags, newTag.trim()]
      });
      setNewTag("");
      setShowTagInput(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!project) return;
    const currentTags = project.tags || [];
    try {
      await updateDoc(doc(db, "projects", project.id), {
        tags: currentTags.filter((t: string) => t !== tagToRemove)
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Save Quick Status Update Log
  const handleSaveQuickStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusUpdateText.trim() || !project) return;
    const currentUpdates = project.statusUpdates || [];
    const newLog = {
      id: "update-" + Date.now(),
      content: statusUpdateText.trim(),
      date: new Date().toISOString()
    };
    try {
      await updateDoc(doc(db, "projects", project.id), {
        statusUpdates: [newLog, ...currentUpdates]
      });
      setStatusUpdateText("");
      setShowStatusUpdateModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Document management handlers
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim() || !project) return;
    const currentDocs = project.documents || [];
    const newDocObj = {
      id: "doc-" + Date.now(),
      name: docName.trim(),
      url: docUrl.trim() || "",
      type: docType,
      noteContent: docType === "note" ? docNoteContent : "",
      createdAt: new Date().toISOString()
    };
    try {
      await updateDoc(doc(db, "projects", project.id), {
        documents: [...currentDocs, newDocObj]
      });
      setDocName("");
      setDocUrl("");
      setDocNoteContent("");
      setShowAddDocModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!project) return;
    const currentDocs = project.documents || [];
    try {
      await updateDoc(doc(db, "projects", project.id), {
        documents: currentDocs.filter((d: any) => d.id !== docId)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectGoogleDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gdriveLinkInput.trim() || !project) return;
    try {
      await updateDoc(doc(db, "projects", project.id), {
        googleDriveFolder: gdriveLinkInput.trim()
      });
      setGdriveLinkInput("");
    } catch (err) {
      console.error(err);
    }
  };

  // AI Executive Status Report Generator Call
  const handleGenerateAIReport = async () => {
    if (!project) return;
    setGeneratingReport(true);
    setReportError("");
    try {
      const response = await fetch("/api/projects/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectTitle: project.title,
          projectDescription: project.description,
          status: project.status,
          health: project.health,
          category: project.category,
          priority: project.priority,
          tasks: tasks.map(t => ({ title: t.title, status: t.status })),
          milestones: milestones.map(m => ({ title: m.title, status: m.status })),
          recentUpdates: project.statusUpdates || []
        })
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || "The configured AI provider is unavailable.");
      }
      const data = await response.json();
      
      setReportTitle(`Executive Status Report - ${new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`);
      setReportSummary(data.executiveSummary || "");
      setReportWins(data.wins || "");
      setReportBlockers(data.blockers || "");
      setReportRisks(data.risks || "");
      setReportNextSteps(data.nextSteps || "");
    } catch (err) {
      console.error(err);
      setReportError(
        "AI drafting is unavailable in this deployment. You can still complete and save the report manually below.",
      );
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSaveStatusReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim() || !project) return;
    const currentReports = project.statusReports || [];
    const reportObj = {
      id: "report-" + Date.now(),
      title: reportTitle.trim(),
      summary: reportSummary.trim(),
      wins: reportWins.trim(),
      blockers: reportBlockers.trim(),
      risks: reportRisks.trim(),
      nextSteps: reportNextSteps.trim(),
      savedAt: new Date().toISOString(),
      author: user?.email || "Executive Coordinator"
    };
    try {
      await updateDoc(doc(db, "projects", project.id), {
        statusReports: [reportObj, ...currentReports]
      });
      // Clear fields
      setReportTitle("");
      setReportSummary("");
      setReportWins("");
      setReportBlockers("");
      setReportRisks("");
      setReportNextSteps("");
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStatusReport = async (reportId: string) => {
    if (!project) return;
    const currentReports = project.statusReports || [];
    if (!confirm("Are you sure you want to delete this status report from history?")) return;
    try {
      await updateDoc(doc(db, "projects", project.id), {
        statusReports: currentReports.filter((r: any) => r.id !== reportId)
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Boldi Co-Pilot assistant
  const handleAskBoldiAboutProject = () => {
    if (!project) return;
    const promptMessage = `Boldi, analyze the current status of my project "${project.title}".
- Category: ${project.category || "None"}
- Health: ${project.health || "Not Evaluated"}
- Priority: ${project.priority || "Medium"}
- Completion: ${progressPercent}% (${doneTasksCount}/${totalTasksCount} tasks complete)
- Goals: ${project.description || "No description set"}

Give me 3 concrete productivity strategies based on Carl Pullein's principles (protecting core work, daily 2+8, time sectors) to speed up execution.`;
    
    // Dispatch custom event to trigger floating widget
    window.dispatchEvent(new CustomEvent("open-boldi-assistant", { 
      detail: { message: promptMessage } 
    }));
  };

  if (loading) {
     return <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  }

  if (!project) {
     return <div className="p-8 text-center text-gray-500">Project not found</div>;
  }

  // Filter tasks for timeline
  const parentTasks = tasks.filter(t => !t.parentId);

  // Unscheduled Tasks list (tasks without startDate AND dueDate)
  const unscheduledTasks = tasks.filter(t => !t.startDate && !t.dueDate);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="gazelle-integrated-page p-4 max-w-6xl mx-auto pb-32 w-full"
    >
      <header className="mb-6 mt-4 bg-white p-5 md:p-6 rounded-[18px] border border-[#deded6] shadow-[0_8px_24px_rgba(30,35,25,0.04)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
          <div className="flex items-start gap-3">
            <Link 
              to="/work/projects" 
              className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-xl flex justify-center items-center transition-all border border-gray-200 shrink-0 mt-1" 
              title="Back to Projects"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </Link>
            
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* Project/Deal indicator - 3 Macro Stages selection */}
                <div className="relative">
                  <select 
                    value={project.projectType || 'project'}
                    disabled={!canUpdateProject}
                    onChange={async (e) => await updateDoc(doc(db, "projects", project.id), { projectType: e.target.value })}
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer disabled:opacity-85 ${
                      project.projectType === 'deal' ? 'bg-amber-50 text-amber-700 border-amber-200/50' : 
                      project.projectType === 'implementation' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/50' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                    }`}
                  >
                    <option value="deal">Deal</option>
                    <option value="implementation">Implementation project</option>
                    <option value="ongoing">Ongoing project</option>
                  </select>
                </div>

                {/* STATUS BADGE SELECT */}
                <div className="relative">
                  <select 
                    value={project.status || 'open'}
                    disabled={!canUpdateProject}
                    onChange={async (e) => await updateDoc(doc(db, "projects", project.id), { status: e.target.value })}
                    className="bg-gray-50 hover:bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-gray-200 focus:outline-none cursor-pointer disabled:opacity-85"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="paused">Paused</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {/* HEALTH BADGE SELECT */}
                <div className="relative">
                  <select 
                    value={project.health || ''}
                    disabled={!canUpdateProject}
                    onChange={async (e) => await updateDoc(doc(db, "projects", project.id), { health: e.target.value })}
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer disabled:opacity-85 ${
                      project.health === 'on_track' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      project.health === 'at_risk' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                      project.health === 'blocked' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    <option value="">Health: evaluate</option>
                    <option value="on_track">On track</option>
                    <option value="at_risk">At risk</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>

                {/* PRIORITY SELECT */}
                <div className="relative">
                  <select 
                    value={project.priority || 'medium'}
                    onChange={async (e) => await updateDoc(doc(db, "projects", project.id), { priority: e.target.value })}
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer ${
                      project.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                      project.priority === 'low' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    <option value="high">Priority: High</option>
                    <option value="medium">Priority: Medium</option>
                    <option value="low">Priority: Low</option>
                  </select>
                </div>

                {/* CATEGORY SELECT */}
                <div className="relative">
                  <select 
                    value={project.category || ''}
                    onChange={async (e) => await updateDoc(doc(db, "projects", project.id), { category: e.target.value })}
                    className="bg-gray-50 hover:bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-gray-200 focus:outline-none cursor-pointer"
                  >
                    <option value="">Category: None</option>
                    <option value="Technology">Technology</option>
                    <option value="Operations">Operations</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                    <option value="Finances">Finances</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{project.title}</h1>
              <p className="text-gray-500 text-sm mt-1 max-w-2xl">{project.description || "No strategic overview written yet. Keep your focus high by adding notes."}</p>
              
              {/* Tag Index bar */}
              <div className="flex flex-wrap items-center gap-1.5 mt-4">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                {(project.tags || []).map((t: string) => (
                  <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1 border border-gray-200">
                    {t}
                    <button onClick={() => handleRemoveTag(t)} className="text-gray-400 hover:text-red-500 font-bold ml-0.5 text-[9px]">&times;</button>
                  </span>
                ))}
                
                {showTagInput ? (
                  <form onSubmit={handleAddTag} className="inline-flex gap-1">
                    <input 
                      type="text" 
                      placeholder="tag..." 
                      value={newTag} 
                      onChange={e => setNewTag(e.target.value)}
                      className="bg-gray-50 border border-gray-300 rounded-full px-2 py-0.5 text-xs w-20 focus:outline-none"
                    />
                    <button type="submit" className="text-xs bg-black text-white px-2 rounded-full font-bold">+</button>
                    <button type="button" onClick={() => setShowTagInput(false)} className="text-xs text-gray-400 font-bold">&times;</button>
                  </form>
                ) : (
                  <button onClick={() => setShowTagInput(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5">
                    + Add tag
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <div className="flex flex-col gap-2 shrink-0 md:text-right mt-4 md:mt-0">
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setIsCoPilotOpen(true)}
                className="bg-black hover:bg-gray-800 text-white px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Bot className="w-3.5 h-3.5 text-white" /> Ask Gazelle
              </button>

              <button 
                onClick={() => setShowStatusUpdateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" /> Log Update
              </button>

              <button 
                onClick={handleAskBoldiAboutProject}
                className="bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Bot className="w-3.5 h-3.5 text-amber-600" /> Analyze
              </button>

              <button 
                onClick={() => {
                  setShowReportModal(true);
                  handleGenerateAIReport(); // Auto generate draft
                }}
                className="bg-gray-900 hover:bg-black text-white px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Generate Report
              </button>
            </div>

            <div className="text-xs text-gray-400 mt-1 md:pr-1 flex flex-col md:items-end">
              <span>Owner: <input 
                type="text" 
                value={project.owner || ""} 
                placeholder="Assign Owner" 
                onChange={async (e) => await updateDoc(doc(db, "projects", project.id), { owner: e.target.value })}
                className="bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none px-1 text-gray-700 font-medium text-right max-w-[120px]"
              /></span>
              <span>Target End: <input 
                type="date" 
                value={project.targetEndDate && /^\d{4}-\d{2}-\d{2}/.test(project.targetEndDate) ? project.targetEndDate.substring(0, 10) : ''} 
                onChange={async (e) => await updateDoc(doc(db, "projects", project.id), { targetEndDate: e.target.value })}
                className="bg-transparent border-none text-right cursor-pointer text-gray-600 max-w-[120px] focus:outline-none focus:ring-0 text-[11px]"
              /></span>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Indicator */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-center text-xs font-bold text-gray-400 mb-1">
              <span className="uppercase tracking-wider">Project Execution Progress</span>
              <span className="text-gray-900">{progressPercent}% ({doneTasksCount}/{totalTasksCount} tasks complete)</span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => setIsEditingStages(!isEditingStages)}
              className={`p-2 rounded-xl border transition-colors ${isEditingStages ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              title="Pipeline Stages Config"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowAutomations(!showAutomations)}
              className={`p-2 rounded-xl border transition-colors ${showAutomations ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              title="Workflow Automation"
            >
              <Zap className="w-4 h-4" />
            </button>
            <button 
              onClick={async () => {
                if (!canArchiveProject) {
                  alert("You do not have permission to archive this project.");
                  return;
                }
                const isCurrentlyArchived = project.status === 'archived';
                await updateDoc(doc(db, "projects", project.id), { status: isCurrentlyArchived ? 'open' : 'archived' });
              }}
              className={`p-2 rounded-xl border transition-colors ${project.status === 'archived' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
              title={project.status === 'archived' ? "Unarchive Workspace" : "Archive Workspace"}
            >
              <Archive className="w-4 h-4" />
            </button>
            <button 
              onClick={handleDeleteProject}
              disabled={!canDeleteProject}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete Project Workspace"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* PIPELINE & AUTOMATION COLLAPSIBLE CONFIGS */}
      {showAutomations && (
        <div className="bg-amber-50/70 border border-amber-200/50 rounded-3xl p-6 mb-6">
          <h2 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-600" /> Automation Rules</h2>
          <p className="text-xs text-amber-700 mb-4">Set up lightweight automatic flows for project stage completions.</p>
          <div className="space-y-2">
            {automations.map(auto => (
               <div key={auto.id} className="flex items-center justify-between bg-white border border-amber-100 p-4 rounded-xl shadow-sm">
                 <div>
                   <div className="font-bold text-sm text-amber-900">{auto.name}</div>
                   <div className="text-xs font-semibold text-amber-700">WHEN: {auto.trigger} &rarr; THEN: {auto.action}</div>
                 </div>
                 <input 
                    type="checkbox" 
                    checked={auto.active}
                    onChange={() => {
                      setAutomations(automations.map(a => a.id === auto.id ? { ...a, active: !a.active } : a))
                    }}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-0 cursor-pointer"
                 />
               </div>
            ))}
          </div>
        </div>
      )}

      {isEditingStages && (
        <div className="bg-indigo-50/70 border border-indigo-200/50 rounded-3xl p-6 mb-6">
          <h2 className="text-lg font-bold text-indigo-900 mb-2">Configure Stage Pipeline</h2>
          <p className="text-xs text-indigo-700 mb-4">Select an industry template or create a custom kanban flow for your deal cycle or project workflow.</p>
          <div className="flex flex-wrap gap-2 mb-4 border-b border-indigo-100/50 pb-3">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-wider mt-1 mr-2">Templates:</span>
            <button onClick={() => handleApplyTemplate('software')} className="text-xs font-bold px-3 py-1 bg-white text-indigo-700 rounded-lg shadow-sm hover:bg-indigo-700 hover:text-white border border-indigo-200 transition-all">💻 Software Dev</button>
            <button onClick={() => handleApplyTemplate('content')} className="text-xs font-bold px-3 py-1 bg-white text-indigo-700 rounded-lg shadow-sm hover:bg-indigo-700 hover:text-white border border-indigo-200 transition-all">📝 Content Pipeline</button>
            <button onClick={() => handleApplyTemplate('sales')} className="text-xs font-bold px-3 py-1 bg-white text-indigo-700 rounded-lg shadow-sm hover:bg-indigo-700 hover:text-white border border-indigo-200 transition-all">💼 B2B Deal Pipeline</button>
          </div>
          <div className="space-y-2 max-w-md">
            {projectStages.map((stage: any, sIndex: number) => (
              <div key={stage.id} className="flex items-center justify-between bg-white border border-indigo-100 p-2.5 rounded-xl shadow-sm">
                <span className="text-sm font-semibold text-gray-700">{sIndex + 1}. {stage.name}</span>
                <button onClick={() => handleRemoveStage(stage.id)} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <form onSubmit={handleAddStage} className="flex gap-2 pt-2">
              <input 
                type="text" 
                placeholder="Custom stage name..." 
                value={newStageName} 
                onChange={e => setNewStageName(e.target.value)}
                className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
              <button disabled={!newStageName.trim()} type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold">Add</button>
            </form>
          </div>
        </div>
      )}

      <div className="flex bg-[#efeee8] p-1.5 rounded-[16px] w-full max-w-2xl mb-8 border border-[#deded6] shadow-inner overflow-x-auto">
        <button 
          onClick={() => setCurrentView("overview")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${currentView === 'overview' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <TrendingUp className="w-4 h-4" /> Overview
        </button>
        <button 
          onClick={() => setCurrentView("board")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${currentView === 'board' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Kanban className="w-4 h-4" /> Board
        </button>
        <button 
          onClick={() => setCurrentView("timeline")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${currentView === 'timeline' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Calendar className="w-4 h-4" /> Timeline
        </button>
        <button 
          onClick={() => setCurrentView("documents")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${currentView === 'documents' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Folder className="w-4 h-4" /> Docs
        </button>
        <button 
          onClick={() => setCurrentView("reports")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${currentView === 'reports' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <FileText className="w-4 h-4" /> Reports
        </button>
      </div>

      {/* 3. VIEW CHANGER */}
      {currentView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main left column: status logs & actions */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick KPIs stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
                <span className="block text-2xl font-black text-gray-900">{tasks.length}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Total Tasks</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
                <span className="block text-2xl font-black text-emerald-600">{doneTasksCount}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Tasks Completed</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
                <span className="block text-2xl font-black text-indigo-600">{milestones.length}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Milestones</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
                <span className="block text-2xl font-black text-red-500">
                  {tasks.filter(t => t.priority === "high" || t.priority === 1).length}
                </span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Critical Tasks</span>
              </div>
            </div>

            {/* Next Actions & Blockers */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Immediate Next Actions</span>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">Focused</span>
              </h3>
              
              <div className="space-y-2.5">
                {parentTasks.filter(t => t.status !== 'done').slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={task.status === 'done'} 
                        onChange={() => handleToggleTask(task.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-800">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.dueDate && (
                        <span className="text-[9px] font-bold text-gray-400 flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" /> {task.dueDate}
                        </span>
                      )}
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-white border border-gray-200 text-gray-500 rounded">
                        {projectStages.find((s:any) => s.id === task.stageId)?.name || "To Do"}
                      </span>
                    </div>
                  </div>
                ))}
                
                {parentTasks.filter(t => t.status !== 'done').length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-400">No active tasks. Add tasks under the "Board" tab!</div>
                )}
              </div>
            </div>

            {/* Status updates timeline log */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Project Status Logs</h3>
              <div className="space-y-4">
                {(project.statusUpdates || []).slice(0, 4).map((u: any, index: number) => (
                  <div key={u.id || index} className="relative pl-6 border-l-2 border-indigo-100 pb-3 last:pb-0">
                    <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-indigo-500" />
                    <div className="text-xs font-bold text-gray-400">{new Date(u.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    <p className="text-xs text-gray-700 mt-0.5">{u.content}</p>
                  </div>
                ))}
                
                {(project.statusUpdates || []).length === 0 && (
                  <div className="text-center py-4 text-xs text-gray-400">No status updates logged yet. Use "Log Update" above to record progress.</div>
                )}
              </div>
            </div>

          </div>

          {/* Right column: Stakeholders & Metadata */}
          <div className="space-y-6">
            
            {/* Health Checklist cockpit */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-indigo-600" /> Health Checklist
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-xs">
                  {progressPercent >= 50 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">Execution Progress</div>
                    <div className="text-gray-400 text-[10px]">{progressPercent}% tasks completed</div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs">
                  {unscheduledTasks.length === 0 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">Timeline Planning</div>
                    <div className="text-gray-400 text-[10px]">{unscheduledTasks.length} tasks without dates</div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs">
                  {project.tags && project.tags.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">Categorization & Tags</div>
                    <div className="text-gray-400 text-[10px]">{project.tags?.length || 0} active tags assigned</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stakeholders list */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-600" /> Project Stakeholders
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold font-mono">
                    {user?.email?.substring(0, 2).toUpperCase() || 'EX'}
                  </div>
                  <div>
                    <div className="font-bold">You ({user?.email?.split('@')[0]})</div>
                    <div className="text-gray-400 text-[10px]">Project Owner & Lead</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold">
                    +
                  </div>
                  <div>
                    <div className="font-bold text-indigo-600 hover:underline cursor-pointer">Invite Stakeholder</div>
                    <div className="text-[10px]">Share status with client</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {currentView === 'board' && (
        <TasksList hideCockpit={true} projectId={id} />
      )}

      {currentView === 'timeline' && (
         <div className="space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Gantt & Timeline Axis</h2>
              <GanttView tasks={tasks} milestones={milestones} stages={projectStages} />
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Milestone checkpoints</h2>
              <ProjectMilestonesView 
                project={project} 
                tasks={tasks} 
                milestones={milestones} 
                user={user} 
                workspace={workspace} 
                canCreateMilestone={canCreateMilestone}
                canCreateTask={canCreateTask}
                canUpdateTask={canUpdateTask}
              />
            </div>

            {/* UNSCHEDULED TASKS DATE ASSIGNMENT */}
            <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-200/50">
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Date Planning Triage ({unscheduledTasks.length} unscheduled)
              </h3>
              <p className="text-xs text-amber-700 mb-4">Assign dates to unscheduled tasks below to pull them into your Gantt chart immediately.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unscheduledTasks.map(task => (
                  <div key={task.id} className="bg-white p-3 rounded-2xl shadow-sm border border-amber-100 flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-gray-800 truncate flex-1">{task.title}</span>
                    <div className="flex gap-1.5 shrink-0">
                      <input 
                        type="date" 
                        onChange={async (e) => {
                          if (e.target.value) {
                            await updateDoc(doc(db, "tasks", task.id), { 
                              startDate: e.target.value,
                              dueDate: e.target.value
                            });
                          }
                        }}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[10px] text-gray-600 focus:outline-none focus:ring-0 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
                
                {unscheduledTasks.length === 0 && (
                  <div className="col-span-full text-center py-4 text-xs text-amber-800 font-medium">All tasks are scheduled! Perfect execution readiness.</div>
                )}
              </div>
            </div>
         </div>
      )}

      {currentView === 'documents' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left main: resource items index */}
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
               <div className="flex justify-between items-center mb-6">
                 <div>
                   <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Document & Resource Index</h3>
                   <p className="text-xs text-gray-400 mt-1">Keep project links, notes, meeting briefs, and working files in one place.</p>
                 </div>
                 <button 
                   onClick={() => setShowAddDocModal(true)}
                   className="bg-black text-white px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-gray-800 transition-all"
                 >
                   <Plus className="w-3.5 h-3.5" /> Add Document
                 </button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {(project.documents || []).map((docObj: any) => (
                    <div key={docObj.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between hover:border-gray-200 transition-all relative">
                      <button 
                        onClick={() => handleDeleteDocument(docObj.id)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 rounded"
                        title="Remove link"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {docObj.type === "gdrive" ? (
                            <span className="p-1 bg-green-50 text-green-700 rounded-lg"><Folder className="w-4 h-4" /></span>
                          ) : docObj.type === "note" ? (
                            <span className="p-1 bg-amber-50 text-amber-700 rounded-lg"><FileText className="w-4 h-4" /></span>
                          ) : (
                            <span className="p-1 bg-indigo-50 text-indigo-700 rounded-lg"><LinkIcon className="w-4 h-4" /></span>
                          )}
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{docObj.type}</span>
                        </div>
                        <h4 className="font-bold text-sm text-gray-800 leading-tight mb-1">{docObj.name}</h4>
                        {docObj.type === "note" && (
                          <p className="text-xs text-gray-500 line-clamp-3 bg-white p-2 rounded-lg border border-gray-100 mt-2 whitespace-pre-line">{docObj.noteContent}</p>
                        )}
                      </div>

                      {docObj.url && (
                        <a 
                          href={docObj.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          Open Resource &rarr;
                        </a>
                      )}
                    </div>
                 ))}

                 {(project.documents || []).length === 0 && (
                   <div className="col-span-full text-center py-8 text-xs text-gray-400">No resources added yet.</div>
                 )}
               </div>
             </div>
           </div>

           {/* Right: Google Drive workspace connector */}
           <div className="space-y-6">
             <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4">
                 <Folder className="w-8 h-8 text-green-600/10" />
               </div>
               
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-2">Google Drive Folder</h3>
               
               {project.googleDriveFolder ? (
                 <div className="space-y-4">
                   <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                     <Folder className="w-8 h-8 text-emerald-600" />
                     <div className="truncate">
                       <div className="font-bold text-xs text-emerald-900">Connected GDrive Workspace</div>
                       <a 
                         href={project.googleDriveFolder} 
                         target="_blank" 
                         rel="noreferrer" 
                         className="text-[10px] text-emerald-700 underline truncate block"
                       >
                         {project.googleDriveFolder}
                       </a>
                     </div>
                   </div>
                   
                   <button 
                     onClick={async () => await updateDoc(doc(db, "projects", project.id), { googleDriveFolder: null })}
                     className="text-[10px] text-red-500 font-bold hover:underline"
                   >
                     Disconnect folder
                   </button>
                 </div>
               ) : (
                 <form onSubmit={handleConnectGoogleDrive} className="space-y-3">
                   <p className="text-xs text-gray-400">Connect a dedicated Google Drive folder to synchronize stakeholders briefs and PDFs.</p>
                   <input 
                     type="url" 
                     placeholder="Paste Google Drive folder URL..." 
                     value={gdriveLinkInput}
                     onChange={e => setGdriveLinkInput(e.target.value)}
                     className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-green-400"
                   />
                   <button 
                     type="submit" 
                     disabled={!gdriveLinkInput.trim()}
                     className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all"
                   >
                     Connect Folder
                   </button>
                 </form>
               )}
             </div>
           </div>
         </div>
      )}

      {currentView === 'reports' && (
         <div className="space-y-6">
           <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
             <div className="flex justify-between items-center mb-6">
               <div>
                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Status report history</h3>
                 <p className="text-xs text-gray-400 mt-1">Review saved executive updates and project decisions.</p>
               </div>
               <button 
                 onClick={() => {
                   setShowReportModal(true);
                   handleGenerateAIReport(); // Auto generate draft
                 }}
                 className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
               >
                 <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Draft New Report
               </button>
             </div>

             <div className="space-y-4">
               {(project.statusReports || []).map((rep: any) => (
                  <div key={rep.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-150 relative">
                    <button 
                      onClick={() => handleDeleteStatusReport(rep.id)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 p-1"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="p-1 bg-indigo-50 text-indigo-700 rounded-lg"><FileText className="w-4.5 h-4.5" /></span>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 leading-tight">{rep.title}</h4>
                        <span className="text-[10px] text-gray-400 font-semibold">{new Date(rep.savedAt).toLocaleDateString()} &bull; Author: {rep.author}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200/50">
                      <div>
                        <h5 className="text-[10px] uppercase font-black text-indigo-600 tracking-wider mb-1">Executive Summary</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{rep.summary}</p>
                      </div>
                      
                      <div>
                        <h5 className="text-[10px] uppercase font-black text-emerald-600 tracking-wider mb-1">Key Wins</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{rep.wins}</p>
                      </div>

                      <div>
                        <h5 className="text-[10px] uppercase font-black text-amber-600 tracking-wider mb-1">Blockers</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{rep.blockers || "No blockers logged."}</p>
                      </div>

                      <div>
                        <h5 className="text-[10px] uppercase font-black text-red-600 tracking-wider mb-1">Risks Evaluated</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{rep.risks || "No major risks identified."}</p>
                      </div>

                      <div className="md:col-span-2">
                        <h5 className="text-[10px] uppercase font-black text-gray-900 tracking-wider mb-1">Next Actions</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{rep.nextSteps}</p>
                      </div>
                    </div>
                  </div>
               ))}

               {(project.statusReports || []).length === 0 && (
                 <div className="text-center py-12 text-xs text-gray-400">No status reports saved yet.</div>
               )}
             </div>
           </div>
         </div>
      )}

      {/* MODALS */}
      
      {/* 1. QUICK STATUS UPDATE LOG MODAL */}
      {showStatusUpdateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-200 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Log Quick Status Update</h3>
              <button onClick={() => setShowStatusUpdateModal(false)} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSaveQuickStatusUpdate} className="space-y-4">
              <textarea 
                placeholder="Log progress, design decisions, or current work sector... (e.g., Kicked off Figma workshop with the design lead.)"
                value={statusUpdateText}
                onChange={e => setStatusUpdateText(e.target.value)}
                rows={4}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                Post Status Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD DOCUMENT MODAL */}
      {showAddDocModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-200 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Add Project Document</h3>
              <button onClick={() => setShowAddDocModal(false)} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSaveDocument} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-500 font-bold mb-1">Doc Type</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button 
                    type="button" 
                    onClick={() => setDocType("link")} 
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold ${docType === 'link' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}
                  >
                    Link/URL
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setDocType("note")} 
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold ${docType === 'note' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}
                  >
                    Workspace Note
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1">Document Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Figma Prototype Link" 
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              {docType === "link" ? (
                <div>
                  <label className="block text-gray-500 font-bold mb-1">URL Link</label>
                  <input 
                    type="url" 
                    placeholder="https://example.com" 
                    value={docUrl}
                    onChange={e => setDocUrl(e.target.value)}
                    required={docType === "link"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-gray-500 font-bold mb-1">Note Content</label>
                  <textarea 
                    placeholder="Write your note/memo details here..." 
                    value={docNoteContent}
                    onChange={e => setDocNoteContent(e.target.value)}
                    required={docType === "note"}
                    rows={5}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              )}

              <button 
                type="submit" 
                className="w-full bg-black hover:bg-gray-800 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                Add to Index
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. AI STATUS REPORT CREATOR MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-gray-200 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-gray-950 uppercase tracking-wider text-sm flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Status report draft
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-black"
                aria-label="Close report builder"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatingReport ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                <p className="text-xs text-gray-500">Gazelle is reviewing tasks, milestones, and recent updates...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveStatusReport} className="space-y-4 text-xs">
                {reportError && (
                  <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    {reportError}
                  </div>
                )}
                <div>
                  <label className="block text-gray-500 font-black uppercase tracking-wider text-[10px] mb-1">Report Title</label>
                  <input 
                    type="text" 
                    value={reportTitle}
                    onChange={e => setReportTitle(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 font-black uppercase tracking-wider text-[10px] mb-1">Executive Summary</label>
                    <textarea 
                      value={reportSummary}
                      onChange={e => setReportSummary(e.target.value)}
                      rows={4}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 font-black uppercase tracking-wider text-[10px] mb-1">Key Achievements & Wins</label>
                    <textarea 
                      value={reportWins}
                      onChange={e => setReportWins(e.target.value)}
                      rows={4}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 font-black uppercase tracking-wider text-[10px] mb-1">Current Blockers</label>
                    <textarea 
                      value={reportBlockers}
                      onChange={e => setReportBlockers(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 font-black uppercase tracking-wider text-[10px] mb-1">Identified Future Risks</label>
                    <textarea 
                      value={reportRisks}
                      onChange={e => setReportRisks(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-gray-500 font-black uppercase tracking-wider text-[10px] mb-1">Immediate Next Actions & Priorities</label>
                    <textarea 
                      value={reportNextSteps}
                      onChange={e => setReportNextSteps(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={handleGenerateAIReport}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl font-bold border border-indigo-200"
                  >
                    Regenerate AI Draft
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-black hover:bg-gray-800 text-white py-2.5 rounded-xl font-bold text-center"
                  >
                    Save & Publish Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {project && (
        <BoldiCoPilotModal
          isOpen={isCoPilotOpen}
          onClose={() => setIsCoPilotOpen(false)}
          itemId={project.id}
          itemTitle={project.title}
          itemDescription={project.description || ""}
          itemType="project"
        />
      )}
    </motion.div>
  );
}
