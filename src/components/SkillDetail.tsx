import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { ChevronLeft, Save, Trash2, BrainCircuit, Play, Loader2, ListChecks, FileOutput, HelpCircle } from "./ui/Icon";
import { motion } from "motion/react";

export function SkillDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [instructions, setInstructions] = useState("");
  const [whenToUse, setWhenToUse] = useState("");
  const [inputsRequired, setInputsRequired] = useState("");
  const [outputSchema, setOutputSchema] = useState("");
  const [qualityChecklist, setQualityChecklist] = useState("");
  const [exampleInputs, setExampleInputs] = useState("");
  const [exampleOutputs, setExampleOutputs] = useState("");
  const [references, setReferences] = useState("");
  const [aiReadable, setAiReadable] = useState(true);

  useEffect(() => {
    if (!id || !user || !workspace) return;
    const fetchSkill = async () => {
      const docRef = doc(db, "skills", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().userId === user.uid) {
        const data = docSnap.data();
        setSkill({ id: docSnap.id, ...data });
        setTitle(data.title || "");
        setCategory(data.category || "General");
        setInstructions(data.instructions || "");
        setWhenToUse(data.whenToUse || "");
        setInputsRequired((data.inputsRequired || []).join(", ") || (typeof data.inputsRequired === 'string' ? data.inputsRequired : ""));
        setOutputSchema(data.outputSchema || "");
        setQualityChecklist((data.qualityChecklist || []).join("\n") || (typeof data.qualityChecklist === 'string' ? data.qualityChecklist : ""));
        setExampleInputs(data.exampleInputs || "");
        setExampleOutputs(data.exampleOutputs || "");
        setReferences(data.references || "");
        setAiReadable(data.aiReadable !== false);
      }
      setLoading(false);
    };
    fetchSkill();
  }, [id, user, workspace]);

  const handleSave = async () => {
    if (!id || !skill) return;
    setSaving(true);
    try {
      const checklistArray = qualityChecklist.split("\n").map(t => t.trim()).filter(t => t);
      await updateDoc(doc(db, "skills", id), {
        title,
        category,
        instructions,
        whenToUse,
        inputsRequired,
        outputSchema,
        qualityChecklist: checklistArray,
        exampleInputs,
        exampleOutputs,
        references,
        aiReadable,
        updatedAt: serverTimestamp()
      });
      setSkill({ ...skill, title, category, instructions, whenToUse, inputsRequired, outputSchema, qualityChecklist: checklistArray, exampleInputs, exampleOutputs, references, aiReadable });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "skills", id));
      navigate("/capture/documents?tab=skills");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!skill) return <div className="p-8 text-center text-gray-500">Skill not found.</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-5xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-black hover:bg-gray-50 transition-colors shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
           <h1 className="text-2xl font-bold font-sans">Skill Configuration</h1>
           <div className="text-sm text-gray-500 mt-1 flex gap-2 items-center">
             <span className="uppercase tracking-wider font-bold text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">ID: {skill.id.slice(0, 8)}</span>
           </div>
        </div>
        {!isEditing ? (
          <>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-black text-white font-bold rounded-xl text-sm shadow-sm hover:bg-gray-800 transition-colors">Edit Skill</button>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleDelete} 
                  className="px-3 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-colors"
                >
                  Confirm Delete
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  className="px-3 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="p-2 border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Delete Skill"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-teal-600 text-white font-bold rounded-xl text-sm shadow-sm hover:bg-teal-700 transition-colors flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-teal-500" />
            {isEditing ? (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2 block">Skill Name</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl font-bold text-xl focus:border-teal-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2 block">Core Instructions / Prompt</label>
                  <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={10} className="w-full p-4 border border-gray-200 rounded-xl font-mono text-sm text-gray-700 focus:border-teal-500 focus:outline-none bg-gray-50 focus:bg-white" placeholder="You are an expert... Your task is to... Always ensure..." />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg">{skill.category}</span>
                  {skill.aiReadable && <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg border border-teal-100 flex items-center gap-1.5"><BrainCircuit className="w-3.5 h-3.5" /> AI Accessible</span>}
                </div>
                <h2 className="text-3xl font-bold font-sans text-gray-900 mb-6">{skill.title}</h2>
                <div className="prose max-w-none text-gray-800 font-mono text-sm bg-gray-50 p-6 rounded-2xl border border-gray-100 whitespace-pre-wrap leading-relaxed">
                  {skill.instructions || <span className="text-gray-400 italic font-sans">No instructions provided. Click edit to add the core prompt logic.</span>}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><ListChecks className="w-4 h-4 text-gray-400" /> Quality Checklist</h3>
             {isEditing ? (
               <div>
                  <p className="text-xs text-gray-500 mb-2">One item per line. AI will verify these before finalizing output.</p>
                  <textarea value={qualityChecklist} onChange={e => setQualityChecklist(e.target.value)} rows={6} className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" placeholder="- Is the tone professional?&#10;- Are all edge cases handled?&#10;- Is it under 500 words?" />
               </div>
             ) : (
               <div className="space-y-2">
                 {(Array.isArray(skill.qualityChecklist) ? skill.qualityChecklist : []).length > 0 ? (
                   (Array.isArray(skill.qualityChecklist) ? skill.qualityChecklist : []).map((item: string, idx: number) => (
                     <div key={idx} className="flex gap-2 items-start text-sm text-gray-700">
                        <div className="w-4 h-4 rounded border border-gray-300 mt-0.5 shrink-0" />
                        <span>{item}</span>
                     </div>
                   ))
                 ) : (
                   <span className="text-sm text-gray-400 italic">No checklist defined.</span>
                 )}
               </div>
             )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-gray-400" /> Usage Guidelines</h3>
             {isEditing ? (
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">When to Use</label>
                   <textarea value={whenToUse} onChange={e => setWhenToUse(e.target.value)} rows={2} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category</label>
                   <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none" />
                 </div>
               </div>
             ) : (
               <div className="space-y-4">
                 <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">When to Use</span>
                    <p className="text-sm text-gray-800">{skill.whenToUse || <span className="text-gray-400 italic">Not specified</span>}</p>
                 </div>
                 <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Accessible</span>
                   <span className="font-bold text-sm text-gray-900">{skill.aiReadable ? 'Yes' : 'No'}</span>
                 </div>
               </div>
             )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><FileOutput className="w-4 h-4 text-gray-400" /> Data Contract</h3>
            {isEditing ? (
               <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Inputs Required</label>
                    <textarea value={inputsRequired} onChange={e => setInputsRequired(e.target.value)} rows={2} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none" placeholder="e.g. transcript, objective" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Output Schema</label>
                    <textarea value={outputSchema} onChange={e => setOutputSchema(e.target.value)} rows={3} className="w-full text-sm p-2 font-mono border border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none" placeholder="e.g. JSON, Bulleted List, Markdown" />
                  </div>
               </div>
            ) : (
              <div className="space-y-4">
                 <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Inputs Needed</span>
                    <p className="text-sm text-gray-800">{skill.inputsRequired || <span className="text-gray-400 italic">None specified</span>}</p>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Expected Output</span>
                    <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100 font-mono whitespace-pre-wrap">{skill.outputSchema || <span className="text-gray-400 italic font-sans">Free text</span>}</div>
                 </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">References (Notion/KB links)</h3>
             {isEditing ? (
                 <textarea value={references} onChange={e => setReferences(e.target.value)} rows={4} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none" placeholder="Past Notion links, URLs, or external data guidelines here" />
             ) : (
                 <div className="text-sm text-gray-800 whitespace-pre-wrap">{skill.references || <span className="text-gray-400 italic">No references added.</span>}</div>
             )}
          </div>

          {!isEditing && (
             <div className="bg-gray-900 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <BrainCircuit className="w-24 h-24 text-white" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2 relative z-10">Test Skill Runner</h3>
                <p className="text-gray-400 text-xs mb-4 relative z-10">Simulate this skill in isolation before adding it to an agent or playbook.</p>
                <div className="opacity-50 cursor-not-allowed">
                   <textarea rows={3} disabled className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm mb-3" placeholder="Input variables..." />
                   <button disabled className="w-full py-2.5 bg-white text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2"><Play className="w-4 h-4 fill-black" /> Run Skill</button>
                   <p className="text-center text-[10px] text-gray-500 uppercase font-bold mt-3 tracking-wide">Skill Runner Not Configured</p>
                </div>
             </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
