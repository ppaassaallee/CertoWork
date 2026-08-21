import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Inbox, List, Kanban, Sparkles, Loader2, Plus, ArrowRight, 
  Search, CheckCircle2
} from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, addDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ReviewCandidateCard } from "./ReviewCandidateCard";
import { triageInputWithAI } from "../lib/gemini";

const KANBAN_COLS = [
  { id: "high", label: "High Confidence", bg: "bg-emerald-50", text: "text-emerald-700" },
  { id: "medium", label: "Medium Confidence", bg: "bg-blue-50", text: "text-blue-700" },
  { id: "low", label: "Low Confidence", bg: "bg-amber-50", text: "text-amber-700" },
];

export function ReviewQueue() {
  const { user, workspace } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "kanban" | "list">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Quick Capture inline
  const [quickInput, setQuickInput] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!user || !workspace) return;

    const q = query(
      collection(db, "review_candidates"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() });
      });
      // Sort by createdAt descending
      items.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setCandidates(items);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, workspace]);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim() || !user || !workspace || capturing) return;
    setCapturing(true);
    try {
      // Direct call to Gemini triage
      const result = await triageInputWithAI(quickInput.trim());
      
      if (result.candidates && Array.isArray(result.candidates)) {
        for (const cand of result.candidates) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid,
            workspaceId: workspace.id,
            title: cand.title || "Untitled Candidate",
            type: cand.type || "task",
            why: cand.why || "Captured from direct inbox text",
            source: quickInput.trim(),
            confidence: cand.confidence || "high",
            action: cand.action || "Process this raw input item",
            proposed: cand.proposed || {},
            status: "pending",
            createdAt: new Date(),
          });
        }
      } else {
        // Fallback to a single candidate
        await addDoc(collection(db, "review_candidates"), {
          userId: user.uid,
          workspaceId: workspace.id,
          title: quickInput.trim(),
          type: "task",
          why: "Manual raw input capture",
          source: quickInput.trim(),
          confidence: "medium",
          action: "Process this raw input item",
          proposed: {},
          status: "pending",
          createdAt: new Date(),
        });
      }

      setQuickInput("");
      setSuccessMsg("Captured and sent to Needs Review.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setCapturing(false);
    }
  };

  const handleDismissAll = async () => {
    if (!user || !workspace || candidates.length === 0) return;
    if (!confirm(`Are you sure you want to dismiss all ${candidates.length} pending items?`)) return;
    
    setLoading(true);
    try {
      // Batch update status to killed
      const batch = writeBatch(db);
      for (const item of candidates) {
        batch.update(doc(db, "review_candidates", item.id), { status: "killed" });
      }
      await batch.commit();
      setSuccessMsg("All pending items dismissed.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter & Search Candidates
  const filteredCandidates = candidates.filter(item => {
    const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.why?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.source?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === "all") return matchesSearch;
    return matchesSearch && item.type?.toLowerCase() === filterType.toLowerCase();
  });

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <p className="text-sm text-gray-500 mt-2 font-medium">Scanning second brain inbox...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-24 text-left">
      
      {/* Header and Status */}
      <header className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-black tracking-tight flex items-center gap-2">
              <Inbox className="w-8 h-8 text-indigo-600" /> Needs Review
            </h1>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1 rounded-full">
              {candidates.length} Items Pending
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1 max-w-xl">
            This is your workspace's central triage inbox. Everything captured—text, notes, audio, web-clipper—lands here first. Review, enrich, and convert them to their final destinations.
          </p>
        </div>

        {candidates.length > 0 && (
          <button
            onClick={handleDismissAll}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
          >
            Clear Pending Inbox
          </button>
        )}
      </header>

      {/* Quick Capture Box */}
      <form onSubmit={handleQuickCapture} className="bg-white border border-gray-200 p-4 rounded-3xl shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" /> AI Triage Quick Capture
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Type anything to capture (e.g. 'Read about SEO playbooks tomorrow at 3pm, and create a core strategy doc')"
            className="flex-1 bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-2xl p-3 text-sm focus:outline-none transition-all font-medium"
          />
          <button
            type="submit"
            disabled={capturing || !quickInput.trim()}
            className="px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Capture
          </button>
        </div>
        {successMsg && (
          <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-xs text-indigo-800 font-bold flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" /> {successMsg}
          </div>
        )}
      </form>

      {/* Control Filters & View Switchers */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-150">
        
        {/* Search and Filters */}
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
            />
          </div>

          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs bg-white border border-gray-200 p-2 rounded-xl focus:outline-none font-bold text-gray-700"
            >
              <option value="all">All Types</option>
              <option value="task">Tasks</option>
              <option value="someday">Ideas / Someday</option>
              <option value="decision">Decisions</option>
              <option value="knowledge">Knowledge Docs</option>
              <option value="skill">AI Skills</option>
              <option value="playbook">Playbooks</option>
              <option value="project">Projects</option>
              <option value="waiting_for">Waiting For</option>
            </select>
          </div>
        </div>

        {/* View Switches */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === "inbox" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" /> Inbox ({filteredCandidates.length})
          </button>
          <button
            onClick={() => setActiveTab("kanban")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === "kanban" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
            }`}
          >
            <Kanban className="w-3.5 h-3.5" /> Confidence Board
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === "list" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
            }`}
          >
            <List className="w-3.5 h-3.5" /> Table List
          </button>
        </div>
      </div>

      {/* Main Tab Renderings */}
      {filteredCandidates.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center bg-white">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="font-bold text-gray-800 text-sm">Inbox is Pristine</h3>
          <p className="text-gray-400 text-xs max-w-xs mt-1">
            Excellent job! No items are currently waiting for triage. All your captures have been organized.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {activeTab === "inbox" && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {filteredCandidates.map(item => (
                <ReviewCandidateCard
                  key={item.id}
                  candidate={item}
                  onProcessed={() => {
                    setSuccessMsg(`Successfully converted item to ${item.type}`);
                    setTimeout(() => setSuccessMsg(""), 3000);
                  }}
                />
              ))}
            </motion.div>
          )}

          {activeTab === "kanban" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {KANBAN_COLS.map(col => {
                const colItems = filteredCandidates.filter(
                  item => (item.confidence || "medium").toLowerCase() === col.id
                );

                return (
                  <div key={col.id} className="bg-gray-50 border border-gray-200 p-4 rounded-3xl flex flex-col gap-3 min-h-[300px]">
                    <div className="flex justify-between items-center px-1">
                      <h3 className={`font-black text-xs uppercase tracking-wider ${col.text}`}>
                        {col.label}
                      </h3>
                      <span className="bg-gray-200/60 text-gray-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {colItems.length}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px]">
                      {colItems.map(item => (
                        <div key={item.id} className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                              {item.type}
                            </span>
                            <span className="text-[9px] text-gray-400 font-bold">
                              {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ""}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-gray-900 leading-snug">{item.title}</h4>
                          <p className="text-xs text-gray-500 line-clamp-2">{item.why}</p>
                          <button
                            onClick={() => {
                              // Switch back to inbox tab to let the card editor expand or do immediate actions
                              setActiveTab("inbox");
                              setSearchQuery(item.title);
                            }}
                            className="w-full py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-600 font-extrabold text-[10px] uppercase tracking-wider rounded-lg border border-gray-200 transition-all flex items-center justify-center gap-1"
                          >
                            Edit & Approve <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeTab === "list" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-gray-700">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase font-black text-[9px] tracking-widest">
                    <tr>
                      <th className="p-4">Candidate Item</th>
                      <th className="p-4">Suggested Type</th>
                      <th className="p-4">Confidence</th>
                      <th className="p-4">Source Context</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredCandidates.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-900 text-sm">{item.title}</span>
                            <span className="text-gray-400 text-[10px] mt-0.5 line-clamp-1">{item.why}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase">
                            {item.type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                            {item.confidence || "high"}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500 italic max-w-xs truncate" title={item.source}>
                          {item.source}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setActiveTab("inbox");
                              setSearchQuery(item.title);
                            }}
                            className="bg-black hover:bg-neutral-800 text-white font-extrabold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Triage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
