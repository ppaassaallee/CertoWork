import re

with open("src/components/AudioCaptureZone.tsx", "r") as f:
    content = f.read()

# Add HeartHandshake for decisions if not present
if "HeartHandshake" not in content:
    content = content.replace('import { Mic, FileAudio, Loader2, Check, X } from "lucide-react";', 'import { Mic, FileAudio, Loader2, Check, X, HeartHandshake, FileText } from "lucide-react";')

new_render_blocks = """
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Executive Summary</h4>
          <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 italic border border-gray-100">
            "{transcriptionResult.summary || transcriptionResult.rawTranscription}"
          </div>
        </div>
        
        {transcriptionResult.decisions && transcriptionResult.decisions.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">Decisions Made</h4>
            <div className="space-y-3">
              {transcriptionResult.decisions.map((item: any, idx: number) => (
                <div key={idx} className="flex items-start justify-between bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <HeartHandshake className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold text-indigo-900">{item.title}</span>
                    </div>
                    {item.reason && <p className="text-sm text-indigo-700 mt-1">{item.reason}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => {
                       const newItems = [...transcriptionResult.decisions];
                       newItems.splice(idx, 1);
                       setTranscriptionResult({ ...transcriptionResult, decisions: newItems });
                    }} className="p-2 text-indigo-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => acceptDecision(item, idx)} className="p-2 text-white bg-indigo-600 hover:bg-indigo-800 rounded-lg transition-colors shadow-sm">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}"""

content = content.replace("""        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Raw Transcription</h4>
          <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 italic border border-gray-100">
            "{transcriptionResult.rawTranscription}"
          </div>
        </div>""", new_render_blocks)

# Add acceptDecision handler
accept_decision_code = """
  const acceptDecision = async (item: any, idx: number) => {
    if (!user || !workspace) return;
    try {
      await addDoc(collection(db, "decisions"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: item.title,
        description: item.reason || "",
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const newItems = [...transcriptionResult.decisions];
      newItems.splice(idx, 1);
      setTranscriptionResult({ ...transcriptionResult, decisions: newItems });
    } catch (e) {
      console.error(e);
      setError("Failed to save decision.");
    }
  };
"""

content = content.replace('const acceptIdea = async (item: any, idx: number) => {', accept_decision_code + '\n  const acceptIdea = async (item: any, idx: number) => {')

with open("src/components/AudioCaptureZone.tsx", "w") as f:
    f.write(content)

