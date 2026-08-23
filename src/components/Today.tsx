import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Calendar, Power, Loader2, Check, Brain, Sparkles, Plus, CheckSquare, RefreshCw, AlertCircle, ChevronRight } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toggleTaskStatus, setTaskStatus } from "../lib/tasks";
import { triageInputWithAI } from "../lib/gemini";
import { StartMyDay } from "./StartMyDay";

export function Today() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [inboxCount, setInboxCount] = useState(0);
  const [hasOnboardedToday, setHasOnboardedToday] = useState(true); // default to true to prevent flickering during DB fetch
  const [showStartDayModal, setShowStartDayModal] = useState(false);
  const [tasks, setTasks] = useState<{id: string, title: string, priority?: number}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");

  const [oneThing, setOneThing] = useState<any>(null);
  const [waitingForItems, setWaitingForItems] = useState<any[]>([]);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user || !workspace) return;
    
    // Listen to pending inbox items (status = raw or pending)
    const qInbox = query(collection(db, "inbox_items"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "raw"));
    const unsubscribeInbox = onSnapshot(qInbox, (snapshot) => {
      setInboxCount(snapshot.size);
    }, (err) => console.error(err));

    // Listen to tasks (open)
    const qTasks = query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "open"));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const items: {id: string, title: string, priority?: number}[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        let pNum = 4;
        const rawPriority = data.priority;
        if (rawPriority !== undefined && rawPriority !== null) {
          if (typeof rawPriority === 'number') {
            pNum = rawPriority;
          } else if (typeof rawPriority === 'string') {
            const clean = rawPriority.toUpperCase().replace('P', '').trim();
            const num = parseInt(clean, 10);
            if (!isNaN(num)) pNum = num;
          }
        }
        items.push({ id: doc.id, title: data.title, priority: pNum });
      });
      setTasks(items);
    }, (err) => console.error(err));

    // Listen to ONE Thing (can be open or done)
    const qOneThing = query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("isOneThing", "==", true));
    const unsubscribeOneThing = onSnapshot(qOneThing, (snapshot) => {
      let foundOneThing = null;
      if (!snapshot.empty) {
        foundOneThing = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      }
      setOneThing(foundOneThing);
    }, (err) => console.error(err));
    
    // Waiting for Items
    const qWaiting = query(collection(db, "waiting_for"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "open"));
    const unsubscribeWaiting = onSnapshot(qWaiting, (snapshot) => {
       const items: any[] = [];
       snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
       setWaitingForItems(items);
    }, (err) => console.error(err));

    const qOnboard = query(collection(db, "start_day_sessions"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("date", "==", todayStr));
    const unsubOnboard = onSnapshot(qOnboard, (snapshot) => {
      setHasOnboardedToday(!snapshot.empty);
    }, (err) => console.error(err));

    return () => {
      unsubscribeInbox();
      unsubscribeTasks();
      unsubscribeOneThing();
      unsubscribeWaiting();
      unsubOnboard();
    };
  }, [user, workspace]);

  const handleProcessInbox = async () => {
    if (!user || !workspace || isProcessing) return;
    setIsProcessing(true);
    setProcessStatus("Fetching items...");
    
    try {
      const qInbox = query(collection(db, "inbox_items"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "raw"));
      const snapshot = await getDocs(qInbox);
      
      let processed = 0;
      for (const itemDoc of snapshot.docs) {
        setProcessStatus(`Processing item ${processed + 1} of ${snapshot.size}...`);
        const item = itemDoc.data();
        
        await updateDoc(doc(db, "inbox_items", itemDoc.id), {
          status: "processing"
        });

        try {
          const responseData = await triageInputWithAI(item.content);
          
          const runRef = await addDoc(collection(db, "agent_runs"), {
             userId: user.uid,
             workspaceId: workspace.id,
             agentName: "triage",
             input: item.content,
             output: responseData,
             status: "success",
             error: null,
             createdAt: serverTimestamp()
          });
          
          const { candidates } = responseData;
          
          if (candidates && Array.isArray(candidates)) {
            for (const c of candidates) {
              await addDoc(collection(db, "review_candidates"), {
                userId: user.uid,
                workspaceId: workspace.id,
                createdBy: user.uid,
                title: c.title || "Untitled",
                type: c.type || "task",
                why: c.why || "",
                action: c.action || "",
                confidence: c.confidence || "medium",
                proposed: c.proposed || {},
                source: item.content,
                sourceType: "capture",
                sourceId: itemDoc.id,
                agentRunId: runRef.id,
                status: "pending",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            }
          }

          await updateDoc(doc(db, "inbox_items", itemDoc.id), {
            status: "processed"
          });
          
          processed++;
        } catch (e) {
          console.error("Failed to process item", itemDoc.id, e);
          await updateDoc(doc(db, "inbox_items", itemDoc.id), {
            status: "raw"
          });
        }
      }
      setProcessStatus("");
    } catch (err) {
      console.error(err);
      setProcessStatus("Error processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-24"
    >
      {/* Mobile Secondary Navigation Horizontal Chips */}
      <div className="flex md:hidden gap-1 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none border-b border-gray-100">
        <button onClick={() => navigate("/")} className="px-3 py-1.5 bg-black text-white rounded-full text-xs font-semibold whitespace-nowrap">Focus</button>
        <button onClick={() => navigate("/today/agenda")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Agenda</button>
        <button onClick={() => navigate("/work/timeblocks")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Time Blocks</button>
        <button onClick={() => navigate("/today/routines")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Routines</button>
        <button onClick={() => navigate("/capture")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Meetings</button>
        <button onClick={() => navigate("/work/waiting")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Waiting For</button>
      </div>

      {/* Greeting Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight">Good morning, Alejandro</h1>
          <p className="text-gray-500 text-sm mt-1">{getDayName()} · Travel Mode Off</p>
        </div>
        
        {/* Secondary Action CTAs */}
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => navigate("/capture")}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-black rounded-xl text-xs font-bold transition-all bg-white"
          >
            <Plus className="w-3.5 h-3.5" /> Capture
          </button>
          <button 
            onClick={() => navigate("/work/tasks")}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-black rounded-xl text-xs font-bold transition-all bg-white"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Plan Day
          </button>
          <button 
            onClick={() => navigate("/review")}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-black rounded-xl text-xs font-bold transition-all bg-white"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Review Yesterday
          </button>
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
                detail: { message: "Certo Work, plan my day." }
              }));
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" /> Ask Certo Work
          </button>
        </div>
      </header>

      {/* Main CTA - Start My Day Hero Card */}
      {!hasOnboardedToday && (
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white p-6 rounded-3xl border border-neutral-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="space-y-1.5 text-left">
            <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5 text-yellow-400">
              <Brain className="w-4.5 h-4.5 animate-pulse text-yellow-400" /> Start My Day Operating Mode
            </h3>
            <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
              Your day is not yet strategically aligned. Take 1-minute to clear your mind, generate your AI daily briefing, and lock down your 2+8 prioritizations.
            </p>
          </div>
          <button
            onClick={() => setShowStartDayModal(true)}
            className="bg-white text-black hover:bg-neutral-100 text-xs font-extrabold px-5 py-3 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-lg"
          >
            <Brain className="w-4.5 h-4.5" /> Start My Day
          </button>
        </div>
      )}

      {showStartDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto no-scrollbar">
          <div className="w-full max-w-2xl">
            <StartMyDay onComplete={() => {
              setShowStartDayModal(false);
              setHasOnboardedToday(true);
            }} />
          </div>
        </div>
      )}

      {/* 1. Today's One Thing (Today Wins If) */}
      <section className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm text-left">
        <h2 className="text-[10px] font-black tracking-widest uppercase text-gray-400 mb-2">Today Wins If (The One Thing)</h2>
        <div className="text-xl font-extrabold mb-4 text-gray-900">
          {oneThing ? oneThing.title : "Not set for today"}
        </div>
        <div className="flex gap-2">
          {oneThing ? (
            oneThing.status === "done" ? (
               <div className="flex-1 bg-green-50 text-green-700 rounded-2xl py-3 font-bold text-xs flex items-center justify-center gap-2 border border-green-150">
                 <Check className="w-4 h-4 text-green-600" /> ONE Thing Accomplished!
               </div>
            ) : (
               <button 
                 onClick={async () => {
                    await toggleTaskStatus({ ...oneThing, userId: user?.uid });
                 }}
                 className="flex-1 bg-black text-white rounded-2xl py-3 font-bold text-xs flex items-center justify-center gap-2 hover:bg-neutral-900 transition-colors"
               >
                 <Check className="w-4 h-4 text-yellow-400" /> Complete ONE Thing
               </button>
            )
          ) : (
            <Link to="/work/tasks" className="flex-1 bg-gray-50 text-gray-600 border border-gray-250 border-dashed hover:bg-gray-100 transition-colors rounded-2xl py-3 font-semibold text-xs flex items-center justify-center gap-2">
              Select your ONE Thing priority
            </Link>
          )}
        </div>
      </section>

      {/* 2. Top 3 Priorities (2+8 Plan) */}
      <section className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm text-left">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-gray-400">Daily Plan (2 Must-Dos + 8 Should-Dos)</h2>
          <Link to="/work/tasks" className="text-[10px] font-black text-indigo-600 hover:underline bg-indigo-50 px-2.5 py-1 rounded-lg">Adjust Priorities</Link>
        </div>
        
        <div className="space-y-5">
          {/* Must Dos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-xs font-black text-red-600 uppercase tracking-wider">Must Dos (Non-Negotiable)</h3>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.priority === 1).slice(0, 2).map(task => (
                <div key={task.id} className="flex items-center gap-3 bg-red-50/25 p-3.5 rounded-2xl border border-red-100 group transition-all hover:bg-red-50/55">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 accent-red-600 cursor-pointer"
                    onChange={async () => { await setTaskStatus(task, "done"); }}
                  />
                  <span className="text-xs font-bold text-red-950 leading-relaxed">{task.title}</span>
                </div>
              ))}
              {tasks.filter(t => t.priority === 1).length === 0 && (
                <div className="text-xs text-gray-400 italic p-3 border border-dashed border-gray-150 rounded-2xl bg-gray-50/30">No non-negotiables scheduled.</div>
              )}
            </div>
          </div>

          {/* Should Dos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider">Should Dos</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tasks.filter(t => t.priority === 2).slice(0, 8).map(task => (
                <div key={task.id} className="flex items-center gap-3 bg-orange-50/20 p-3.5 rounded-2xl border border-orange-100/70 group transition-all hover:bg-orange-50/45">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 accent-orange-500 cursor-pointer"
                    onChange={async () => { await setTaskStatus(task, "done"); }}
                  />
                  <span className="text-xs font-semibold text-orange-950 truncate">{task.title}</span>
                </div>
              ))}
              {tasks.filter(t => t.priority === 2).length === 0 && (
                <div className="col-span-2 text-xs text-gray-400 italic p-3 border border-dashed border-gray-150 rounded-2xl bg-gray-50/30 text-center">No high-priority tasks.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Agenda / Time Blocks Card */}
      <section className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm text-left">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-gray-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-500" /> Today's Calendar & Time Blocks
          </h2>
          <Link to="/work/timeblocks" className="text-[10px] font-black text-indigo-600 hover:underline">Adjust Blocks</Link>
        </div>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Ensure calendar integrity: protect work sessions and align admin, message buffers, and fitness blocks.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/today/agenda" className="p-4 bg-gray-50 hover:bg-gray-100/80 rounded-2xl border border-gray-150/70 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Calendar className="w-4 h-4" /></div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Unified Agenda</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">View meetings & schedule</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link to="/work/timeblocks" className="p-4 bg-gray-50 hover:bg-gray-100/80 rounded-2xl border border-gray-150/70 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Clock className="w-4 h-4" /></div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 group-hover:text-amber-600 transition-colors">Perfect Day Builder</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Hourly focus blocks</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* 4. Urgent Follow-ups & 6. Waiting For */}
      <section className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm text-left">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-gray-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Urgent Follow-ups & Waiting For
          </h2>
          <Link to="/work/waiting" className="text-[10px] font-black text-indigo-600 hover:underline">Manage All</Link>
        </div>
        {waitingForItems.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No urgent waiting-for followups outstanding.</p>
        ) : (
          <div className="space-y-2">
            {waitingForItems.slice(0, 3).map(item => (
              <div key={item.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-150/60 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900">{item.title}</h4>
                  <p className="text-[9px] text-gray-400 mt-0.5">Waiting for: {item.owner || "External stakeholder"}</p>
                </div>
                <Link to={`/work/waiting/${item.id}`} className="p-1 px-2.5 bg-white border border-gray-200 rounded-lg text-[9px] font-bold text-gray-600 hover:border-black transition-all">
                  Inspect
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Meetings to Process */}
      {inboxCount > 0 && (
        <section className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100/80 shadow-sm text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black uppercase tracking-wider text-blue-600">Unprocessed Meetings & Captures</h2>
            <div className="font-bold text-sm text-blue-900">{inboxCount} raw notes and inputs ready for AI triage</div>
            {processStatus && <div className="text-[10px] text-blue-700 font-bold">{processStatus}</div>}
          </div>
          <button 
            onClick={handleProcessInbox}
            disabled={isProcessing}
            className="bg-white text-blue-900 border border-blue-250/70 px-4 py-2.5 rounded-xl text-xs font-extrabold hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-500" />}
            AI Triage
          </button>
        </section>
      )}

      {/* 8. Boldi Suggestion Widget Inside Today Dashboard */}
      <section className="bg-neutral-50 p-5 rounded-3xl border border-gray-200 shadow-sm text-left">
        <h2 className="text-[10px] font-black tracking-widest uppercase text-gray-400 mb-3 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" /> Ask Certo Work Nav Intelligence Suggestions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
                detail: { message: "Certo Work, plan my day based on calendar blocks and 2+8 priorities." }
              }));
            }}
            className="p-3 bg-white border border-gray-150 hover:border-black rounded-xl text-left transition-all"
          >
            <span className="text-xs font-bold text-gray-900 block">Plan my day</span>
            <span className="text-[9px] text-gray-400 mt-1 block">Inspect priorities and slot schedule</span>
          </button>
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
                detail: { message: "Certo Work, what should I focus on next right now?" }
              }));
            }}
            className="p-3 bg-white border border-gray-150 hover:border-black rounded-xl text-left transition-all"
          >
            <span className="text-xs font-bold text-gray-900 block">What is next focus?</span>
            <span className="text-[9px] text-gray-400 mt-1 block">Evaluate top non-negotiables</span>
          </button>
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
                detail: { message: "Certo Work, is there any critical task or project that is stuck?" }
              }));
            }}
            className="p-3 bg-white border border-gray-150 hover:border-black rounded-xl text-left transition-all"
          >
            <span className="text-xs font-bold text-gray-900 block">Check stuck items</span>
            <span className="text-[9px] text-gray-400 mt-1 block">Scan workspace strategic drift</span>
          </button>
        </div>
      </section>

      {/* Daily Shutdown / Ritual Footer */}
      <Link 
         to="/work/daily-shutdown"
         className="w-full text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 rounded-2xl py-4 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
      >
        <Power className="w-4 h-4" /> System Daily Shutdown
      </Link>
    </motion.div>
  );
}
