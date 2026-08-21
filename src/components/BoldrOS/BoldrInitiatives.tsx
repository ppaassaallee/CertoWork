import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BoldrInitiative, BoldrProject } from './types';
import { Plus, Link2 } from "../ui/Icon";

const STATUS_OPTIONS = ["Candidate", "Selected", "Mapped", "Prioritized", "Designed", "In Build", "In QA", "In Review", "Live", "Optimizing", "Completed", "Parked"] as const;

export function BoldrInitiatives() {
  const { user, workspace } = useAuth();
  const [initiatives, setInitiatives] = useState<BoldrInitiative[]>([]);
  const [projects, setProjects] = useState<Record<string, BoldrProject>>({});
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [department, setDepartment] = useState("");
  const [painArea, setPainArea] = useState("");

  useEffect(() => {
    if (!user || !workspace) return;
    const qI = query(collection(db, "boldr_initiatives"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubI = onSnapshot(qI, snap => {
      const data: BoldrInitiative[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as BoldrInitiative));
      setInitiatives(data);
    });

    const qP = query(collection(db, "boldr_projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubP = onSnapshot(qP, snap => {
      const pMap: Record<string, BoldrProject> = {};
      snap.forEach(d => {
        pMap[d.id] = {id: d.id, ...d.data()} as BoldrProject;
      });
      setProjects(pMap);
    });

    return () => { unsubI(); unsubP(); }
  }, [user, workspace]);

  const handleSave = async () => {
    if (!user || !workspace || !newName.trim() || !selectedProjectId) return;
    try {
      await addDoc(collection(db, "boldr_initiatives"), {
        userId: user.uid,
        workspaceId: workspace.id,
        projectId: selectedProjectId,
        workflowName: newName.trim(),
        department: department.trim(),
        status: "Candidate",
        painArea: painArea.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewName("");
      setDepartment("");
      setPainArea("");
    } catch(e) { console.error(e); }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold">Workflow Initiatives</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">Specific workflows delivered inside projects</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-800 flex items-center gap-2">
          <Plus className="w-4 h-4"/> New Initiative
        </button>
      </div>

      {isAdding && (
        <div className="p-6 border-b border-gray-200 bg-amber-50/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Workflow Name</label>
              <input autoFocus className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Lead triage bot"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Project</label>
              <select className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium bg-white" value={selectedProjectId} onChange={e=>setSelectedProjectId(e.target.value)}>
                <option value="">Select Project...</option>
                {Object.values(projects).map(p => <option key={p.id} value={p.id}>{p.companyName} - {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Department</label>
              <input className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium" value={department} onChange={e=>setDepartment(e.target.value)} placeholder="e.g. Sales"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Pain Area</label>
              <input className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium" value={painArea} onChange={e=>setPainArea(e.target.value)} placeholder="e.g. 5 hours lost daily"/>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={()=>setIsAdding(false)} className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm font-bold text-white bg-black rounded shadow disabled:opacity-50" disabled={!newName || !selectedProjectId}>Create Initiative</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <th className="p-4 pl-6 font-bold w-1/4">Workflow Name</th>
              <th className="p-4 font-bold">Project</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 font-bold">Department</th>
              <th className="p-4 pr-6 font-bold text-right">Pain Area</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initiatives.map(ini => (
              <tr key={ini.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="p-4 pl-6 text-sm font-bold text-gray-900">{ini.workflowName}</td>
                <td className="p-4 text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Link2 className="w-3 h-3 text-gray-400" />
                  {projects[ini.projectId]?.companyName || "Unknown"}
                </td>
                <td className="p-4">
                  <select 
                    className="text-xs font-bold bg-white border border-gray-200 rounded p-1 outline-none hover:border-gray-300 focus:border-black"
                    value={ini.status}
                    onChange={async (e) => {
                      if(ini.id) {
                        try { await updateDoc(doc(db, "boldr_initiatives", ini.id), { status: e.target.value, updatedAt: serverTimestamp() }); } catch(err){}
                      }
                    }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-4 text-sm font-medium text-gray-600">{ini.department || "-"}</td>
                <td className="p-4 pr-6 text-sm text-gray-400 text-right truncate max-w-[200px]">{ini.painArea || "-"}</td>
              </tr>
            ))}
            {initiatives.length === 0 && !isAdding && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 text-sm">No workflow initiatives found. Click "New Initiative" to begin tracking.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
