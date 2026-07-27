import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BoldrBlocker } from './types';
import { Plus, CheckCircle, AlertOctagon } from 'lucide-react';

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export function BoldrBlockers() {
  const { user, workspace } = useAuth();
  const [blockers, setBlockers] = useState<BoldrBlocker[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState<"low"|"medium"|"high"|"critical">("medium");

  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(collection(db, "boldr_risks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsub = onSnapshot(q, snap => {
      const data: BoldrBlocker[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as BoldrBlocker));
      // sort unresolved first, then highest severity
      data.sort((a,b) => {
        if(a.status !== b.status) return a.status === 'open' ? -1 : 1;
        const weights = {critical: 4, high: 3, medium: 2, low: 1};
        return weights[b.severity] - weights[a.severity];
      });
      setBlockers(data);
    });
    return () => unsub();
  }, [user, workspace]);

  const handleSave = async () => {
    if (!user || !workspace || !title.trim()) return;
    try {
      await addDoc(collection(db, "boldr_risks"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: title.trim(),
        type: type.trim(),
        severity,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAdding(false);
      setTitle("");
      setType("");
      setSeverity("medium");
    } catch(e) { console.error(e); }
  };

  const getSeverityColors = (sev: string) => {
    switch(sev) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold">Risks & Blockers</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">Escalate, track, and unblock delivery</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-800 flex items-center gap-2">
          <Plus className="w-4 h-4"/> Log Issue
        </button>
      </div>

      {isAdding && (
        <div className="p-6 border-b border-gray-200 bg-red-50/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Issue Title</label>
              <input autoFocus className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium text-red-900" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Missing API keys"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
              <input className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-medium" value={type} onChange={e=>setType(e.target.value)} placeholder="e.g. Access Delay"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Severity</label>
              <select className="w-full mt-1 border border-gray-300 rounded p-2 text-sm focus:border-black outline-none font-bold bg-white" value={severity} onChange={e=>setSeverity(e.target.value as any)}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={()=>setIsAdding(false)} className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm font-bold text-white bg-black rounded shadow disabled:opacity-50" disabled={!title}>Log Issue</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto flex-1 p-6">
        <div className="grid grid-cols-1 gap-4">
          {blockers.map(b => (
            <div key={b.id} className={`p-4 rounded-xl border flex items-center justify-between ${b.status === 'resolved' ? 'opacity-50 bg-gray-50 border-gray-100' : 'bg-white border-gray-200 hover:shadow-sm'}`}>
              <div className="flex items-center gap-4">
                <button 
                  onClick={async () => {
                    if(!b.id) return;
                    await updateDoc(doc(db, "boldr_risks", b.id), {
                      status: b.status === "open" ? "resolved" : "open",
                      updatedAt: serverTimestamp()
                    });
                  }}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${b.status==='resolved' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-black text-transparent hover:text-gray-300'}`}
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <div>
                  <h3 className={`text-sm font-bold ${b.status === 'resolved' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{b.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityColors(b.severity)}`}>
                      {b.severity}
                    </span>
                    {b.type && <span className="text-[10px] font-bold text-gray-400 capitalize">{b.type}</span>}
                  </div>
                </div>
              </div>
              {b.status === 'open' && b.severity === 'critical' && (
                <div className="flex items-center gap-1 text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-md">
                  <AlertOctagon className="w-3 h-3" /> Needs Attention
                </div>
              )}
            </div>
          ))}
          {blockers.length === 0 && !isAdding && (
            <div className="text-center p-8 text-gray-400 text-sm font-medium">No active risks or blockers. Smooth sailing!</div>
          )}
        </div>
      </div>
    </div>
  );
}
