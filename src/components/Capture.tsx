import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Send, Inbox as InboxIcon, Sparkles, RefreshCw, Zap } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { triageInputWithAI } from "../lib/gemini";
import { AudioCaptureZone } from "./AudioCaptureZone";
import { ReviewCandidateCard } from "./ReviewCandidateCard";


export function Capture() {
  const { user, workspace } = useAuth();
  
  const [input, setInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [rawCaptures, setRawCaptures] = useState<any[]>([]);
  const [reviewCandidates, setReviewCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Meeting Intake State
  const [activeTab, setActiveTab] = useState<"quick" | "meeting" | "audio">("quick");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [meetingProcessing, setMeetingProcessing] = useState(false);
  const [meetingOutcome, setMeetingOutcome] = useState<any | null>(null);


  useEffect(() => {
    if (!user || !workspace) return;

    // 1. Raw captures
    const qRaw = query(
      collection(db, "inbox_items"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "raw")
    );
    const unsubRaw = onSnapshot(qRaw, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setRawCaptures(items);
    });

    // 2. Review candidates
    const qReview = query(
      collection(db, "review_candidates"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "pending")
    );
    const unsubReview = onSnapshot(qReview, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setReviewCandidates(items);
      setLoading(false);
    });

    return () => {
      unsubRaw();
      unsubReview();
    };
  }, [user, workspace]);

  const handleCapture = async () => {
    if (!input.trim() || !user || !workspace) return;
    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const docRef = await addDoc(collection(db, "inbox_items"), {
        userId: user.uid,
        createdBy: user.uid,
        workspaceId: workspace.id,
        content: input.trim(),
        typeHint: "none",
        timeSector: "Today",
        status: "processing",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      try {
        const triaged = await triageInputWithAI(input.trim());
        const runRef = await addDoc(collection(db, "agent_runs"), {
           userId: user.uid,
           agentName: "triage",
           input: input.trim(),
           output: triaged,
           status: "success",
           createdAt: serverTimestamp()
        });
        
        if (triaged.candidates && Array.isArray(triaged.candidates)) {
          for (const c of triaged.candidates) {
            await addDoc(collection(db, "review_candidates"), {
              userId: user.uid,
              createdBy: user.uid,
              workspaceId: workspace.id,
              title: c.title || "Untitled",
              type: c.type || "task",
              why: c.why || "",
              action: c.action || "",
              proposed: {
                ...c.proposed,
                timeSector: "Today"
              },
              source: input.trim(),
              sourceType: "capture",
              sourceId: docRef.id,
              agentRunId: runRef.id,
              status: "pending",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
        await updateDoc(doc(db, "inbox_items", docRef.id), { status: "processed" });
        setSuccessMsg("Processed with AI!");
      } catch (e: any) {
        console.error(e);
        await updateDoc(doc(db, "inbox_items", docRef.id), { status: "raw" });
        setSuccessMsg("Captured for manual review.");
      }
      
      setInput("");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to capture: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };



  
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



  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-24"
    >
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight">Capture</h1>
          <p className="text-gray-500 text-sm mt-1">Collect and clarify inputs. Text, audio, or files.</p>
        </div>

      </header>

      <div className="max-w-2xl mx-auto">
        {/* Capture Container */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setActiveTab('quick')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'quick' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Quick Thought</button>
              <button onClick={() => setActiveTab('meeting')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'meeting' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Meeting Notes</button>
              <button onClick={() => setActiveTab('audio')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'audio' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Voice / Audio</button>
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
          ) : activeTab === 'audio' ? (
            <div className="flex-1 flex flex-col justify-center mt-4">
              <AudioCaptureZone onComplete={() => setSuccessMsg("Voice processed!")} />
            </div>
          ) : (
          
          <div className="flex-1 flex flex-col gap-4 mt-4">
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
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Review Candidates */}
          {reviewCandidates.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" /> Needs Review ({reviewCandidates.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reviewCandidates.map(c => (
                  <ReviewCandidateCard 
                    key={c.id} 
                    candidate={c} 
                    onProcessed={() => {
                      setSuccessMsg("Item processed and saved successfully!");
                      setTimeout(() => setSuccessMsg(""), 3000);
                    }} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Raw Queue */}
          {rawCaptures.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <InboxIcon className="w-4 h-4 text-gray-400" /> Unprocessed Captures ({rawCaptures.length})
                </h3>
              </div>
              <div className="space-y-2.5">
                {rawCaptures.map(item => (
                  <div key={item.id} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-start justify-between gap-3">
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-gray-800">{item.content}</span>
                      <span className="text-[10px] text-gray-400 mt-1">{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
