import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Folder, FileText, Search, Plus, SlidersHorizontal, BookOpen, Clock, Tag, BrainCircuit, Paperclip, Network } from "lucide-react";
import { motion } from "motion/react";
import { SkillsLibrary } from "./SkillsLibrary";
import { PlaybooksList } from "./PlaybooksList";
import { ResourcesManager } from "./ResourcesManager";
import { WorkspaceConnectionGraph } from "./WorkspaceConnectionGraph";

export function KnowledgeBase() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "documents";

  const [items, setItems] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // Modal states
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemType, setNewItemType] = useState("note");

  useEffect(() => {
    if (!user || !workspace) return;
    
    const qItems = query(collection(db, "knowledge_items"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubItems = onSnapshot(qItems, (snap) => {
      const arr: any[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setItems(arr);
    });

    const qFolders = query(collection(db, "knowledge_folders"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubFolders = onSnapshot(qFolders, (snap) => {
      const arr: any[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setFolders(arr);
      setLoading(false);
    });

    return () => { unsubItems(); unsubFolders(); };
  }, [user, workspace]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || !user || !workspace) return;
    try {
      await addDoc(collection(db, "knowledge_folders"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: folderName.trim(),
        parentFolderId: currentFolder,
        createdAt: serverTimestamp()
      });
      setFolderName("");
      setShowNewFolder(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create folder");
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !user || !workspace) return;
    try {
      const ref = await addDoc(collection(db, "knowledge_items"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: newItemTitle.trim(),
        type: newItemType,
        folderId: currentFolder,
        status: "active",
        sensitivity: "internal",
        aiReadable: true,
        aiUsageScope: "all",
        createdAt: serverTimestamp()
      });
      setShowNewItem(false);
      setNewItemTitle("");
      navigate(`/work/knowledge/${ref.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create item");
    }
  };

  const filteredItems = items.filter(i => {
    if (currentFolder && i.folderId !== currentFolder) return false;
    if (!currentFolder && i.folderId) return false; // In root
    if (i.status === "archived") return false;
    if (search && !i.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredFolders = folders.filter(f => {
    if (currentFolder && f.parentFolderId !== currentFolder) return false;
    if (!currentFolder && f.parentFolderId) return false;
    if (search && !f.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const parentFolder = folders.find(f => f.id === currentFolder);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-6xl mx-auto pb-24">
      {/* Unified Tab Bar */}
      <div className="flex border-b border-gray-200/80 mb-6 gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          type="button"
          onClick={() => handleTabChange("documents")}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
            activeTab === "documents"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Knowledge Base</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("skills")}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
            activeTab === "skills"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span>Skills Library</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("playbooks")}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
            activeTab === "playbooks"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Playbooks</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("resources")}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
            activeTab === "resources"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Paperclip className="w-4 h-4" />
          <span>Resources</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("graph")}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
            activeTab === "graph"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Linked Graph</span>
        </button>
      </div>

      {activeTab === "documents" && (
        <>
          <header className="mb-8 mt-4 flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-2">
                <button onClick={() => setCurrentFolder(null)} className="hover:text-black transition-colors">Knowledge Base</button>
                {parentFolder && (
                  <>
                    <span className="text-gray-300">/</span>
                    <span className="text-black">{parentFolder.name}</span>
                  </>
                )}
              </div>
              <h1 className="text-3xl font-bold font-sans tracking-tight">
                {parentFolder ? parentFolder.name : "Knowledge Base"}
              </h1>
              <p className="text-gray-500 mt-2 text-sm max-w-xl">
                 Your central brain. Store notes, SOPs, people knowledge, project context, and rules. AI will consult this when generating plans and summaries.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Link to="/me/notion" className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm flex items-center gap-2">
                Notion Setup
              </Link>
              <button onClick={() => setShowNewFolder(true)} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm flex items-center gap-2">
                <Folder className="w-4 h-4" /> New Folder
              </button>
              <button onClick={() => setShowNewItem(true)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2 shadow-sm">
                <Plus className="w-4 h-4" /> New Item
              </button>
            </div>
          </header>

          {/* New Folder Modal */}
          {showNewFolder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
                 <h3 className="font-bold text-lg mb-4">Create Folder</h3>
                 <form onSubmit={handleCreateFolder}>
                   <input autoFocus type="text" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Folder name" className="w-full p-3 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:border-indigo-500" />
                   <div className="flex justify-end gap-2">
                     <button type="button" onClick={() => setShowNewFolder(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                     <button type="submit" disabled={!folderName.trim()} className="px-4 py-2 bg-black text-white font-bold rounded-xl disabled:opacity-50">Create</button>
                   </div>
                 </form>
              </div>
            </div>
          )}

          {/* New Item Modal */}
          {showNewItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                 <h3 className="font-bold text-lg mb-4">Create Knowledge Item</h3>
                 <form onSubmit={handleCreateItem} className="space-y-4">
                   <div>
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Item Type</label>
                     <select value={newItemType} onChange={e => setNewItemType(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-indigo-500">
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
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Title</label>
                     <input autoFocus type="text" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} placeholder="e.g. Acme Corp Launch Specs" className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500" />
                   </div>
                   <div className="flex justify-end gap-2 pt-2">
                     <button type="button" onClick={() => setShowNewItem(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                     <button type="submit" disabled={!newItemTitle.trim()} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-50">Create</button>
                   </div>
                 </form>
              </div>
            </div>
          )}

          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search knowledge..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>
            <button className="p-2.5 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-black transition-colors shadow-sm">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading knowledge...</div>
          ) : (
            <div className="space-y-6">
              {/* Folders */}
              {filteredFolders.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredFolders.map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => setCurrentFolder(f.id)}
                      className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all text-left"
                    >
                      <Folder className="w-6 h-6 text-indigo-400 fill-indigo-50" />
                      <span className="font-bold text-gray-800 truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Items */}
              {filteredItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map(item => (
                    <Link 
                      key={item.id} 
                      to={`/work/knowledge/${item.id}`}
                      className="flex flex-col bg-white border border-gray-200 rounded-3xl p-5 hover:border-indigo-300 hover:shadow-lg transition-all group h-full"
                    >
                      <div className="flex items-start gap-4 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-indigo-50 transition-colors">
                          <FileText className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{item.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wide">{item.type}</span>
                            {item.aiReadable && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase">AI Synced</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {item.summary && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1 mb-4 flex-1">
                          {item.summary}
                        </p>
                      )}
                      
                      <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400 font-medium">
                         <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString() : 'Just now'}</div>
                         {item.tags && item.tags.length > 0 && (
                           <div className="flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {item.tags.length}
                           </div>
                         )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                filteredFolders.length === 0 && (
                  <div className="text-center py-20 bg-white border border-gray-100 border-dashed rounded-3xl">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">Knowledge Base is Empty</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mt-2 mb-6">Create a folder or note to start building your AI-accessible second brain.</p>
                    <button onClick={() => setShowNewItem(true)} className="px-6 py-2.5 bg-black text-white font-bold rounded-xl shadow-sm hover:bg-gray-800 transition-colors">Create First Item</button>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "skills" && (
        <SkillsLibrary isEmbedded={true} />
      )}

      {activeTab === "playbooks" && (
        <PlaybooksList isEmbedded={true} />
      )}

      {activeTab === "resources" && (
        <ResourcesManager />
      )}

      {activeTab === "graph" && (
        <WorkspaceConnectionGraph />
      )}
    </motion.div>
  );
}
