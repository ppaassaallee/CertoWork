import re

with open("src/components/Capture.tsx", "r") as f:
    content = f.read()

# Add states for Meeting Intake
states = """
  // Meeting Intake State
  const [activeTab, setActiveTab] = useState<"quick" | "meeting">("quick");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [meetingProcessing, setMeetingProcessing] = useState(false);
  const [meetingOutcome, setMeetingOutcome] = useState<any | null>(null);
"""
content = content.replace('const [errorMsg, setErrorMsg] = useState("");', 'const [errorMsg, setErrorMsg] = useState("");\n' + states)

# Add handler for Meeting Intake
handler = """
  const handleProcessMeeting = async () => {
    if (!input.trim() || !user || !workspace) return;
    setMeetingProcessing(true);
    setMeetingOutcome(null);
    try {
      const projSnap = await getDocs(query(collection(db, "projects"), where("userId", "==", user.uid)));
      const projectsList = projSnap.docs.map(d => ({ id: d.id, title: d.data().title }));
      
      const response = await fetch("/api/boldi/process-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: input.trim(),
          title: meetingTitle || "Sync Session",
          meetingDate: meetingDate,
          projectContext: projectsList
        })
      });
      if (!response.ok) throw new Error("Processing failed");
      const data = await response.json();
      setMeetingOutcome(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Meeting process failed: " + err.message);
    } finally {
      setMeetingProcessing(false);
    }
  };

  const handleApproveAndIngestMeeting = async () => {
    if (!user || !workspace || !meetingOutcome) return;
    try {
      const intakeRef = await addDoc(collection(db, "meeting_intakes"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: meetingTitle || "Processed Sync Session",
        meetingDate: meetingDate,
        rawInput: input.trim(),
        inputType: "notes",
        status: "processed",
        processedOutput: meetingOutcome,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (meetingOutcome.decisions) {
        for (const dec of meetingOutcome.decisions) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid, workspaceId: workspace.id, createdBy: user.uid,
            title: `[Decision Decided] ${dec.title}`, type: "decision",
            why: dec.reason, action: "Process Decision Record", confidence: "high",
            proposed: { ...dec, intakeId: intakeRef.id },
            source: meetingOutcome.summary, sourceType: "meeting", sourceId: intakeRef.id,
            status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          });
        }
      }

      if (meetingOutcome.actionItems) {
        for (const t of meetingOutcome.actionItems) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid, workspaceId: workspace.id, createdBy: user.uid,
            title: t.title, type: "task", why: `Extracted action item: "${t.description}"`,
            action: "Import Task", confidence: "high",
            proposed: {
              title: t.title, priority: "P2",
              dueDate: t.dueDate || new Date(Date.now() + 48*60*60*1000).toISOString().split("T")[0],
              status: "open", notes: t.description, projectId: t.projectId || ""
            },
            source: meetingOutcome.summary, sourceType: "meeting", sourceId: intakeRef.id,
            status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          });
        }
      }

      if (meetingOutcome.stakeholderFollowUps) {
        for (const fl of meetingOutcome.stakeholderFollowUps) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid, workspaceId: workspace.id, createdBy: user.uid,
            title: `Stakeholder Follow-up with ${fl.name}`, type: "task",
            why: fl.suggestedFollowUp, action: "Schedule Follow-up Task", confidence: "high",
            proposed: {
              title: `Follow-up with ${fl.name}`, priority: "P1",
              notes: fl.suggestedFollowUp, status: "open", stakeholderId: fl.stakeholderId || ""
            },
            source: meetingOutcome.summary, sourceType: "meeting", sourceId: intakeRef.id,
            status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          });
        }
      }
      setSuccessMsg("Meeting processed & ingested to queue!");
      setMeetingOutcome(null);
      setMeetingTitle("");
      setInput("");
    } catch (e) {
      console.error(e);
    }
  };
"""
content = content.replace('const handleKillCandidate = async (candidateId: string) => {', handler + '\n  const handleKillCandidate = async (candidateId: string) => {')

# Remove the link to meeting intake
content = content.replace("""        <Link
          to="/capture/meeting-intake"
          className="hidden md:flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-black rounded-xl text-xs font-bold transition-all bg-white shadow-sm"
        >
          <FileText className="w-3.5 h-3.5" /> Meeting Intake
        </Link>""", "")

# Update text capture card to handle tabs
text_capture_old = """        {/* Text Capture */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Text Capture</h3>
            <span className="text-[10px] text-indigo-600 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" /> AI Triage Active
            </span>
          </div>"""
text_capture_new = """        {/* Text Capture */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setActiveTab('quick')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'quick' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Quick Thought</button>
              <button onClick={() => setActiveTab('meeting')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'meeting' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Meeting Notes</button>
            </div>
            {activeTab === 'quick' && (
              <span className="text-[10px] text-indigo-600 font-extrabold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" /> AI Triage Active
              </span>
            )}
          </div>
          
          {activeTab === 'meeting' && !meetingOutcome && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Session Title</label>
                <input type="text" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="e.g. Weekly Sync" className="w-full text-xs p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-black font-semibold" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Date</label>
                <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="w-full text-xs p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none font-semibold text-gray-800" />
              </div>
            </div>
          )}
          
          {meetingOutcome ? (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wider">Summary</span>
                <p className="text-xs text-gray-800 font-medium leading-relaxed mt-2 italic">"{meetingOutcome.summary}"</p>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setMeetingOutcome(null)} className="flex-1 py-3 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors">Discard</button>
                <button onClick={handleApproveAndIngestMeeting} className="flex-1 py-3 text-xs font-bold text-white bg-black hover:bg-neutral-800 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"><Zap className="w-4 h-4 text-amber-400" /> Send to AI Queue</button>
              </div>
            </div>
          ) : ("""

content = content.replace(text_capture_old, text_capture_new)

textarea_block_old = """          <div className="flex-1 flex flex-col gap-4">
            <textarea
              className="w-full h-32 p-4 text-base bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-black/5 placeholder:text-gray-400"
              placeholder="Dump a thought, next action, issue, or note..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCapture();
                }
              }}
              disabled={isSaving}
            />
            <div className="flex items-center justify-between">
              <div>
                {successMsg && (
                  <span className="text-xs text-green-600 font-bold">{successMsg}</span>
                )}
                {errorMsg && (
                  <span className="text-xs text-red-600 font-bold">{errorMsg}</span>
                )}
              </div>
              <button
                onClick={handleCapture}
                disabled={isSaving || !input.trim()}
                className="bg-black hover:bg-neutral-900 text-white px-6 py-2.5 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-25"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Process
              </button>
            </div>
          </div>"""
textarea_block_new = """          <div className="flex-1 flex flex-col gap-4">
            <textarea
              className={`w-full ${activeTab === 'meeting' ? 'h-48' : 'h-32'} p-4 text-base bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-black/5 placeholder:text-gray-400 transition-all`}
              placeholder={activeTab === 'meeting' ? "Paste raw notes dump or transcript here..." : "Dump a thought, next action, issue, or note..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && activeTab === 'quick') {
                  e.preventDefault();
                  handleCapture();
                }
              }}
              disabled={isSaving || meetingProcessing}
            />
            <div className="flex items-center justify-between">
              <div>
                {successMsg && (
                  <span className="text-xs text-green-600 font-bold">{successMsg}</span>
                )}
                {errorMsg && (
                  <span className="text-xs text-red-600 font-bold">{errorMsg}</span>
                )}
              </div>
              <button
                onClick={activeTab === 'meeting' ? handleProcessMeeting : handleCapture}
                disabled={isSaving || meetingProcessing || !input.trim()}
                className="bg-black hover:bg-neutral-900 text-white px-6 py-2.5 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-25"
              >
                {(isSaving || meetingProcessing) ? <RefreshCw className="w-4 h-4 animate-spin" /> : (activeTab === 'meeting' ? <Sparkles className="w-4 h-4 text-amber-400" /> : <Send className="w-4 h-4" />)}
                {activeTab === 'meeting' ? 'Analyze Meeting' : 'Process'}
              </button>
            </div>
          </div>
          )}"""

content = content.replace(textarea_block_old, textarea_block_new)

with open("src/components/Capture.tsx", "w") as f:
    f.write(content)

