import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ChevronLeft, Loader2, Save } from "./ui/Icon";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

export function PlaybookDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [playbook, setPlaybook] = useState<{id: string, title: string, content: string} | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(doc(db, "playbooks", id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setPlaybook({ id: snap.id, ...data });
        setTitle(data.title || "");
        setContent(data.content || "");
      }
      setLoading(false);
    }, err => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [user, id]);

  const handleSave = async () => {
    if (!id || !playbook) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "playbooks", id), {
        title,
        content
      });
    } catch(err) {
      console.error(err);
    }
    setSaving(false);
  };

  if (loading) {
     return <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!playbook) {
     return <div className="p-4 flex flex-col items-center justify-center pt-20">
         <div className="text-gray-500 font-medium">Playbook not found</div>
         <Link to="/work/playbooks" className="text-indigo-500 mt-2">Go back</Link>
     </div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-2xl mx-auto space-y-4 pb-24"
    >
      <header className="flex items-center justify-between mb-2">
        <Link to="/work/playbooks" className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-xl flex items-center gap-2 hover:bg-indigo-100 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save</span>
        </button>
      </header>

      <div>
         <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            placeholder="Playbook Title"
            className="w-full text-3xl font-bold bg-transparent border-none p-0 focus:ring-0 placeholder:text-gray-300"
         />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden min-h-[400px] flex flex-col">
         <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            placeholder="Write your playbook content here in Markdown..."
            className="w-full flex-1 p-6 bg-transparent border-none focus:ring-0 resize-none font-mono text-sm leading-relaxed"
         />
      </div>
    </motion.div>
  );
}
