import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Folder, Plus, Loader2, Sparkles, Briefcase, Activity, 
  Search, Tag, ShieldAlert, ArrowRightLeft,
  SlidersHorizontal, CheckSquare, Info, X,
  LayoutGrid, List, ArrowUp, ArrowDown, Bot
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AIProjectBuilder } from "./AIProjectBuilder";
import { getRoleForUser, canPerform } from "../lib/permissions";
import { BoldiCoPilotModal } from "./BoldiCoPilotModal";

export function ProjectsList() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  
  // User permissions
  const userRole = getRoleForUser(workspace, user?.email, user?.uid);
  const canUpdateProject = canPerform(userRole, 'project.update');

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [coPilotProject, setCoPilotProject] = useState<any | null>(null);

  // Command Center Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<'all' | 'deal' | 'implementation' | 'ongoing'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all_active'); // 'all_active', 'all', 'open', 'in_progress', 'done', 'cancelled', 'archived'
  const [selectedHealth, setSelectedHealth] = useState<string>('all'); // 'all', 'on_track', 'at_risk', 'blocked'
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'custom' | 'priority' | 'dueDate' | 'title'>('custom');

  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(
      collection(db, "projects"), 
      where("userId", "==", user.uid), 
      where("workspaceId", "==", workspace.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setProjects(items);
      setLoading(false);
    }, (err) => console.error(err));
    return () => unsub();
  }, [user, workspace]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim() || !user || !workspace) return;
    try {
      const type = selectedStage === 'all' 
        ? 'project' 
        : selectedStage;

      const titleCleaned = newProjectTitle.trim();
      const normalizedTitle = titleCleaned
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

      const docRef = await addDoc(collection(db, "projects"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: titleCleaned,
        normalizedTitle,
        status: "open",
        projectType: type,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        tags: selectedTag ? [selectedTag] : []
      });

      // Audit and Platform event logging
      const { logAuditAction, emitPlatformEvent } = await import("../lib/audit");
      await logAuditAction({
        workspaceId: workspace.id,
        actorId: user.uid,
        action: "project_created",
        entityType: "project",
        entityId: docRef.id,
        after: { title: titleCleaned, projectType: type }
      });
      await emitPlatformEvent({
        workspaceId: workspace.id,
        actorId: user.uid,
        eventType: "PROJECT_CREATED",
        entityType: "project",
        entityId: docRef.id
      });

      setNewProjectTitle("");
      navigate(`/work/projects/${docRef.id}`);
    } catch(e) {
      console.error(e);
    }
  };

  const handleQuickAdd = async (type: 'deal' | 'implementation' | 'ongoing') => {
    if (!user || !workspace) return;
    const title = prompt(`Enter title for new ${type === 'deal' ? 'Deal' : type + ' Project'}:`);
    if (!title || !title.trim()) return;
    
    try {
      const titleCleaned = title.trim();
      const normalizedTitle = titleCleaned
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

      const docRef = await addDoc(collection(db, "projects"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: titleCleaned,
        normalizedTitle,
        status: "open",
        projectType: type,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        tags: selectedTag ? [selectedTag] : []
      });

      // Audit and Platform event logging
      const { logAuditAction, emitPlatformEvent } = await import("../lib/audit");
      await logAuditAction({
        workspaceId: workspace.id,
        actorId: user.uid,
        action: "project_created",
        entityType: "project",
        entityId: docRef.id,
        after: { title: titleCleaned, projectType: type }
      });
      await emitPlatformEvent({
        workspaceId: workspace.id,
        actorId: user.uid,
        eventType: "PROJECT_CREATED",
        entityType: "project",
        entityId: docRef.id
      });

      navigate(`/work/projects/${docRef.id}`);
    } catch(e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-gray-400">Loading workspace project deck...</p>
      </div>
    );
  }

  // Extract all unique tags
  const allUniqueTags = Array.from(
    new Set(
      projects.flatMap(p => p.tags || [])
    )
  ).filter(Boolean) as string[];

  // Macro counts
  const totalActive = projects.filter(p => p.status !== 'archived').length;
  const totalDeals = projects.filter(p => p.projectType === 'deal' && p.status !== 'archived').length;
  const totalImplementation = projects.filter(p => p.projectType === 'implementation' && p.status !== 'archived').length;
  const totalOngoing = projects.filter(p => (p.projectType === 'ongoing' || !p.projectType || p.projectType === 'project') && p.status !== 'archived').length;
  const totalAtRiskOrBlocked = projects.filter(p => (p.health === 'blocked' || p.health === 'at_risk') && p.status !== 'archived').length;

  // Filter main portfolio list
  const filteredProjects = projects.filter(p => {
    // 1. Live Search (Title or Tag matching)
    const matchesSearch = searchQuery.trim() === "" || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    // 2. Macro Stage filter
    let matchesStage = true;
    if (selectedStage !== 'all') {
      if (selectedStage === 'ongoing') {
        matchesStage = p.projectType === 'ongoing' || p.projectType === 'project' || !p.projectType;
      } else {
        matchesStage = p.projectType === selectedStage;
      }
    }

    // 3. Status filter
    let matchesStatus = true;
    if (selectedStatus === 'all_active') {
      matchesStatus = p.status !== 'archived';
    } else if (selectedStatus !== 'all') {
      matchesStatus = p.status === selectedStatus;
    }

    // 4. Health filter
    const matchesHealth = selectedHealth === 'all' || p.health === selectedHealth;

    // 5. Selected Tag filter
    const matchesTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));

    return matchesSearch && matchesStage && matchesStatus && matchesHealth && matchesTag;
  });

  const getPriorityWeight = (priority: string) => {
    switch (priority || 'medium') {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  };

  const getDueDateValue = (dateStr: string) => {
    if (!dateStr) return Number.MAX_SAFE_INTEGER;
    return new Date(dateStr).getTime() || Number.MAX_SAFE_INTEGER;
  };

  const sortedFilteredProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'custom') {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 0;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    } else if (sortBy === 'priority') {
      const pA = getPriorityWeight(a.priority);
      const pB = getPriorityWeight(b.priority);
      if (pA !== pB) return pB - pA;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    } else if (sortBy === 'dueDate') {
      const dA = getDueDateValue(a.dueDate);
      const dB = getDueDateValue(b.dueDate);
      if (dA !== dB) return dA - dB;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    } else if (sortBy === 'title') {
      return (a.title || "").localeCompare(b.title || "");
    }
    return 0;
  });

  const handleMoveProject = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedFilteredProjects.length) return;

    const p1 = sortedFilteredProjects[index];
    const p2 = sortedFilteredProjects[targetIndex];

    const updatedProjects = [...projects].sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 0;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    const p1FullIdx = updatedProjects.findIndex(p => p.id === p1.id);
    const p2FullIdx = updatedProjects.findIndex(p => p.id === p2.id);

    if (p1FullIdx !== -1 && p2FullIdx !== -1) {
      updatedProjects.forEach((proj, idx) => {
        proj.sortOrder = idx * 10;
      });

      const tempOrder = updatedProjects[p1FullIdx].sortOrder;
      updatedProjects[p1FullIdx].sortOrder = updatedProjects[p2FullIdx].sortOrder;
      updatedProjects[p2FullIdx].sortOrder = tempOrder;

      try {
        await Promise.all([
          updateDoc(doc(db, "projects", p1.id), { sortOrder: updatedProjects[p1FullIdx].sortOrder, updatedAt: serverTimestamp() }),
          updateDoc(doc(db, "projects", p2.id), { sortOrder: updatedProjects[p2FullIdx].sortOrder, updatedAt: serverTimestamp() })
        ]);
      } catch (err) {
        console.error("Error updating project sort order:", err);
      }
    }
  };

  const hasActiveFilters = searchQuery !== "" || selectedStage !== 'all' || selectedStatus !== 'all_active' || selectedHealth !== 'all' || selectedTag !== null;

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStage('all');
    setSelectedStatus('all_active');
    setSelectedHealth('all');
    setSelectedTag(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 max-w-6xl mx-auto pb-24 space-y-6"
    >
      {/* Top Banner */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              {workspace?.name || 'Workspace'} Governance
            </span>
          </div>
          <h1 className="text-2xl font-black font-sans tracking-tight text-gray-900 mt-1">Projects & Deals deck</h1>
          <p className="text-gray-500 text-xs mt-0.5">Filter, configure, and transition initiatives through strategic macro stages.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
             onClick={() => navigate("/work/projects/health")}
             className="flex-1 sm:flex-initial bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-black px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
             <Activity className="w-4 h-4 text-indigo-600 animate-pulse" /> <span>Health Center</span>
          </button>
          <button
             onClick={() => setShowAIBuilder(true)}
             className="flex-1 sm:flex-initial bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
             <Sparkles className="w-4 h-4" /> <span>AI Builder</span>
          </button>
        </div>
      </header>

      {/* AI Builder Modal */}
      {showAIBuilder && (
         <AIProjectBuilder 
            user={user} 
            workspace={workspace} 
            onClose={() => setShowAIBuilder(false)} 
            onSuccess={(projectId) => {
               setShowAIBuilder(false);
               navigate(`/work/projects/${projectId}`);
            }} 
         />
      )}

      {/* 1. INTERACTIVE KPI METRIC bento grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Active card */}
        <div 
          onClick={() => {
            setSelectedStage('all');
            setSelectedStatus('all_active');
            setSelectedHealth('all');
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all duration-200 ${
            selectedStage === 'all' && selectedStatus === 'all_active' && selectedHealth === 'all'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
              : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Active Portfolio</span>
            <Folder className={`w-4 h-4 ${selectedStage === 'all' && selectedStatus === 'all_active' && selectedHealth === 'all' ? 'text-indigo-200' : 'text-indigo-600'}`} />
          </div>
          <div className="text-2xl font-black">{totalActive}</div>
          <div className="text-[9px] opacity-75 mt-0.5">Click to view all active</div>
        </div>

        {/* Deals card */}
        <div 
          onClick={() => {
            setSelectedStage('deal');
            setSelectedStatus('all_active');
            setSelectedHealth('all');
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all duration-200 ${
            selectedStage === 'deal' && selectedStatus === 'all_active' && selectedHealth === 'all'
              ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-100'
              : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">💰 Deals</span>
            <Briefcase className={`w-4 h-4 ${selectedStage === 'deal' && selectedStatus === 'all_active' && selectedHealth === 'all' ? 'text-amber-200' : 'text-amber-600'}`} />
          </div>
          <div className="text-2xl font-black">{totalDeals}</div>
          <div className="text-[9px] opacity-75 mt-0.5">Sales Pipeline</div>
        </div>

        {/* Implementation card */}
        <div 
          onClick={() => {
            setSelectedStage('implementation');
            setSelectedStatus('all_active');
            setSelectedHealth('all');
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all duration-200 ${
            selectedStage === 'implementation' && selectedStatus === 'all_active' && selectedHealth === 'all'
              ? 'bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-100'
              : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">⚙️ Implementation</span>
            <ArrowRightLeft className={`w-4 h-4 ${selectedStage === 'implementation' && selectedStatus === 'all_active' && selectedHealth === 'all' ? 'text-sky-200' : 'text-sky-600'}`} />
          </div>
          <div className="text-2xl font-black">{totalImplementation}</div>
          <div className="text-[9px] opacity-75 mt-0.5">Active Setup Phase</div>
        </div>

        {/* Ongoing card */}
        <div 
          onClick={() => {
            setSelectedStage('ongoing');
            setSelectedStatus('all_active');
            setSelectedHealth('all');
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all duration-200 ${
            selectedStage === 'ongoing' && selectedStatus === 'all_active' && selectedHealth === 'all'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100'
              : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">🔄 Ongoing</span>
            <CheckSquare className={`w-4 h-4 ${selectedStage === 'ongoing' && selectedStatus === 'all_active' && selectedHealth === 'all' ? 'text-emerald-200' : 'text-emerald-600'}`} />
          </div>
          <div className="text-2xl font-black">{totalOngoing}</div>
          <div className="text-[9px] opacity-75 mt-0.5">Recurring Delivery</div>
        </div>

        {/* Blocked/At Risk card */}
        <div 
          onClick={() => {
            setSelectedHealth('blocked');
            setSelectedStatus('all_active');
          }}
          className={`cursor-pointer p-4 rounded-2xl border col-span-2 md:col-span-1 transition-all duration-200 ${
            selectedHealth === 'blocked'
              ? 'bg-red-600 border-red-600 text-white shadow-md'
              : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">⚠️ At Risk/Blocked</span>
            <ShieldAlert className={`w-4 h-4 ${selectedHealth === 'blocked' ? 'text-red-200' : 'text-red-500 animate-pulse'}`} />
          </div>
          <div className="text-2xl font-black text-red-500" style={{ color: selectedHealth === 'blocked' ? '#ffffff' : undefined }}>{totalAtRiskOrBlocked}</div>
          <div className="text-[9px] opacity-75 mt-0.5">Requires Intervention</div>
        </div>
      </div>

      {/* 2. ADVANCED FILTERS PANEL */}
      <div className="bg-white border border-gray-250/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Command Center Filter Deck
          </h2>
          {hasActiveFilters && (
            <button 
              onClick={resetFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg"
            >
              Reset Filters
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Live Search & Macro Stage Select */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-450" />
            <input 
              type="text"
              placeholder="Search by title, target account, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50/50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600"
            />
          </div>

          {/* Macro Stage Filter Pills */}
          <div className="flex bg-gray-100 p-0.5 rounded-xl md:col-span-4 justify-between items-center h-full">
            {(['all', 'deal', 'implementation', 'ongoing'] as const).map((stage) => (
              <button
                key={stage}
                onClick={() => setSelectedStage(stage)}
                className={`flex-1 text-[10px] py-2 font-black uppercase tracking-wider rounded-lg transition-all ${
                  selectedStage === stage 
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {stage === 'all' ? 'All' : stage === 'deal' ? '💰 Deal' : stage === 'implementation' ? '⚙️ Imp' : '🔄 Ong'}
              </button>
            ))}
          </div>

          {/* Status Select */}
          <div className="md:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            >
              <option value="all_active">Status: Active</option>
              <option value="all">Status: Show All</option>
              <option value="open">🟢 Open</option>
              <option value="in_progress">⚙️ In Progress</option>
              <option value="done">✅ Done</option>
              <option value="cancelled">❌ Cancelled</option>
              <option value="archived">📦 Archived</option>
            </select>
          </div>

          {/* Health Select */}
          <div className="md:col-span-2">
            <select
              value={selectedHealth}
              onChange={(e) => setSelectedHealth(e.target.value)}
              className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            >
              <option value="all">Health: All</option>
              <option value="on_track">🟢 On Track</option>
              <option value="at_risk">🟡 At Risk</option>
              <option value="blocked">🔴 Blocked</option>
            </select>
          </div>
        </div>

        {/* 3. TAG CLOUD BROWSER */}
        {allUniqueTags.length > 0 && (
          <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mr-2 flex items-center gap-1">
              <Tag className="w-3 h-3 text-indigo-500" />
              Filter by Tag:
            </span>
            {allUniqueTags.map(tag => {
              const isSelected = selectedTag === tag;
              const count = projects.filter(p => p.tags?.includes(tag)).length;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`text-[9px] font-bold px-2.5 py-1 rounded-full transition-all border ${
                    isSelected 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200/60'
                  }`}
                >
                  #{tag} <span className={`ml-0.5 text-[8px] opacity-75`}>({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. CREATION INJECTORS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-sm text-gray-900">
            Create New {selectedStage === 'deal' ? 'Deal' : selectedStage === 'implementation' ? 'Implementation Project' : selectedStage === 'ongoing' ? 'Ongoing Project' : 'Project/Deal'}
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">Quickly seed a record in active focus workspace.</p>
        </div>
        
        <form onSubmit={handleAddProject} className="flex-1 flex gap-2 w-full">
          <input 
            type="text"
            required
            placeholder={
              selectedStage === 'deal' ? "e.g., Enterprise Sales Agreement" : 
              selectedStage === 'implementation' ? "e.g., Client onboarding kick-off" :
              "Enter a descriptive title..."
            }
            className="flex-1 bg-gray-50/50 border border-gray-250 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newProjectTitle.trim()}
            className="bg-black text-white px-5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Seed
          </button>
        </form>

        <div className="flex items-center gap-1.5 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
          <button 
            onClick={() => handleQuickAdd('deal')}
            className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-2 rounded-xl transition-colors"
          >
            + 💰 Deal
          </button>
          <button 
            onClick={() => handleQuickAdd('implementation')}
            className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-2 rounded-xl transition-colors"
          >
            + ⚙️ Imp
          </button>
          <button 
            onClick={() => handleQuickAdd('ongoing')}
            className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-2 rounded-xl transition-colors"
          >
            + 🔄 Ongoing
          </button>
        </div>
      </div>

      {/* 5. DYNAMIC CARDS PORTFOLIO LISTING */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-2 pr-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Initiatives Deck ({sortedFilteredProjects.length})
            </h2>
            <span className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-0.5 rounded-md">
              Showing matching {selectedStage !== 'all' ? selectedStage : 'all'} types
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-[10px] font-bold text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="custom">Custom Rank 🔢</option>
                <option value="priority">Priority ⚠️</option>
                <option value="dueDate">Due Date 📅</option>
                <option value="title">Alphabetical 🔠</option>
              </select>
            </div>

            {/* Grid / List Toggles */}
            <div className="flex bg-gray-105 p-0.5 bg-gray-100 rounded-xl items-center border border-gray-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-white text-indigo-600 shadow-sm border border-gray-200/50' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white text-indigo-600 shadow-sm border border-gray-200/50' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {sortedFilteredProjects.map((project) => {
                const isDeal = project.projectType === 'deal';
                const isImp = project.projectType === 'implementation';

                return (
                  <motion.div
                    layout
                    key={project.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="bg-white border border-gray-200 hover:border-indigo-200 rounded-3xl p-5 hover:shadow-md transition-all flex flex-col justify-between relative"
                  >
                    <div>
                      {/* Top Pill / Inline Selectors Row */}
                      <div className="flex items-center justify-between mb-3.5">
                        {/* Macro Stage Switcher Selector */}
                        <div className="relative">
                          <select
                            disabled={!canUpdateProject}
                            value={project.projectType || 'ongoing'}
                            onChange={async (e) => {
                              await updateDoc(doc(db, "projects", project.id), { 
                                projectType: e.target.value,
                                updatedAt: serverTimestamp()
                              });
                            }}
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border focus:outline-none cursor-pointer disabled:opacity-85 ${
                              isDeal ? 'bg-amber-50 text-amber-800 border-amber-200/50' :
                              isImp ? 'bg-sky-50 text-sky-800 border-sky-200/50' :
                              'bg-emerald-50 text-emerald-800 border-emerald-200/50'
                            }`}
                          >
                            <option value="deal">💰 Deal</option>
                            <option value="implementation">⚙️ Implementation</option>
                            <option value="ongoing">🔄 Ongoing</option>
                          </select>
                        </div>

                        {/* Status Selector */}
                        <div className="flex items-center gap-1.5">
                          <select
                            disabled={!canUpdateProject}
                            value={project.status || 'open'}
                            onChange={async (e) => {
                              await updateDoc(doc(db, "projects", project.id), { 
                                status: e.target.value,
                                updatedAt: serverTimestamp()
                              });
                            }}
                            className="text-[9px] bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-gray-200 focus:outline-none cursor-pointer disabled:opacity-80"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="archived">Archived</option>
                          </select>

                          {/* Health Selector */}
                          <select
                            disabled={!canUpdateProject}
                            value={project.health || 'none'}
                            onChange={async (e) => {
                              await updateDoc(doc(db, "projects", project.id), { 
                                health: e.target.value === 'none' ? null : e.target.value,
                                updatedAt: serverTimestamp()
                              });
                            }}
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border focus:outline-none cursor-pointer disabled:opacity-80 ${
                              project.health === 'on_track' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              project.health === 'at_risk' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              project.health === 'blocked' ? 'bg-red-50 border-red-200 text-red-700' :
                              'bg-gray-50 border-gray-200 text-gray-500'
                            }`}
                          >
                            <option value="none">Health: --</option>
                            <option value="on_track">🟢 On Track</option>
                            <option value="at_risk">🟡 At Risk</option>
                            <option value="blocked">🔴 Blocked</option>
                          </select>
                        </div>
                      </div>

                      {/* Title with Route Link */}
                      <Link to={`/work/projects/${project.id}`} className="block group">
                        <h3 className="font-bold text-md text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1.5">
                          {project.title}
                        </h3>
                        {project.dueDate ? (
                          <p className="text-[10px] text-gray-450 font-medium">Target Completion: {project.dueDate}</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic">No target deadline set</p>
                        )}
                      </Link>
                    </div>

                    {/* Tags & Actions Footer */}
                    <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between gap-2">
                      {/* Tags List */}
                      <div className="flex flex-wrap items-center gap-1 overflow-hidden max-w-[70%]">
                        {project.tags && project.tags.length > 0 ? (
                          project.tags.map((t: string) => (
                            <button
                              key={t}
                              onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors ${
                                selectedTag === t 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-gray-100 text-gray-650 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                            >
                              #{t}
                            </button>
                          ))
                        ) : (
                          <span className="text-[9px] text-gray-400 italic">No tags</span>
                        )}
                      </div>

                      {/* Quick navigation indicator & Co-Pilot */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCoPilotProject(project);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/50 rounded-lg text-[10px] font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs group/boldi shrink-0"
                          title="Ask Boldi: Research or draft email"
                        >
                          <Bot className="w-3.5 h-3.5 text-emerald-600 animate-pulse group-hover/boldi:rotate-12 transition-transform" /> 
                          <span>Ask Boldi</span>
                        </button>
                        <Link 
                          to={`/work/projects/${project.id}`} 
                          className="flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-650 hover:text-indigo-600 rounded-lg text-[10px] font-bold transition-all shrink-0"
                        >
                          <span>Workspace</span>
                          <ArrowRightLeft className="w-3 h-3 text-indigo-500" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {sortedFilteredProjects.length === 0 && (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-3xl text-gray-500 bg-gray-50/30">
                 <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                 <p className="font-bold text-sm text-gray-800">No initiatives found matching filters</p>
                 <p className="text-xs text-gray-400 mt-1">Try resetting selected filters or seed a new record.</p>
                 {hasActiveFilters && (
                   <button 
                     onClick={resetFilters}
                     className="mt-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-indigo-200"
                   >
                     Clear Filter Deck
                   </button>
                 )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-150 text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                    {sortBy === 'custom' && <th className="p-4 w-12 text-center">Rank</th>}
                    <th className="p-4">Initiative / Project Title</th>
                    <th className="p-4 w-32">Stage</th>
                    <th className="p-4 w-32">Priority</th>
                    <th className="p-4 w-32">Health</th>
                    <th className="p-4 w-32">Status</th>
                    <th className="p-4 w-28">Due Date</th>
                    <th className="p-4 w-20 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence mode="popLayout">
                    {sortedFilteredProjects.map((project, index) => {
                      const isDeal = project.projectType === 'deal';
                      const isImp = project.projectType === 'implementation';

                      return (
                        <motion.tr
                          layout
                          key={project.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-neutral-50/50 group text-gray-750 text-gray-700"
                        >
                          {/* Reordering Controls column */}
                          {sortBy === 'custom' && (
                            <td className="p-4 whitespace-nowrap text-center">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMoveProject(index, 'up')}
                                  className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] text-gray-450 font-bold select-none">{index + 1}</span>
                                <button
                                  type="button"
                                  disabled={index === sortedFilteredProjects.length - 1}
                                  onClick={() => handleMoveProject(index, 'down')}
                                  className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}

                          {/* Title Column */}
                          <td className="p-4">
                            <div className="space-y-1 max-w-[280px]">
                              <Link 
                                to={`/work/projects/${project.id}`}
                                className="font-bold text-gray-950 hover:text-indigo-600 line-clamp-1 text-sm block"
                              >
                                {project.title}
                              </Link>
                              {/* Tags lists */}
                              <div className="flex flex-wrap gap-1">
                                {project.tags && project.tags.length > 0 ? (
                                  project.tags.map((t: string) => (
                                    <span key={t} className="text-[8px] font-black uppercase bg-gray-100 text-gray-500 px-1 py-0.5 rounded">
                                      #{t}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-gray-400 italic">No tags</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Stage Dropdown */}
                          <td className="p-4 whitespace-nowrap">
                            <select
                              disabled={!canUpdateProject}
                              value={project.projectType || 'ongoing'}
                              onChange={async (e) => {
                                await updateDoc(doc(db, "projects", project.id), { 
                                  projectType: e.target.value,
                                  updatedAt: serverTimestamp()
                                });
                              }}
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border focus:outline-none cursor-pointer disabled:opacity-85 ${
                                isDeal ? 'bg-amber-50 text-amber-800 border-amber-200/50' :
                                isImp ? 'bg-sky-50 text-sky-800 border-sky-200/50' :
                                'bg-emerald-50 text-emerald-800 border-emerald-200/50'
                              }`}
                            >
                              <option value="deal">💰 Deal</option>
                              <option value="implementation">⚙️ Imp</option>
                              <option value="ongoing">🔄 Ong</option>
                            </select>
                          </td>

                          {/* Priority Dropdown */}
                          <td className="p-4 whitespace-nowrap">
                            <select 
                              disabled={!canUpdateProject}
                              value={project.priority || 'medium'}
                              onChange={async (e) => {
                                await updateDoc(doc(db, "projects", project.id), { 
                                  priority: e.target.value,
                                  updatedAt: serverTimestamp()
                                });
                              }}
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                project.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                project.priority === 'low' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                'bg-gray-50 text-gray-600 border-gray-200'
                              }`}
                            >
                              <option value="high">🔴 High</option>
                              <option value="medium">🟡 Medium</option>
                              <option value="low">🔵 Low</option>
                            </select>
                          </td>

                          {/* Health Dropdown */}
                          <td className="p-4 whitespace-nowrap">
                            <select
                              disabled={!canUpdateProject}
                              value={project.health || 'none'}
                              onChange={async (e) => {
                                await updateDoc(doc(db, "projects", project.id), { 
                                  health: e.target.value === 'none' ? null : e.target.value,
                                  updatedAt: serverTimestamp()
                                });
                              }}
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border focus:outline-none cursor-pointer disabled:opacity-80 ${
                                project.health === 'on_track' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                project.health === 'at_risk' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                project.health === 'blocked' ? 'bg-red-550/10 border-red-200 text-red-700 bg-red-50' :
                                'bg-gray-50 border-gray-200 text-gray-500'
                              }`}
                            >
                              <option value="none">Health: --</option>
                              <option value="on_track">🟢 On Track</option>
                              <option value="at_risk">🟡 At Risk</option>
                              <option value="blocked">🔴 Blocked</option>
                            </select>
                          </td>

                          {/* Status Dropdown */}
                          <td className="p-4 whitespace-nowrap">
                            <select
                              disabled={!canUpdateProject}
                              value={project.status || 'open'}
                              onChange={async (e) => {
                                await updateDoc(doc(db, "projects", project.id), { 
                                  status: e.target.value,
                                  updatedAt: serverTimestamp()
                                });
                              }}
                              className="text-[10px] bg-gray-50 hover:bg-gray-100 text-gray-650 font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-gray-200 focus:outline-none cursor-pointer disabled:opacity-80"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="archived">Archived</option>
                            </select>
                          </td>

                          {/* Due Date */}
                          <td className="p-4 whitespace-nowrap">
                            {project.dueDate ? (
                              <span className="font-mono text-[10px] font-semibold text-gray-600 bg-neutral-100 px-2 py-1 rounded">
                                {project.dueDate}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-[10px]">Not set</span>
                            )}
                          </td>

                          {/* Workspace link */}
                          <td className="p-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCoPilotProject(project);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/50 rounded-lg text-[10px] font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs group/boldi"
                                title="Ask Boldi: Research or draft email"
                              >
                                <Bot className="w-3.5 h-3.5 text-emerald-600 animate-pulse group-hover/boldi:rotate-12 transition-transform" /> 
                                <span>Ask Boldi</span>
                              </button>
                              <Link 
                                to={`/work/projects/${project.id}`}
                                className="text-indigo-600 hover:text-indigo-900 font-bold hover:underline text-xs"
                              >
                                Open ↗
                              </Link>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {sortedFilteredProjects.length === 0 && (
              <div className="py-16 text-center text-gray-500 bg-gray-50/20 rounded-3xl border border-dashed border-gray-200 m-4">
                <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="font-bold text-sm text-gray-800">No initiatives found matching filters</p>
                <p className="text-xs text-gray-400 mt-1">Try resetting selected filters or seed a new record.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {coPilotProject && (
        <BoldiCoPilotModal
          isOpen={!!coPilotProject}
          onClose={() => setCoPilotProject(null)}
          itemId={coPilotProject.id}
          itemTitle={coPilotProject.title}
          itemDescription={coPilotProject.description || ""}
          itemType="project"
        />
      )}
    </motion.div>
  );
}
