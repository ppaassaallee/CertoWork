import { motion, AnimatePresence } from "motion/react";
import { Check, X, AlignLeft, AlertCircle, Loader2, ArrowRight, List as ListIcon, Calendar, Kanban, Users, Folder, Inbox, Activity, Trash, MoreHorizontal } from "./ui/Icon";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface ReviewCandidate {
  id: string;
  type: string; // task, decision, waiting_for, presentation, health, knowledge, project, someday
  title: string;
  why: string;
  source: string;
  proposed: any;
  confidence: string;
  action: string;
  status: string; // new, reviewing, approved, killed, archived, blocked
  actionCategory?: string; // needs_approval, needs_decision, can_delegate, can_kill, needs_scheduling, needs_clarification
  priority?: string;
  dueDate?: string;
  projectId?: string;
  owner?: string;
  createdAt?: any;
}

const VIEWS = [
  { id: "inbox", label: "Inbox", icon: Inbox, enabled: true },
  { id: "kanban", label: "Board", icon: Kanban, enabled: true },
  { id: "list", label: "List", icon: ListIcon, enabled: true },
  { id: "calendar", label: "Calendar", icon: Calendar, enabled: false },
  { id: "source", label: "Source", icon: AlignLeft, enabled: false },
  { id: "project", label: "Project", icon: Folder, enabled: false },
  { id: "people", label: "People", icon: Users, enabled: false },
  { id: "priority", label: "Priority", icon: Activity, enabled: false }
];

export function Review() {
  const { user, workspace } = useAuth();
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState("inbox");
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    if (!user || !workspace) return;
    
    // Fetch non-deleted items. For now, checking status != killed and status != approved
    const q = query(
      collection(db, "review_candidates"), 
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ReviewCandidate[] = [];
      snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() } as ReviewCandidate;
        if (item.status !== "killed" && item.status !== "approved" && item.status !== "archived") {
           // Ensure it has an action category for boards
           if (!item.actionCategory) item.actionCategory = "needs_approval";
           items.push(item);
        }
      });
      // Sort by creation or priority here if needed
      setCandidates(items);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, workspace]);

  const handleApprove = async (card: ReviewCandidate) => {
    if (!user) return;
    setActioning(card.id);
    try {
      const basePayload: any = {
        userId: user.uid,
        workspaceId: workspace?.id || user.uid, // Fallback to user.uid
        title: card.title,
        status: "open",
        reviewItemId: card.id,
        source: card.source || '',
        reason: card.why || '',
        confidence: card.confidence || '',
        proposedPayload: card.proposed || {},
        sourceType: "triage",
        sourceId: card.id,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const getNormalizedPriority = (priority: any): number => {
        if (priority === undefined || priority === null) return 4;
        if (typeof priority === 'number') {
          if (priority >= 1 && priority <= 4) return priority;
        }
        if (typeof priority === 'string') {
          const clean = priority.toUpperCase().replace('P', '').trim();
          const num = parseInt(clean, 10);
          if (!isNaN(num) && num >= 1 && num <= 4) return num;
        }
        return 4;
      };

      // Map proposed attributes if they exist
      if (card.proposed) {
        basePayload.priority = getNormalizedPriority(card.proposed.priority);
        if (card.proposed.dueDate) basePayload.dueDate = card.proposed.dueDate;
        if (card.proposed.timeSector) basePayload.timeSector = card.proposed.timeSector;
        if (card.proposed.description) basePayload.description = card.proposed.description;
        if (card.proposed.context) {
          basePayload.context = card.proposed.context;
          basePayload.gtdContext = card.proposed.context;
        }
        if (card.proposed.tags) {
          basePayload.tagIds = card.proposed.tags;
          basePayload.categoryIds = card.proposed.tags;
        }
        if (card.proposed.recurrence) basePayload.recurrence = card.proposed.recurrence;
        if (card.proposed.gtdStatus) basePayload.globalStageId = card.proposed.gtdStatus;
        if (card.proposed.projectId) basePayload.projectId = card.proposed.projectId;
        if (card.proposed.stakeholderIds) basePayload.stakeholderIds = card.proposed.stakeholderIds;
      } else {
        basePayload.priority = 4;
      }

      if ((card as any).agentRunId) {
         basePayload.agentRunId = (card as any).agentRunId;
      }

      const lowerType = card.type?.toLowerCase() || '';
      let targetCollection = "tasks";
      let convertedPayload: any = basePayload;
      
      // Route to correct module
      if (lowerType === "decision") {
        targetCollection = "decisions";
      } else if (lowerType === "waiting_for" || lowerType === "waiting for") {
        targetCollection = "waiting_for";
      } else if (lowerType === "idea" || lowerType === "project") {
        targetCollection = "projects";
      } else if (lowerType === "presentation") {
        targetCollection = "presentations";
      } else if (lowerType === "knowledge") {
        targetCollection = "knowledge_items";
        convertedPayload.type = 'Knowledge';
      } else if (lowerType === "someday") {
        targetCollection = "someday";
      } else if (lowerType === "health") {
        targetCollection = "health_actions";
      } else if (lowerType === "routine") {
        targetCollection = "tasks";
        convertedPayload.itemType = "routine";
      } else if (lowerType === "meeting") {
        targetCollection = "tasks";
        convertedPayload.itemType = "meeting";
      }

      const docRef = await addDoc(collection(db, targetCollection), convertedPayload);
      
      // Mark approved and preserve conversion metadata
      await updateDoc(doc(db, "review_candidates", card.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        convertedToType: targetCollection,
        convertedToId: docRef.id,
        originalReviewPayload: card,
        sourceReviewItemId: card.id
      });
    } catch (err) {
      console.error("Failed to approve", err);
      alert("Failed to approve item.");
    } finally {
      setActioning(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if(!user) return;
    setActioning(id);
    try {
      await updateDoc(doc(db, "review_candidates", id), { status });
    } catch (err) {
      console.error(`Failed to ${status}`, err);
    } finally {
      setActioning(null);
    }
  };

  const handleChangeCategory = async (id: string, newCategory: string) => {
    if(!user) return;
    try {
      await updateDoc(doc(db, "review_candidates", id), { actionCategory: newCategory });
    } catch (err) {
      console.error("Failed to change category", err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Active view info
  const activeViewObj = VIEWS.find(v => v.id === currentView) || VIEWS[0];

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      
      {/* Header & View Switcher */}
      <header className="px-4 py-6 border-b border-gray-200 bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">Review</h1>
            <p className="text-gray-500 text-sm">{candidates.length} items to process</p>
          </div>
          
          <div className="relative">
            <div className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              {VIEWS.filter(v => v.enabled).map(view => {
                const Icon = view.icon;
                return (
                  <button
                    key={view.id}
                    onClick={() => setCurrentView(view.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${currentView === view.id ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    <Icon className="w-4 h-4" /> {view.label}
                  </button>
                )
              })}
            </div>
            {/* Mobile View Switcher */}
            <div className="md:hidden relative">
              <button onClick={() => setShowViewMenu(!showViewMenu)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl font-medium text-sm">
                <activeViewObj.icon className="w-4 h-4" />
                {activeViewObj.label}
                <MoreHorizontal className="w-4 h-4 ml-2" />
              </button>
              {showViewMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 shadow-xl rounded-2xl p-2 z-50">
                  {VIEWS.map(view => {
                    const Icon = view.icon;
                    return (
                      <button
                        key={view.id}
                        disabled={!view.enabled}
                        onClick={() => {
                          if (view.enabled) setCurrentView(view.id);
                          setShowViewMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl text-sm font-medium transition-colors ${currentView === view.id ? 'bg-gray-100 text-black' : 'text-gray-600 hover:bg-gray-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <Icon className="w-4 h-4" />
                        {view.label}
                        {!view.enabled && <span className="ml-auto text-[10px] uppercase font-bold text-gray-400 tracking-wider">Soon</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-7xl mx-auto w-full">
        {candidates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center mt-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">System Clear</h2>
            <p className="text-gray-500">You are all caught up.</p>
          </div>
        ) : (
          <>
            {currentView === "inbox" && (
              <InboxView candidates={candidates} actioning={actioning} onApprove={handleApprove} onUpdateStatus={handleUpdateStatus} />
            )}
            {currentView === "kanban" && (
              <KanbanView candidates={candidates} actioning={actioning} onApprove={handleApprove} onUpdateStatus={handleUpdateStatus} onChangeCategory={handleChangeCategory} />
            )}
            {currentView === "list" && (
              <ListView candidates={candidates} actioning={actioning} onApprove={handleApprove} onUpdateStatus={handleUpdateStatus} />
            )}
          </>
        )}
      </main>

    </div>
  );
}

// --- VIEWS ---

function InboxView({ candidates, actioning, onApprove, onUpdateStatus }: any) {
  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      <AnimatePresence>
        {candidates.map((card: ReviewCandidate) => (
          <ReviewCard key={card.id} card={card} actioning={actioning} onApprove={onApprove} onUpdateStatus={onUpdateStatus} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const BOARD_COLUMNS = [
  { id: "needs_approval", label: "Needs Approval" },
  { id: "needs_decision", label: "Needs Decision" },
  { id: "can_delegate", label: "Can Delegate" },
  { id: "needs_scheduling", label: "Needs Schedule" },
  { id: "needs_clarification", label: "Needs Clarification" }
];

function KanbanView({ candidates, actioning, onApprove, onUpdateStatus, onChangeCategory }: any) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-8 h-[calc(100vh-200px)] items-start">
      {BOARD_COLUMNS.map(col => {
        const colItems = candidates.filter((c: ReviewCandidate) => c.actionCategory === col.id);
        
        return (
          <div key={col.id} className="min-w-[320px] w-[320px] bg-gray-100 rounded-3xl p-3 flex flex-col max-h-full">
            <h3 className="font-semibold px-3 py-2 flex justify-between items-center text-gray-700">
               {col.label} <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs font-bold">{colItems.length}</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 p-1">
              {colItems.map((card: ReviewCandidate) => (
                <div key={card.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 relative group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.type}</span>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase">{card.confidence}</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 leading-snug mb-2">{card.title}</h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-4">{card.why}</p>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onApprove(card)}
                      disabled={actioning === card.id}
                      className="flex-1 bg-black text-white text-xs font-medium py-1.5 rounded-lg flex items-center justify-center disabled:opacity-50"
                    >
                      {actioning === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                    </button>
                    <button 
                      onClick={() => onUpdateStatus(card.id, 'killed')}
                      disabled={actioning === card.id}
                      className="px-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mock drag & drop category changer for prototype */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex overflow-x-auto gap-1 no-scrollbar pb-1">
                     {BOARD_COLUMNS.filter(c => c.id !== col.id).map(c => (
                        <button key={c.id} onClick={() => onChangeCategory(card.id, c.id)} className="whitespace-nowrap text-[10px] font-medium bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-500 hover:text-black hover:bg-gray-100">
                          Move to {c.label.split(' ')[1] || c.label}
                        </button>
                     ))}
                  </div>
                </div>
              ))}
              {colItems.length === 0 && (
                 <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl mx-1">
                   Drop here
                 </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  );
}

function ListView({ candidates, actioning, onApprove, onUpdateStatus }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
            <tr>
              <th className="p-4 font-bold">Title</th>
              <th className="p-4 font-bold">Type</th>
              <th className="p-4 font-bold">Source</th>
              <th className="p-4 font-bold">Category</th>
              <th className="p-4 font-bold text-center">Confidence</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map((card: ReviewCandidate) => (
              <tr key={card.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="p-4 font-medium text-gray-900 max-w-xs truncate" title={card.title}>{card.title}</td>
                <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-semibold capitalize">{card.type}</span></td>
                <td className="p-4 text-gray-500 max-w-[150px] truncate"><div className="flex items-center gap-1"><AlignLeft className="w-3 h-3" /> {card.source}</div></td>
                <td className="p-4 text-gray-500 capitalize">{card.actionCategory?.replace('_', ' ')}</td>
                <td className="p-4 text-center">
                  <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-[10px] font-bold uppercase">{card.confidence}</span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => onApprove(card)}
                      disabled={actioning === card.id}
                      className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      {actioning === card.id ? <Loader2 className="w-3 h-3 animate-spin mx-3" /> : 'Approve'}
                    </button>
                    <button 
                      onClick={() => onUpdateStatus(card.id, 'killed')}
                      disabled={actioning === card.id}
                      className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      Kill
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function ReviewCard({ card, actioning, onApprove, onUpdateStatus }: { card: ReviewCandidate, actioning: string | null, onApprove: any, onUpdateStatus: any }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: -100 }}
      className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
    >
      <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.type} Candidate</span>
        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
          <AlertCircle className="w-3 h-3" /> {card.confidence}
        </span>
      </div>
      
      <div className="p-6 space-y-5">
        <h3 className="text-xl font-bold text-gray-900">{card.title}</h3>
        
        <div className="space-y-3">
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Why</h4>
            <p className="text-gray-700 text-sm">{card.why}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Source</h4>
            <p className="text-gray-700 text-sm flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /> {card.source}</p>
          </div>
        </div>

        <div className="bg-gray-50/50 rounded-2xl p-4 grid grid-cols-2 gap-4 border border-gray-100">
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Priority</h4>
            <p className="text-sm font-bold text-indigo-600">{card.proposed?.priority ? `P${card.proposed.priority}` : '- -'}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Time Sector</h4>
            <p className="text-sm font-medium">{card.proposed?.timeSector || 'Today'}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Context</h4>
            <p className="text-sm font-medium">{card.proposed?.context || '- -'}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Due Date</h4>
            <p className="text-sm font-medium">{card.proposed?.dueDate || '- -'}</p>
          </div>
          {card.proposed?.tags && card.proposed.tags.length > 0 && (
            <div className="col-span-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tags</h4>
                <div className="flex flex-wrap gap-1">
                    {card.proposed.tags.map((tag: string) => (
                        <span key={tag} className="text-[10px] bg-white border border-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-bold">{tag}</span>
                    ))}
                </div>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 pt-2 border-t border-gray-100 flex gap-2">
          <span className="font-semibold text-gray-700 pr-1">If approved:</span> 
          {card.action} <ArrowRight className="w-4 h-4 ml-auto" />
        </div>
      </div>

      <div className="p-3 bg-white border-t border-gray-100 flex flex-wrap gap-2">
        <button 
          onClick={() => onApprove(card)}
          disabled={actioning === card.id}
          className="flex-1 min-w-[120px] bg-black text-white hover:bg-gray-800 transition-colors py-3 px-4 rounded-xl font-medium flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {actioning === card.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve & Convert
        </button>
        <button 
          disabled={true}
          className="flex-1 min-w-[100px] bg-white border border-gray-200 text-gray-500 disabled:opacity-40 disabled:bg-gray-50 py-3 px-4 rounded-xl font-medium flex justify-center items-center gap-2"
          title="Edit not implemented yet"
        >
          Edit
        </button>
        <button 
          onClick={() => onUpdateStatus(card.id, 'killed')}
          disabled={actioning === card.id}
          className="bg-red-50 text-red-600 hover:bg-red-100 px-5 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          title="Kill Item"
        >
          <Trash className="w-4 h-4" /> Kill
        </button>
      </div>
    </motion.div>
  );
}

