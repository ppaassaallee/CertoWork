import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { Users, Plus, X, Trash2, Mail, Briefcase, Search, Loader2, Sparkles, AlertTriangle, Send, CheckSquare, Square, Calendar } from "./ui/Icon";
import { motion, AnimatePresence } from "motion/react";
import { Stakeholder } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

export function StakeholdersList() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // New stakeholder form fields
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");

  // AI Insights state
  const [consulting, setConsulting] = useState(false);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, string>>({});

  // Direct quick task form state
  const [quickTaskTitle, setQuickTaskTitle] = useState("");

  useEffect(() => {
    if (!user || !workspace) return;
    
    // Fetch stakeholders
    const qStakeholders = query(
      collection(db, "stakeholders"), 
      where("userId", "==", user.uid), 
      where("workspaceId", "==", workspace.id)
    );
    const unsubStakeholders = onSnapshot(qStakeholders, (snap) => {
      const items: Stakeholder[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Stakeholder));
      const sorted = items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStakeholders(sorted);
      
      // Auto select first stakeholder on first load
      if (sorted.length > 0 && !selectedStakeholder) {
        setSelectedStakeholder(sorted[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "stakeholders");
    });

    // Fetch tasks
    const qTasks = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setTasks(items);
    });

    // Fetch projects
    const qProjects = query(
      collection(db, "projects"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubProjects = onSnapshot(qProjects, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setProjects(items);
    });

    return () => { unsubStakeholders(); unsubTasks(); unsubProjects(); };
  }, [user, workspace]);

  // Reset insights whenever stakeholder selection changes
  useEffect(() => {
    setAiInsight(null);
  }, [selectedStakeholder]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user || !workspace) return;
    try {
      const docRef = await addDoc(collection(db, "stakeholders"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewName("");
      setNewEmail("");
      setNewRole("");
      setIsAdding(false);
      setSelectedStakeholder({
        id: docRef.id,
        userId: user.uid,
        workspaceId: workspace.id,
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole.trim()
      } as Stakeholder);
    } catch (e) { 
      handleFirestoreError(e, OperationType.CREATE, "stakeholders");
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Stakeholder>) => {
    try {
      await updateDoc(doc(db, "stakeholders", id), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      if (selectedStakeholder?.id === id) {
        setSelectedStakeholder(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (e) { 
      handleFirestoreError(e, OperationType.UPDATE, `stakeholders/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stakeholder? All task assignments will remain but reference to this stakeholder will be removed.')) return;
    try {
      await deleteDoc(doc(db, "stakeholders", id));
      if (selectedStakeholder?.id === id) {
        setSelectedStakeholder(stakeholders.find(s => s.id !== id) || null);
      }
    } catch (e) { 
      handleFirestoreError(e, OperationType.DELETE, `stakeholders/${id}`);
    }
  };

  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim() || !user || !workspace || !selectedStakeholder) return;
    try {
      await addDoc(collection(db, "tasks"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: quickTaskTitle.trim(),
        status: "open",
        priority: 2, // Medium
        stakeholderIds: [selectedStakeholder.id],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setQuickTaskTitle("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: currentStatus === "open" ? "done" : "open",
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAIInsights = async () => {
    if (!selectedStakeholder || !user?.uid) return;
    setConsulting(true);
    setAiInsight(null);

    // Get assigned tasks and associated projects
    const sTasks = tasks.filter(t => t.stakeholderIds?.includes(selectedStakeholder.id));
    const sProjects = projects.filter(p => sTasks.some(t => t.projectId === p.id));

    try {
      const res = await fetch("/api/stakeholder/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stakeholder: selectedStakeholder,
          tasks: sTasks,
          projects: sProjects
        })
      });
      if (!res.ok) throw new Error("Could not construct AI diagnostics.");
      const data = await res.json();
      setAiInsight(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to contact strategist server.");
    } finally {
      setConsulting(false);
    }
  };

  const dispatchInsightAction = async (idx: number, actionItem: any) => {
    if (!user || !workspace || !selectedStakeholder) return;
    const blockKey = `${selectedStakeholder.id}_${idx}`;
    setDispatchStatus(prev => ({ ...prev, [blockKey]: 'dispatching' }));

    try {
      // Direct insertion as an active Task in this workspace assigned to them!
      await addDoc(collection(db, "tasks"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: `Follow-up: ${actionItem.title}`,
        description: `${actionItem.description}\n\nReason: ${actionItem.reason}`,
        status: "open",
        priority: 1, // High Priority
        stakeholderIds: [selectedStakeholder.id],
        dueDate: actionItem.proposedDueDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setDispatchStatus(prev => ({ ...prev, [blockKey]: 'dispatched' }));
    } catch (err) {
      console.error(err);
      setDispatchStatus(prev => ({ ...prev, [blockKey]: 'error' }));
    }
  };

  const filteredStakeholders = stakeholders.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sub-metrics and associations for the selected stakeholder
  const stakeholderTasks = selectedStakeholder ? tasks.filter(t => t.stakeholderIds?.includes(selectedStakeholder.id)) : [];
  const openTasks = stakeholderTasks.filter(t => t.status === "open");
  const closedTasks = stakeholderTasks.filter(t => t.status === "done");
  
  // Find which projects are referenced by their tasks
  const associatedProjects = selectedStakeholder 
    ? projects.filter(p => stakeholderTasks.some(t => t.projectId === p.id)) 
    : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 max-w-7xl mx-auto pb-24"
    >
      <header className="mb-8 mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Stakeholder Command Center
          </h1>
          <p className="text-gray-500 text-sm mt-1">Direct stakeholder commitments, cross-project dependencies, and AI communication playbooks.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 self-start"
        >
          <Plus className="w-5 h-5" />
          Add Stakeholder
        </button>
      </header>

      {/* Adding Modal / Sliding overlay */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <form onSubmit={handleAdd} className="bg-white border-2 border-emerald-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-900">New Stakeholder / Contact</h3>
                <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Full Name</label>
                  <input 
                    autoFocus
                    required
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Alejandro Boldr"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                  <input 
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="e.g. alejandro@boldr.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Role / Company Title</label>
                  <input 
                    type="text"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    placeholder="e.g. CEO @ Boldr"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  type="submit"
                  disabled={!newName.trim()}
                  className="bg-black text-white px-8 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Create Stakeholder
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Directory Search List */}
        <section className="lg:col-span-4 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Teammate & Contact Directory</h2>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input 
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto pr-1">
            {filteredStakeholders.map(s => {
              const isSelected = selectedStakeholder?.id === s.id;
              const pendingCount = tasks.filter(t => t.status === "open" && t.stakeholderIds?.includes(s.id)).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStakeholder(s)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left gap-3 border ${
                    isSelected 
                      ? 'bg-emerald-50/50 border-emerald-100 text-black shadow-none' 
                      : 'bg-transparent border-transparent hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border uppercase ${
                      isSelected ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-gray-150 text-gray-600 border-gray-200'
                    }`}>
                      {s.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-xs truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{s.role || "No explicit role"}</p>
                    </div>
                  </div>

                  {pendingCount > 0 && (
                    <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 font-bold px-1.5 py-0.5 rounded-full">
                      {pendingCount} open
                    </span>
                  )}
                </button>
              );
            })}

            {filteredStakeholders.length === 0 && (
              <p className="text-center py-12 text-xs text-gray-400 italic">No contacts match the search terms.</p>
            )}
          </div>
        </section>

        {/* Right Side: Command Center Desk */}
        <section className="lg:col-span-8 space-y-6">
          {selectedStakeholder ? (
            <div className="space-y-6">
              
              {/* Profile Card Header */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center text-xl font-black uppercase">
                    {selectedStakeholder.name.slice(0, 2)}
                  </div>
                  <div>
                    <input 
                      type="text"
                      defaultValue={selectedStakeholder.name}
                      onBlur={(e) => handleUpdate(selectedStakeholder.id, { name: e.target.value })}
                      className="block font-black text-gray-900 bg-transparent border-none text-xl p-0 focus:ring-0 leading-tight hover:bg-gray-50 rounded"
                    />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <input 
                          type="email"
                          defaultValue={selectedStakeholder.email || ""}
                          placeholder="Add email address..."
                          onBlur={(e) => handleUpdate(selectedStakeholder.id, { email: e.target.value })}
                          className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-44 hover:bg-gray-50 rounded"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                        <input 
                          type="text"
                          defaultValue={selectedStakeholder.role || ""}
                          placeholder="Add corporate role..."
                          onBlur={(e) => handleUpdate(selectedStakeholder.id, { role: e.target.value })}
                          className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-44 hover:bg-gray-50 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center">
                  <button
                    onClick={fetchAIInsights}
                    disabled={consulting}
                    className="bg-black text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-800 transition-all border border-black shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    Consult strategist
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedStakeholder.id)}
                    className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete User"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* AI Communications Advice Block */}
              <AnimatePresence>
                {consulting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-emerald-50/40 border-2 border-dashed border-emerald-200/50 rounded-3xl p-6 text-center"
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-emerald-950">Drafting Certo Work leadership counsel for {selectedStakeholder.name}...</p>
                  </motion.div>
                )}

                {aiInsight && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="bg-emerald-50/20 border border-emerald-100 rounded-3xl p-6 space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-emerald-950 text-sm">Strategic Briefing</h3>
                      </div>
                      <span className="text-[10px] bg-emerald-100/50 text-emerald-800 border border-emerald-200/50 font-bold px-2 py-0.5 rounded-full">
                        Vibe: {aiInsight.relationshipVibe}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed italic">"{aiInsight.summaryText}"</p>

                    {/* Blockers & Communication Move */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aiInsight.blockersIdentified?.length > 0 && (
                        <div className="bg-white border border-emerald-50/30 p-4 rounded-2xl shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Blockers Detected
                          </p>
                          <ul className="list-disc pl-4 space-y-1 text-xs text-gray-600">
                            {aiInsight.blockersIdentified.map((b: string, i: number) => <li key={i} className="block">• {b}</li>)}
                          </ul>
                        </div>
                      )}
                      
                      <div className="bg-white border border-emerald-50/30 p-4 rounded-2xl shadow-sm">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Recommended Communication Play</p>
                        <p className="text-xs text-gray-700 font-bold">{aiInsight.communicationPlay}</p>
                      </div>
                    </div>

                    {/* Proposed Actions */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest pl-1">Proposed Micro-Action Candidates</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {aiInsight.proposedActions?.map((act: any, idx: number) => {
                          const blockKey = `${selectedStakeholder.id}_${idx}`;
                          const status = dispatchStatus[blockKey];
                          return (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-150 flex flex-col justify-between">
                              <div>
                                <h4 className="font-bold text-gray-900 text-xs mb-1">{act.title}</h4>
                                <p className="text-[10px] text-gray-500 leading-normal mb-2">{act.description}</p>
                                <p className="text-[10px] text-indigo-600 italic">"Why: {act.reason}"</p>
                              </div>
                              <div className="border-t border-gray-100 mt-3 pt-2.5 flex items-center justify-between">
                                <span className="text-[9px] text-gray-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {act.proposedDueDate || "Within 2 days"}
                                </span>
                                <button
                                  onClick={() => dispatchInsightAction(idx, act)}
                                  disabled={status === 'dispatched'}
                                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                                    status === 'dispatched'
                                      ? 'bg-emerald-50 text-emerald-800'
                                      : 'bg-black text-white hover:bg-gray-800'
                                  }`}
                                >
                                  <Send className="w-3 h-3" />
                                  {status === 'dispatching' ? 'Sending...' : status === 'dispatched' ? 'Assigned' : 'Dispatch Action'}
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

              {/* Grid: Commitments vs Linked Projects */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Commitments & Tasks List (8 cols) */}
                <div className="md:col-span-8 bg-white border border-gray-200 rounded-3xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
                      Assigned Commitments ({openTasks.length})
                    </h3>
                  </div>

                  {/* Quick Task Adding Input */}
                  <form onSubmit={handleCreateQuickTask} className="flex gap-2">
                    <input
                      type="text"
                      value={quickTaskTitle}
                      onChange={(e) => setQuickTaskTitle(e.target.value)}
                      placeholder={`Assign action item for ${selectedStakeholder.name.split(" ")[0]}...`}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!quickTaskTitle.trim()}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </form>

                  <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                    {/* Active tasks */}
                    {openTasks.map(t => (
                      <div key={t.id} className="py-3 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleToggleTask(t.id, t.status)} className="text-gray-400 hover:text-emerald-600 transition-colors shrink-0">
                            <Square className="w-4.5 h-4.5" />
                          </button>
                          <div>
                            <span className="text-xs font-semibold text-gray-900 block">{t.title}</span>
                            {t.dueDate && (
                              <span className="text-[9px] text-gray-400 block mt-0.5">Due: {t.dueDate}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          t.priority === 1 ? "bg-rose-50 text-rose-700" : t.priority === 3 ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-700"
                        }`}>
                          P{t.priority || 2}
                        </span>
                      </div>
                    ))}

                    {/* Completed commitments */}
                    {closedTasks.length > 0 && (
                      <div className="pt-4 mt-2 border-t border-dashed border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Recently Completed</p>
                        {closedTasks.map(t => (
                          <div key={t.id} className="py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-3 opacity-60">
                              <button onClick={() => handleToggleTask(t.id, t.status)} className="text-emerald-600 hover:text-gray-400 transition-colors shrink-0">
                                <CheckSquare className="w-4.5 h-4.5" />
                              </button>
                              <span className="text-xs line-through text-gray-500">{t.title}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {stakeholderTasks.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-8 italic">No pending tasks or commitments assigned.</p>
                    )}
                  </div>
                </div>

                {/* Associated Projects widget (4 cols) */}
                <div className="md:col-span-4 bg-white border border-gray-200 rounded-3xl p-5 space-y-4 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Project Network</h3>
                  
                  <div className="space-y-3">
                    {associatedProjects.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => navigate(`/work/projects/${p.id}`)}
                        className="bg-gray-50 p-3 rounded-xl border border-gray-150 cursor-pointer hover:border-indigo-400 hover:bg-white transition-all"
                      >
                        <p className="text-xs font-bold text-gray-900 truncate">{p.title}</p>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded mt-2 inline-block ${
                          p.healthStatus === "On Track" ? "bg-emerald-55 text-emerald-800" : p.healthStatus === "At Risk" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {p.healthStatus || "Proposed"}
                        </span>
                      </div>
                    ))}

                    {associatedProjects.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-6">Not linked to any projects.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-3xl py-24 text-center shadow-sm">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-bounce" />
              <p className="text-gray-500 font-medium">Select a contact to open the Command Center desk.</p>
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
