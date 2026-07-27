import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Sparkles } from 'lucide-react';
import { doc, onSnapshot, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { useUndo } from '../lib/UndoContext';
import { InvokeSkillModal } from './InvokeSkillModal';

export function GenericModuleDetail({ 
  collectionName 
}: { 
  collectionName: string 
}) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pushAction } = useUndo();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  const handleAppendSkillContent = async (text: string) => {
    if (!item || !id) return;
    const updated = (content || "") + "\n\n" + text;
    await updateDoc(doc(db, collectionName, id), { content: updated });
    setContent(updated);
  };

  const handleOverwriteSkillContent = async (text: string) => {
    if (!item || !id) return;
    await updateDoc(doc(db, collectionName, id), { content: text });
    setContent(text);
  };

  useEffect(() => {
    if (!user || !id) return;
    const unsubscribe = onSnapshot(doc(db, collectionName, id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setItem({ id: snapshot.id, ...data });
        setTitle(data.title || '');
        setContent(data.content || data.reason || data.description || '');
      } else {
        setItem(null);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, id, collectionName]);

  const handleSave = async () => {
    if (!user || !item || !id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, collectionName, id), {
        title,
        content // We save it as content, if it was named reason/description originally, we'll just save it as content for this generic view to allow edits
      });
    } catch (e) {
      console.error(e);
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!user || !item || !id) return;
    const newStatus = (item.status === 'done' || item.status === 'completed') ? 'open' : 'done';
    try {
      await updateDoc(doc(db, collectionName, id), {
        status: newStatus
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!user || !item || !id || !confirm("Are you sure you want to delete this item?")) return;
    try {
      const itemData = { ...item };
      delete itemData.id;
      
      await deleteDoc(doc(db, collectionName, id));
      
      pushAction({
        id: `delete-${collectionName}-${id}`,
        description: `Delete item "${item.title || 'Untitled'}"`,
        undo: async () => {
          await setDoc(doc(db, collectionName, id), itemData);
        },
        redo: async () => {
          await deleteDoc(doc(db, collectionName, id));
        }
      });
      
      navigate('..');
    } catch (e) {
      console.error(e);
      alert('Failed to delete item.');
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center h-full">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4 flex flex-col items-center justify-center pt-20">
        <div className="text-gray-500 font-medium">Item not found</div>
        <button onClick={() => navigate('..')} className="text-indigo-500 mt-2 hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-4xl mx-auto space-y-6 pb-24"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('..')} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex gap-2 items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">Item Details</span>
            <button 
              onClick={toggleStatus}
              className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors ${item.status === 'done' || item.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
            >
              {item.status || 'Active'}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsSkillModalOpen(true)}
            className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-xl text-sm shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            title="Invoke AI Skill"
          >
            <Sparkles className="w-4 h-4 text-teal-600" /> AI Skill
          </button>
          <button 
             onClick={handleDelete}
             className="px-4 py-2 border border-gray-200 text-gray-500 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
             title="Delete Item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2 bg-black text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </header>

      <div className="space-y-6">
        <input 
          type="text" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          placeholder="Enter title here..." 
          className="w-full text-3xl font-bold bg-transparent border-none p-0 focus:ring-0 placeholder:text-gray-300 text-gray-900"
        />

        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[400px]">
          <div className="bg-gray-50 border-b border-gray-100 px-6 py-3">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Content / Description</span>
          </div>
          <textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            placeholder="Write content here in Markdown..." 
            className="w-full flex-1 p-6 bg-transparent border-none focus:ring-0 resize-none font-mono text-sm leading-relaxed text-gray-800"
          />
        </div>

        {item.source && (
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
             <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Source Context</h3>
             <p className="text-sm text-gray-600">{item.source}</p>
          </div>
        )}
      </div>

      <InvokeSkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        itemTitle={item.title || ""}
        itemContent={content || ""}
        itemType={collectionName === "someday" ? "idea" : "item"}
        onAppendContent={handleAppendSkillContent}
        onOverwriteContent={handleOverwriteSkillContent}
      />
    </motion.div>
  );
}
