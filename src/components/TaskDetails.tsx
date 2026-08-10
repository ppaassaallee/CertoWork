import { motion } from "motion/react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, collection, query, where, addDoc, serverTimestamp, deleteDoc, setDoc, deleteField, getDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toggleTaskStatus } from "../lib/tasks";
import { ArrowLeft, CheckCircle, Loader2, Calendar, Folder, AlignLeft, CornerDownRight, Plus, Target, Trash2, Lightbulb, Scale, Briefcase, Book, CheckSquare, Zap, RefreshCw, Timer, Sparkles, Link as LucideLink, Search, BookOpen, Bot } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useUndo } from "../lib/UndoContext";

import { performAITask } from "../lib/gemini";
import { FocusModeModal } from "./FocusModeModal";
import { EntityPicker } from "./EntityPicker";
import { InvokeSkillModal } from "./InvokeSkillModal";
import { BoldiCoPilotModal } from "./BoldiCoPilotModal";

export function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const { pushAction } = useUndo();
  const [task, setTask] = useState<any>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [_projects, setProjects] = useState<any[]>([]);
  const [_categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isCoPilotOpen, setIsCoPilotOpen] = useState(false);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState("");

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Document Linking States
  const [isLinkingDoc, setIsLinkingDoc] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [docSearchResult, setDocSearchResult] = useState<any[]>([]);
  const [loadingDocSearch, setLoadingDocSearch] = useState(false);

  // Live search for matching knowledge documents
  useEffect(() => {
    if (!isLinkingDoc || !user || !workspace) return;
    const delayDebounce = setTimeout(async () => {
      setLoadingDocSearch(true);
      try {
        const q = query(
          collection(db, "knowledge_items"),
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspace.id)
        );
        const snap = await getDocs(q);
        const matches: any[] = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!docSearch || (d.title || "").toLowerCase().includes(docSearch.toLowerCase())) {
            matches.push({ id: docSnap.id, title: d.title || "Untitled" });
          }
        });
        setDocSearchResult(matches.slice(0, 10)); // Top 10 matches
      } catch (err) {
        console.error("Error searching documents: ", err);
      } finally {
        setLoadingDocSearch(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [docSearch, isLinkingDoc, user, workspace]);

  const handleConnectDoc = async (docId: string, docTitle: string) => {
    if (!task) return;
    const currentLinks = task.linkedDocs || [];
    if (currentLinks.some((l: any) => l.id === docId)) {
      alert("Already linked!");
      return;
    }
    const updatedLinks = [...currentLinks, { id: docId, title: docTitle }];
    await handleUpdate('linkedDocs', updatedLinks);
    setIsLinkingDoc(false);
    setDocSearch("");

    // Bidirectional write to the knowledge item as well
    try {
      const docRef = doc(db, "knowledge_items", docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const docData = docSnap.data();
        const currentDocLinks = docData.linkedItems || [];
        if (!currentDocLinks.some((l: any) => l.id === task.id)) {
          const updatedDocLinks = [...currentDocLinks, {
            id: task.id,
            title: task.title,
            type: "task",
            collection: "tasks"
          }];
          await updateDoc(docRef, { linkedItems: updatedDocLinks });
        }
      }
    } catch (err) {
      console.error("Error linking bidirectionally: ", err);
    }
  };

  const handleDisconnectDoc = async (docId: string) => {
    if (!task) return;
    const currentLinks = task.linkedDocs || [];
    const updatedLinks = currentLinks.filter((l: any) => l.id !== docId);
    await handleUpdate('linkedDocs', updatedLinks);

    // Bidirectional remove from the knowledge item as well
    try {
      const docRef = doc(db, "knowledge_items", docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const docData = docSnap.data();
        const currentDocLinks = docData.linkedItems || [];
        const updatedDocLinks = currentDocLinks.filter((l: any) => l.id !== task.id);
        await updateDoc(docRef, { linkedItems: updatedDocLinks });
      }
    } catch (err) {
      console.error("Error disconnecting bidirectionally: ", err);
    }
  };

  useEffect(() => {
    if (!id || !user || !workspace) return;
    
    // Fetch Task
    const unsubTask = onSnapshot(doc(db, "tasks", id), (docSnap) => {
      if (docSnap.exists()) {
        const t = { id: docSnap.id, ...docSnap.data() } as any;
        setTask(t);
        setDescInput(t.description || "");
      } else {
        setTask(null);
      }
      setLoading(false);
    });

    // Fetch Subtasks
    const qSub = query(collection(db, "tasks"), where("parentId", "==", id), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubSub = onSnapshot(qSub, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setSubtasks(items);
    });

    // Fetch Projects
    const qProj = query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubProj = onSnapshot(qProj, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setProjects(items);
    });

    // Fetch Categories
    const qCat = query(collection(db, "categories"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubCat = onSnapshot(qCat, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setCategories(items);
    });

    return () => { unsubTask(); unsubSub(); unsubProj(); unsubCat(); };
  }, [id, user, workspace]);

  const handleUpdate = async (field: string, value: any) => {
    if (!task) return;
    try {
      await updateDoc(doc(db, "tasks", task.id), { [field]: value });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !user || !workspace || !task) return;
    try {
      const subtaskData: any = {
        userId: user.uid,
        workspaceId: workspace.id,
        title: newSubtaskTitle.trim(),
        status: "open",
        parentId: task.id,
        createdAt: serverTimestamp()
      };
      
      if (task.projectId) subtaskData.projectId = task.projectId;
      if (task.milestoneId) subtaskData.milestoneId = task.milestoneId;

      await addDoc(collection(db, "tasks"), subtaskData);
      setNewSubtaskTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAppendSkillContent = async (text: string) => {
    if (!task) return;
    const updated = (task.description || "") + "\n\n" + text;
    await handleUpdate('description', updated);
    setDescInput(updated);
  };

  const handleOverwriteSkillContent = async (text: string) => {
    if (!task) return;
    await handleUpdate('description', text);
    setDescInput(text);
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      // Create a shallow copy for undo (excluding derived UI things)
      const taskData = { ...task };
      delete taskData.id;
      
      await deleteDoc(doc(db, "tasks", task.id));
      
      pushAction({
        id: `delete-task-${task.id}`,
        description: `Delete task "${task.title}"`,
        undo: async () => {
          await setDoc(doc(db, "tasks", task.id), taskData);
        },
        redo: async () => {
          await deleteDoc(doc(db, "tasks", task.id));
        }
      });
      
      navigate("/work/tasks");
    } catch (err) {
      console.error(err);
      // alert("Failed to delete task.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-4 text-center mt-20 text-gray-500">
        Task not found.
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 max-w-4xl mx-auto space-y-6 pb-24 flex flex-col md:flex-row gap-6"
    >
      <div className="flex-1 space-y-6">
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-4">
            <Link to="/work/tasks" className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </Link>
            <span className="text-gray-400 font-medium text-sm tracking-widest uppercase">Task Details</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsCoPilotOpen(true)}
              className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-full font-bold text-sm transition-all shadow-sm flex items-center gap-1.5"
              title="Open Certo Work Co-Pilot"
            >
              <Bot className="w-4 h-4 text-white animate-pulse" /> Certo Work Co-Pilot
            </button>
            <button 
              onClick={() => setIsSkillModalOpen(true)}
              className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-full font-bold text-sm transition-all shadow-sm flex items-center gap-1.5"
              title="Invoke Claude-like AI Skill"
            >
              <Sparkles className="w-4 h-4 text-teal-600" /> AI Skill
            </button>
            <button 
              onClick={() => setIsFocusModeOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 rounded-full font-bold text-sm transition-all shadow-sm flex items-center gap-2"
              title="Start Focus Session"
            >
              <Timer className="w-4 h-4" /> Start Focus
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete Task">
               <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 leading-snug">{task.title}</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
               <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                 {task.itemType === 'idea' ? <Lightbulb className="w-5 h-5" /> : 
                  task.itemType === 'decision' ? <Scale className="w-5 h-5" /> :
                  task.itemType === 'meeting' ? <Briefcase className="w-5 h-5" /> :
                  task.itemType === 'presentation' ? <Book className="w-5 h-5" /> :
                  task.itemType === 'routine_follow_up' ? <RefreshCw className="w-5 h-5" /> :
                  task.itemType === '2mins' ? <Zap className="w-5 h-5" /> :
                  <CheckSquare className="w-5 h-5" />}
               </div>
               <div className="flex-1 overflow-hidden relative">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Item Type</p>
                  <select 
                    value={task.itemType || "task"}
                    onChange={(e) => handleUpdate('itemType', e.target.value)}
                    className="bg-transparent border-none p-0 text-sm font-medium text-gray-900 focus:ring-0 w-full cursor-pointer"
                  >
                     <option value="task">Task</option>
                     <option value="2mins">2 Mins (Do it now)</option>
                     <option value="idea">Idea</option>
                     <option value="decision">Decision</option>
                     <option value="presentation">Presentation</option>
                     <option value="meeting">Meeting</option>
                     <option value="routine_follow_up">Routine Follow Up</option>
                  </select>
               </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
               <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Calendar className="w-5 h-5"/></div>
               <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Due Date</p>
                  <input 
                    type="date" 
                    value={task.dueDate && /^\d{4}-\d{2}-\d{2}/.test(task.dueDate) ? task.dueDate.substring(0, 10) : ""}
                    onChange={(e) => handleUpdate('dueDate', e.target.value)}
                    className="bg-transparent border-none p-0 text-sm font-medium text-gray-900 focus:ring-0 w-full"
                  />
               </div>
            </div>

                         <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Folder className="w-5 h-5"/></div>
                <div className="flex-1 font-sans">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Project</p>
                   <EntityPicker
                     entityType="project_deal"
                     selectedIds={task.projectId || ""}
                     onSelect={(id) => handleUpdate('projectId', id ? String(id) : null)}
                     workspaceId={workspace?.id || ""}
                     userId={user?.uid || ""}
                     placeholder="Select Project or Deal"
                     triggerClassName="w-full text-left font-medium text-sm text-gray-900 focus:outline-none bg-transparent"
                   />
                </div>
             </div>

             <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
                </div>
                <div className="flex-1 font-sans">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tags / Categories</p>
                   <EntityPicker
                     entityType="tag"
                     allowMultiple={true}
                     selectedIds={(task.categoryIds && Array.isArray(task.categoryIds)) ? task.categoryIds : (task.categoryId ? [task.categoryId] : [])}
                     onSelect={(ids) => handleUpdate('categoryIds', ids as string[])}
                     workspaceId={workspace?.id || ""}
                     userId={user?.uid || ""}
                     placeholder="Select Tags"
                     triggerClassName="w-full text-left font-medium text-sm text-gray-900 focus:outline-none bg-transparent"
                   />
                </div>
             </div>

             <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div className="flex-1 font-sans">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Stakeholders / Users</p>
                   <EntityPicker
                     entityType="stakeholder"
                     allowMultiple={true}
                     selectedIds={task.stakeholderIds || []}
                     onSelect={(ids) => handleUpdate('stakeholderIds', ids as string[])}
                     workspaceId={workspace?.id || ""}
                     userId={user?.uid || ""}
                     placeholder="Select Users"
                     triggerClassName="w-full text-left font-medium text-sm text-gray-900 focus:outline-none bg-transparent"
                   />
                </div>
             </div>


<div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 md:col-span-2">
               <div className="flex items-start sm:items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><RefreshCw className="w-5 h-5"/></div>
                 <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                       <div>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Routine / Cadence</p>
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => {
                               if (!task.isRoutineTask) {
                                 updateDoc(doc(db, "tasks", task.id), { 
                                   isRoutineTask: true, 
                                   recurrenceStatus: 'active',
                                   recurrenceType: 'daily',
                                   recurrenceInterval: 1,
                                   recurrenceUnit: 'days',
                                   recurrenceAnchorDate: task.dueDate || new Date().toISOString().split('T')[0],
                                   recurringSeriesId: task.id,
                                   updatedAt: serverTimestamp()
                                 });
                               } else {
                                 updateDoc(doc(db, "tasks", task.id), { 
                                   isRoutineTask: false,
                                   recurrenceStatus: deleteField(),
                                   updatedAt: serverTimestamp()
                                 });
                               }
                             }}
                             className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${task.isRoutineTask ? 'bg-indigo-600' : 'bg-gray-300'}`}
                           >
                             <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${task.isRoutineTask ? 'translate-x-4' : 'translate-x-1'}`} />
                           </button>
                           <span className="text-sm font-medium text-gray-900">{task.isRoutineTask ? 'Routine Active' : 'Not Routine'}</span>
                         </div>
                       </div>
                       
                       {task.isRoutineTask && (
                          <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm ml-auto">
                             <select
                               value={task.recurrenceType || 'daily'}
                               onChange={(e) => handleUpdate('recurrenceType', e.target.value)}
                               className="bg-transparent border-none text-sm font-bold p-0 pr-5 focus:ring-0 cursor-pointer text-gray-700 hover:text-gray-900"
                             >
                               <option value="daily">Daily</option>
                               <option value="workdays">Workdays</option>
                               <option value="weekly">Weekly</option>
                               <option value="monthly">Monthly</option>
                               <option value="quarterly">Quarterly</option>
                               <option value="custom">Custom</option>
                             </select>
                             
                             {(task.recurrenceType === 'custom') && (
                               <>
                                 <span className="text-sm font-medium text-gray-500">Every</span>
                                 <input 
                                   type="number"
                                   min="1"
                                   value={task.recurrenceInterval || 1}
                                   onChange={(e) => handleUpdate('recurrenceInterval', parseInt(e.target.value) || 1)}
                                   className="w-10 p-0 text-center border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 text-sm font-bold"
                                 />
                                 <select
                                   value={task.recurrenceUnit || 'days'}
                                   onChange={(e) => handleUpdate('recurrenceUnit', e.target.value)}
                                   className="bg-transparent border-none text-sm font-bold p-0 pr-5 focus:ring-0 cursor-pointer text-gray-700 hover:text-gray-900"
                                 >
                                   <option value="days">Days</option>
                                   <option value="weeks">Weeks</option>
                                   <option value="months">Months</option>
                                 </select>
                               </>
                             )}

                             <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                             
                             <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Anchor</span>
                               <input 
                                 type="date"
                                 value={task.recurrenceAnchorDate || ""}
                                 onChange={(e) => handleUpdate('recurrenceAnchorDate', e.target.value)}
                                 className="bg-transparent border-none p-0 text-[10px] font-bold text-indigo-600 focus:ring-0 leading-none"
                               />
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
               </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
               <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5" />
               </div>
               <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Context (GTD)</p>
                  <select 
                    value={task.gtdContext || ""}
                    onChange={(e) => handleUpdate('gtdContext', e.target.value)}
                    className="bg-transparent border-none p-0 text-sm font-medium text-gray-900 focus:ring-0 w-full"
                  >
                    <option value="">No Context</option>
                    <option value="@home">@Home</option>
                    <option value="@office">@Office</option>
                    <option value="@computer">@Computer</option>
                    <option value="@errands">@Errands</option>
                    <option value="@phone">@Phone</option>
                    <option value="@waiting">@Waiting</option>
                  </select>
               </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><AlignLeft className="w-5 h-5"/></div>
                 <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</p>
                    <p className="text-sm font-medium text-gray-900">{task.description ? 'Added' : 'Empty'}</p>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={() => setIsSkillModalOpen(true)} className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-teal-100 transition-colors">
                   <Sparkles className="w-3.5 h-3.5" /> AI Skill
                 </button>
                 <button onClick={() => setIsEditingDesc(!isEditingDesc)} className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg">Edit</button>
               </div>
            </div>
          </div>

          {isEditingDesc && (
             <div className="animate-in fade-in slide-in-from-top-2 border border-purple-200 bg-white rounded-xl p-2 shadow-inner">
                <textarea 
                  value={descInput}
                  onChange={e => setDescInput(e.target.value)}
                  placeholder="Add detailed task description here... Type /ai to ask the assistant to draft something."
                  className="w-full bg-transparent border-none p-3 text-sm min-h-[150px] focus:ring-0 resize-none font-mono text-gray-800"
                />
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-2 bg-purple-50 rounded-lg gap-3">
                   <div className="flex-1 flex gap-2 w-full">
                     <input 
                       id="ai-prompt-input"
                       type="text" 
                       placeholder="✨ Ask AI to draft or rewrite..."
                       className="flex-1 text-sm bg-white border border-purple-100 focus:ring-purple-500 focus:border-purple-500 rounded-lg px-3 py-1.5 shadow-sm"
                       onKeyDown={async (e) => {
                         if (e.key === 'Enter') {
                           e.preventDefault();
                           const target = e.currentTarget;
                           const promptText = target.value;
                           if (!promptText.trim()) return;
                           target.disabled = true;
                           target.value = "Thinking...";
                           try {
                             const result = await performAITask(
                               promptText, 
                               `Task Title: ${task.title}\nCurrent Description: ${descInput}`
                             );
                             if (result) {
                               setDescInput(prev => prev + (prev.trim() ? '\n\n' : '') + result);
                             }
                           } catch (err) {
                             console.error(err);
                           } finally {
                             target.disabled = false;
                             target.value = "";
                             target.focus();
                           }
                         }
                       }}
                     />
                   </div>
                   <div className="flex gap-2 shrink-0 w-full md:w-auto justify-end">
                     <button type="button" onClick={() => setIsEditingDesc(false)} className="px-4 py-2 text-sm font-medium text-purple-800 hover:bg-purple-100 rounded-lg transition-colors">Cancel</button>
                     <button type="button" onClick={() => { handleUpdate('description', descInput); setIsEditingDesc(false); }} className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition-colors">Save</button>
                   </div>
                </div>
             </div>
          )}

          {!isEditingDesc && task.description && (
             <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
               {task.description}
             </div>
          )}

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
              Subtasks
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{subtasks.length}</span>
            </h3>
            <div className="space-y-2">
              {subtasks.map(sub => (
                 <div key={sub.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
                   <CornerDownRight className="w-4 h-4 text-gray-400 shrink-0" />
                   <input 
                     type="checkbox" 
                     checked={sub.status === 'done'}
                     onChange={() => toggleTaskStatus(sub)}
                     className="w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
                   />
                   <span className={`text-sm flex-1 ${sub.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{sub.title}</span>
                 </div>
              ))}
              <form onSubmit={handleAddSubtask} className="flex gap-2">
                 <input 
                   type="text" 
                   value={newSubtaskTitle}
                   onChange={e => setNewSubtaskTitle(e.target.value)}
                   placeholder="Add new subtask..."
                   className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-black focus:border-black shadow-sm"
                 />
                 <button type="submit" disabled={!newSubtaskTitle.trim()} className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 rounded-xl transition-colors disabled:opacity-50">
                    <Plus className="w-5 h-5"/>
                 </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full md:w-80 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex gap-2 items-center">
             <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md ${task.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{task.status}</span>
             {task.isOneThing && <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold uppercase tracking-widest">ONE THING</span>}
             {task.isMilestone && <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3"/> MILESTONE</span>}
          </div>

          <button 
            onClick={() => toggleTaskStatus(task)}
            className={`w-full py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${task.status === 'done' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            <CheckCircle className="w-5 h-5" /> 
            {task.status === 'done' ? 'Reopen Task' : 'Mark as Done'}
          </button>

          <button 
            onClick={() => handleUpdate('isMilestone', !task.isMilestone)}
            className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors border ${task.isMilestone ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            <Target className="w-4 h-4" /> 
            {task.isMilestone ? 'Remove Milestone' : 'Make Milestone'}
          </button>
          
          {task.source && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2">Source Context</h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">{task.source}</p>
            </div>
          )}

          {task.reason && (
            <div className="pt-4">
              <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2">Why this matters</h3>
              <p className="text-sm text-gray-700 bg-amber-50 p-4 rounded-xl border border-amber-100/50">{task.reason}</p>
            </div>
          )}

          {/* Notion/Loop Style Connection Manager for Task details */}
          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase flex items-center gap-2">
                <LucideLink className="w-4 h-4 text-gray-400" /> Linked Knowledge
              </h3>
              <button
                type="button"
                onClick={() => setIsLinkingDoc(!isLinkingDoc)}
                className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3 h-3" /> Link Doc
              </button>
            </div>

            {isLinkingDoc && (
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 space-y-3 mb-4">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search documents and SOPs..."
                    className="w-full text-xs pl-8 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {loadingDocSearch ? (
                    <div className="text-[10px] text-gray-400 py-1 text-center">Searching docs...</div>
                  ) : docSearchResult.length > 0 ? (
                    docSearchResult.map((docItem) => (
                      <button
                        type="button"
                        key={docItem.id}
                        onClick={() => handleConnectDoc(docItem.id, docItem.title)}
                        className="w-full text-left p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-xs font-medium text-gray-700 hover:text-indigo-600 transition-all flex items-center justify-between border border-transparent hover:border-gray-100"
                      >
                        <span className="truncate mr-2 text-[11px]">{docItem.title}</span>
                        <Plus className="w-3 h-3 text-indigo-500 shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="text-[10px] text-gray-400 py-1 text-center">No documents found</div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {task.linkedDocs && task.linkedDocs.length > 0 ? (
                task.linkedDocs.map((docItem: any) => (
                  <div
                    key={docItem.id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-xl transition-all"
                  >
                    <div
                      onClick={() => navigate(`/work/documents/${docItem.id}`)}
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                    >
                      <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-[11px] font-medium text-gray-700 truncate hover:text-indigo-600 transition-colors">
                        {docItem.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDisconnectDoc(docItem.id)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Unlink document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-gray-400 italic text-center py-4 border border-dashed border-gray-100 rounded-2xl">
                  No linked documents.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FocusModeModal
        isOpen={isFocusModeOpen}
        onClose={() => setIsFocusModeOpen(false)}
        selectedTaskIds={[task.id]}
        tasks={[task]}
      />

      <InvokeSkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        itemTitle={task.title}
        itemContent={task.description || ""}
        itemType="task"
        onAppendContent={handleAppendSkillContent}
        onOverwriteContent={handleOverwriteSkillContent}
      />

      <BoldiCoPilotModal
        isOpen={isCoPilotOpen}
        onClose={() => setIsCoPilotOpen(false)}
        itemId={task.id}
        itemTitle={task.title}
        itemDescription={task.description || ""}
        itemType="task"
      />
    </motion.div>
  );
}
