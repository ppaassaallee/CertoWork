import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { X, Users, Check, Plus, UserPlus } from "./ui/Icon";
import { motion, AnimatePresence } from "motion/react";
import { Stakeholder } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

export function StakeholdersManager({ 
  isOpen, 
  onClose, 
  selectedIds, 
  onToggle 
}: { 
  isOpen: boolean, 
  onClose: () => void,
  selectedIds: string[],
  onToggle: (id: string) => void
}) {
  const { user, workspace } = useAuth();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user || !workspace) return;
    const qStake = query(collection(db, "stakeholders"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsub = onSnapshot(qStake, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setStakeholders(items.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "stakeholders");
    });
    return unsub;
  }, [user, workspace]);

  const handleCreate = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const nameToUse = newName.trim() || searchTerm.trim();
    if (!nameToUse || !user || !workspace) return;
    try {
      const docRef = await addDoc(collection(db, "stakeholders"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: nameToUse,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewName("");
      setSearchTerm("");
      setShowAdd(false);
      onToggle(docRef.id);
    } catch (e) { 
      handleFirestoreError(e, OperationType.CREATE, "stakeholders");
    }
  };

  if (!isOpen) return null;

  const filtered = stakeholders.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl border border-gray-100"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900"><Users className="w-5 h-5 text-emerald-500"/> Stakeholders</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X className="w-5 h-5"/></button>
          </div>

          <div className="relative mb-4">
             <input 
               type="text"
               placeholder="Search or add stakeholder..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
             />
          </div>

          <div className="space-y-1 mb-4 max-h-[300px] overflow-y-auto pr-1">
             {filtered.map(s => (
               <button 
                 key={s.id}
                 onClick={() => onToggle(s.id)}
                 className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedIds.includes(s.id) ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'}`}
               >
                 <div className="flex items-center gap-3">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${selectedIds.includes(s.id) ? 'bg-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                     {s.name.slice(0, 2).toUpperCase()}
                   </div>
                   <span className="font-semibold text-sm">{s.name}</span>
                 </div>
                 {selectedIds.includes(s.id) && <Check className="w-4 h-4" />}
               </button>
             ))}
             
             {filtered.length === 0 && searchTerm && (
                <button 
                  onClick={handleCreate}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-emerald-100 text-emerald-600 hover:bg-emerald-50 transition-all font-bold text-sm"
                >
                  <Plus className="w-5 h-5" />
                  Create "{searchTerm}"
                </button>
             )}

             {stakeholders.length === 0 && !searchTerm && (
                <div className="text-center py-10 text-gray-400">
                   <p className="text-sm">No stakeholders yet.</p>
                </div>
             )}
          </div>

          {!showAdd ? (
            <button 
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 transition-all"
            >
              <UserPlus className="w-5 h-5" />
              Add New Stakeholder
            </button>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
               <input 
                 autoFocus
                 type="text"
                 value={newName}
                 onChange={e => setNewName(e.target.value)}
                 placeholder="Enter full name..."
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-emerald-500 focus:border-emerald-500"
               />
               <div className="flex gap-2">
                 <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-sm text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                 <button type="submit" disabled={!newName.trim()} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50">Create</button>
               </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
