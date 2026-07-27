import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BoldrProject, PIPELINE_STAGES, getPhaseForStage, PipelineStage } from './types';
import { Plus, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const PHASES = [
  "PHASE 1 — Qualification",
  "PHASE 2 — Handoff",
  "PHASE 3 — Discovery & Blueprint",
  "PHASE 4 — Build, QA & Launch",
  "PHASE 5 — Operate, Optimize & Expand",
  "Archived"
] as const;

export function BoldrPipeLine() {
  const { user, workspace } = useAuth();
  const [projects, setProjects] = useState<BoldrProject[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");

  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(
      collection(db, "boldr_projects"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: BoldrProject[] = [];
      snap.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as BoldrProject);
      });
      setProjects(data);
    });
    return () => unsub();
  }, [user, workspace]);

  const handleAddStart = () => setIsAdding(true);
  const handleAddCancel = () => {
    setIsAdding(false);
    setNewName("");
    setNewCompany("");
  };
  const handleAddSave = async () => {
    if (!user || !workspace || !newName.trim() || !newCompany.trim()) return;
    try {
      await addDoc(collection(db, "boldr_projects"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: newName.trim(),
        companyName: newCompany.trim(),
        stage: "New Opportunity",
        deliveryRiskLevel: "low",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      handleAddCancel();
    } catch (e) {
      console.error(e);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    // Actually dragging across PHASES?
    // In a real kanban, we'd drag to a stage, not a phase, 
    // but the columns are phases. 
    // Let's just find the first stage of the target phase for drops.
    const targetPhase = destination.droppableId;
    const targetStage = PIPELINE_STAGES.find(s => getPhaseForStage(s) === targetPhase) || "Closed / Archived";
    
    try {
      await updateDoc(doc(db, "boldr_projects", draggableId), {
        stage: targetStage,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getProjectsForPhase = (phase: string) => {
    return projects.filter(p => getPhaseForStage(p.stage) === phase).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Project Pipeline</h2>
        <button 
          onClick={handleAddStart}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-800 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Opportunity
        </button>
      </div>

      {isAdding && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 flex items-end gap-4 shadow-sm">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Company Name</label>
            <input 
              autoFocus
              className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-black font-semibold"
              value={newCompany}
              onChange={e => setNewCompany(e.target.value)}
              placeholder="E.g. Acme Corp"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Project Name</label>
            <input 
              className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-black font-semibold"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="E.g. Customer Support AI AI"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddCancel} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-black hover:bg-gray-200 rounded-lg">Cancel</button>
            <button onClick={handleAddSave} className="px-4 py-2 text-sm font-bold bg-black text-white rounded-lg shadow-sm hover:bg-gray-800 disabled:opacity-50">Save</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 items-start min-w-max pb-8 h-full">
            {PHASES.map(phase => {
              const phaseProjects = getProjectsForPhase(phase);
              return (
                <div key={phase} className="w-80 bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col max-h-[80vh]">
                  <h3 className="font-bold text-sm text-gray-800 mb-4">{phase}</h3>
                  <Droppable droppableId={phase}>
                    {(provided) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto min-h-[100px] flex flex-col gap-3"
                      >
                        {phaseProjects.map((proj, index) => (
                          <Draggable key={proj.id!} draggableId={proj.id!} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative group"
                              >
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-gray-300">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="text-[10px] uppercase font-black tracking-widest text-indigo-500 mb-1">{proj.companyName}</div>
                                <div className="font-bold text-gray-900 leading-tight mb-2 pr-4">{proj.name}</div>
                                
                                <div className="mt-4 flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">Stage</label>
                                  <select 
                                    className="text-xs bg-gray-50 border border-gray-200 rounded-md p-1 outline-none font-medium truncate shrink-0 w-full hover:border-gray-300 focus:border-black cursor-pointer"
                                    value={proj.stage}
                                    onChange={async (e) => {
                                      const val = e.target.value as PipelineStage;
                                      if(proj.id) {
                                        await updateDoc(doc(db, "boldr_projects", proj.id), {
                                          stage: val, updatedAt: serverTimestamp()
                                        });
                                      }
                                    }}
                                  >
                                    {PIPELINE_STAGES.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
