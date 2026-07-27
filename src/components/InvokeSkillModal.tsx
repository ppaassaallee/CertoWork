import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  Sparkles, 
  X, 
  Search, 
  Copy, 
  Check, 
  Play, 
  Loader2, 
  HelpCircle
} from "lucide-react";

interface InvokeSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle: string;
  itemContent: string;
  itemType: "task" | "document" | "idea" | "decision" | "item" | string;
  onAppendContent?: (text: string) => Promise<void> | void;
  onOverwriteContent?: (text: string) => Promise<void> | void;
}

export function InvokeSkillModal({
  isOpen,
  onClose,
  itemTitle,
  itemContent,
  itemType,
  onAppendContent,
  onOverwriteContent
}: InvokeSkillModalProps) {
  const { user, workspace } = useAuth();
  const [skills, setSkills] = useState<any[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<any | null>(null);
  
  // Execution states
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedAction, setSavedAction] = useState<"append" | "overwrite" | null>(null);

  // Fetch skills when open
  useEffect(() => {
    if (!isOpen || !user || !workspace) return;
    
    const fetchSkills = async () => {
      setLoadingSkills(true);
      try {
        const q = query(
          collection(db, "skills"), 
          where("userId", "==", user.uid), 
          where("workspaceId", "==", workspace.id)
        );
        const snap = await getDocs(q);
        const arr: any[] = [];
        snap.forEach(doc => {
          arr.push({ id: doc.id, ...doc.data() });
        });
        setSkills(arr);
        if (arr.length > 0) {
          setSelectedSkill(arr[0]);
        }
      } catch (err) {
        console.error("Error fetching skills: ", err);
      } finally {
        setLoadingSkills(false);
      }
    };
    
    fetchSkills();
  }, [isOpen, user, workspace]);

  if (!isOpen) return null;

  const filteredSkills = skills.filter(s => 
    (s.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExecute = async () => {
    if (!selectedSkill) return;
    setExecuting(true);
    setResult(null);
    setError(null);
    setSavedAction(null);
    
    try {
      const res = await fetch("/api/skills/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillTitle: selectedSkill.title,
          instructions: selectedSkill.instructions,
          itemTitle,
          itemContent,
          itemType
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute skill");
      }
      
      setResult(data.outputText);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during execution.");
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAppend = async () => {
    if (!result || !onAppendContent) return;
    try {
      await onAppendContent(result);
      setSavedAction("append");
    } catch (err) {
      alert("Failed to append content");
    }
  };

  const handleOverwrite = async () => {
    if (!result || !onOverwriteContent || !confirm("Are you sure you want to OVERWRITE the current content/notes with the AI result?")) return;
    try {
      await onOverwriteContent(result);
      setSavedAction("overwrite");
    } catch (err) {
      alert("Failed to overwrite content");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h2 className="font-black text-gray-900 text-lg tracking-tight">Invoke AI Skill (Claude Skills for Gazelle)</h2>
              <p className="text-xs text-gray-400">Run a custom instruction set on "{itemTitle}" through the configured AI provider</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Split Screen */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Skill Library Selector */}
          <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
            {/* Search */}
            <div className="p-4 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search skills..."
                  className="w-full bg-white text-xs pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                />
              </div>
            </div>

            {/* List of Skills */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingSkills ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 font-medium">No skills found.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Create skills in Knowledge Base or Skills tab.</p>
                </div>
              ) : (
                filteredSkills.map(skill => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      setSelectedSkill(skill);
                      setResult(null);
                      setError(null);
                      setSavedAction(null);
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-3 border ${
                      selectedSkill?.id === skill.id 
                        ? "bg-teal-50/50 border-teal-100 text-teal-900 shadow-sm" 
                        : "bg-transparent border-transparent text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                      selectedSkill?.id === skill.id ? "bg-teal-100/50 text-teal-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs truncate">{skill.title}</h4>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{skill.category || "General"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Execution and Output Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {selectedSkill ? (
              <div className="flex-1 flex flex-col overflow-hidden p-6">
                {/* Skill Details */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-4 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase font-black bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md tracking-wider">
                      {selectedSkill.category || "General"}
                    </span>
                    <span className="text-[10px] text-gray-400">Created in Skills Library</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{selectedSkill.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">
                    Prompt: {selectedSkill.instructions || "No custom instructions defined yet."}
                  </p>
                </div>

                {/* Response / Prompt output workspace */}
                <div className="flex-1 border border-gray-150 rounded-2xl overflow-y-auto bg-gray-50/30 p-5 relative min-h-[150px]">
                  {executing ? (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                      <p className="text-xs font-bold text-gray-700">The configured AI provider is executing your skill...</p>
                      <p className="text-[10px] text-gray-400">Analyzing context & applying custom instructions</p>
                    </div>
                  ) : null}

                  {result ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-teal-50/30 border border-teal-100 px-4 py-2 rounded-xl shrink-0">
                        <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-teal-600" />
                          Skill Executed Successfully!
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopy}
                            className="text-xs font-semibold text-gray-600 hover:text-black bg-white border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            {copied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-gray-400" />
                                Copy Output
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Styled Plaintext Markdown Output */}
                      <div className="font-sans text-sm text-gray-800 leading-relaxed whitespace-pre-wrap select-text p-1 bg-white/50 rounded-lg">
                        {result}
                      </div>
                    </div>
                  ) : error ? (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs space-y-1">
                      <h4 className="font-bold">Execution Failed</h4>
                      <p>{error}</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                      <Sparkles className="w-12 h-12 text-teal-100 mb-3" />
                      <h4 className="font-bold text-gray-700 text-sm mb-1">Ready to Execute</h4>
                      <p className="text-xs max-w-sm">
                        Click the **"Execute Skill"** button to analyze "{itemTitle}" using this skill's custom instruction prompt.
                      </p>
                    </div>
                  )}
                </div>

                {/* Modal Footer Controls inside Right Panel */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                  {/* Left: action on append/overwrite */}
                  <div className="flex items-center gap-2">
                    {result && onAppendContent && (
                      <button
                        onClick={handleAppend}
                        disabled={savedAction === "append" || savedAction === "overwrite"}
                        className="px-3.5 py-2 border border-gray-200 text-xs font-bold text-gray-700 rounded-xl hover:border-black/20 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {savedAction === "append" ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" /> Appended!
                          </>
                        ) : (
                          "Append to Item Notes"
                        )}
                      </button>
                    )}
                    {result && onOverwriteContent && (
                      <button
                        onClick={handleOverwrite}
                        disabled={savedAction === "append" || savedAction === "overwrite"}
                        className="px-3.5 py-2 border border-red-100 text-xs font-bold text-red-700 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {savedAction === "overwrite" ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" /> Overwritten!
                          </>
                        ) : (
                          "Overwrite Item Notes"
                        )}
                      </button>
                    )}
                  </div>

                  {/* Right: Trigger Button */}
                  <button
                    onClick={handleExecute}
                    disabled={executing}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    {executing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 text-teal-100 fill-teal-100" />
                        Execute Skill
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <Sparkles className="w-12 h-12 text-teal-100 mb-3" />
                <h3 className="font-bold text-gray-700 text-sm">Select a Skill</h3>
                <p className="text-xs max-w-xs mt-1">
                  Choose a Claude-like custom skill from the sidebar to execute on this item.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
