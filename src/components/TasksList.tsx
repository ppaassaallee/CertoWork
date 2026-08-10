import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../lib/AuthContext";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc, setDoc, deleteField } from "firebase/firestore";
import { db } from "../lib/firebase";
import { setTaskStatus } from "../lib/tasks";
import { CheckSquare, ArrowLeft, Plus, Loader2, Tag, Repeat, Zap, X, Kanban, ChevronDown, ChevronRight, ChevronLeft, Search, Lightbulb, Scale, Book, Briefcase, Calendar, Inbox, RefreshCw, Timer, Users, Brain, ArrowUp, ArrowDown, SlidersHorizontal, Sparkles, Eye, MoreHorizontal, Sliders, Star, Trash2, Bot } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUndo } from "../lib/UndoContext";
import { TagsManager } from "./TagsManager";
import { StakeholdersManager } from "./StakeholdersManager";
import { FocusModeModal } from "./FocusModeModal";
import { ClarityResetTrigger } from "./ClarityResetTrigger";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { EntityPicker } from "./EntityPicker";
import { NotebookPlanner } from "./NotebookPlanner";
import { MetadataAuditor } from "./MetadataAuditor";
import { ReviewCandidateCard } from "./ReviewCandidateCard";
import { BoldiCoPilotModal } from "./BoldiCoPilotModal";

export function TasksList({ hideCockpit = false, projectId: filterProjectId }: { hideCockpit?: boolean, projectId?: string } = {}) {
  const { user, workspace } = useAuth();
  const { pushAction } = useUndo();
  const navigate = useNavigate();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState<string>("");
  const [tasks, setTasks] = useState<{id: string, title: string, status: string, itemType?: string, description?: string, categoryId?: string, categoryIds?: string[], stakeholderIds?: string[], isOneThing?: boolean, recurrence?: string, parentId?: string, projectId?: string, stageId?: string, previousStageId?: string, globalStageId?: string, priority?: number, gtdContext?: string, dueDate?: string, isRoutineTask?: boolean, recurrenceType?: string, recurrenceInterval?: number, recurrenceUnit?: string, recurrenceAnchorDate?: string, occurrenceDate?: string, recurrenceStatus?: string, recurringSeriesId?: string, nextOccurrenceAt?: any, position?: number}[]>([]);
  const [reviewCandidates, setReviewCandidates] = useState<any[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [stakeholders, setStakeholders] = useState<{id: string, name: string}[]>([]);
  
  const [pipelineStages, setPipelineStages] = useState<{id: string, name: string}[]>([
    { id: 'capture', name: 'Capture' },
    { id: 'categorization', name: 'Categorization' },
    { id: 'backlog', name: 'On Backlog' },
    { id: 'blocked', name: 'Blocked' },
    { id: 'done', name: 'Done' }
  ]);
  const [loading, setLoading] = useState(true);
  
  const [isSelectionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [coPilotTask, setCoPilotTask] = useState<any | null>(null);
  
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newItemType, setNewItemType] = useState("task");
  const [newTaskPriority, setNewTaskPriority] = useState<number>(4);
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>("");
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>(filterProjectId || "");
  const [newTaskCategoryIds, setNewTaskCategoryIds] = useState<string[]>([]);
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<string>("");
  const [newTaskGlobalStageId, setNewTaskGlobalStageId] = useState<string>("");
  const [newTaskGtdContext, setNewTaskGtdContext] = useState<string>("");
  const [newTaskIsOneThing, setNewTaskIsOneThing] = useState<boolean>(false);
  const [newTaskStakeholderIds, setNewTaskStakeholderIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  
  const [projectFilterMode, setProjectFilterMode] = useState<"all" | "standalone" | "projects">(() => localStorage.getItem('ab_projectFilterMode') as any || "all");
  useEffect(() => localStorage.setItem('ab_projectFilterMode', projectFilterMode), [projectFilterMode]);

  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedStakeholders, setSelectedStakeholders] = useState<Set<string>>(new Set());
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isStakeholderModalOpen, setIsStakeholderModalOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [isEditingStages, setIsEditingStages] = useState(false);
  const [editingStagesInput, setEditingStagesInput] = useState("");
  const [isTagsManagerOpen, setIsTagsManagerOpen] = useState(false);
  const [activeStakeholderTaskId, setActiveStakeholderTaskId] = useState<string | null>(null);
  const [isAutoOrganizing, setIsAutoOrganizing] = useState(false);
  const [showOrganizeDialog, setShowOrganizeDialog] = useState(false);
  const [organizeResults, setOrganizeResults] = useState<any>(null);
  const [approvedUpdates, setApprovedUpdates] = useState<Record<string, boolean>>({});
  const [approvedMerges, setApprovedMerges] = useState<Record<string, boolean>>({});
  const [organizeUndoBackup, setOrganizeUndoBackup] = useState<any[]>([]);
  
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  
  const [showDone, setShowDone] = useState(() => localStorage.getItem('ab_showDone') === 'true');
  useEffect(() => localStorage.setItem('ab_showDone', String(showDone)), [showDone]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [currentView, setCurrentView] = useState(() => localStorage.getItem('ab_currentView') || "kanban");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    // Start week on Monday
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  useEffect(() => localStorage.setItem('ab_currentView', currentView), [currentView]);

  const [cardSize, setCardSize] = useState<"small" | "standard" | "large">(() => localStorage.getItem('ab_cardSize') as any || "standard");
  useEffect(() => localStorage.setItem('ab_cardSize', cardSize), [cardSize]);

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const [groupBy, setGroupBy] = useState<"none" | "priority" | "category" | "project" | "status" | "itemType" | "gtd" | "stage" | "timeSector" | "stakeholder">(() => localStorage.getItem('ab_groupBy') as any || "none");
  const [activeFolder, setActiveFolder] = useState(() => localStorage.getItem('ab_activeFolder') || "all");
  const [activeContext, setActiveContext] = useState(() => localStorage.getItem('ab_activeContext') || "all");
  
  useEffect(() => localStorage.setItem('ab_groupBy', groupBy), [groupBy]);
  useEffect(() => localStorage.setItem('ab_activeFolder', activeFolder), [activeFolder]);
  useEffect(() => localStorage.setItem('ab_activeContext', activeContext), [activeContext]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // UI state toggles
  const [activeMode, setActiveMode] = useState<"focus" | "full">(() => {
    if (hideCockpit) return "full";
    const saved = localStorage.getItem('ab_activeMode');
    if (saved === 'focus' || saved === 'full') return saved;
    // Mobile defaults to focus, desktop to focus first time
    return 'focus';
  });
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const [isMoreTabsOpen, setIsMoreTabsOpen] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(() => localStorage.getItem('ab_filtersCollapsed') === 'true');
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState(false);

  useEffect(() => {
    localStorage.setItem('ab_activeMode', activeMode);
  }, [activeMode]);

  useEffect(() => {
    localStorage.setItem('ab_filtersCollapsed', String(isFiltersCollapsed));
  }, [isFiltersCollapsed]);

  // Sync preferences with Firestore user_action_board_preferences
  useEffect(() => {
    if (!user || !workspace) return;
    const prefDocRef = doc(db, "user_action_board_preferences", `${user.uid}_${workspace.id}`);
    const unsub = onSnapshot(prefDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.defaultMode && (data.defaultMode === "focus" || data.defaultMode === "full")) {
          setActiveMode(data.defaultMode);
        }
        if (data.view) {
          const viewVal = data.view === "notes" ? "notebook" : data.view === "board" ? "kanban" : data.view;
          setCurrentView(viewVal);
        }
        if (data.density) {
          const sizeVal = data.density === "compact" ? "small" : data.density === "spacious" ? "large" : "standard";
          setCardSize(sizeVal);
        }
        if (data.grouping) {
          setGroupBy(data.grouping as any);
        }
        if (data.filtersCollapsed !== undefined) {
          setIsFiltersCollapsed(data.filtersCollapsed);
        }
        if (data.lastActiveTab) {
          setActiveFolder(data.lastActiveTab);
        }
      }
    });
    return () => unsub();
  }, [user, workspace]);

  const updatePreference = async (updates: any) => {
    if (!user || !workspace) return;
    const prefDocRef = doc(db, "user_action_board_preferences", `${user.uid}_${workspace.id}`);
    try {
      await setDoc(prefDocRef, {
        userId: user.uid,
        workspaceId: workspace.id,
        updatedAt: serverTimestamp(),
        ...updates
      }, { merge: true });
    } catch (err) {
      console.error("Failed to save preferences to Firestore:", err);
    }
  };

  // Two-level sorting states
  const [sortLevel1, setSortLevel1] = useState<"priority" | "tag" | "dueDate" | "title" | "position" | "createdAt">(() => localStorage.getItem('ab_sortLevel1') as any || "priority");
  const [sortLevel1Dir, setSortLevel1Dir] = useState<"asc" | "desc">(() => localStorage.getItem('ab_sortLevel1Dir') as any || "asc");
  const [sortLevel2, setSortLevel2] = useState<"priority" | "tag" | "dueDate" | "title" | "position" | "createdAt">(() => localStorage.getItem('ab_sortLevel2') as any || "position");
  const [sortLevel2Dir, setSortLevel2Dir] = useState<"asc" | "desc">(() => localStorage.getItem('ab_sortLevel2Dir') as any || "asc");
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('ab_sortLevel1', sortLevel1);
  }, [sortLevel1]);
  useEffect(() => {
    localStorage.setItem('ab_sortLevel1Dir', sortLevel1Dir);
  }, [sortLevel1Dir]);
  useEffect(() => {
    localStorage.setItem('ab_sortLevel2', sortLevel2);
  }, [sortLevel2]);
  useEffect(() => {
    localStorage.setItem('ab_sortLevel2Dir', sortLevel2Dir);
  }, [sortLevel2Dir]);

  const GTD_FOLDERS = [
    { id: 'all', name: 'All Items' },
    { id: 'next', name: 'Next Actions' },
    { id: '2mins', name: '2 Mins (Do it now)' },
    { id: 'waiting', name: 'Waiting For' },
    { id: 'someday', name: 'Someday / Maybe' }
  ];

  const getNormalizedFolderId = (folderId: string | undefined | null): string => {
    if (!folderId) return "next";
    const f = folderId.toLowerCase();
    if (f === "next_action" || f === "next_actions" || f === "next") return "next";
    if (f === "waiting_for" || f === "waiting") return "waiting";
    if (f === "someday_maybe" || f === "someday") return "someday";
    if (f === "2mins") return "2mins";
    return "next";
  };

  const getNormalizedPriority = (priority: any): number | null => {
    if (priority === undefined || priority === null || priority === "") return null;
    if (typeof priority === 'number') {
      if (priority >= 1 && priority <= 4) return priority;
      return null;
    }
    if (typeof priority === 'string') {
      const clean = priority.toUpperCase().replace('P', '').trim();
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num >= 1 && num <= 4) return num;
    }
    return null;
  };


  const GTD_CONTEXTS = ['@computer', '@home', '@office', '@calls', '@anywhere'];
  const TIME_SECTORS = [
    { id: 'Today', name: 'Today' },
    { id: 'This Week', name: 'This Week' },
    { id: 'Next Week', name: 'Next Week' },
    { id: 'This Month', name: 'This Month' },
    { id: 'Next Month', name: 'Next Month' },
    { id: 'Later', name: 'Later' },
    { id: 'none', name: 'Inbox / Unsorted' }
  ];

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
       const next = new Set(prev);
       if(next.has(taskId)) next.delete(taskId);
       else next.add(taskId);
       return next;
    });
  };

  const changeWeek = (offset: number) => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + (offset * 7));
    setCurrentWeekStart(next);
  };

  const getTodayWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
       const next = new Set(prev);
       if(next.has(groupKey)) next.delete(groupKey);
       else next.add(groupKey);
       return next;
    });
  };

  const renderTaskCard = (task: any, options: { showExpand?: boolean, forceSmall?: boolean, itemsInGroup?: any[] } = {}) => {
    const subtasks = tasks.filter(t => t.parentId === task.id);
    const isExpanded = expandedTasks.has(task.id);
    const displaySize = options.forceSmall ? 'small' : cardSize;
    
    return (
      <div 
        key={task.id} 
        className={`bg-white rounded-2xl shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors group relative
          ${displaySize === 'small' ? 'p-3' : displaySize === 'large' ? 'p-6' : 'p-4'}
        `}
        onDoubleClick={() => {
          navigate(`/work/action-board/${task.id}`);
        }}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("taskId", task.id);
        }}
        onDragOver={(e) => {
          if (options.itemsInGroup) {
            e.preventDefault();
          }
        }}
        onDrop={async (e) => {
          if (options.itemsInGroup) {
            e.preventDefault();
            e.stopPropagation();
            const draggedId = e.dataTransfer.getData("taskId");
            if (draggedId && draggedId !== task.id) {
              await handleTaskDropOnTask(draggedId, task.id, options.itemsInGroup);
            }
          }
        }}
      >
        {/* Custom Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
           <p className="font-bold mb-1">{task.title}</p>
           <p className="text-gray-400">Status: {task.status}</p>
           {task.priority && <p className="text-gray-400">Priority: P{task.priority}</p>}
           {task.gtdContext && <p className="text-gray-400">Context: {task.gtdContext}</p>}
           {subtasks.length > 0 && <p className="text-gray-400 mt-1">{subtasks.length} subtasks</p>}
           <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
        
        <div className="flex justify-between items-start">
          <div className="flex-1 flex gap-2 pr-2">
            {isSelectionMode && (
              <input
                type="checkbox"
                checked={selectedTasks.has(task.id)}
                onChange={(e) => {
                  const next = new Set(selectedTasks);
                  if (e.target.checked) next.add(task.id);
                  else next.delete(task.id);
                  setSelectedTasks(next);
                }}
                className="mt-1 w-4 h-4 rounded border-indigo-300 text-indigo-600 bg-indigo-50 cursor-pointer shrink-0"
              />
            )}
            <input 
              type="checkbox" 
              checked={task.status === "done" || (task.stageId === "done")}
              onChange={(e) => {
                const isDone = e.target.checked;
                handleChangeStage(task.id, isDone ? "done" : (task.previousStageId || pipelineStages[0]?.id || "capture"));
             }}
             className="mt-1 w-4 h-4 rounded border-gray-300 accent-black cursor-pointer shrink-0" 
           />
            <div>
              {editingTaskId === task.id ? (
                <input
                  type="text"
                  value={editingTitleText}
                  onChange={(e) => setEditingTitleText(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (editingTitleText.trim() && editingTitleText.trim() !== task.title) {
                        try {
                          await updateDoc(doc(db, "tasks", task.id), { title: editingTitleText.trim() });
                        } catch (err) {
                          console.error("Failed to update task title", err);
                        }
                      }
                      setEditingTaskId(null);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingTaskId(null);
                    }
                  }}
                  onBlur={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (editingTitleText.trim() && editingTitleText.trim() !== task.title) {
                      try {
                        await updateDoc(doc(db, "tasks", task.id), { title: editingTitleText.trim() });
                      } catch (err) {
                        console.error("Failed to update task title", err);
                      }
                    }
                    setEditingTaskId(null);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  autoFocus
                  className="text-sm font-medium leading-snug px-2 py-1 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 w-full"
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingTaskId(task.id);
                      setEditingTitleText(task.title);
                    }}
                    className={`text-sm font-medium leading-snug hover:underline cursor-pointer ${task.status === 'done' || task.stageId === "done" ? 'text-gray-400 line-through' : 'text-gray-900'} ${displaySize === 'small' ? 'line-clamp-1' : ''}`}
                  >
                    {task.title}
                  </span>
                  {task.itemType && task.itemType !== 'task' && (
                    <span className="bg-gray-200 text-gray-700 text-[10px] pl-1 pr-1.5 py-0.5 rounded-full capitalize leading-none no-underline flex items-center">
                      {task.itemType === 'idea' && <Lightbulb className="w-3 h-3 inline-block mr-1 text-amber-500" />}
                      {task.itemType === 'decision' && <Scale className="w-3 h-3 inline-block mr-1 text-blue-500" />}
                      {task.itemType === 'meeting' && <Briefcase className="w-3 h-3 inline-block mr-1 text-purple-500" />}
                      {task.itemType === 'presentation' && <Book className="w-3 h-3 inline-block mr-1 text-rose-500" />}
                      {task.itemType === 'routine_follow_up' && <RefreshCw className="w-3 h-3 inline-block mr-1 text-teal-500" />}
                      {task.itemType === '2mins' && <Zap className="w-3 h-3 inline-block mr-1 text-yellow-500" />}
                      {task.itemType === '2mins' ? '2 Mins' : task.itemType === 'routine_follow_up' ? 'Routine Follow Up' : task.itemType}
                    </span>
                  )}
                  {task.isRoutineTask && (
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 no-underline">
                      <RefreshCw className="w-2.5 h-2.5" /> Routine
                    </span>
                  )}
                </div>
              )}
              {options.showExpand !== false && (
                <button onClick={() => toggleExpand(task.id)} className="text-[10px] text-gray-400 font-bold flex items-center gap-1 hover:text-black mt-1">
                   {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                   {subtasks.length} Subtasks
                </button>
              )}
          </div>
        </div>
      </div>

      {/* Action Board Quick-Action Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-b border-gray-100/70 py-1.5 px-1 bg-gray-50/40 rounded-xl">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCoPilotTask(task);
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/50 rounded-lg text-[10px] font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs group/boldi shrink-0"
            title="Ask Certo Work: Research or draft email"
          >
            <Bot className="w-3 h-3 text-emerald-600 animate-pulse group-hover/boldi:rotate-12 transition-transform" /> 
            <span>Ask Certo Work</span>
          </button>

          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedTasks(new Set([task.id]));
              setIsFocusModeOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg text-[10px] font-bold transition-all shrink-0"
            title="Start Focus Timer"
          >
            <Timer className="w-3 h-3 text-indigo-500" />
            <span>Focus</span>
          </button>

          {options.showExpand !== false && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleExpand(task.id);
              }}
              className="flex items-center gap-1 px-2 py-1 text-gray-550 hover:text-black hover:bg-gray-100 rounded-lg text-[10px] font-bold transition-all shrink-0"
              title="Manage Subtasks"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
              <span>{subtasks.length} Subtasks</span>
            </button>
          )}

          {options.itemsInGroup && options.itemsInGroup.length > 1 && (
            <div className="flex items-center gap-0.5 border-l border-gray-200/60 pl-1.5">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  moveTaskInList(task.id, "up", options.itemsInGroup!);
                }}
                disabled={options.itemsInGroup.findIndex(t => t.id === task.id) === 0}
                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all disabled:opacity-20"
                title="Move Up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  moveTaskInList(task.id, "down", options.itemsInGroup!);
                }}
                disabled={options.itemsInGroup.findIndex(t => t.id === task.id) === options.itemsInGroup.length - 1}
                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all disabled:opacity-20"
                title="Move Down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          )}

          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteTask(task);
            }}
            className="ml-auto p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Delete Task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
         
        {displaySize !== 'small' && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 flex-wrap">
            <div className="relative group/icon" title="Priority">
                {getNormalizedPriority(task.priority) === null ? (
                    <div className="flex items-center justify-center px-1.5 h-6 rounded-md font-bold text-[9px] text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer relative">
                        Sin prioridad
                        <select 
                            value="" 
                            onChange={(e) => handleUpdatePriority(task.id, e.target.value === "" ? null : parseInt(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        >
                            <option value="">Sin prioridad</option>
                            <option value={1}>P1</option>
                            <option value={2}>P2</option>
                            <option value={3}>P3</option>
                            <option value={4}>P4</option>
                        </select>
                    </div>
                ) : (
                    <div className={`flex items-center justify-center w-6 h-6 rounded-md font-bold text-[10px] text-white cursor-pointer relative
                        ${getNormalizedPriority(task.priority) === 1 ? 'bg-red-500' : getNormalizedPriority(task.priority) === 2 ? 'bg-orange-500' : getNormalizedPriority(task.priority) === 3 ? 'bg-amber-500' : 'bg-gray-400'}
                    `}>
                        P{getNormalizedPriority(task.priority)}
                        <select 
                            value={getNormalizedPriority(task.priority) || ""} 
                            onChange={(e) => handleUpdatePriority(task.id, e.target.value === "" ? null : parseInt(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        >
                            <option value="">Sin prioridad</option>
                            <option value={1}>P1</option>
                            <option value={2}>P2</option>
                            <option value={3}>P3</option>
                            <option value={4}>P4</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="relative group/icon" title="Pipeline Stage">
                <div className="text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5 border-none focus:ring-0 cursor-pointer max-w-[80px] truncate relative h-6 flex items-center text-center">
                    {pipelineStages.find(s => s.id === task.stageId)?.name || pipelineStages[0]?.name}
                    <select
                        value={task.stageId || pipelineStages[0]?.id || "capture"}
                        onChange={(e) => handleChangeStage(task.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                        {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {getCategoryIds(task).length > 0 && (
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                {categories.find(c => c.id === getCategoryIds(task)[0])?.name}
                {getCategoryIds(task).length > 1 && ` +${getCategoryIds(task).length - 1}`}
              </span>
            )}
            {task.projectId && (
              <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase max-w-[100px] truncate">
                {projects.find(p => p.id === task.projectId)?.name || 'PROJECT'}
              </span>
            )}
            {task.dueDate && (
               <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                 <Calendar className="w-2.5 h-2.5" />
                 {new Date(task.dueDate + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})}
               </span>
            )}
            <button 
              onClick={(e) => {
                e.preventDefault();
                handleSetOneThing(task.id, !!task.isOneThing);
              }}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase transition-colors flex items-center gap-1 border ${task.isOneThing ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-transparent'}`}
            >
              {task.isOneThing ? '★ ONE THING' : 'MAKE ONE THING'}
            </button>
            {task.recurrence && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5"><Repeat className="w-2 h-2"/> {task.recurrence}</span>}
            
            <div className="flex -space-x-1 overflow-hidden" title="Stakeholders">
               {task.stakeholderIds?.map((sid: string) => {
                 const s = stakeholders.find(st => st.id === sid);
                 if (!s) return null;
                 return (
                   <div key={sid} className="inline-block h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 border-2 border-white flex items-center justify-center text-[10px] font-bold shrink-0 uppercase" title={s.name}>
                     {s.name.slice(0, 1)}
                   </div>
                 );
               })}
               <button 
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setActiveStakeholderTaskId(task.id);
                 }}
                 className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 border-2 border-white text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors shrink-0"
               >
                 <Plus className="w-3 h-3" />
               </button>
            </div>

            <Link to={`/work/action-board/${task.id}`} className="ml-auto text-[10px] font-bold bg-gray-50 text-gray-500 hover:text-black hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors">Detail</Link>
          </div>
        )}

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
             {subtasks.length > 0 && (
               <div className="space-y-2">
                 {subtasks.map(st => (
                    <div key={st.id} className="flex items-center gap-2 group/sub">
                       <input 
                         type="checkbox"
                         checked={st.status === 'done' || st.stageId === 'done'}
                         onChange={(e) => {
                           const isDone = e.target.checked;
                           handleChangeStage(st.id, isDone ? 'done' : 'capture');
                         }}
                         className="w-3.5 h-3.5 rounded border-gray-300 accent-black cursor-pointer"
                       />
                       <span className={`text-xs flex-1 ${st.status === 'done' || st.stageId === 'done' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{st.title}</span>
                    </div>
                 ))}
               </div>
             )}
             
             <form 
               onSubmit={async (e) => {
                 e.preventDefault();
                 const input = e.currentTarget.elements.namedItem('subtaskTitle') as HTMLInputElement;
                 const title = input.value.trim();
                 if (!title || !user || !workspace) return;
                 
                 try {
                   const subtaskData: any = {
                     userId: user.uid,
                     workspaceId: workspace.id,
                     title,
                     status: "open",
                     parentId: task.id,
                     createdAt: serverTimestamp()
                   };
                   
                   if (task.projectId) subtaskData.projectId = task.projectId;
                   if (task.milestoneId) subtaskData.milestoneId = task.milestoneId;

                   await addDoc(collection(db, "tasks"), subtaskData);
                   input.value = "";
                 } catch (err) {
                   console.error("Failed to add subtask", err);
                 }
               }}
               className="flex gap-2"
             >
               <input 
                 name="subtaskTitle"
                 type="text"
                 placeholder="Quick add subtask..."
                 className="flex-1 bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-black"
               />
               <button type="submit" className="text-gray-400 hover:text-black">
                 <Plus className="w-4 h-4" />
               </button>
             </form>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!user || !workspace) return;
    
    // Fetch Projects
    const qProjects = query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const items: {id: string, name: string}[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, name: doc.data().title || doc.data().name || "Untitled Project" } as any);
      });
      setProjects(items);
    });

    // Fetch Tasks
    const qTasks = filterProjectId
      ? query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("projectId", "==", filterProjectId))
      : query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const items: {id: string, title: string, status: string, categoryId?: string, isOneThing?: boolean}[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as any);
      });
      items.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return 0; // maintain relative order for now
      });
      setTasks(items);
    }, (error) => console.error('Tasks error:', error.message));

    // Fetch Review Candidates
    const qReview = query(collection(db, "review_candidates"), where("userId", "==", user.uid));
    const unsubReview = onSnapshot(qReview, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() } as any;
        if (item.status !== "killed" && item.status !== "approved" && item.status !== "archived") {
           items.push(item);
        }
      });
      setReviewCandidates(items);
      setLoading(false);
    }, (error) => console.error('Review Candidates error:', error.message));

    // Fetch Categories
    const qCategories = query(collection(db, "categories"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const items: {id: string, name: string}[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as any);
      });
      setCategories(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "categories"));

    // Fetch Stakeholders
    const qStakeholders = query(collection(db, "stakeholders"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubStakeholders = onSnapshot(qStakeholders, (snapshot) => {
      const items: {id: string, name: string}[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, name: doc.data().name || "Untitled Stakeholder" });
      });
      setStakeholders(items.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "stakeholders"));

    // Fetch User Settings
    const unsubSettings = onSnapshot(doc(db, "userSettings", user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.data().pipelineStages) {
        setPipelineStages(docSnap.data().pipelineStages);
      }
    }, (error) => console.error('UserSettings error:', error.message));

    return () => {
      unsubProjects();
      unsubTasks();
      unsubReview();
      unsubCategories();
      unsubStakeholders();
      unsubSettings();
    };
  }, [user, workspace]);



  const handleSetOneThing = async (id: string, currentlyOneThing: boolean) => {
    try {
      if (!currentlyOneThing) {
        // Only unset One Thing from other OPEN tasks to preserve history
        const previousOneThings = tasks.filter(t => t.isOneThing && t.id !== id && t.status !== 'done');
        for (const pt of previousOneThings) {
          await updateDoc(doc(db, "tasks", pt.id), { isOneThing: false });
        }
      }
      await updateDoc(doc(db, "tasks", id), { 
        isOneThing: !currentlyOneThing 
      });
    } catch(e) {
      console.error("Failed to set one thing", e);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user) return;
    setIsAdding(true);
    try {
      const taskData: any = {
        userId: user.uid,
        workspaceId: workspace?.id || user.uid,
        title: newTaskTitle.trim(),
        itemType: newItemType,
        status: "open",
        globalStageId: newTaskGlobalStageId || (newItemType === '2mins' ? '2mins' : 'next'),
        priority: newTaskPriority,
        createdBy: user.uid,
        sourceType: "manual",
        source: "Manual entry",
        createdAt: serverTimestamp()
      };
      
      if (newTaskGtdContext) taskData.gtdContext = newTaskGtdContext;
      if (newTaskDueDate) taskData.dueDate = newTaskDueDate;
      if (newTaskProjectId) taskData.projectId = newTaskProjectId;
      if (newTaskCategoryIds.length > 0) taskData.categoryIds = newTaskCategoryIds;
      else if (selectedCategories.size === 1) taskData.categoryIds = [Array.from(selectedCategories)[0]];
      if (newTaskStakeholderIds.length > 0) taskData.stakeholderIds = newTaskStakeholderIds;
      else if (selectedStakeholders.size > 0 && !selectedStakeholders.has('none')) taskData.stakeholderIds = Array.from(selectedStakeholders);
      if (newTaskRecurrence) taskData.recurrence = newTaskRecurrence;
      if (newTaskIsOneThing) taskData.isOneThing = true;

      await addDoc(collection(db, "tasks"), taskData);
      
      // Also potentially clear one thing from others if we set it
      if (newTaskIsOneThing) {
        const previousOneThings = tasks.filter(t => t.isOneThing);
        for (const pt of previousOneThings) {
          await updateDoc(doc(db, "tasks", pt.id), { isOneThing: false });
        }
      }

      setNewTaskTitle("");
      setNewItemType("task");
      setNewTaskPriority(4);
      setNewTaskDueDate("");
      setNewTaskProjectId(filterProjectId || "");
      setNewTaskCategoryIds([]);
      setNewTaskStakeholderIds([]);
      setNewTaskRecurrence("");
      setNewTaskGlobalStageId("");
      setNewTaskGtdContext("");
      setNewTaskIsOneThing(false);
    } catch (err) {
      console.error("Failed to add task", err);
    } finally {
      setIsAdding(false);
    }
  };

  async function handleUpdatePriority(id: string, newPriority: number | null) {
    try {
       await updateDoc(doc(db, "tasks", id), { priority: newPriority === null ? deleteField() : newPriority });
    } catch (err) {
       console.error("Failed to update priority", err);
    }
  }

  const moveTaskInList = async (taskId: string, direction: "up" | "down", itemsInGroup: any[]) => {
    const idx = itemsInGroup.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= itemsInGroup.length) return;
    
    // Assign position numbers if they are missing or identical
    const updatedPositions = itemsInGroup.map((item, i) => ({
      id: item.id,
      position: typeof item.position === 'number' ? item.position : i * 10
    }));

    // Swap positions of index and targetIdx
    const temp = updatedPositions[idx].position;
    updatedPositions[idx].position = updatedPositions[targetIdx].position;
    updatedPositions[targetIdx].position = temp;

    // If they were equal, make sure they are distinct
    if (updatedPositions[idx].position === updatedPositions[targetIdx].position) {
      if (direction === "up") {
        updatedPositions[idx].position -= 5;
      } else {
        updatedPositions[idx].position += 5;
      }
    }

    // Save both positions to Firestore
    try {
      await updateDoc(doc(db, "tasks", updatedPositions[idx].id), { position: updatedPositions[idx].position });
      await updateDoc(doc(db, "tasks", updatedPositions[targetIdx].id), { position: updatedPositions[targetIdx].position });
    } catch (err) {
      console.error("Failed to update task positions:", err);
    }
  };

  const handleTaskDropOnTask = async (draggedTaskId: string, targetTaskId: string, itemsInGroup: any[]) => {
    if (draggedTaskId === targetTaskId) return;
    const draggedIdx = itemsInGroup.findIndex(t => t.id === draggedTaskId);
    const targetIdx = itemsInGroup.findIndex(t => t.id === targetTaskId);
    if (targetIdx === -1) return;

    // Create a copy of the items array
    const newItems = [...itemsInGroup];
    
    // If the dragged task is already in the list, remove it
    let draggedItem;
    if (draggedIdx !== -1) {
      draggedItem = newItems.splice(draggedIdx, 1)[0];
    } else {
      // Find it from the main tasks list
      draggedItem = tasks.find(t => t.id === draggedTaskId);
    }
    
    if (!draggedItem) return;

    // Find the new target index in the modified array
    const finalTargetIdx = newItems.findIndex(t => t.id === targetTaskId);
    
    // Insert dragged item right before the target item
    newItems.splice(finalTargetIdx, 0, draggedItem);

    // Update positions of everything in this column
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const newPos = i * 10;
      if (item.position !== newPos || item.id === draggedTaskId) {
        // Prepare update payload
        const payload: any = { position: newPos };
        
        // If dragged from another column, we should also update the group field to match target!
        if (item.id === draggedTaskId) {
          const targetItem = itemsInGroup[targetIdx];
          if (groupBy === 'stage' || groupBy === 'none') {
            payload.stageId = targetItem.stageId || "capture";
          } else if (groupBy === 'priority') {
            payload.priority = targetItem.priority || 4;
          } else if (groupBy === 'project') {
            payload.projectId = targetItem.projectId || deleteField();
          } else if (groupBy === 'timeSector') {
            payload.timeSector = (targetItem as any).timeSector || deleteField();
          } else if (groupBy === 'gtd') {
            payload.globalStageId = targetItem.globalStageId || "next";
          } else if (groupBy === 'category') {
            payload.categoryIds = targetItem.categoryIds || [];
          }
        }

        try {
          await updateDoc(doc(db, "tasks", item.id), payload);
        } catch (e) {
          console.error("Failed to update position on drop:", e);
        }
      }
    }
  };

  const handleToggleStakeholder = async (taskId: string, stakeholderId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const current = task.stakeholderIds || [];
    let next;
    if (current.includes(stakeholderId)) next = current.filter(id => id !== stakeholderId);
    else next = [...current, stakeholderId];
    
    try {
      await updateDoc(doc(db, "tasks", taskId), { stakeholderIds: next });
    } catch (e) { console.error(e); }
  };

  const handleChangeStage = async (id: string, stageId: string) => {
    try {
       const task = tasks.find(t => t.id === id);
       if (!task) return;
       const updateData: any = { stageId };
       
       let targetStatus = task.status;
       if (stageId === "done") {
          targetStatus = "done";
          if (task.stageId !== 'done') {
             updateData.previousStageId = task.stageId || pipelineStages[0]?.id || "capture";
          }
       } else {
          targetStatus = "open";
       }
       
       await updateDoc(doc(db, "tasks", id), updateData);
       
       if (targetStatus !== task.status) {
          await setTaskStatus(task, targetStatus);
       }
    } catch (err) {
       console.error("Failed to move stage", err);
    }
  };

  const handleChangeContext = async (id: string, context: string) => {
    try {
      await updateDoc(doc(db, "tasks", id), { gtdContext: context === 'none' ? "" : context });
    } catch (e) { console.error(e); }
  };

  const handleChangeFolder = async (id: string, folderId: string) => {
    try {
      await updateDoc(doc(db, "tasks", id), { globalStageId: folderId });
    } catch (err) {
      console.error("Failed to move GTD stage", err);
    }
  };

  const handleSaveStages = async () => {
    if (!user) return;
    const stageNames = editingStagesInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (stageNames.length === 0) return;
    
    const newPipelineStages = stageNames.map(name => {
       const existing = pipelineStages.find(s => s.name.toLowerCase() === name.toLowerCase());
       return existing ? existing : { id: "stage-" + Math.random().toString(36).substring(2, 9), name };
    });

    try {
       await setDoc(doc(db, "userSettings", user.uid), {
          userId: user.uid,
          pipelineStages: newPipelineStages,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp() // in case it's created now
       }, { merge: true });
       setIsEditingStages(false);
    } catch (e) {
       console.error("Failed to update pipeline stages", e);
    }
  };

  const toggleCategory = (id: string) => {
    const next = new Set(selectedCategories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCategories(next);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !user || !workspace) return;
    try {
      await addDoc(collection(db, "categories"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: newCategoryName.trim(),
        createdAt: serverTimestamp()
      });
      setNewCategoryName("");
      setIsAddingCategory(false);
    } catch (err) {
      console.error("Failed to add category", err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, "categories", id));
      if (selectedCategories.has(id)) {
        toggleCategory(id);
      }
    } catch (err) {
      console.error("Failed to delete category", err);
    }
  };

  const handleDeleteTask = async (taskItem: any) => {
    if (!taskItem || !taskItem.id) return;
    try {
      const taskData = { ...taskItem };
      const taskId = taskItem.id;
      delete taskData.id;

      await deleteDoc(doc(db, "tasks", taskId));

      pushAction({
        id: `delete-task-${taskId}`,
        description: `Delete task "${taskItem.title}"`,
        undo: async () => {
          await setDoc(doc(db, "tasks", taskId), taskData);
        },
        redo: async () => {
          await deleteDoc(doc(db, "tasks", taskId));
        }
      });
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleAutoOrganize = async () => {
    if (!user) return;
    setIsAutoOrganizing(true);
    try {
      // Get all active tasks, limited to 20 per batch by default as requested by user
      const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'merged' && !t.parentId).slice(0, 20);
      if (activeTasks.length === 0) {
        alert("No active tasks to organize.");
        setIsAutoOrganizing(false);
        return;
      }
      
      const res = await fetch("/api/autoOrganize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           tasks: activeTasks.map(t => ({ id: t.id, title: t.title, description: t.description || "" })),
           categories: categories.map(c => ({ id: c.id, name: c.name })),
           pipelineStages: pipelineStages.map(s => ({ id: s.id, name: s.name }))
        })
      });

      if (!res.ok) throw new Error("Failed to auto organize");
      const data = await res.json();
      
      const { taskUpdates, duplicateMerges } = data;
      
      // Pre-check all recommendations
      const initialUpdates: Record<string, boolean> = {};
      taskUpdates?.forEach((u: any) => {
        initialUpdates[u.taskId] = true;
      });

      const initialMerges: Record<string, boolean> = {};
      duplicateMerges?.forEach((m: any) => {
        initialMerges[m.primaryTaskId] = true;
      });

      setApprovedUpdates(initialUpdates);
      setApprovedMerges(initialMerges);
      setOrganizeResults(data);
      setShowOrganizeDialog(true);
    } catch (e) {
      console.error(e);
      alert("Failed to auto organize tasks.");
    } finally {
      setIsAutoOrganizing(false);
    }
  };

  const applyOrganizeChanges = async () => {
    if (!user || !organizeResults) return;
    setIsAutoOrganizing(true);
    try {
      const backup: any[] = [];
      const { taskUpdates, duplicateMerges } = organizeResults;

      // Snapshot backups of all affected tasks first (for perfect undo)
      const affectedIds = new Set<string>();
      taskUpdates?.forEach((u: any) => {
        if (approvedUpdates[u.taskId]) affectedIds.add(u.taskId);
      });
      duplicateMerges?.forEach((m: any) => {
        if (approvedMerges[m.primaryTaskId]) {
          affectedIds.add(m.primaryTaskId);
          m.duplicateTaskIds?.forEach((dupId: string) => affectedIds.add(dupId));
        }
      });

      for (const id of Array.from(affectedIds)) {
        const t = tasks.find(item => item.id === id);
        if (t) {
          backup.push({
            id: t.id,
            title: t.title,
            description: t.description || "",
            priority: t.priority || 4,
            categoryIds: t.categoryIds || [],
            stageId: t.stageId || "",
            status: t.status || "todo",
            mergedIntoTaskId: (t as any).mergedIntoTaskId || null,
          });
        }
      }
      setOrganizeUndoBackup(backup);

      // Apply Merges
      let mergeCount = 0;
      if (duplicateMerges && Array.isArray(duplicateMerges)) {
        for (const merge of duplicateMerges) {
          if (!approvedMerges[merge.primaryTaskId]) continue;
          if (merge.duplicateTaskIds && Array.isArray(merge.duplicateTaskIds)) {
            for (const dupId of merge.duplicateTaskIds) {
              // Instead of permanently deleting, set status to 'merged' and record primary ID (safe undo/history preservation)
              const ref = doc(db, "tasks", dupId);
              await updateDoc(ref, {
                status: "merged",
                mergedIntoTaskId: merge.primaryTaskId
              });
              mergeCount++;
            }
          }
        }
      }

      // Apply Enriched Updates
      let updateCount = 0;
      if (taskUpdates && Array.isArray(taskUpdates)) {
        for (const update of taskUpdates) {
          if (!approvedUpdates[update.taskId]) continue;
          
          const ref = doc(db, "tasks", update.taskId);
          const dataToUpdate: any = {};
          if (update.categoryId) dataToUpdate.categoryIds = [update.categoryId];
          if (update.priority) dataToUpdate.priority = update.priority;
          if (update.globalStageId) dataToUpdate.stageId = update.globalStageId;
          if (update.enrichedTitle) dataToUpdate.title = update.enrichedTitle;
          if (update.enrichedDescription) dataToUpdate.description = update.enrichedDescription;

          await updateDoc(ref, dataToUpdate);
          updateCount++;
        }
      }

      setShowOrganizeDialog(false);
      alert(`AI Organize Applied: Enriched ${updateCount} tasks and merged ${mergeCount} duplicates. You can undo this action from the Action Board.`);
    } catch (err) {
      console.error(err);
      alert("Failed to apply AI organize.");
    } finally {
      setIsAutoOrganizing(false);
    }
  };

  const undoOrganizeChanges = async () => {
    if (organizeUndoBackup.length === 0) return;
    setIsAutoOrganizing(true);
    try {
      for (const item of organizeUndoBackup) {
        const ref = doc(db, "tasks", item.id);
        await updateDoc(ref, {
          title: item.title,
          description: item.description,
          priority: item.priority,
          categoryIds: item.categoryIds,
          stageId: item.stageId,
          status: item.status,
          mergedIntoTaskId: item.mergedIntoTaskId
        });
      }
      setOrganizeUndoBackup([]);
      setOrganizeResults(null);
      alert("AI Organize successfully reverted!");
    } catch (err) {
      console.error(err);
      alert("Could not revert AI organize.");
    } finally {
      setIsAutoOrganizing(false);
    }
  };

  const renderCalendarWeekView = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        days.push(d);
    }

    return (
      <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-gray-200">
              <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-gray-900">
                      {currentWeekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex bg-gray-100 p-1 rounded-xl shrink-0 gap-1 border border-gray-200/50">
                      <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white rounded-lg transition-all" title="Previous Week"><ChevronLeft className="w-4 h-4" /></button>
                      <button onClick={() => setCurrentWeekStart(getTodayWeekStart())} className="px-3 py-1 text-xs font-bold hover:bg-white rounded-lg transition-all">This Week</button>
                      <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white rounded-lg transition-all" title="Next Week"><ChevronRight className="w-4 h-4" /></button>
                  </div>
              </div>
              <div className="text-sm text-gray-500 font-medium">
                {days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} - {days[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
              {/* Overdue Section */}
              <div 
                className="w-[300px] min-w-[300px] bg-red-50/30 rounded-3xl p-4 flex flex-col border border-red-100"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("taskId");
                  const today = new Date().toISOString().split('T')[0];
                  if (taskId) await updateDoc(doc(db, "tasks", taskId), { dueDate: today });
                }}
              >
                  <div className="mb-4">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Immediate Attention</p>
                      <h3 className="text-lg font-bold text-red-900">Overdue</h3>
                  </div>
                  <div className="space-y-3">
                      {(() => {
                        const overdueItems = filteredTasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]);
                        return overdueItems.map(t => renderTaskCard(t, { forceSmall: true, itemsInGroup: overdueItems }));
                      })()}
                      {filteredTasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]).length === 0 && (
                        <div className="text-center py-8 text-xs text-red-300 border-2 border-dashed border-red-100 rounded-2xl">None</div>
                      )}
                  </div>
              </div>

              {days.map(day => {
                  const dateStr = day.toISOString().split('T')[0];
                  const dayTasks = filteredTasks.filter(t => t.dueDate === dateStr);
                  const isToday = dateStr === new Date().toISOString().split('T')[0];

                  return (
                      <div 
                          key={dateStr}
                          className={`w-[300px] min-w-[300px] bg-white rounded-3xl p-4 flex flex-col border transition-colors
                              ${isToday ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500/20' : 'border-gray-200'}
                          `}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={async (e) => {
                              e.preventDefault();
                              const taskId = e.dataTransfer.getData("taskId");
                              if (taskId) {
                                await updateDoc(doc(db, "tasks", taskId), { dueDate: dateStr });
                              }
                          }}
                      >
                          <div className="mb-4 flex items-center justify-between">
                              <div>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{day.toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                <h3 className={`text-lg font-bold ${isToday ? 'text-indigo-900' : 'text-gray-900'}`}>{day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</h3>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>{dayTasks.length}</span>
                          </div>
                          <div className="space-y-3 min-h-[100px]">
                              {dayTasks.map(t => renderTaskCard(t, { itemsInGroup: dayTasks }))}
                              {dayTasks.length === 0 && (
                                <div className="text-center py-8 text-xs text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl">No tasks</div>
                              )}
                          </div>
                      </div>
                  );
              })}

              {/* Unscheduled Section */}
              <div 
                className="w-[300px] min-w-[300px] bg-gray-100 rounded-3xl p-4 flex flex-col border border-gray-200/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("taskId");
                  if (taskId) await updateDoc(doc(db, "tasks", taskId), { dueDate: deleteField() });
                }}
              >
                  <div className="mb-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Flexible</p>
                      <h3 className="text-lg font-bold text-gray-900">Unscheduled</h3>
                  </div>
                  <div className="space-y-3">
                      {(() => {
                        const unscheduledItems = filteredTasks.filter(t => !t.dueDate);
                        return unscheduledItems.map(t => renderTaskCard(t, { forceSmall: true, itemsInGroup: unscheduledItems }));
                      })()}
                      {filteredTasks.filter(t => !t.dueDate).length === 0 && (
                        <div className="text-center py-8 text-xs text-gray-300 border-2 border-dashed border-gray-200 rounded-2xl">All scheduled</div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    );
  };

  if (loading) {
     return (
      <div className="p-4 flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const getCategoryIds = (t: any) => {
    let ids: string[] = [];
    if (t.categoryIds && Array.isArray(t.categoryIds)) {
      ids = t.categoryIds;
    } else if (t.categoryId) {
      ids = [t.categoryId];
    }
    const uniq = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.trim() !== '')));
    return uniq.filter(id => categories.some(c => c.id === id));
  };

  const compareByCriteria = (a: any, b: any, criteria: string, direction: "asc" | "desc") => {
    let comparison = 0;
    let hasValA = true;
    let hasValB = true;

    if (criteria === "priority") {
      const pA = getNormalizedPriority(a.priority);
      const pB = getNormalizedPriority(b.priority);
      hasValA = pA !== null;
      hasValB = pB !== null;
      if (hasValA && hasValB) {
        comparison = pA! - pB!;
      }
    } else if (criteria === "tag") {
      const cIdsA = getCategoryIds(a);
      const cIdsB = getCategoryIds(b);
      hasValA = cIdsA.length > 0;
      hasValB = cIdsB.length > 0;
      if (hasValA && hasValB) {
        const nameA = categories.find(c => c.id === cIdsA[0])?.name || "";
        const nameB = categories.find(c => c.id === cIdsB[0])?.name || "";
        comparison = nameA.localeCompare(nameB);
      }
    } else if (criteria === "dueDate") {
      hasValA = !!a.dueDate;
      hasValB = !!b.dueDate;
      if (hasValA && hasValB) {
        comparison = a.dueDate.localeCompare(b.dueDate);
      }
    } else if (criteria === "title") {
      const titleA = a.title || "";
      const titleB = b.title || "";
      comparison = titleA.localeCompare(titleB);
    } else if (criteria === "position") {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      comparison = posA - posB;
    } else if (criteria === "createdAt") {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      comparison = timeA - timeB;
    }

    // Always push items with missing/empty values to the bottom, regardless of sort direction!
    if (!hasValA && !hasValB) return 0;
    if (!hasValA) return 1;  // a goes to bottom
    if (!hasValB) return -1; // b goes to bottom

    return direction === "asc" ? comparison : -comparison;
  };

  const filteredTasks = tasks.filter(t => {
    const isCompleted = t.status === "done" || t.stageId === "done";
    if (showDone ? !isCompleted : isCompleted) return false;
    if (t.parentId) return false;
    if (activeFolder !== "all") {
       if (activeFolder === "priority") {
         const p = getNormalizedPriority(t.priority);
         if ((p === null || p > 2) && !t.isOneThing) return false;
       } else if (activeFolder === "routine") {
         if (t.itemType !== "routine_follow_up") return false;
       } else if (activeFolder === "2mins") {
         if (t.itemType !== "2mins") return false;
       } else if (activeFolder === "blocked") {
         if (t.stageId !== "blocked") return false;
       } else if (activeFolder === "missing_metadata") {
         const hasPriority = getNormalizedPriority(t.priority) !== null;
         const hasDueDate = !!t.dueDate;
         const hasContext = !!t.gtdContext;
         const hasTags = getCategoryIds(t).length > 0;
         if (hasPriority && hasDueDate && hasContext && hasTags) return false;
       } else {
         if (getNormalizedFolderId(t.globalStageId) !== activeFolder) return false;
       }
    }
    if (activeContext !== "all") {
        if (t.gtdContext !== activeContext) return false;
    }
    if (selectedCategories.size > 0) {
      const cIds = getCategoryIds(t);
      if (cIds.length === 0 || !cIds.some((c: string) => selectedCategories.has(c))) return false;
    }
    if (projectFilterMode === "standalone" && t.projectId) return false;
    if (projectFilterMode === "projects" && selectedProjects.size > 0) {
      if (!t.projectId && !selectedProjects.has('none')) return false;
      if (t.projectId && !selectedProjects.has(t.projectId)) return false;
    }
    if (selectedStakeholders.size > 0) {
      if (!t.stakeholderIds || t.stakeholderIds.length === 0) {
        if (!selectedStakeholders.has('none')) return false;
      } else {
        if (!t.stakeholderIds.some((s: string) => selectedStakeholders.has(s))) return false;
      }
    }
    return true;
  }).sort((a, b) => {
    const comp1 = compareByCriteria(a, b, sortLevel1, sortLevel1Dir);
    if (comp1 !== 0) return comp1;

    const comp2 = compareByCriteria(a, b, sortLevel2, sortLevel2Dir);
    if (comp2 !== 0) return comp2;

    const titleA = a.title || "";
    const titleB = b.title || "";
    return titleA.localeCompare(titleB);
  });

  const isOpenTask = (t: any) => !(t.status === "done" || t.stageId === "done") && !t.parentId;

  const nextCount = tasks.filter(t => isOpenTask(t) && getNormalizedFolderId(t.globalStageId) === 'next').length;
  const priorityCount = tasks.filter(t => {
    if (!isOpenTask(t)) return false;
    const p = getNormalizedPriority(t.priority);
    return (p !== null && p <= 2) || t.isOneThing;
  }).length;
  const waitingCount = tasks.filter(t => isOpenTask(t) && getNormalizedFolderId(t.globalStageId) === 'waiting').length;
  const routineCount = tasks.filter(t => isOpenTask(t) && t.itemType === 'routine_follow_up').length;
  const somedayCount = tasks.filter(t => isOpenTask(t) && getNormalizedFolderId(t.globalStageId) === 'someday').length;

  const moreTabs = [
    { id: '2mins', name: '2 Mins', count: tasks.filter(t => isOpenTask(t) && t.itemType === '2mins').length },
    { id: 'blocked', name: 'Blocked', count: tasks.filter(t => isOpenTask(t) && t.stageId === 'blocked').length },
    { id: 'missing_metadata', name: 'Auditor', count: tasks.filter(t => {
      if (!isOpenTask(t)) return false;
      const hasPriority = getNormalizedPriority(t.priority) !== null;
      const hasDueDate = !!t.dueDate;
      const hasContext = !!t.gtdContext;
      const hasTags = getCategoryIds(t).length > 0;
      return !(hasPriority && hasDueDate && hasContext && hasTags);
    }).length }
  ];

  const handleAskBoldi = () => {
    window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
      detail: {
        context: `I am looking at my Action Board with ${tasks.filter(t => t.status === 'open').length} open tasks. Help me organize them.`
      }
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`w-full max-w-7xl mx-auto space-y-6 font-sans ${hideCockpit ? 'min-h-[500px]' : 'min-h-screen p-4 bg-slate-50/20 pb-24'}`}
    >
      {!hideCockpit && <ClarityResetTrigger workspaceId={workspace?.id || ""} />}      {/* 1. COMPACT HEADER */}
      <header className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl shadow-sm relative z-40 ${hideCockpit ? 'p-3 border border-gray-200/60' : 'p-5 border border-gray-100'}`}>
        {!hideCockpit ? (
          <div className="flex items-center gap-3">
            <Link to="/work" className="w-10 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-full flex justify-center items-center transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                Action Board
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {tasks.filter(t => t.status === 'open' && !t.parentId).length}
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Simplify, prioritize, and protect focus</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2">
            <h1 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
              Project Board
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {tasks.filter(t => t.status === 'open' && !t.parentId).length}
              </span>
            </h1>
          </div>
        )}

        {/* Focus Mode & Full Board Mode Toggles */}
        <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
          {!hideCockpit && (
            <>
              <div className="bg-gray-100/80 p-1 rounded-xl flex items-center border border-gray-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode("focus");
                    updatePreference({ defaultMode: "focus" });
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeMode === "focus" ? 'bg-white text-black shadow-sm font-black' : 'text-gray-500 hover:text-black'}`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Focus Cockpit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode("full");
                    updatePreference({ defaultMode: "full" });
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeMode === "full" ? 'bg-white text-black shadow-sm font-black' : 'text-gray-500 hover:text-black'}`}
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Full Workspace</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleAskBoldi}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/50 rounded-xl text-xs font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs group/boldi"
                title="Get contextual AI advice on your tasks from Certo Work Assistant"
              >
                <Bot className="w-4 h-4 text-emerald-600 animate-pulse group-hover/boldi:rotate-12 transition-transform" /> 
                <span>Ask Certo Work</span>
              </button>
            </>
          )}

          {/* VIEW DROPDOWN */}
          {activeMode === "full" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsViewDropdownOpen(!isViewDropdownOpen);
                  setIsMoreDropdownOpen(false);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5
                  ${isViewDropdownOpen ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
                `}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Options</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isViewDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl p-3 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Layout</label>
                    <div className="grid grid-cols-2 gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-200/50">
                      {[
                        { id: 'list', name: 'List' },
                        { id: 'kanban', name: 'Board' },
                        { id: 'week', name: 'Week' },
                        { id: 'notebook', name: 'Notebook' },
                      ].map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setCurrentView(v.id);
                            const pref = v.id === "notebook" ? "notes" : v.id === "kanban" ? "board" : v.id;
                            updatePreference({ view: pref });
                            setIsViewDropdownOpen(false);
                          }}
                          className={`py-1 text-[10px] font-bold rounded ${currentView === v.id ? 'bg-white text-black shadow-xs font-black' : 'text-gray-500 hover:text-black'}`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Group By</label>
                    <select
                      value={groupBy}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGroupBy(val as any);
                        updatePreference({ grouping: val });
                      }}
                      className="w-full px-2 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                    >
                      <option value="none">No Grouping</option>
                      <option value="priority">Priority</option>
                      <option value="category">Category</option>
                      <option value="project">Project</option>
                      <option value="stage">Status Stage</option>
                      <option value="timeSector">Time Sector</option>
                      <option value="stakeholder">Stakeholder</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Task Density</label>
                    <div className="grid grid-cols-3 gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-200/50">
                      {[
                        { id: 'small', name: 'Compact' },
                        { id: 'standard', name: 'Normal' },
                        { id: 'large', name: 'Spacious' },
                      ].map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setCardSize(d.id as any);
                            const pref = d.id === "small" ? "compact" : d.id === "large" ? "spacious" : "comfortable";
                            updatePreference({ density: pref });
                          }}
                          className={`py-1 text-[9px] font-bold rounded ${cardSize === d.id ? 'bg-white text-black shadow-xs font-black' : 'text-gray-500 hover:text-black'}`}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500">Show Completed</span>
                    <input
                      type="checkbox"
                      checked={showDone}
                      onChange={(e) => {
                        setShowDone(e.target.checked);
                      }}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-black cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MORE DROPDOWN */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsMoreDropdownOpen(!isMoreDropdownOpen);
                setIsViewDropdownOpen(false);
              }}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center
                ${isMoreDropdownOpen ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
              `}
              title="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMoreDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 space-y-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    handleAutoOrganize();
                    setIsMoreDropdownOpen(false);
                  }}
                  disabled={isAutoOrganizing}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 text-gray-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isAutoOrganizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
                  <span>AI Organize</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-clarity-reset'));
                    setIsMoreDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Brain className="w-3.5 h-3.5 text-amber-500" />
                  <span>10-Min Reset</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSortPanelOpen(!isSortPanelOpen);
                    setIsMoreDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                  <span>Configure Sort</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsTagsManagerOpen(true);
                    setIsMoreDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Manage Tags</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingStagesInput(pipelineStages.map(s => s.name).join('\n'));
                    setIsEditingStages(!isEditingStages);
                    setIsMoreDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-purple-500" />
                  <span>Pipeline Stages</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. TODAY COMMAND STRIP */}
      {!hideCockpit && (
      <div className="flex items-center justify-between bg-white border border-gray-100 shadow-xs px-4 py-2.5 rounded-2xl relative z-30">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={handleAutoOrganize}
            disabled={isAutoOrganizing}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-indigo-600 transition-colors shrink-0 disabled:opacity-50"
          >
            {isAutoOrganizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
            <span>AI Organize</span>
          </button>
          
          <div className="h-4 w-[1px] bg-gray-200 shrink-0"></div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-clarity-reset'))}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-amber-600 transition-colors shrink-0"
          >
            <Brain className="w-3.5 h-3.5 text-amber-500" />
            <span>10-Min Reset</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-200 shrink-0"></div>

          <button
            type="button"
            onClick={() => setIsTagsManagerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-emerald-600 transition-colors shrink-0"
          >
            <Tag className="w-3.5 h-3.5 text-emerald-500" />
            <span>Tags</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-200 shrink-0"></div>

          <button
            type="button"
            onClick={() => setIsEditingStages(!isEditingStages)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-purple-600 transition-colors shrink-0"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-500" />
            <span>Stages</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowDone(!showDone);
          }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all shrink-0 border
            ${showDone ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold' : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700'}
          `}
          title="Toggle visibility of completed tasks"
        >
          {showDone ? 'Completed (Shown)' : 'Completed (Hidden)'}
        </button>
      </div>
      )}

      {/* Pipeline Stages Editor Pane (Inline) */}
      {isEditingStages && (
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-3xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-500" />
              <span>Pipeline Stage Customization</span>
            </h3>
            <button type="button" onClick={() => setIsEditingStages(false)} className="text-xs font-bold text-gray-400 hover:text-black">Cancel</button>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">Enter stage names (one per line). These define the columns in your Kanban board view.</p>
          <textarea
            value={editingStagesInput}
            onChange={(e) => setEditingStagesInput(e.target.value)}
            className="w-full h-24 p-3 text-xs border border-gray-200 rounded-xl bg-white font-mono focus:ring-1 focus:ring-black outline-none"
            placeholder="Inbox&#10;In Progress&#10;Done"
          />
          <button
            type="button"
            onClick={handleSaveStages}
            className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Save Pipeline Changes
          </button>
        </div>
      )}

      {/* Configure Two-Level Sort Pane */}
      {isSortPanelOpen && (
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-blue-500" />
              <span>Two-Level Sorting Engine</span>
            </h3>
            <button type="button" onClick={() => setIsSortPanelOpen(false)} className="text-xs font-bold text-gray-400 hover:text-black">Close</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Level 1 Sort */}
            <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-gray-150 shadow-xs">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Primary Sort Parameter</label>
              <div className="flex gap-2">
                <select
                  value={sortLevel1}
                  onChange={(e) => {
                    const next = e.target.value as any;
                    setSortLevel1(next);
                  }}
                  className="flex-1 px-2.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="priority">Priority Order</option>
                  <option value="dueDate">Due Date</option>
                  <option value="tag">Category Tag</option>
                  <option value="title">Alphabetical</option>
                  <option value="position">Kanban Position</option>
                  <option value="createdAt">Created Time</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortLevel1Dir(sortLevel1Dir === "asc" ? "desc" : "asc")}
                  className="px-2.5 py-1 text-xs font-bold border border-gray-200 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors uppercase"
                >
                  {sortLevel1Dir === "asc" ? "Asc" : "Desc"}
                </button>
              </div>
            </div>

            {/* Level 2 Sort */}
            <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-gray-150 shadow-xs">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Secondary Sort Parameter</label>
              <div className="flex gap-2">
                <select
                  value={sortLevel2}
                  onChange={(e) => {
                    const next = e.target.value as any;
                    setSortLevel2(next);
                  }}
                  className="flex-1 px-2.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="priority">Priority Order</option>
                  <option value="dueDate">Due Date</option>
                  <option value="tag">Category Tag</option>
                  <option value="title">Alphabetical</option>
                  <option value="position">Kanban Position</option>
                  <option value="createdAt">Created Time</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortLevel2Dir(sortLevel2Dir === "asc" ? "desc" : "asc")}
                  className="px-2.5 py-1 text-xs font-bold border border-gray-200 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors uppercase"
                >
                  {sortLevel2Dir === "asc" ? "Asc" : "Desc"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SMART VIEW TABS */}
      {activeMode === "full" && (
        <div className="relative z-20">
          {/* Main Desktop/Mobile Tabs Strip */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-px">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full">
              {[
                { id: 'next', name: 'Next Actions', count: nextCount, icon: Inbox },
                { id: 'priority', name: 'Priority Focus', count: priorityCount, icon: Star, iconColor: 'text-amber-500 fill-amber-500' },
                { id: 'waiting', name: 'Waiting For', count: waitingCount, icon: Users },
                { id: 'routine', name: 'Routines', count: routineCount, icon: RefreshCw },
                { id: 'someday', name: 'Someday', count: somedayCount, icon: Calendar },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeFolder === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveFolder(tab.id);
                      updatePreference({ lastActiveTab: tab.id });
                    }}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 relative
                      ${isActive ? 'border-black text-black font-black' : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'}
                    `}
                  >
                    <Icon className={`w-3.5 h-3.5 ${tab.iconColor || ''}`} />
                    <span>{tab.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none
                      ${isActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}
                    `}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}

              {/* MORE TABS POPOVER */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMoreTabsOpen(!isMoreTabsOpen)}
                  className={`flex items-center gap-1 px-4 py-3 text-xs font-bold border-b-2 transition-all
                    ${moreTabs.some(t => t.id === activeFolder) ? 'border-black text-black font-black' : 'border-transparent text-gray-400 hover:text-gray-700'}
                  `}
                >
                  <span>More</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isMoreTabsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMoreTabsOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg p-2 space-y-1 z-30 animate-in fade-in slide-in-from-top-1 duration-100">
                    {moreTabs.map(tab => {
                      const isActive = activeFolder === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setActiveFolder(tab.id);
                            updatePreference({ lastActiveTab: tab.id });
                            setIsMoreTabsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-lg text-left transition-colors
                            ${isActive ? 'bg-gray-50 text-black font-black' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}
                          `}
                        >
                          <span>{tab.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. COLLAPSIBLE FILTERS PANEL */}
      {activeMode === "full" && (
        <div className="bg-white border border-gray-100 shadow-xs rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
              <span>Workspace Filter Deck</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                const nextVal = !isFiltersCollapsed;
                setIsFiltersCollapsed(nextVal);
                updatePreference({ filtersCollapsed: nextVal });
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-[10px] font-bold text-gray-600 border border-gray-200 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{isFiltersCollapsed ? "Expand Filters" : "Collapse Filters"}</span>
            </button>
          </div>

          {!isFiltersCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-gray-100/60 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* GTD CONTEXT FILTER */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GTD Context</h4>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveContext("all")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all
                      ${activeContext === "all" ? 'bg-black text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}
                    `}
                  >
                    All
                  </button>
                  {GTD_CONTEXTS.map(ctx => (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() => setActiveContext(ctx)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all
                        ${activeContext === ctx ? 'bg-cyan-600 text-white shadow-xs' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}
                      `}
                    >
                      {ctx}
                    </button>
                  ))}
                </div>
              </div>

              {/* PROJECT / DEAL FILTER */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Project / Deal Filter</h4>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setProjectFilterMode("all")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all
                      ${projectFilterMode === "all" ? 'bg-black text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}
                    `}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectFilterMode("standalone")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all
                      ${projectFilterMode === "standalone" ? 'bg-black text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}
                    `}
                  >
                    Standalone
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProjectModalOpen(true)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1
                      ${projectFilterMode === "projects" ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                    `}
                  >
                    <span>{projectFilterMode === "projects" && selectedProjects.size > 0 ? `${selectedProjects.size} Projects` : 'Filter Projects...'}</span>
                  </button>
                </div>
              </div>

              {/* STAKEHOLDERS FILTER */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stakeholder Contacts</h4>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStakeholders.size === 0) {
                        setIsStakeholderModalOpen(true);
                      } else {
                        setSelectedStakeholders(new Set());
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1
                      ${selectedStakeholders.size > 0 ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                    `}
                  >
                    <span>{selectedStakeholders.size > 0 ? `${selectedStakeholders.size} Stakeholders` : 'Filter Stakeholders...'}</span>
                  </button>
                </div>
              </div>

              {/* CATEGORY / TAG FILTER */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Tags / Categories</h4>
                <div className="flex flex-wrap gap-1 max-h-[110px] overflow-y-auto no-scrollbar">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1
                        ${selectedCategories.has(cat.id) ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}
                      `}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>

                {isAddingCategory ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleAddCategory(e); }} className="flex gap-1 items-center mt-1">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New tag..."
                      className="border border-gray-200 px-2 py-1 rounded-md text-[10px] w-20 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                      autoFocus
                    />
                    <button type="submit" className="bg-black text-white px-2 py-1 rounded-md text-[10px] font-medium">Add</button>
                    <button type="button" onClick={() => setIsAddingCategory(false)} className="text-[10px] text-gray-500 px-1">X</button>
                  </form>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-dashed border-gray-300 text-gray-500 hover:text-black hover:border-gray-500 transition-colors flex items-center gap-1 w-max"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Add Tag</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stakeholder Filter Modal (Applying changes to it) */}
      <AnimatePresence>
        {isStakeholderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
            >
               <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600" /> Filter by Stakeholders</h2>
                  <button type="button" onClick={() => setIsStakeholderModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X className="w-5 h-5" /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  <div 
                    onClick={() => {
                       if (selectedStakeholders.size === 0) {
                         setIsStakeholderModalOpen(false);
                       } else {
                         setSelectedStakeholders(new Set());
                       }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedStakeholders.size === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedStakeholders.size === 0 ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
                      {selectedStakeholders.size === 0 && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className={`font-medium ${selectedStakeholders.size === 0 ? 'text-emerald-900' : 'text-gray-900'}`}>All Stakeholders</span>
                  </div>
                  
                  <div 
                    onClick={() => {
                       const next = new Set(selectedStakeholders);
                       if (next.has('none')) next.delete('none'); else next.add('none');
                       setSelectedStakeholders(next);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedStakeholders.has('none') ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedStakeholders.has('none') ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
                      {selectedStakeholders.has('none') && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className={`font-medium ${selectedStakeholders.has('none') ? 'text-emerald-900' : 'text-gray-900'}`}>No Stakeholder</span>
                  </div>
                  
                  {stakeholders.map(stakeholder => (
                    <div 
                      key={stakeholder.id}
                      onClick={() => {
                        const next = new Set(selectedStakeholders);
                        if (next.has(stakeholder.id)) next.delete(stakeholder.id);
                        else next.add(stakeholder.id);
                        setSelectedStakeholders(next);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedStakeholders.has(stakeholder.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedStakeholders.has(stakeholder.id) ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
                        {selectedStakeholders.has(stakeholder.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className={`font-medium ${selectedStakeholders.has(stakeholder.id) ? 'text-emerald-900' : 'text-gray-900'}`}>{stakeholder.name}</span>
                    </div>
                  ))}
               </div>
               
               <div className="p-4 border-t border-gray-100 bg-gray-50">
                  <button 
                    type="button"
                    onClick={() => {
                      if (currentView === "list" && selectedStakeholders.size > 0 && groupBy !== "stakeholder") {
                         setGroupBy("stakeholder");
                      }
                      setIsStakeholderModalOpen(false);
                    }}
                    className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    Apply Stakeholder Filter
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-2 mt-2">
        {categories.filter(c => selectedCategories.has(c.id)).map(cat => (
          <div key={cat.id} className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
             <div>
                <h2 className="font-semibold text-indigo-900 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  {cat.name}
                </h2>
                <p className="text-xs text-indigo-700/70 mt-0.5">
                  {selectedCategories.size === 1 ? "Tasks created below will be tagged automatically." : "Filtering by this category."}
                </p>
             </div>
             <div className="flex items-center gap-2">
               <button onClick={() => handleDeleteCategory(cat.id)} className="text-xs font-medium text-red-500 hover:text-red-700 px-2">Delete Category</button>
             </div>
          </div>
        ))}
      </div>

      <TagsManager isOpen={isTagsManagerOpen} onClose={() => setIsTagsManagerOpen(false)} />
      
      <StakeholdersManager
        isOpen={!!activeStakeholderTaskId}
        onClose={() => setActiveStakeholderTaskId(null)}
        selectedIds={tasks.find(t => t.id === activeStakeholderTaskId)?.stakeholderIds || []}
        onToggle={(sid) => activeStakeholderTaskId && handleToggleStakeholder(activeStakeholderTaskId, sid)}
      />

      <form onSubmit={handleAddTask} className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-black/5 transition-shadow">
        <div className="flex items-center gap-2 p-1">
          {/* Item Type Selector */}
          <div className="relative group/icon ml-2" title="Item Type">
             <div className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors relative">
               {newItemType === 'idea' && <Lightbulb className="w-4 h-4 text-amber-500" />}
               {newItemType === 'decision' && <Scale className="w-4 h-4 text-blue-500" />}
               {newItemType === 'meeting' && <Briefcase className="w-4 h-4 text-purple-500" />}
               {newItemType === 'presentation' && <Book className="w-4 h-4 text-rose-500" />}
               {newItemType === 'routine_follow_up' && <RefreshCw className="w-4 h-4 text-teal-500" />}
               {newItemType === '2mins' && <Zap className="w-4 h-4 text-yellow-500" />}
               {newItemType === 'task' && <CheckSquare className="w-4 h-4 text-gray-400" />}
               <select
                 value={newItemType}
                 onChange={(e) => setNewItemType(e.target.value)}
                 className="absolute inset-0 opacity-0 cursor-pointer w-[200%] max-w-[200px]"
                 title="Select Item Type"
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
          <input 
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onFocus={() => setIsQuickAddExpanded(true)}
            placeholder={selectedCategories.size === 1 ? `New task in selected category...` : "New task..."}
            className="flex-1 bg-transparent py-3 focus:outline-none placeholder-gray-400 font-medium text-gray-900 min-w-0"
          />
          {isQuickAddExpanded && (
            <button 
              type="button"
              onClick={() => setIsQuickAddExpanded(false)}
              className="text-xs text-gray-400 hover:text-black font-semibold px-2"
              title="Collapse metadata panel"
            >
              Collapse
            </button>
          )}
          <button 
            type="submit" 
            aria-label="Add task"
            disabled={!newTaskTitle.trim() || isAdding}
            className="bg-black text-white p-2.5 rounded-xl font-medium disabled:opacity-50 flex justify-center items-center transition-transform hover:scale-105 active:scale-95 m-1 shrink-0"
          >
            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        {/* Quick Action Bar*/}
        {isQuickAddExpanded && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 pb-2 px-3 relative z-30 overflow-visible">
             {/* Priority */}
             <div className="relative group/icon shrink-0" title="Priority">
                <div className="flex items-center justify-center h-6 px-2 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-500 cursor-pointer transition-colors relative border border-gray-200">
                   <span className="text-[10px] font-bold">P{newTaskPriority}</span>
                   <select 
                     value={newTaskPriority} 
                     onChange={(e) => setNewTaskPriority(parseInt(e.target.value))}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                   >
                     <option value={1}>1 - Urgent</option>
                     <option value={2}>2 - High</option>
                     <option value={3}>3 - Medium</option>
                     <option value={4}>4 - Low</option>
                   </select>
                </div>
             </div>

             {/* Due Date */}
             <div className="relative group/icon shrink-0" title="Due Date">
                <div className={`flex items-center justify-center h-6 px-1.5 rounded-md overflow-hidden cursor-pointer relative transition-colors gap-1 border ${newTaskDueDate ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'}`}>
                   <Calendar className="w-3.5 h-3.5 shrink-0" />
                   {newTaskDueDate ? <span className="text-[10px] font-bold">{new Date(newTaskDueDate + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span> : <span className="text-[10px] font-medium hidden sm:inline">Date</span>}
                   <input
                     type="date"
                     value={newTaskDueDate}
                     onChange={(e) => setNewTaskDueDate(e.target.value)}
                     className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] opacity-0 cursor-pointer [color-scheme:light]"
                   />
                </div>
             </div>

             {/* Project */}
              <div className="relative group/icon shrink-0 font-sans" title="Project / Deal">
                 <EntityPicker
                   entityType="project_deal"
                   selectedIds={newTaskProjectId}
                   onSelect={(id) => setNewTaskProjectId(id ? String(id) : "")}
                   workspaceId={workspace?.id || ""}
                   userId={user?.uid || ""}
                   placeholder="Project / Deal"
                   triggerClassName="h-6 !py-0 !px-1.5 border hover:bg-gray-100 transition-colors gap-1 flex items-center justify-center font-bold text-gray-500 rounded-md border-gray-200 bg-gray-50"
                 />
              </div>
  {/* Tag / Category */}
              <div className="relative group/icon shrink-0 font-sans" title="Category / Tag">
                 <EntityPicker
                   entityType="tag"
                   allowMultiple={true}
                   selectedIds={newTaskCategoryIds}
                   onSelect={(ids) => setNewTaskCategoryIds(ids as string[])}
                   workspaceId={workspace?.id || ""}
                   userId={user?.uid || ""}
                   placeholder="Tag"
                   triggerClassName="h-6 !py-0 !px-1.5 border hover:bg-gray-100 transition-colors gap-1 flex items-center justify-center font-bold text-gray-500 rounded-md border-gray-200 bg-gray-50"
                 />
              </div>
  {/* Stakeholders */}
              <div className="relative group/icon shrink-0 font-sans" title="Stakeholders">
                 <EntityPicker
                   entityType="stakeholder"
                   allowMultiple={true}
                   selectedIds={newTaskStakeholderIds}
                   onSelect={(ids) => setNewTaskStakeholderIds(ids as string[])}
                   workspaceId={workspace?.id || ""}
                   userId={user?.uid || ""}
                   placeholder="User"
                   triggerClassName="h-6 !py-0 !px-1.5 border hover:bg-gray-100 transition-colors gap-1 flex items-center justify-center font-bold text-gray-500 rounded-md border-gray-200 bg-gray-50"
                 />
              </div>
  {/* GTD Folder */}
             <div className="relative group/icon shrink-0" title="GTD Folder">
                <div className={`flex items-center justify-center h-6 px-1.5 rounded-md cursor-pointer relative transition-colors gap-1 border ${newTaskGlobalStageId ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'}`}>
                   <Inbox className="w-3.5 h-3.5 shrink-0" />
                   {newTaskGlobalStageId ? <span className="text-[10px] font-bold capitalize">{GTD_FOLDERS.find(f => f.id === newTaskGlobalStageId)?.name || 'Inbox'}</span> : <span className="text-[10px] font-medium hidden sm:inline">Folder</span>}
                   <select 
                     value={newTaskGlobalStageId}
                     onChange={(e) => setNewTaskGlobalStageId(e.target.value)}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                   >
                     <option value="">No Folder</option>
                     {GTD_FOLDERS.filter(f => f.id !== 'all').map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                     ))}
                   </select>
                </div>
             </div>

             {/* GTD Context */}
             <div className="relative group/icon shrink-0" title="GTD Context">
                <div className={`flex items-center justify-center h-6 px-1.5 rounded-md cursor-pointer relative transition-colors gap-1 border ${newTaskGtdContext ? 'bg-cyan-50 text-cyan-600 border-cyan-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'}`}>
                   <span className="text-[10px] font-bold capitalize">{newTaskGtdContext || 'Context'}</span>
                   <select 
                     value={newTaskGtdContext}
                     onChange={(e) => setNewTaskGtdContext(e.target.value)}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                   >
                     <option value="">No Context</option>
                     {GTD_CONTEXTS.filter(c => c !== '@anywhere').map(c => (
                        <option key={c} value={c}>{c}</option>
                     ))}
                   </select>
                </div>
             </div>
             
             {/* Recurrence */}
             <div className="relative group/icon shrink-0" title="Recurrence">
                <div className={`flex items-center justify-center h-6 px-1.5 rounded-md cursor-pointer relative transition-colors gap-1 border ${newTaskRecurrence ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'}`}>
                   <Repeat className="w-3.5 h-3.5 shrink-0" />
                   {newTaskRecurrence ? <span className="text-[10px] font-bold capitalize">{newTaskRecurrence}</span> : <span className="text-[10px] font-medium hidden sm:inline">Repeat</span>}
                   <select 
                     value={newTaskRecurrence}
                     onChange={(e) => setNewTaskRecurrence(e.target.value)}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                   >
                     <option value="">No Repeat</option>
                     <option value="daily">Daily</option>
                     <option value="weekdays">Weekdays</option>
                     <option value="weekly">Weekly</option>
                     <option value="biweekly">Bi-weekly</option>
                     <option value="monthly">Monthly</option>
                     <option value="yearly">Yearly</option>
                   </select>
                </div>
             </div>

             {/* ONE THING */}
             <button 
               type="button"
               onClick={(e) => {
                 e.preventDefault(); // prevent form submit just in case
                 setNewTaskIsOneThing(!newTaskIsOneThing);
               }}
               className={`shrink-0 text-[10px] font-bold px-2 h-6 rounded-md uppercase transition-colors border ${newTaskIsOneThing ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'}`}
             >
               {newTaskIsOneThing ? '★ ONE THING' : 'MAKE ONE THING'}
             </button>
          </div>
        )}
       </form>
       <AnimatePresence mode="wait">
        {activeFolder === "missing_metadata" ? (
          <motion.div
            key="metadata_auditor"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full"
          >
            <MetadataAuditor
              tasks={tasks}
              projects={projects}
              db={db}
              user={user}
              workspace={workspace}
            />
          </motion.div>
        ) : currentView === "kanban" ? (
          <motion.div 
            key="kanban"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]"
          >
             {/* INBOX / REVIEW COLUMN */}
             <div className="w-[350px] min-w-[350px] bg-indigo-50/50 rounded-3xl p-4 flex flex-col border border-indigo-100 max-h-[85vh] overflow-y-auto">
               <h3 className="font-bold text-indigo-900 capitalize mb-4 flex justify-between items-center text-xs">
                  Needs Review
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{reviewCandidates.length}</span>
               </h3>
               <div className="space-y-4 overflow-y-auto">
                 {reviewCandidates.map(card => (
                   <ReviewCandidateCard 
                     key={card.id} 
                     candidate={card} 
                     onProcessed={() => {}} 
                   />
                 ))}
                 {reviewCandidates.length === 0 && <div className="text-center py-8 text-xs text-indigo-300 border-2 border-dashed border-indigo-200 rounded-2xl">Inbox Zero</div>}
               </div>
             </div>
  
             {/* TASKS COLUMNS BASED ON GROUPBY */}
             {(() => {
               let columns: { key: string, title: string, items: typeof filteredTasks }[] = [];
               
               if (groupBy === "none" || groupBy === "stage") {
                 columns = pipelineStages.map(s => ({ key: s.id, title: s.name, items: filteredTasks.filter(t => (t.stageId || pipelineStages[0]?.id || "capture") === s.id) }));
               } else if (groupBy === "priority") {
                 columns = [1, 2, 3, 4].map(p => ({ key: `p${p}`, title: `Priority ${p}`, items: filteredTasks.filter(t => getNormalizedPriority(t.priority) === p) }));
                 columns.push({ key: "p-none", title: "No Priority", items: filteredTasks.filter(t => !getNormalizedPriority(t.priority)) });
               } else if (groupBy === "category") {
                 columns = categories.map(c => ({ key: c.id, title: c.name, items: filteredTasks.filter(t => getCategoryIds(t).includes(c.id)) }));
                 columns.push({ key: "c-none", title: "No Category", items: filteredTasks.filter(t => getCategoryIds(t).length === 0) });
               } else if (groupBy === "project") {
                 columns = projects.map(p => ({ key: p.id, title: p.name, items: filteredTasks.filter(t => t.projectId === p.id) }));
                 columns.push({ key: "proj-none", title: "No Project", items: filteredTasks.filter(t => !t.projectId || !projects.some(ptr => ptr.id === t.projectId)) });
               } else if (groupBy === "stakeholder") {
                 columns = stakeholders.map(s => ({ key: s.id, title: s.name, items: filteredTasks.filter(t => (t.stakeholderIds || []).includes(s.id)) }));
                 columns.push({ key: "stake-none", title: "No Stakeholder", items: filteredTasks.filter(t => !t.stakeholderIds || t.stakeholderIds.length === 0) });
               } else if (groupBy === "timeSector") {
                 columns = TIME_SECTORS.map(s => ({ 
                   key: s.id, 
                   title: s.name, 
                   items: filteredTasks.filter(t => {
                     const ts = (t as any).timeSector || (t as any).proposed?.timeSector;
                     if (s.id === 'none') return !ts || ts === 'none';
                     return ts === s.id;
                   }) 
                 }));
               } else if (groupBy === "gtd") {
                 GTD_FOLDERS.filter(f => f.id !== 'all').forEach(f => {
                   columns.push({ key: f.id, title: f.name, items: filteredTasks.filter(t => getNormalizedFolderId(t.globalStageId) === f.id) });
                 });
               }

               return columns.filter(c => groupBy === 'stage' || groupBy === 'none' || c.items.length > 0).map(col => (
                 <div 
                   key={col.key} 
                   className="w-[320px] min-w-[320px] bg-gray-100 rounded-3xl p-4 flex flex-col border border-gray-200/50 transition-colors hover:bg-gray-200/50"
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={async (e) => {
                     e.preventDefault();
                     const taskId = e.dataTransfer.getData("taskId");
                     if (!taskId) return;
                     
                     if (groupBy === 'stage' || groupBy === 'none') await handleChangeStage(taskId, col.key);
                     else if (groupBy === 'priority' && col.key.startsWith('p')) await handleUpdatePriority(taskId, parseInt(col.key.replace('p', '')) || 4);
                     else if (groupBy === 'project') await updateDoc(doc(db, "tasks", taskId), { projectId: col.key === 'proj-none' ? deleteField() : col.key });
                     else if (groupBy === 'stakeholder') {
                        const task = tasks.find(t => t.id === taskId);
                        if (task) {
                          const current = task.stakeholderIds || [];
                          if (col.key === 'stake-none') await updateDoc(doc(db, "tasks", taskId), { stakeholderIds: [] });
                          else if (!current.includes(col.key)) await updateDoc(doc(db, "tasks", taskId), { stakeholderIds: [...current, col.key] });
                        }
                     }
                     else if (groupBy === 'timeSector') await updateDoc(doc(db, "tasks", taskId), { timeSector: col.key === 'none' ? deleteField() : col.key });
                     else if (groupBy === 'gtd') await handleChangeFolder(taskId, col.key);
                     else if (groupBy === 'category') {
                       if (col.key === 'c-none') await updateDoc(doc(db, "tasks", taskId), { categoryIds: [] });
                       else await updateDoc(doc(db, "tasks", taskId), { categoryIds: [col.key] });
                     }
                   }}
                 >
                    <div className="mb-4 flex items-center justify-between">
                       <h3 className="font-semibold text-gray-700 capitalize">{col.title}</h3>
                       <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full font-bold text-gray-500">{col.items.length}</span>
                    </div>
                    <div className="space-y-3 overflow-y-auto min-h-[100px] flex-1">
                      {col.items.map(task => renderTaskCard(task, { itemsInGroup: col.items }))}
                      {col.items.length === 0 && (
                        <div className="text-center py-10 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl">
                          Drop tasks here to organize
                        </div>
                      )}
                    </div>
                 </div>
               ));
             })()}
          </motion.div>
        ) : currentView === "week" ? (
          <motion.div
            key="week"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
          >
            {renderCalendarWeekView()}
          </motion.div>
        ) : currentView === "notebook" ? (
          <motion.div
            key="notebook"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
          >
            <NotebookPlanner />
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
           {reviewCandidates.length > 0 && (
              <div className="bg-indigo-50/30 border border-indigo-100 rounded-3xl overflow-hidden shadow-sm p-5 space-y-4">
                <div className="text-xs font-bold text-indigo-900 uppercase tracking-widest flex justify-between items-center px-1">
                  Needs Review
                  <span className="bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-bold text-[10px]">{reviewCandidates.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {reviewCandidates.map((card) => (
                    <ReviewCandidateCard 
                      key={card.id} 
                      candidate={card} 
                      onProcessed={() => {}} 
                    />
                  ))}
                </div>
              </div>
           )}

           {filteredTasks.length > 0 ? (
            <div className="space-y-6">
              {(() => {
                let groups: { key: string, title: string, items: typeof filteredTasks }[] = [];
                
                if (groupBy === "none") {
                  groups = [{ key: "all", title: "All Items", items: filteredTasks }];
                } else if (groupBy === "priority") {
                  const priorities = [1, 2, 3, 4];
                  groups = priorities.map(p => ({
                    key: `p${p}`,
                    title: `Priority ${p}`,
                    items: filteredTasks.filter(t => getNormalizedPriority(t.priority) === p)
                  }));
                  groups.push({ key: "p-none", title: "No Priority", items: filteredTasks.filter(t => !getNormalizedPriority(t.priority)) });
                } else if (groupBy === "category") {
                  categories.forEach(c => {
                    groups.push({ key: c.id, title: c.name, items: filteredTasks.filter(t => getCategoryIds(t).includes(c.id)) });
                  });
                  groups.push({ key: "c-none", title: "No Category", items: filteredTasks.filter(t => getCategoryIds(t).length === 0) });
                } else if (groupBy === "gtd") {
                  GTD_FOLDERS.filter(f => f.id !== 'all').forEach(f => {
                    groups.push({ key: f.id, title: f.name, items: filteredTasks.filter(t => getNormalizedFolderId(t.globalStageId) === f.id) });
                  });
                } else if (groupBy === "project") {
                  projects.forEach(p => {
                    groups.push({ key: p.id, title: p.name, items: filteredTasks.filter(t => t.projectId === p.id) });
                  });
                  groups.push({ key: "proj-none", title: "No Project", items: filteredTasks.filter(t => !t.projectId || !projects.some(p => p.id === t.projectId)) });
                } else if (groupBy === "stakeholder") {
                   stakeholders.forEach(s => {
                     groups.push({ key: s.id, title: s.name, items: filteredTasks.filter(t => (t.stakeholderIds || []).includes(s.id)) });
                   });
                   groups.push({ key: "stake-none", title: "No Stakeholder", items: filteredTasks.filter(t => !t.stakeholderIds || t.stakeholderIds.length === 0) });
                } else if (groupBy === "stage") {
                  pipelineStages.forEach(s => {
                    groups.push({ key: s.id, title: s.name, items: filteredTasks.filter(t => (t.stageId || pipelineStages[0]?.id || "capture") === s.id) });
                  });
                } else if (groupBy === "timeSector") {
                  TIME_SECTORS.forEach(s => {
                    groups.push({ 
                      key: s.id, 
                      title: s.name, 
                      items: filteredTasks.filter(t => {
                        const ts = (t as any).timeSector || (t as any).proposed?.timeSector;
                        if (s.id === 'none') return !ts || ts === 'none';
                        return ts === s.id;
                      }) 
                    });
                  });
                }

                const activeGroups = groups.filter(g => g.items.length > 0);

                return activeGroups.map(group => (
                  <div key={group.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {groupBy !== "none" && (
                       <div 
                         className="bg-gray-50 border-b border-gray-200 px-4 py-3 font-semibold text-gray-800 cursor-pointer flex justify-between items-center"
                         onClick={() => toggleGroup(group.key)}
                       >
                         <div className="flex items-center gap-2">
                           {collapsedGroups.has(group.key) ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                           {group.title} <span className="text-gray-400 font-normal text-sm">({group.items.length})</span>
                         </div>
                       </div>
                    )}
                    
                    {!collapsedGroups.has(group.key) && group.items.map((task) => {
                      const subtasks = tasks.filter(t => t.parentId === task.id);
                      const isExpanded = expandedTasks.has(task.id);
                      
                      return (
                        <div 
                          key={task.id} 
                          className="relative group border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing"
                          onDoubleClick={() => {
                            navigate(`/work/action-board/${task.id}`);
                          }}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("taskId", task.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const draggedId = e.dataTransfer.getData("taskId");
                            if (draggedId && draggedId !== task.id) {
                              await handleTaskDropOnTask(draggedId, task.id, group.items);
                            }
                          }}
                        >
                          {/* Custom Tooltip */}
                          <div className="absolute right-1/4 top-0 -translate-y-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                             <p className="font-bold mb-1">{task.title}</p>
                             <p className="text-gray-400">Status: {task.status}</p>
                             {task.priority && <p className="text-gray-400">Priority: P{task.priority}</p>}
                             {task.gtdContext && <p className="text-gray-400">Context: {task.gtdContext}</p>}
                             {subtasks.length > 0 && <p className="text-gray-400 mt-1">{subtasks.length} subtasks</p>}
                          </div>

                          <div className={`flex flex-col sm:flex-row sm:items-center gap-4 ${cardSize === 'small' ? 'p-2' : cardSize === 'large' ? 'p-6' : 'p-4'}`}>
                            <div className="flex items-start gap-4 flex-1 w-full justify-between sm:justify-start">
                              <div className="flex items-start gap-4 flex-1">
                                {isSelectionMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedTasks.has(task.id)}
                                    onChange={(e) => {
                                      const next = new Set(selectedTasks);
                                      if (e.target.checked) next.add(task.id);
                                      else next.delete(task.id);
                                      setSelectedTasks(next);
                                    }}
                                    className="mt-1.5 w-4 h-4 rounded border-indigo-300 text-indigo-600 bg-indigo-50 cursor-pointer shrink-0"
                                  />
                                )}
                                <input 
                                  type="checkbox" 
                                  checked={task.status === "done" || task.stageId === "done"}
                                  onChange={() => {
                                     const isDone = task.status === 'done' || task.stageId === 'done';
                                     handleChangeStage(task.id, isDone ? (task.previousStageId || pipelineStages[0]?.id || "capture") : "done");
                                  }}
                                  className="mt-1 w-5 h-5 rounded-md border-gray-300 accent-black cursor-pointer bg-white shrink-0" 
                                />
                                <div className="flex-1 flex flex-col items-start">
                                  <div className="flex items-center gap-2 w-full">
                                    {editingTaskId === task.id ? (
                                      <input
                                        type="text"
                                        value={editingTitleText}
                                        onChange={(e) => setEditingTitleText(e.target.value)}
                                        onKeyDown={async (e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (editingTitleText.trim() && editingTitleText.trim() !== task.title) {
                                              try {
                                                await updateDoc(doc(db, "tasks", task.id), { title: editingTitleText.trim() });
                                              } catch (err) {
                                                console.error("Failed to update task title", err);
                                              }
                                            }
                                            setEditingTaskId(null);
                                          } else if (e.key === "Escape") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditingTaskId(null);
                                          }
                                        }}
                                        onBlur={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (editingTitleText.trim() && editingTitleText.trim() !== task.title) {
                                            try {
                                              await updateDoc(doc(db, "tasks", task.id), { title: editingTitleText.trim() });
                                            } catch (err) {
                                              console.error("Failed to update task title", err);
                                            }
                                          }
                                          setEditingTaskId(null);
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        onDoubleClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        autoFocus
                                        className="text-sm font-medium leading-snug px-2 py-1 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 w-full"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span 
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditingTaskId(task.id);
                                            setEditingTitleText(task.title);
                                          }}
                                          className={`text-sm font-medium hover:underline cursor-pointer ${task.status === 'done' || task.stageId === "done" ? 'text-gray-400 line-through' : 'text-gray-900'} ${cardSize === 'small' ? 'line-clamp-1' : ''}`}
                                        >
                                          {task.title}
                                        </span>
                                        {task.itemType && task.itemType !== 'task' && (
                                          <span className="bg-gray-200 text-gray-700 text-[10px] pl-1 pr-1.5 py-0.5 rounded-full capitalize leading-none no-underline flex items-center">
                                            {task.itemType === 'idea' && <Lightbulb className="w-3 h-3 inline-block mr-1 text-amber-500" />}
                                            {task.itemType === 'decision' && <Scale className="w-3 h-3 inline-block mr-1 text-blue-500" />}
                                            {task.itemType === 'meeting' && <Briefcase className="w-3 h-3 inline-block mr-1 text-purple-500" />}
                                            {task.itemType === 'presentation' && <Book className="w-3 h-3 inline-block mr-1 text-rose-500" />}
                                            {task.itemType === 'routine_follow_up' && <RefreshCw className="w-3 h-3 inline-block mr-1 text-teal-500" />}
                                            {task.itemType === '2mins' && <Zap className="w-3 h-3 inline-block mr-1 text-yellow-500" />}
                                            {task.itemType === '2mins' ? '2 Mins' : task.itemType === 'routine_follow_up' ? 'Routine Follow Up' : task.itemType}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {group.items.length > 1 && (
                                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            moveTaskInList(task.id, "up", group.items);
                                          }}
                                          disabled={group.items.findIndex(t => t.id === task.id) === 0}
                                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all disabled:opacity-20 disabled:hover:bg-transparent"
                                          title="Move Up"
                                        >
                                          <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            moveTaskInList(task.id, "down", group.items);
                                          }}
                                          disabled={group.items.findIndex(t => t.id === task.id) === group.items.length - 1}
                                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all disabled:opacity-20 disabled:hover:bg-transparent"
                                          title="Move Down"
                                        >
                                          <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                    <button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setSelectedTasks(new Set([task.id]));
                                        setIsFocusModeOpen(true);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shrink-0"
                                      title="Start Focus"
                                    >
                                      <Timer className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  {cardSize !== 'small' && (
                                    <div className="flex gap-2 flex-wrap mt-1 items-center">
                                    {/* Priority */}
                                    <div className="relative group/icon" title="Priority">
                                       <div className="flex items-center justify-center h-6 px-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 cursor-pointer overflow-hidden relative">
                                          <span className="text-[10px] font-bold w-full h-full flex items-center justify-center">
                                            {getNormalizedPriority(task.priority) === null ? "Sin prioridad" : `P${getNormalizedPriority(task.priority)}`}
                                          </span>
                                          <select 
                                            value={getNormalizedPriority(task.priority) || ""} 
                                            onChange={(e) => handleUpdatePriority(task.id, e.target.value === "" ? null : parseInt(e.target.value))}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                          >
                                            <option value="">Sin prioridad</option>
                                            <option value={1}>P1</option>
                                            <option value={2}>P2</option>
                                            <option value={3}>P3</option>
                                            <option value={4}>P4</option>
                                          </select>
                                       </div>
                                    </div>

                                    {/* Due Date */}
                                    <div className="relative group/icon" title="Due Date">
                                       <div className={`flex items-center justify-center h-6 px-1.5 rounded-md cursor-pointer overflow-hidden relative ${task.dueDate ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'} transition-colors gap-1`}>
                                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                                          {task.dueDate && <span className="text-[10px] font-bold">{new Date(task.dueDate + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>}
                                          <input
                                            type="date"
                                            value={task.dueDate && /^\d{4}-\d{2}-\d{2}/.test(task.dueDate) ? task.dueDate.substring(0, 10) : ""}
                                            onChange={(e) => updateDoc(doc(db, "tasks", task.id), { dueDate: e.target.value || deleteField() })}
                                            className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] opacity-0 cursor-pointer [color-scheme:light]"
                                          />
                                       </div>
                                    </div>
                                    <div className="relative group/icon font-sans" title="Project / Deal">
                                       <EntityPicker
                                         entityType="project_deal"
                                         selectedIds={task.projectId || ""}
                                         onSelect={(id) => updateDoc(doc(db, "tasks", task.id), { projectId: id ? String(id) : deleteField() })}
                                         workspaceId={workspace?.id || ""}
                                         userId={user?.uid || ""}
                                         placeholder="Project / Deal"
                                         triggerClassName="h-6 !py-0 !px-1.5 border-none bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-md shrink-0 flex items-center justify-center font-bold"
                                       />
                                    </div>

                                    {/* Tags / Category */}
                                    <div className="relative group/icon font-sans" title="Category / Tag">
                                       <EntityPicker
                                         entityType="tag"
                                         allowMultiple={true}
                                         selectedIds={getCategoryIds(task)}
                                         onSelect={(ids) => updateDoc(doc(db, "tasks", task.id), { categoryIds: ids as string[], categoryId: deleteField() })}
                                         workspaceId={workspace?.id || ""}
                                         userId={user?.uid || ""}
                                         placeholder="Tag"
                                         triggerClassName="h-6 !py-0 !px-1.5 border-none bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-md shrink-0 flex items-center justify-center font-bold"
                                       />
                                    </div>

                                    {/* Cadence / Recurrence */}
                                    <div className="relative group/icon" title="Recurrence">
                                       <div className={`flex items-center justify-center h-6 px-1.5 rounded-md cursor-pointer overflow-hidden relative ${task.recurrence ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'} transition-colors gap-1`}>
                                          <Repeat className="w-3.5 h-3.5 shrink-0" />
                                          {task.recurrence && <span className="text-[10px] font-bold capitalize whitespace-nowrap">{task.recurrence}</span>}
                                          <select
                                            value={task.recurrence || ""}
                                            onChange={(e) => updateDoc(doc(db, "tasks", task.id), { recurrence: e.target.value || deleteField() })}
                                            className="absolute inset-0 w-full mb-0 opacity-0 cursor-pointer"
                                          >
                                            <option value="">No Recurrence</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="yearly">Yearly</option>
                                            {task.recurrence && !['daily','weekly','monthly','yearly'].includes(task.recurrence) && (
                                              <option value={task.recurrence}>{task.recurrence}</option>
                                            )}
                                          </select>
                                       </div>
                                    </div>

                                    {/* GTD Folder / Global Stage */}
                                    <div className="relative group/icon" title="GTD Folder">
                                       <div className={`flex items-center justify-center h-6 px-2 rounded-md cursor-pointer overflow-hidden relative ${task.globalStageId ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'} gap-1`}>
                                          <Inbox className="w-3.5 h-3.5 shrink-0" />
                                          <span className="text-[10px] font-bold truncate uppercase max-w-[120px]">
                                            {GTD_FOLDERS.find(f => f.id === getNormalizedFolderId(task.globalStageId))?.name || 'Next Action'}
                                          </span>
                                          <select
                                            value={getNormalizedFolderId(task.globalStageId)}
                                            onChange={(e) => handleChangeFolder(task.id, e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                          >
                                            {GTD_FOLDERS.filter(f => f.id !== 'all').map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                          </select>
                                       </div>
                                    </div>

                                    {/* context / Anywhere */}
                                    <div className="relative group/icon" title="Context">
                                       <div className={`flex items-center justify-center h-6 px-1.5 rounded-md cursor-pointer overflow-hidden relative ${task.gtdContext ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'} gap-1`}>
                                          <span className="text-[10px] font-bold max-w-[80px] truncate uppercase">{task.gtdContext || '@anywhere'}</span>
                                          <select
                                            value={task.gtdContext || "none"}
                                            onChange={(e) => handleChangeContext(task.id, e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                          >
                                            <option value="none">@anywhere</option>
                                            {GTD_CONTEXTS.filter(c => c !== '@anywhere').map(c => <option key={c} value={c}>{c}</option>)}
                                          </select>
                                       </div>
                                    </div>

                                    {/* Pipeline Stage */}
                                    <div className="relative group/icon" title="Pipeline Stage">
                                       <div className={`flex items-center justify-center h-6 px-1.5 rounded-md cursor-pointer overflow-hidden relative ${task.stageId ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'} gap-1`}>
                                          <Kanban className="w-3.5 h-3.5 shrink-0" />
                                          <span className="text-[10px] font-bold max-w-[80px] truncate uppercase">{pipelineStages.find(s => s.id === task.stageId)?.name || pipelineStages[0]?.name || 'Stage'}</span>
                                          <select
                                            value={task.stageId || pipelineStages[0]?.id || "capture"}
                                            onChange={(e) => handleChangeStage(task.id, e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                          >
                                            {pipelineStages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                          </select>
                                       </div>
                                    </div>

                                    {/* Stakeholders */}
                                    <div className="flex -space-x-1 overflow-hidden" title="Stakeholders">
                                       {task.stakeholderIds?.map((sid: string) => {
                                         const s = stakeholders.find(st => st.id === sid);
                                         if (!s) return null;
                                         return (
                                           <div key={sid} className="inline-block h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 border-2 border-white flex items-center justify-center text-[10px] font-bold shrink-0 uppercase" title={s.name}>
                                             {s.name.slice(0, 1)}
                                           </div>
                                         );
                                       })}
                                       <EntityPicker
                                         entityType="stakeholder"
                                         allowMultiple={true}
                                         selectedIds={task.stakeholderIds || []}
                                         onSelect={(ids) => updateDoc(doc(db, "tasks", task.id), { stakeholderIds: ids as string[] })}
                                         workspaceId={workspace?.id || ""}
                                         userId={user?.uid || ""}
                                         customTrigger={
                                           <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 border-2 border-white text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors shrink-0">
                                             <Plus className="w-3 h-3" />
                                           </div>
                                         }
                                       />
                                    </div>

                                    {/* ONE THING */}
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleSetOneThing(task.id, !!task.isOneThing);
                                      }}
                                      className={`shrink-0 text-[9px] font-bold px-1.5 h-6 rounded-md uppercase transition-colors border ${task.isOneThing ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 border-transparent hover:border-gray-200'}`}
                                    >
                                      {task.isOneThing ? '★ ONE THING' : 'MAKE ONE THING'}
                                    </button>

                                    <button onClick={() => toggleExpand(task.id)} className="text-[10px] text-gray-500 font-bold flex items-center gap-1 hover:text-black bg-gray-100 px-1.5 py-0.5 rounded transition-colors h-6 ml-auto">
                                       {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                       {subtasks.length} Subtasks
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedTasks(new Set([task.id]));
                                  setIsFocusModeOpen(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shrink-0"
                                title="Start Focus"
                              >
                                <Timer className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteTask(task);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                                title="Delete Task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            </div>
                            
                            {task.status !== 'done' && cardSize === 'small' && (
                               <div className="flex items-center gap-2">
                                   <button onClick={() => toggleExpand(task.id)} className="text-[10px] text-gray-400 font-bold flex items-center gap-1 hover:text-black">
                                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      {subtasks.length}
                                   </button>
                               </div>
                            )}
                          </div>

                          {/* Collapsible Subtasks */}
                          {isExpanded && (
                       <div className="bg-gray-50/50 border-t border-gray-100 px-6 py-3 ml-7">
                         <div className="space-y-2 border-l-2 border-gray-200 pl-4">
                           {subtasks.length === 0 && <span className="text-xs text-gray-400">No subtasks yet.</span>}
                           {subtasks.map(st => (
                             <div 
                               key={st.id} 
                               className="flex items-start gap-2 cursor-pointer"
                               onDoubleClick={() => navigate(`/work/action-board/${st.id}`)}
                             >
                                <input 
                                  type="checkbox" 
                                  checked={st.status === "done"}
                                  onChange={() => setTaskStatus(st, st.status === 'done' ? 'open' : 'done')}
                                  className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-black cursor-pointer shrink-0 bg-white"
                                />
                                {editingTaskId === st.id ? (
                                  <input
                                    type="text"
                                    value={editingTitleText}
                                    onChange={(e) => setEditingTitleText(e.target.value)}
                                    onKeyDown={async (e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (editingTitleText.trim() && editingTitleText.trim() !== st.title) {
                                          try {
                                            await updateDoc(doc(db, "tasks", st.id), { title: editingTitleText.trim() });
                                          } catch (err) {
                                            console.error("Failed to update task title", err);
                                          }
                                        }
                                        setEditingTaskId(null);
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditingTaskId(null);
                                      }
                                    }}
                                    onBlur={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (editingTitleText.trim() && editingTitleText.trim() !== st.title) {
                                        try {
                                          await updateDoc(doc(db, "tasks", st.id), { title: editingTitleText.trim() });
                                        } catch (err) {
                                          console.error("Failed to update task title", err);
                                        }
                                      }
                                      setEditingTaskId(null);
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onDoubleClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    autoFocus
                                    className="text-sm font-medium leading-snug px-2 py-0.5 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 w-full"
                                  />
                                ) : (
                                  <span 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditingTaskId(st.id);
                                      setEditingTitleText(st.title);
                                    }}
                                    className={`text-sm ${st.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700 font-medium hover:text-black transition-colors'}`}
                                  >
                                    {st.title}
                                  </span>
                                )}
                             </div>
                           ))}
                         </div>
                       </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>
          ) : (
            <div className="text-center py-12 bg-white border border-gray-200 shadow-sm rounded-3xl">
              <CheckSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No tasks found here.</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>

      <AnimatePresence>
        {isProjectModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="font-bold text-gray-900">Select Projects</h3>
                 <button onClick={() => setIsProjectModalOpen(false)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-900 shadow-sm border border-gray-200 transition-colors">
                   <X className="w-4 h-4" />
                 </button>
              </div>
              
              <div className="p-4 border-b border-gray-100">
                 <div className="relative">
                   <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input 
                     type="text" 
                     value={projectSearch}
                     onChange={(e) => setProjectSearch(e.target.value)}
                     placeholder="Search projects..." 
                     className="pl-10 pr-4 py-3 bg-gray-100 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-black/5"
                   />
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                 <div 
                   onClick={() => {
                      if (selectedProjects.size === 0) {
                        setProjectFilterMode("all");
                        setIsProjectModalOpen(false);
                      } else {
                        setSelectedProjects(new Set());
                      }
                   }}
                   className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedProjects.size === 0 ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                 >
                   <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedProjects.size === 0 ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                     {selectedProjects.size === 0 && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                   </div>
                   <span className={`font-medium ${selectedProjects.size === 0 ? 'text-indigo-900' : 'text-gray-900'}`}>All Projects</span>
                 </div>
                 
                 <div 
                   onClick={() => {
                      const next = new Set(selectedProjects);
                      if (next.has('none')) next.delete('none'); else next.add('none');
                      setSelectedProjects(next);
                   }}
                   className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedProjects.has('none') ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                 >
                   <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedProjects.has('none') ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                     {selectedProjects.has('none') && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                   </div>
                   <span className={`font-medium ${selectedProjects.has('none') ? 'text-indigo-900' : 'text-gray-900'}`}>No Project</span>
                 </div>
                 
                 {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).map(project => (
                   <div 
                     key={project.id}
                     onClick={() => {
                       const next = new Set(selectedProjects);
                       if (next.has(project.id)) next.delete(project.id);
                       else next.add(project.id);
                       setSelectedProjects(next);
                     }}
                     className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedProjects.has(project.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                   >
                     <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedProjects.has(project.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                       {selectedProjects.has(project.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                     </div>
                     <span className={`font-medium ${selectedProjects.has(project.id) ? 'text-indigo-900' : 'text-gray-900'}`}>{project.name}</span>
                   </div>
                 ))}
                 
                 {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                   <div className="text-center py-6 text-gray-500 text-sm">
                     No projects found.
                   </div>
                 )}
              </div>
              
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                 <button 
                   onClick={() => {
                     setProjectFilterMode('projects');
                     if (currentView === "list" && selectedProjects.size > 0 && groupBy !== "project") {
                        setGroupBy("project");
                     }
                     setIsProjectModalOpen(false);
                   }}
                   className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                 >
                   Apply Filters
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Organize Review Dialog */}
      <AnimatePresence>
        {showOrganizeDialog && organizeResults && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[110] flex justify-center items-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl border border-gray-150"
            >
              <div className="p-5 border-b border-gray-150 flex justify-between items-center bg-gray-50/50 text-left">
                <div>
                  <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" /> AI Action Board Optimizer
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Review, refine, and approve task consolidations, description rewrites, and category-stage enrichments.</p>
                </div>
                <button 
                  onClick={() => setShowOrganizeDialog(false)} 
                  className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-900 shadow-sm border border-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
                {/* 1. Duplicates & Merges */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    Duplicate Consolidations & Merges
                  </h4>
                  {(!organizeResults.duplicateMerges || organizeResults.duplicateMerges.length === 0) ? (
                    <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-gray-100">No duplicates or overlapping tasks detected.</p>
                  ) : (
                    <div className="space-y-3">
                      {organizeResults.duplicateMerges.map((merge: any, idx: number) => {
                        const primary = tasks.find(t => t.id === merge.primaryTaskId);
                        const dupTitles = merge.duplicateTaskIds?.map((dupId: string) => {
                          const t = tasks.find(item => item.id === dupId);
                          return t ? t.title : "Unknown task";
                        });

                        return (
                          <div key={idx} className="bg-amber-50/40 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!approvedMerges[merge.primaryTaskId]}
                              onChange={(e) => {
                                setApprovedMerges({
                                  ...approvedMerges,
                                  [merge.primaryTaskId]: e.target.checked
                                });
                              }}
                              className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Consolidate</span>
                                <h5 className="font-extrabold text-xs text-gray-900">Merge Into: {primary ? primary.title : "Primary Task"}</h5>
                              </div>
                              <div className="text-[11px] text-gray-500 space-y-1 pl-1">
                                <p className="font-semibold text-gray-400">Merges and archives these duplicates:</p>
                                <ul className="list-disc list-inside space-y-0.5 font-medium text-amber-900/80">
                                  {dupTitles?.map((tTitle: string, tIdx: number) => (
                                    <li key={tIdx} className="truncate">{tTitle}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Enrichments */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-500">
                    Title, Description, & Metadata Enhancements
                  </h4>
                  {(!organizeResults.taskUpdates || organizeResults.taskUpdates.length === 0) ? (
                    <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-gray-100">No enhancements proposed.</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {organizeResults.taskUpdates.map((update: any, idx: number) => {
                        const original = tasks.find(t => t.id === update.taskId);
                        if (!original) return null;

                        return (
                          <div key={idx} className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!approvedUpdates[update.taskId]}
                              onChange={(e) => {
                                setApprovedUpdates({
                                  ...approvedUpdates,
                                  [update.taskId]: e.target.checked
                                });
                              }}
                              className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="space-y-1">
                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block">Original Title</span>
                                <p className="text-xs text-gray-500 font-semibold line-clamp-1">{original.title}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] text-indigo-600 font-black uppercase tracking-widest block">Enriched Optimization</span>
                                <p className="text-xs text-gray-900 font-extrabold">{update.enrichedTitle}</p>
                              </div>
                              {update.enrichedDescription && (
                                <div className="space-y-1 bg-white border border-gray-200/60 p-2.5 rounded-xl">
                                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block">Expanded Context</span>
                                  <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{update.enrichedDescription}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-150 bg-gray-50 flex gap-2 justify-end">
                <button 
                  onClick={() => setShowOrganizeDialog(false)}
                  className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={applyOrganizeChanges}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors"
                >
                  Apply Approved Optimizations
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Button Banner */}
      {organizeUndoBackup.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[90] bg-black text-white p-4 rounded-2xl shadow-xl flex items-center gap-4 animate-bounce-subtle border border-neutral-800">
          <div className="text-left">
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400">AI Optimize Active</h4>
            <p className="text-[11px] text-neutral-300 font-semibold">Changes are successfully saved. You can revert at any time.</p>
          </div>
          <button
            onClick={undoOrganizeChanges}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors shrink-0"
          >
            Revert Changes
          </button>
        </div>
      )}

      <FocusModeModal 
        isOpen={isFocusModeOpen} 
        onClose={() => setIsFocusModeOpen(false)} 
        selectedTaskIds={Array.from(selectedTasks)} 
        tasks={tasks} 
      />

      {coPilotTask && (
        <BoldiCoPilotModal
          isOpen={!!coPilotTask}
          onClose={() => setCoPilotTask(null)}
          itemId={coPilotTask.id}
          itemTitle={coPilotTask.title}
          itemDescription={coPilotTask.description || ""}
          itemType="task"
        />
      )}
    </motion.div>
  );
}
