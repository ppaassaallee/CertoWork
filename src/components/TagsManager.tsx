import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { X, Tag, Trash } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const COLORS = [
  { id: 'gray', class: 'bg-gray-100 text-gray-700 border-gray-200' },
  { id: 'red', class: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'orange', class: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'amber', class: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'green', class: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'emerald', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'teal', class: 'bg-teal-100 text-teal-700 border-teal-200' },
  { id: 'cyan', class: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { id: 'blue', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'indigo', class: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'violet', class: 'bg-violet-100 text-violet-700 border-violet-200' },
  { id: 'purple', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'fuchsia', class: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  { id: 'pink', class: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'rose', class: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const DEFAULT_GROUPS = ["Area of Life", "Work", "Personal", "Others"];

export function TagsManager({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, workspace } = useAuth();
  const [categories, setCategories] = useState<{id: string, name: string, color?: string, group?: string}[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gray");
  
  // Group selection states
  const [selectedGroup, setSelectedGroup] = useState("Work");
  const [customGroupInput, setCustomGroupInput] = useState("");
  const [showCustomGroupInput, setShowCustomGroupInput] = useState(false);

  useEffect(() => {
    if (!user || !workspace) return;
    const qCat = query(collection(db, "categories"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsub = onSnapshot(qCat, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setCategories(items);
    });
    return unsub;
  }, [user, workspace]);

  // Extract all currently existing custom group names
  const existingGroups = Array.from(new Set([
    ...DEFAULT_GROUPS,
    ...categories.map(c => c.group).filter((g): g is string => typeof g === "string" && g.trim() !== "")
  ]));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user || !workspace) return;
    
    const finalGroup = showCustomGroupInput ? customGroupInput.trim() : selectedGroup;
    if (!finalGroup) return;

    try {
      await addDoc(collection(db, "categories"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: newName.trim(),
        color: newColor,
        group: finalGroup,
        createdAt: serverTimestamp()
      });
      setNewName("");
      setNewColor("gray");
      setCustomGroupInput("");
      setShowCustomGroupInput(false);
    } catch (e) { console.error(e); }
  };

  const handleUpdateName = async (id: string, name: string) => {
    if (!name.trim()) return;
    try {
      await updateDoc(doc(db, "categories", id), { name: name.trim() });
    } catch (e) { console.error(e); }
  };

  const handleUpdateColor = async (id: string, color: string) => {
    try {
      await updateDoc(doc(db, "categories", id), { color });
    } catch (e) { console.error(e); }
  };

  const handleUpdateGroup = async (id: string, group: string) => {
    try {
      await updateDoc(doc(db, "categories", id), { group });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tag? Tasks will lose this tag reference.')) return;
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (e) { console.error(e); }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-extrabold flex items-center gap-2 text-gray-900"><Tag className="w-5 h-5 text-indigo-500"/> Manage Tags & Groups</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5"/></button>
          </div>

          {/* Add Tag Form */}
          <form onSubmit={handleAdd} className="mb-6 space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-150">
             <span className="text-[10px] font-black tracking-wider text-gray-400 uppercase">Create New Tag</span>
             
             <div className="flex flex-col sm:flex-row gap-2">
               <input 
                 autoFocus
                 type="text" 
                 value={newName}
                 onChange={e => setNewName(e.target.value)}
                 placeholder="Tag name (e.g., Marketing, Sleep)..."
                 className="flex-1 bg-white border border-gray-250 rounded-xl px-3.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
               />
               
               {/* Group Dropdown */}
               <div className="flex gap-1.5">
                 <select
                   value={showCustomGroupInput ? "custom" : selectedGroup}
                   onChange={(e) => {
                     if (e.target.value === "custom") {
                       setShowCustomGroupInput(true);
                     } else {
                       setShowCustomGroupInput(false);
                       setSelectedGroup(e.target.value);
                     }
                   }}
                   className="bg-white border border-gray-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-1 focus:ring-black"
                 >
                   {existingGroups.map(g => (
                     <option key={g} value={g}>{g}</option>
                   ))}
                   <option value="custom">+ Create custom group...</option>
                 </select>

                 {showCustomGroupInput && (
                   <input
                     type="text"
                     value={customGroupInput}
                     onChange={e => setCustomGroupInput(e.target.value)}
                     placeholder="New group name..."
                     className="bg-white border border-gray-250 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black w-32"
                   />
                 )}
               </div>

               <button disabled={!newName.trim()} type="submit" className="bg-black text-white px-4 py-1.5 rounded-xl disabled:opacity-40 font-bold text-xs">Add</button>
             </div>

             {/* Colors selection */}
             <div className="flex flex-wrap gap-1.5 pt-1">
               {COLORS.map(c => (
                 <button
                   key={c.id}
                   type="button"
                   onClick={() => setNewColor(c.id)}
                   className={`w-5.5 h-5.5 rounded-full border-2 ${newColor === c.id ? 'border-black scale-110 shadow-xs' : 'border-transparent'} ${c.class.split(' ')[0]} transition-all`}
                   title={c.id}
                 />
               ))}
             </div>
          </form>

          {/* Grouped Tags List */}
          <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
             {(() => {
               // Group categories by group field
               const grouped: { [key: string]: typeof categories } = {};
               categories.forEach(cat => {
                 const g = cat.group || "Others";
                 if (!grouped[g]) grouped[g] = [];
                 grouped[g].push(cat);
               });

               // Sort group names
               const sortedGroupNames = Object.keys(grouped).sort((a, b) => {
                 const order = ["area of life", "work", "personal", "others"];
                 const idxA = order.indexOf(a.toLowerCase());
                 const idxB = order.indexOf(b.toLowerCase());
                 if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                 if (idxA !== -1) return -1;
                 if (idxB !== -1) return 1;
                 return a.localeCompare(b);
               });

               return sortedGroupNames.map(groupName => (
                 <div key={groupName} className="space-y-1.5">
                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mt-2.5">
                     {groupName}
                   </h3>
                   {grouped[groupName].map(cat => {
                     const catColor = COLORS.find(c => c.id === cat.color) || COLORS[0];
                     return (
                       <div key={cat.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-2xl border ${catColor.class} gap-2`}>
                         <div className="flex-1 flex items-center gap-2">
                           <input
                             type="text"
                             defaultValue={cat.name}
                             onBlur={(e) => handleUpdateName(cat.id, e.target.value)}
                             className="font-bold text-xs tracking-wide bg-transparent border-none focus:ring-0 p-0 w-full focus:outline-none"
                           />
                         </div>
                         
                         <div className="flex items-center gap-2 bg-white/50 px-2 py-1 rounded-xl self-end sm:self-auto shrink-0">
                            {/* Inline group update */}
                            <select
                              value={cat.group || 'Others'}
                              onChange={(e) => handleUpdateGroup(cat.id, e.target.value)}
                              className="text-[10px] bg-transparent border-none py-0.5 pl-1 pr-6 cursor-pointer font-bold focus:ring-0 text-gray-750"
                            >
                              {existingGroups.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>

                            {/* Inline color update */}
                            <select 
                              value={cat.color || 'gray'}
                              onChange={(e) => handleUpdateColor(cat.id, e.target.value)}
                              className="text-[10px] bg-transparent border-none py-0.5 pl-1 pr-6 cursor-pointer font-medium focus:ring-0 text-gray-650"
                            >
                               {COLORS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                            </select>

                            <button onClick={() => handleDelete(cat.id)} className="p-1 hover:bg-white/80 rounded text-red-500 transition-colors shrink-0"><Trash className="w-3.5 h-3.5"/></button>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               ));
             })()}
             {categories.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No tags created yet.</p>}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
