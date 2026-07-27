import { useState, useEffect } from "react";
import { X, Sparkles, Loader2, Check } from "lucide-react";
import { addDoc, collection, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "motion/react";

import { generateProjectDraft } from "../lib/gemini";

import { getRelevantKnowledge } from "../services/KnowledgeService";

export function AIProjectBuilder({ user, workspace, onClose, onSuccess }: { user: any, workspace: any, onClose: () => void, onSuccess: (projectId: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [skills, setSkills] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !workspace) return;
    const fetchData = async () => {
      try {
        const q = query(collection(db, "skills"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
        const snap = await getDocs(q);
        const docs: any[] = [];
        snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
        setSkills(docs);

        // Fetch relevant knowledge
        const kDocs = await getRelevantKnowledge({
           workspaceId: workspace.id,
           userId: user.uid,
           useCase: 'project_builder'
        });
        setKnowledge(kDocs);
      } catch (err) {
        console.error("Failed to load skills or knowledge", err);
      }
    };
    fetchData();
  }, [user, workspace]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setDraft(null);
    try {
      // Modify generateProjectDraft to also accept knowledge? For now we just pass it inside prompt or skills array.
      // Let's pass knowledge to the skills array or update gemini.ts. A better way without touching gemini again:
      const appendedKnowledgeStr = knowledge.length > 0 
        ? `\\n\\n[SYSTEM KNOWLEDGE EXTRACTS]\\n${knowledge.map((k:any) => `- ${k.type.toUpperCase()}: ${k.title}\\n  Body: ${k.body}`).join('\\n')}` 
        : '';
        
      const data = await generateProjectDraft(prompt + appendedKnowledgeStr, skills);
      
      // Store used knowledge in draft for UI display
      data._usedKnowledge = knowledge.map(k => k.title);
      data._usedSkills = skills.map(s => s.title);

      setDraft(data);
    } catch (e: any) {
      console.error(e);
      alert("Failed to generate project draft: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateProject = async () => {
    if (!draft || !user || !workspace) return;
    setIsSaving(true);
    try {
      // 1. Create Project
      const projectRef = await addDoc(collection(db, "projects"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: (typeof draft.title === 'string' ? draft.title : "Untitled Project").slice(0, 500),
        description: typeof draft.description === 'string' ? draft.description : "",
        objective: typeof draft.objective === 'string' ? draft.objective : "",
        successCriteria: Array.isArray(draft.successCriteria) ? draft.successCriteria : [],
        priority: "medium",
        health: "on_track",
        methodology: typeof draft.methodology === 'string' ? draft.methodology : "Agile",
        status: "open",
        createdAt: serverTimestamp()
      });

      // 2. Create Milestones & Tasks
      if (draft.milestones && Array.isArray(draft.milestones)) {
        for (let i = 0; i < draft.milestones.length; i++) {
          const m = draft.milestones[i];
          try {
            const mRef = await addDoc(collection(db, "milestones"), {
              userId: user.uid,
              workspaceId: workspace.id,
              projectId: projectRef.id,
              title: (typeof m.title === 'string' ? m.title : `Milestone ${i+1}`).slice(0, 500),
              description: typeof m.description === 'string' ? m.description : "",
              deliverables: Array.isArray(m.deliverables) ? m.deliverables : [],
              acceptanceCriteria: Array.isArray(m.acceptanceCriteria) ? m.acceptanceCriteria : [],
              status: "not_started",
              order: i,
              createdAt: serverTimestamp()
            });

            if (m.tasks && Array.isArray(m.tasks)) {
              for (let j = 0; j < m.tasks.length; j++) {
                const t = m.tasks[j];
                try {
                  const pVal = Number(t.priority);
                  const parsedPriority = !isNaN(pVal) ? pVal : 4;
                  const tData: any = {
                    userId: user.uid,
                    workspaceId: workspace.id,
                    projectId: projectRef.id,
                    milestoneId: mRef.id,
                    title: (typeof t.title === 'string' ? t.title : "Untitled Task").slice(0, 500),
                    description: typeof t.description === 'string' ? t.description : "",
                    status: "open",
                    priority: parsedPriority,
                    createdAt: serverTimestamp()
                  };
                  if (t.recurrence) tData.recurrence = t.recurrence;
                  const tRef = await addDoc(collection(db, "tasks"), tData);

                  if (t.subtasks && Array.isArray(t.subtasks)) {
                    for (let k = 0; k < t.subtasks.length; k++) {
                       const st = t.subtasks[k];
                       try {
                         await addDoc(collection(db, "tasks"), {
                           userId: user.uid,
                           workspaceId: workspace.id,
                           projectId: projectRef.id,
                           milestoneId: mRef.id,
                           parentId: tRef.id,
                           title: (typeof st === 'string' ? st : typeof st?.title === 'string' ? st.title : "Subtask").slice(0, 500),
                           status: "open",
                           priority: 4,
                           createdAt: serverTimestamp()
                         });
                       } catch (e: any) {
                         console.error("Subtask error", e);
                       }
                    }
                  }
                } catch (e: any) {
                  console.error("Task error:", e);
                }
              }
            }
          } catch (e: any) {
            console.error("Milestone error:", e);
          }
        }
      }

      setIsSaving(false);
      onSuccess(projectRef.id);
    } catch (e: any) {
      console.error("Error creating project structure:", e, e.code, e.message);
      if (typeof e.details === 'object') {
        console.error('Details:', e.details);
      }
      alert("Failed to save project.");
      setIsSaving(false);
    }
  };

  const handleEditDraft = (field: string, val: any) => {
    setDraft({ ...draft, [field]: val });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
               <Sparkles className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-xl font-bold text-gray-900 leading-none">AI Project Builder</h2>
               <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">From Prompt to Project</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
             <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           {!draft && !isGenerating && (
             <div className="space-y-4">
                <p className="text-gray-600">Describe the project goal, scope, timeline, deliverables, constraints, or anything else. The AI will structure a complete plan for you.</p>
                <textarea 
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g., I want to build a new marketing website for a SaaS startup. It needs to have a landing page, pricing page, and contact form. We have 3 weeks..."
                  className="w-full h-48 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                />
                <div className="flex justify-end">
                   <button 
                     onClick={handleGenerate}
                     disabled={!prompt.trim()}
                     className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold tracking-wide flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                   >
                      <Sparkles className="w-4 h-4" /> Generate Plan
                   </button>
                </div>
             </div>
           )}

           {isGenerating && (
             <div className="py-20 flex flex-col items-center justify-center text-indigo-600">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-bold animate-pulse">Designing your project architecture...</p>
                <p className="text-sm text-gray-500 mt-2">Thinking through milestones, dependencies, and structure.</p>
             </div>
           )}

           {draft && !isGenerating && (
             <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-emerald-800 flex items-start gap-3">
                   <Check className="w-5 h-5 mt-0.5 shrink-0" />
                   <div>
                     <p className="font-bold">Draft Generated Successfully</p>
                     <p className="text-sm opacity-80 mt-1">Review and modify the details below before creating the project.</p>
                   </div>
                </div>

                {(draft._usedKnowledge?.length > 0 || draft._usedSkills?.length > 0) && (
                   <div className="flex gap-4">
                     {draft._usedKnowledge?.length > 0 && (
                        <div className="flex-1 bg-blue-50 border border-blue-100 p-4 rounded-2xl text-blue-900">
                           <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Knowledge Used</h4>
                           <ul className="list-disc pl-4 space-y-1 text-sm">
                             {draft._usedKnowledge.map((k: string, idx: number) => <li key={idx}>{k}</li>)}
                           </ul>
                        </div>
                     )}
                     {draft._usedSkills?.length > 0 && (
                        <div className="flex-1 bg-purple-50 border border-purple-100 p-4 rounded-2xl text-purple-900">
                           <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Skills Used</h4>
                           <ul className="list-disc pl-4 space-y-1 text-sm">
                             {draft._usedSkills.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                           </ul>
                        </div>
                     )}
                   </div>
                )}

                <div className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Project Title</label>
                      <input 
                        type="text" 
                        value={draft.title || ''} 
                        onChange={e => handleEditDraft('title', e.target.value)}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Description & Overview</label>
                      <textarea 
                        value={draft.description || ''} 
                        onChange={e => handleEditDraft('description', e.target.value)}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                      />
                   </div>
                   
                   {/* Milestones Preview */}
                   <div className="mt-8">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 block">Planned Milestones</label>
                     <div className="space-y-4">
                        {draft.milestones?.map((m: any, idx: number) => (
                           <div key={idx} className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                              <h4 className="font-bold text-gray-900">Phase {idx + 1}: {m.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{m.description}</p>
                              
                              <div className="mt-3 pl-4 border-l-2 border-indigo-200">
                                 <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-2">Tasks</span>
                                 <ul className="list-disc pl-4 space-y-1">
                                    {m.tasks?.map((t: any, tIdx: number) => (
                                       <li key={tIdx} className="text-sm text-gray-800">
                                          {t.title}
                                          {t.subtasks?.length > 0 && (
                                            <span className="text-xs text-gray-500 ml-2">({t.subtasks.length} subtasks)</span>
                                          )}
                                       </li>
                                    ))}
                                 </ul>
                              </div>
                           </div>
                        ))}
                     </div>
                   </div>
                </div>
             </div>
           )}
        </div>

        {draft && !isGenerating && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-3xl">
             <button 
               onClick={() => setDraft(null)} 
               disabled={isSaving}
               className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
             >
               Discard
             </button>
             <button 
               onClick={handleCreateProject} 
               disabled={isSaving}
               className="px-6 py-2.5 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
             >
               {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Project Structure"}
             </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
