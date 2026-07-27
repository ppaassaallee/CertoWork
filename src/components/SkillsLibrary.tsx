import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";
import { Folder, BrainCircuit, Search, Plus, Sparkles, Filter, Code2, Zap } from "lucide-react";
import { motion } from "motion/react";

export function SkillsLibrary({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // Modal states
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [showNewSkill, setShowNewSkill] = useState(false);
  const [newSkillTitle, setNewSkillTitle] = useState("");
  
  useEffect(() => {
    if (!user || !workspace) return;
    
    // Using snapshot for skills
    const qSkills = query(collection(db, "skills"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubSkills = onSnapshot(qSkills, (snap) => {
      const arr: any[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setSkills(arr);
    });

    const qFolders = query(collection(db, "skill_folders"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubFolders = onSnapshot(qFolders, (snap) => {
      const arr: any[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setFolders(arr);
      setLoading(false);
    });

    return () => { unsubSkills(); unsubFolders(); };
  }, [user, workspace]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || !user || !workspace) return;
    try {
      await addDoc(collection(db, "skill_folders"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: folderName.trim(),
        parentFolderId: currentFolder || null,
        createdAt: serverTimestamp()
      });
      setFolderName("");
      setShowNewFolder(false);
    } catch (err: any) {
      console.error('Create Folder Error: ', err);
      alert("Failed to create folder: " + err.message);
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillTitle.trim() || !user || !workspace) return;
    try {
      const ref = await addDoc(collection(db, "skills"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: newSkillTitle.trim(),
        folderId: currentFolder || null,
        status: "active",
        aiReadable: true,
        instructions: "",
        category: "General",
        createdAt: serverTimestamp()
      });
      setShowNewSkill(false);
      setNewSkillTitle("");
      navigate(`/work/skills/${ref.id}`);
    } catch (err: any) {
      console.error('Create Skill Error: ', err);
      alert("Failed to create skill: " + err.message);
    }
  };

  const handleCreateStarterProjectSkills = async () => {
     if (!user || !workspace || !confirm("Add starter project management skills to your library?")) return;
     
     const starterSkills = [
       { title: "Agile Project Planning", category: "Project Management", instructions: "Break project into outcomes, not just activities. Create milestones before tasks. Each milestone must have a deliverable. Each task must be actionable." },
       { title: "Task Decomposition", category: "Project Management", instructions: "Take a large task and break it down into 3-5 subtasks max. Make sure there is a clear start and finish for each subtask." },
       { title: "Risk Identification", category: "Analysis", instructions: "Analyze a project description and list 3-5 potential risks, categorized by likelihood and impact." }
     ];

     try {
        const folderRef = await addDoc(collection(db, "skill_folders"), {
           userId: user.uid,
           workspaceId: workspace.id,
           name: "Project Management Framework",
           createdAt: serverTimestamp()
        });

        for (const skill of starterSkills) {
           await addDoc(collection(db, "skills"), {
              userId: user.uid,
              workspaceId: workspace.id,
              title: skill.title,
              category: skill.category,
              instructions: skill.instructions,
              whenToUse: "When planning projects or breaking down tasks.",
              outputSchema: "A detailed list or breakdown.",
              qualityChecklist: ["Are items actionable?", "Is it specific?"],
              folderId: folderRef.id,
              status: "active",
              aiReadable: true,
              createdAt: serverTimestamp()
           });
        }
        alert("Starter skills added successfully.");
     } catch (err) {
        console.error(err);
        alert("Failed to create starter skills");
     }
  };

  const filteredSkills = skills.filter(s => {
    if (currentFolder && s.folderId !== currentFolder) return false;
    if (!currentFolder && s.folderId) return false;
    if (search && !s.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredFolders = folders.filter(f => {
    if (currentFolder && f.parentFolderId !== currentFolder) return false;
    if (!currentFolder && f.parentFolderId) return false;
    // Don't filter folders out of view if there's a search term, maybe keep it simple.
    if (search && !f.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const parentFolder = folders.find(f => f.id === currentFolder);

  return (
    <motion.div 
      initial={isEmbedded ? false : { opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className={isEmbedded ? "space-y-6" : "p-4 max-w-6xl mx-auto pb-24"}
    >
      <header className="mb-6 mt-2 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-1">
            <button onClick={() => setCurrentFolder(null)} className="hover:text-black transition-colors">Skills Library</button>
            {parentFolder && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-black">{parentFolder.name}</span>
              </>
            )}
          </div>
          <h1 className={isEmbedded ? "text-xl font-bold font-sans tracking-tight" : "text-3xl font-bold font-sans tracking-tight"}>
            {parentFolder ? parentFolder.name : "Skills Library"}
          </h1>
          {isEmbedded ? (
            <p className="text-gray-500 mt-1 text-xs max-w-xl">
               reusable AI capabilities and instructions
            </p>
          ) : (
            <p className="text-gray-500 mt-2 text-sm max-w-xl">
               Reusable AI capabilities. Teach the system how to perform specific tasks, generate documents, or run processes accurately.
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          {!parentFolder && (
            <button onClick={handleCreateStarterProjectSkills} className="px-3 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors text-xs flex items-center gap-1.5 border border-indigo-100">
              <Sparkles className="w-3.5 h-3.5" /> Starter PM Skills
            </button>
          )}
          <button onClick={() => setShowNewFolder(true)} className="px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5" /> New Folder
          </button>
          <button onClick={() => setShowNewSkill(true)} className="px-3 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-xs flex items-center gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> New Skill
          </button>
        </div>
      </header>

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
             <h3 className="font-bold text-lg mb-4">Create Skill Category (Folder)</h3>
             <form onSubmit={handleCreateFolder}>
               <input autoFocus type="text" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="e.g. Code Review" className="w-full p-3 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:border-indigo-500" />
               <div className="flex justify-end gap-2">
                 <button type="button" onClick={() => setShowNewFolder(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                 <button type="submit" disabled={!folderName.trim()} className="px-4 py-2 bg-black text-white font-bold rounded-xl disabled:opacity-50">Create</button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* New Skill Modal */}
      {showNewSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
             <h3 className="font-bold text-lg mb-4">Create AI Skill</h3>
             <form onSubmit={handleCreateSkill} className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Skill Name</label>
                 <input autoFocus type="text" value={newSkillTitle} onChange={e => setNewSkillTitle(e.target.value)} placeholder="e.g. Write PR Description" className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500" />
               </div>
               <div className="flex justify-end gap-2 pt-2">
                 <button type="button" onClick={() => setShowNewSkill(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                 <button type="submit" disabled={!newSkillTitle.trim()} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-50">Create</button>
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
            placeholder="Search skills..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
          />
        </div>
        <button className="p-2.5 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-black transition-colors shadow-sm">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading skills...</div>
      ) : (
        <div className="space-y-6">
          {/* Folders */}
          {filteredFolders.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {filteredFolders.map(f => (
                <button 
                  key={f.id} 
                  onClick={() => setCurrentFolder(f.id)}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:border-teal-300 hover:shadow-md transition-all text-left"
                >
                  <Folder className="w-6 h-6 text-teal-500 fill-teal-50" />
                  <span className="font-bold text-gray-800 truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Skills */}
          {filteredSkills.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map(skill => (
                <Link 
                  key={skill.id} 
                  to={`/work/skills/${skill.id}`}
                  className="flex flex-col bg-white border border-gray-200 rounded-3xl p-5 hover:border-teal-400 hover:shadow-lg transition-all group h-full"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 border border-teal-100/50">
                      <BrainCircuit className="w-6 h-6 text-teal-600" />
                    </div>
                    {skill.aiReadable && (
                       <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-teal-50 text-teal-700 border border-teal-100 uppercase flex items-center gap-1">
                          <Zap className="w-3 h-3 fill-teal-500" /> Active
                       </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{skill.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-2 leading-relaxed">
                       {skill.whenToUse || skill.description || "No description provided. Click to add instructions."}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{skill.category || 'Uncategorized'}</span>
                     <div className="text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity text-sm font-bold flex items-center gap-1">
                        Configure <ChevronRight className="w-4 h-4" />
                     </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            filteredFolders.length === 0 && (
              <div className="text-center py-20 bg-white border border-gray-100 border-dashed rounded-3xl">
                <Code2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900">No Skills Yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto mt-2 mb-6">Create structural AI instructions to use across your workspace.</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setShowNewSkill(true)} className="px-6 py-2.5 bg-black text-white font-bold rounded-xl shadow-sm hover:bg-gray-800 transition-colors">Create Skill</button>
                  <button onClick={handleCreateStarterProjectSkills} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors">Load Starter Skills</button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </motion.div>
  );
}

// Inline helper because ChevronRight is used above
function ChevronRight(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6"/></svg>
}
