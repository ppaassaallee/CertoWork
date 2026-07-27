import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ChevronLeft, Plus, FileText, Loader2, Trash } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

export function PlaybooksList({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState<{id: string, title: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(collection(db, "playbooks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setPlaybooks(items);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [user, workspace]);

  const handleCreatePlaybook = async () => {
    if (!user || !workspace) return;
    try {
      const docRef = await addDoc(collection(db, "playbooks"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: "New Playbook",
        content: "",
        createdAt: serverTimestamp()
      });
      navigate(`/work/playbooks/${docRef.id}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm("Delete this playbook?")) {
      try {
        await deleteDoc(doc(db, "playbooks", id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
     return <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <motion.div 
      initial={isEmbedded ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={isEmbedded ? "space-y-6" : "p-4 max-w-2xl mx-auto space-y-6 pb-24"}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isEmbedded && (
            <Link to="/work" className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </Link>
          )}
          <div>
            <h1 className={isEmbedded ? "text-xl font-bold text-gray-900" : "text-2xl font-bold text-gray-900"}>Playbooks</h1>
            {isEmbedded && (
              <p className="text-gray-500 text-xs mt-1">document work routines and structured runbooks</p>
            )}
          </div>
        </div>
        <button 
          onClick={handleCreatePlaybook}
          className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Playbook
        </button>
      </header>

      <div className="grid gap-3">
        {playbooks.length === 0 ? (
           <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
             <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
             <p className="text-gray-500 font-medium">No playbooks yet.</p>
             <p className="text-sm text-gray-400 mt-1">Create one to start documenting workflows.</p>
           </div>
        ) : (
          playbooks.map(pb => (
            <Link 
              key={pb.id}
              to={`/work/playbooks/${pb.id}`}
              className="group flex flex-col p-4 bg-white border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-sm transition-all"
            >
               <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-indigo-50 flex items-center justify-center rounded-xl text-indigo-500">
                       <FileText className="w-5 h-5" />
                     </div>
                     <span className="font-semibold text-gray-900">{pb.title}</span>
                  </div>
                  <button onClick={(e) => handleDelete(e, pb.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                     <Trash className="w-4 h-4" />
                  </button>
               </div>
            </Link>
          ))
        )}
      </div>
    </motion.div>
  );
}
