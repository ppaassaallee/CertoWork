import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { useUndo } from "../lib/UndoContext";
import { ChevronLeft, Save, Trash2, Tag, BookOpen, Activity, Loader2, Sparkles, Link as LucideLink, Plus, Search, CheckSquare, Lightbulb } from "lucide-react";
import { motion } from "motion/react";
import { InvokeSkillModal } from "./InvokeSkillModal";

export function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const { pushAction } = useUndo();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [aiReadable, setAiReadable] = useState(true);
  const [aiUsageScope, setAiUsageScope] = useState("all");
  const [sensitivity, setSensitivity] = useState("internal");
  const [reviewCadence, setReviewCadence] = useState("months_3");

  // Linking states
  const [isLinking, setIsLinking] = useState(false);
  const [linkType, setLinkType] = useState<"task" | "idea">("task");
  const [linkSearch, setLinkSearch] = useState("");
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Live search for linking tasks/ideas
  useEffect(() => {
    if (!isLinking || !user || !workspace) return;
    const delayDebounce = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const collectionToSearch = linkType === "task" ? "tasks" : "someday";
        const q = query(
          collection(db, collectionToSearch),
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspace.id)
        );
        const snap = await getDocs(q);
        const matches: any[] = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!linkSearch || (d.title || "").toLowerCase().includes(linkSearch.toLowerCase())) {
            matches.push({ id: docSnap.id, title: d.title || "Untitled", status: d.status || "open" });
          }
        });
        setSearchResult(matches.slice(0, 10)); // Top 10 results
      } catch (err) {
        console.error("Error searching links: ", err);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [linkSearch, linkType, isLinking, user, workspace]);

  const handleConnectItem = async (targetId: string, targetTitle: string) => {
    if (!item) return;
    const currentLinks = item.linkedItems || [];
    if (currentLinks.some((l: any) => l.id === targetId)) {
      alert("Already linked!");
      return;
    }
    const updatedLinks = [...currentLinks, {
      id: targetId,
      title: targetTitle,
      type: linkType,
      collection: linkType === "task" ? "tasks" : "someday"
    }];

    await updateDoc(doc(db, "knowledge_items", id!), { linkedItems: updatedLinks });
    setItem({ ...item, linkedItems: updatedLinks });
    setIsLinking(false);
    setLinkSearch("");
  };

  const handleDisconnectItem = async (targetId: string) => {
    if (!item) return;
    const currentLinks = item.linkedItems || [];
    const updatedLinks = currentLinks.filter((l: any) => l.id !== targetId);

    await updateDoc(doc(db, "knowledge_items", id!), { linkedItems: updatedLinks });
    setItem({ ...item, linkedItems: updatedLinks });
  };

  useEffect(() => {
    if (!id || !user || !workspace) return;
    const fetchItem = async () => {
      const docRef = doc(db, "knowledge_items", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().userId === user.uid) {
        const data = docSnap.data();
        setItem({ id: docSnap.id, ...data });
        setTitle(data.title || "");
        setType(data.type || "note");
        setSummary(data.summary || "");
        setBody(data.body || "");
        setTags((data.tags || []).join(", "));
        setAiReadable(data.aiReadable !== false); // default true
        setAiUsageScope(data.aiUsageScope || "all");
        setSensitivity(data.sensitivity || "internal");
        setReviewCadence(data.reviewCadence || "months_3");
      }
      setLoading(false);
    };
    fetchItem();
  }, [id, user, workspace]);

  const handleSave = async () => {
    if (!id || !item) return;
    setSaving(true);
    try {
      const tagsArray = tags.split(",").map(t => t.trim()).filter(t => t);
      await updateDoc(doc(db, "knowledge_items", id), {
        title,
        type,
        summary,
        body,
        tags: tagsArray,
        aiReadable,
        aiUsageScope,
        sensitivity,
        reviewCadence,
        updatedAt: serverTimestamp()
      });
      setItem({ ...item, title, type, summary, body, tags: tagsArray, aiReadable, aiUsageScope, sensitivity, reviewCadence });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!id || !confirm("Are you sure you want to archive this knowledge item?")) return;
    try {
      await updateDoc(doc(db, "knowledge_items", id), {
        status: "archived",
        updatedAt: serverTimestamp()
      });
      navigate("/work/knowledge");
    } catch (err) {
      console.error(err);
      alert("Failed to archive item");
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm("Are you sure you want to completely delete this item?")) return;
    try {
      const itemData = { ...item };
      delete itemData.id;
      
      await deleteDoc(doc(db, "knowledge_items", id));
      
      pushAction({
        id: `delete-knowledge-${id}`,
        description: `Delete knowledge item "${item.title || 'Untitled'}"`,
        undo: async () => {
          await setDoc(doc(db, "knowledge_items", id), itemData);
        },
        redo: async () => {
          await deleteDoc(doc(db, "knowledge_items", id));
        }
      });
      
      navigate("/work/knowledge");
    } catch (err) {
      console.error(err);
      alert("Failed to delete item");
    }
  };

  const handleMarkReviewed = async () => {
    if (!id) return;
    try {
      await updateDoc(doc(db, "knowledge_items", id), {
        lastReviewedAt: serverTimestamp(),
        status: "active"
      });
      alert("Marked as reviewed.");
      // Refresh logic would ideally go here if we were using onSnapshot, but since we use getDoc:
      const updatedSnap = await getDoc(doc(db, "knowledge_items", id));
      if(updatedSnap.exists()) {
        setItem({ id, ...updatedSnap.data() });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to mark reviewed");
    }
  };

  const handleAppendSkillContent = async (text: string) => {
    if (!item || !id) return;
    const updated = (item.body || "") + "\n\n" + text;
    await updateDoc(doc(db, "knowledge_items", id), { body: updated });
    setBody(updated);
    setItem({ ...item, body: updated });
  };

  const handleOverwriteSkillContent = async (text: string) => {
    if (!item || !id) return;
    await updateDoc(doc(db, "knowledge_items", id), { body: text });
    setBody(text);
    setItem({ ...item, body: text });
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!item) {
    return <div className="p-8 text-center text-gray-500">Knowledge item not found.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-black hover:bg-gray-50 transition-colors shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
           <h1 className="text-2xl font-bold font-sans">Knowledge Detail</h1>
           <div className="text-sm text-gray-500 mt-1 flex gap-2 items-center">
             <span className="uppercase tracking-wider font-bold text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">ID: {item.id.slice(0, 8)}</span>
           </div>
        </div>
        {!isEditing ? (
          <>
            <button 
              onClick={() => setIsSkillModalOpen(true)}
              className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-sm font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              title="Invoke AI Skill"
            >
              <Sparkles className="w-4 h-4 text-teal-600" /> AI Skill
            </button>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-black text-white font-bold rounded-xl text-sm shadow-sm hover:bg-gray-800 transition-colors">Edit</button>
            <button onClick={handleArchive} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">Archive</button>
            <button onClick={handleDelete} className="p-2 border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Delete"><Trash2 className="w-5 h-5" /></button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Title</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl font-bold text-xl focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Item Type</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none">
                     <option value="note">Note</option>
                     <option value="SOP">SOP / Process</option>
                     <option value="project_context">Project Context</option>
                     <option value="people_context">People Context</option>
                     <option value="system_rule">System Rule</option>
                     <option value="decision_record">Decision Record</option>
                     <option value="template">Template</option>
                     <option value="research">Research</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Summary</label>
                  <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} className="w-full p-3 border border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:outline-none placeholder:text-gray-400" placeholder="Brief overview of what this knowledge item contains..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Body (Markdown support in future)</label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} className="w-full p-3 border border-gray-200 rounded-xl font-mono text-sm text-gray-700 focus:border-indigo-500 focus:outline-none" placeholder="Elaborate details here..." />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg">{item.type}</span>
                  {item.aiReadable && <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> AI Accessible</span>}
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg">{item.sensitivity}</span>
                </div>
                <h2 className="text-3xl font-bold font-sans text-gray-900 mb-6">{item.title}</h2>
                {item.summary && (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-gray-700 mb-6 font-medium leading-relaxed">
                    {item.summary}
                  </div>
                )}
                {item.body ? (
                  <div className="prose max-w-none text-gray-800 font-sans whitespace-pre-wrap leading-relaxed">
                    {item.body}
                  </div>
                ) : (
                  <div className="text-gray-400 italic py-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                    No body content provided.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-400" /> AI Settings</h3>
             {isEditing ? (
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <label className="text-sm font-bold text-gray-700">AI Readable</label>
                   <input type="checkbox" checked={aiReadable} onChange={e => setAiReadable(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Usage Scope</label>
                   <select value={aiUsageScope} onChange={e => setAiUsageScope(e.target.value)} disabled={!aiReadable} className="w-full text-sm p-2 border border-gray-200 rounded-lg disabled:opacity-50">
                     <option value="all">All Features</option>
                     <option value="project_builder">Project Builder Only</option>
                     <option value="meeting_processor">Meetings Only</option>
                     <option value="system_review">Reviews Only</option>
                   </select>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Sensitivity</label>
                    <select value={sensitivity} onChange={e => setSensitivity(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg">
                      <option value="public">Public</option>
                      <option value="internal">Internal / Default</option>
                      <option value="private">Private</option>
                      <option value="sensitive">Sensitive (Strict Guardrails)</option>
                    </select>
                 </div>
               </div>
             ) : (
               <div className="space-y-3 text-sm text-gray-600">
                 <div className="flex justify-between items-center py-2 border-b border-gray-50"><span>AI Accessible</span> <span className="font-bold text-gray-900">{item.aiReadable ? 'Yes' : 'No'}</span></div>
                 <div className="flex justify-between items-center py-2 border-b border-gray-50"><span>Scope</span> <span className="font-bold text-gray-900 capitalize">{item.aiUsageScope?.replace('_', ' ')}</span></div>
                 <div className="flex justify-between items-center py-2"><span>Sensitivity</span> <span className="font-bold text-gray-900 capitalize">{item.sensitivity}</span></div>
               </div>
             )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-gray-400" /> Meta & Tags</h3>
            {isEditing ? (
               <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tags (comma separated)</label>
                    <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg" placeholder="project, marketing, q3..." />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Review Cadence</label>
                    <select value={reviewCadence} onChange={e => setReviewCadence(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg">
                      <option value="never">Never / Archive when done</option>
                      <option value="months_1">Every 1 Month</option>
                      <option value="months_3">Every 3 Months</option>
                      <option value="months_6">Every 6 Months</option>
                      <option value="yearly">Every 1 Year</option>
                    </select>
                  </div>
               </div>
            ) : (
              <div className="space-y-4">
                 <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Tags</span>
                    <div className="flex flex-wrap gap-2">
                       {item.tags && item.tags.length > 0 ? item.tags.map((t: string) => (
                         <span key={t} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">{t}</span>
                       )) : <span className="text-sm text-gray-400 italic">No tags</span>}
                    </div>
                 </div>
                 <div className="pt-4 border-t border-gray-50 text-sm flex justify-between items-center"><span className="text-gray-500">Review Cadence</span><span className="font-bold text-gray-900">{item.reviewCadence?.replace('_', ' ')}</span></div>
                 {item.lastReviewedAt && (
                    <div className="text-sm flex justify-between items-center"><span className="text-gray-500">Last Reviewed</span><span className="font-bold text-gray-900">{new Date(item.lastReviewedAt.toDate()).toLocaleDateString()}</span></div>
                 )}
                 <button onClick={handleMarkReviewed} className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs hover:bg-indigo-100 transition-colors mt-2 text-center block">Mark Just Reviewed</button>
              </div>
            )}
          </div>

          {/* Notion/Loop Style Connection Manager */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <LucideLink className="w-4 h-4 text-gray-400" /> Linked Items
              </h3>
              {!isEditing && (
                <button
                  onClick={() => setIsLinking(!isLinking)}
                  className="p-1 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors"
                  title="Link an item"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {isLinking && (
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setLinkType("task"); setSearchResult([]); }}
                    className={`flex-1 py-1 px-2 text-xs font-bold rounded-lg transition-colors ${linkType === "task" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Task
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLinkType("idea"); setSearchResult([]); }}
                    className={`flex-1 py-1 px-2 text-xs font-bold rounded-lg transition-colors ${linkType === "idea" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Idea
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder={`Search ${linkType === "task" ? "tasks" : "ideas"}...`}
                    className="w-full text-xs pl-8 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {loadingSearch ? (
                    <div className="text-[10px] text-gray-400 py-1 text-center">Searching...</div>
                  ) : searchResult.length > 0 ? (
                    searchResult.map((res) => (
                      <button
                        type="button"
                        key={res.id}
                        onClick={() => handleConnectItem(res.id, res.title)}
                        className="w-full text-left p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-xs font-medium text-gray-700 hover:text-indigo-600 transition-all flex items-center justify-between border border-transparent hover:border-gray-100"
                      >
                        <span className="truncate mr-2">{res.title}</span>
                        <Plus className="w-3 h-3 text-indigo-500 shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="text-[10px] text-gray-400 py-1 text-center">No results found</div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {item.linkedItems && item.linkedItems.length > 0 ? (
                item.linkedItems.map((link: any) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-xl hover:shadow-sm transition-all"
                  >
                    <div
                      onClick={() => navigate(link.type === 'task' ? `/work/action-board` : `/capture/ideas`)}
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                    >
                      {link.type === "task" ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-gray-700 truncate hover:text-indigo-600 transition-colors">
                        {link.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDisconnectItem(link.id)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Remove link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-100 rounded-2xl">
                  No linked items. Click + to interlink tasks and ideas.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <InvokeSkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        itemTitle={item.title || ""}
        itemContent={item.body || ""}
        itemType="document"
        onAppendContent={handleAppendSkillContent}
        onOverwriteContent={handleOverwriteSkillContent}
      />
    </motion.div>
  );
}
