import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BoldrMBR, BoldrProject } from './types';
import { Plus, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';

export function BoldrMBRs() {
  const { user, workspace } = useAuth();
  const [mbrs, setMbrs] = useState<BoldrMBR[]>([]);
  const [projects, setProjects] = useState<Record<string, BoldrProject>>({});
  
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [decisionRequired, setDecisionRequired] = useState("");

  useEffect(() => {
    if (!user || !workspace) return;
    const qM = query(collection(db, "boldr_mbrs"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubM = onSnapshot(qM, snap => {
      const data: BoldrMBR[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as BoldrMBR));
      data.sort((a,b) => b.month.localeCompare(a.month));
      setMbrs(data);
    });

    const qP = query(collection(db, "boldr_projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubP = onSnapshot(qP, snap => {
      const pMap: Record<string, BoldrProject> = {};
      snap.forEach(d => {
        pMap[d.id] = {id: d.id, ...d.data()} as BoldrProject;
      });
      setProjects(pMap);
    });

    return () => { unsubM(); unsubP(); }
  }, [user, workspace]);

  const handleSave = async () => {
    if (!user || !workspace || !selectedProjectId) return;
    try {
      await addDoc(collection(db, "boldr_mbrs"), {
        userId: user.uid,
        workspaceId: workspace.id,
        projectId: selectedProjectId,
        month,
        status: "pending",
        decisionRequired: decisionRequired.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAdding(false);
      setDecisionRequired("");
    } catch(e) { console.error(e); }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold">Monthly Business Reviews</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">Track MBR readiness and expansion decisions</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-800 flex items-center gap-2">
          <Plus className="w-4 h-4"/> Schedule MBR
        </button>
      </div>

      {isAdding && (
        <div className="p-6 border-b border-gray-200 bg-indigo-50/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Project</label>
              <select className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium bg-white" value={selectedProjectId} onChange={e=>setSelectedProjectId(e.target.value)}>
                <option value="">Select Project...</option>
                {Object.values(projects).map(p => <option key={p.id} value={p.id}>{p.companyName} - {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Target Month</label>
              <input type="month" className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium" value={month} onChange={e=>setMonth(e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Decision Required</label>
              <input className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium" value={decisionRequired} onChange={e=>setDecisionRequired(e.target.value)} placeholder="e.g. Retainer renewal"/>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={()=>setIsAdding(false)} className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm font-bold text-white bg-black rounded shadow disabled:opacity-50" disabled={!selectedProjectId}>Create MBR</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <th className="p-4 pl-6 font-bold w-1/4">Project / Client</th>
              <th className="p-4 font-bold">Month</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 pr-6 font-bold text-right">Decision Required</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mbrs.map(mbr => (
              <tr key={mbr.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="p-4 pl-6 text-sm font-bold text-gray-900 flex items-center gap-3">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <div>
                    <div>{projects[mbr.projectId]?.companyName || "Unknown"}</div>
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{projects[mbr.projectId]?.name || ""}</div>
                  </div>
                </td>
                <td className="p-4 text-sm font-black text-gray-700">{mbr.month}</td>
                <td className="p-4">
                  <select 
                    className={`text-xs font-bold border rounded p-1 outline-none hover:border-gray-300 focus:border-black ${mbr.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}
                    value={mbr.status}
                    onChange={async (e) => {
                      if(mbr.id) {
                        try { await updateDoc(doc(db, "boldr_mbrs", mbr.id), { status: e.target.value, updatedAt: serverTimestamp() }); } catch(err){}
                      }
                    }}
                  >
                    <option value="pending">PENDING</option>
                    <option value="completed">COMPLETED</option>
                  </select>
                </td>
                <td className="p-4 pr-6 text-sm font-medium text-gray-600 text-right">{mbr.decisionRequired || "-"}</td>
              </tr>
            ))}
            {mbrs.length === 0 && !isAdding && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">No MBRs scheduled. Stay ahead of expansion!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
