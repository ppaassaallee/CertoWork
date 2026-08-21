import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BoldrQA, BoldrProject } from './types';
import { Plus, CheckSquare } from "../ui/Icon";
import { format } from 'date-fns';

export function BoldrQAView() {
  const { user, workspace } = useAuth();
  const [qas, setQas] = useState<BoldrQA[]>([]);
  const [projects, setProjects] = useState<Record<string, BoldrProject>>({});
  
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    if (!user || !workspace) return;
    const qM = query(collection(db, "boldr_qas"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubM = onSnapshot(qM, snap => {
      const data: BoldrQA[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as BoldrQA));
      setQas(data);
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
      await addDoc(collection(db, "boldr_qas"), {
        userId: user.uid,
        workspaceId: workspace.id,
        projectId: selectedProjectId,
        status: "pending",
        issuesFound: 0,
        testDate: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAdding(false);
    } catch(e) { console.error(e); }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold">QA & Testing</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">Review against strict delivery standards</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-800 flex items-center gap-2">
          <Plus className="w-4 h-4"/> Log QA Run
        </button>
      </div>

      {isAdding && (
        <div className="p-6 border-b border-gray-200 bg-sky-50/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Project</label>
              <select className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium bg-white" value={selectedProjectId} onChange={e=>setSelectedProjectId(e.target.value)}>
                <option value="">Select Project...</option>
                {Object.values(projects).map(p => <option key={p.id} value={p.id}>{p.companyName} - {p.name}</option>)}
              </select>
            </div>
            <div className="flex items-end text-sm text-gray-500 font-medium">
              Will start in 'Pending' status. Log issues after creation.
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={()=>setIsAdding(false)} className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm font-bold text-white bg-black rounded shadow disabled:opacity-50" disabled={!selectedProjectId}>Create QA Checklist</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <th className="p-4 pl-6 font-bold w-1/4">Project / Client</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 font-bold">Test Date</th>
              <th className="p-4 font-bold">Issues Found</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {qas.map(qa => (
              <tr key={qa.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="p-4 pl-6 text-sm font-bold text-gray-900 flex items-center gap-3">
                  <CheckSquare className="w-4 h-4 text-sky-400" />
                  <div>
                    <div>{projects[qa.projectId]?.companyName || "Unknown"}</div>
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{projects[qa.projectId]?.name || ""}</div>
                  </div>
                </td>
                <td className="p-4">
                  <select 
                    className={`text-xs font-bold border rounded p-1 outline-none hover:border-gray-300 focus:border-black ${
                      qa.status === 'passed' ? 'bg-green-50 text-green-700 border-green-200' : 
                      qa.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}
                    value={qa.status}
                    onChange={async (e) => {
                      if(qa.id) {
                        try { await updateDoc(doc(db, "boldr_qas", qa.id), { 
                          status: e.target.value, 
                          updatedAt: serverTimestamp(),
                          testDate: (e.target.value === 'passed' || e.target.value === 'failed') && !qa.testDate ? serverTimestamp() : qa.testDate
                        }); } catch(err){}
                      }
                    }}
                  >
                    <option value="pending">PENDING</option>
                    <option value="passed">✅ PASSED</option>
                    <option value="failed">❌ FAILED</option>
                  </select>
                </td>
                <td className="p-4 text-sm font-medium text-gray-600">
                  {qa.testDate ? format(qa.testDate.toDate(), "MMM dd, yyyy") : "-"}
                </td>
                <td className="p-4">
                  <input 
                    type="number"
                    min="0"
                    className="w-16 bg-white border border-gray-200 rounded p-1 text-sm text-center outline-none focus:border-black font-semibold"
                    value={qa.issuesFound}
                    onChange={async (e) => {
                      if(qa.id) {
                        try { await updateDoc(doc(db, "boldr_qas", qa.id), { issuesFound: parseInt(e.target.value) || 0, updatedAt: serverTimestamp() }); } catch(err){}
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
            {qas.length === 0 && !isAdding && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">No QA runs logged. Make sure to QA before client reviews!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
