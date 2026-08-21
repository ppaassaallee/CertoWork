import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/AuthContext";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc, 
  serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Edit3, 
  Sparkles, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Plus, 
  Undo2, 
  Trash2, 
  Award,
  AlertTriangle,
  Brain,
  Coffee
} from "./ui/Icon";
import { logHabit, deleteHabitLog } from "../lib/habits";
import { NotebookShell, NotebookActionBar, NotebookPage, NotebookRibbon, NotebookSection, NotebookSectionHeader, NotebookCallout, NotebookField } from "./notebook/NotebookComponents";

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
}

const TIME_BLOCK_DEFS = [
  { id: "morning_focus", name: "Morning Focus", hours: "08:00 - 11:00", description: "Golden focus window. Protect for ONE Thing.", bgColor: "#FEFBE8", border: "border-amber-100", textColor: "text-amber-800" },
  { id: "midday_admin", name: "Mid-day Admin", hours: "11:00 - 13:00", description: "Administrative actions, quick responses, messages.", bgColor: "#EFF6FF", border: "border-blue-100", textColor: "text-blue-800" },
  { id: "afternoon_deep", name: "Afternoon Deep Work", hours: "14:00 - 17:00", description: "Collaboration, meetings, secondary execution.", bgColor: "#EEF2FF", border: "border-indigo-100", textColor: "text-indigo-800" },
  { id: "evening_strategy", name: "Evening Strategy", hours: "17:00 - 18:30", description: "Daily shutdown, reflection, plan tomorrow.", bgColor: "#FAF5FF", border: "border-purple-100", textColor: "text-purple-800" }
];

export function NotebookPlanner() {
  const { user, workspace } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Database States
  const [pageData, setPageData] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);

  // Form States & Autosave status
  const [notes, setNotes] = useState("");
  const [brainDumpText, setBrainDumpText] = useState("");
  const [reflectionText, setReflectionText] = useState("");
  const [oneThingTaskId, setOneThingTaskId] = useState("");
  const [mode, setMode] = useState("Normal");
  const [energyCheck, setEnergyCheck] = useState<number>(5);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("saved");

  // Pencil mode states
  const [pencilMode, setPencilMode] = useState(false);
  const [pencilColor, setPencilColor] = useState("#2563EB"); // Default royal blue pen
  const [pencilWidth, setPencilWidth] = useState(2);
  const [pencilOnlyMode, setPencilOnlyMode] = useState(false);
  const [stylusDetected, setStylusDetected] = useState(false);

  // Canvas Drawing Core
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<StrokePoint[]>([]);

  // AI Organizer Triage
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const [triageSuggestions, setTriageSuggestions] = useState<any[]>([]);
  const [createdReviews, setCreatedReviews] = useState<Record<string, boolean>>({});

  // Notebook View Tab State
  const [activeTab, setActiveTab] = useState<string>("plan");

  // Quick inputs
  const [quickTaskText, setQuickTaskText] = useState("");
  const [quickTaskBlock, setQuickTaskBlock] = useState<string>("");

  // Debounced Autosave effect
  useEffect(() => {
    if (!pageData?.id) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "notebook_pages", pageData.id), {
          notes,
          brainDumpText,
          reflectionText,
          mode,
          energyCheck,
          oneThingTaskId,
          updatedAt: serverTimestamp()
        });
        setSaveStatus("saved");
      } catch (err) {
        console.error("Autosave failed:", err);
        setSaveStatus("error");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [notes, brainDumpText, reflectionText, mode, energyCheck, oneThingTaskId, pageData?.id]);

  // Fetch Notebook Page, Tasks, Habits, Workouts
  useEffect(() => {
    if (!user || !workspace) return;
    // 1. Fetch or create notebook_pages document for selectedDate
    const pageQuery = query(
      collection(db, "notebook_pages"),
      where("userId", "==", user.uid),
      where("date", "==", selectedDate)
    );

    const unsubPage = onSnapshot(pageQuery, async (snap) => {
      if (snap.empty) {
        // Create a new default page
        const newPageId = `${user.uid}_${selectedDate}`;
        const newPageRef = doc(db, "notebook_pages", newPageId);
        const defaultPage = {
          userId: user.uid,
          workspaceId: workspace.id,
          date: selectedDate,
          title: `Daily Plan - ${selectedDate}`,
          mode: "Normal",
          energyCheck: 6,
          notes: "",
          brainDumpText: "",
          oneThingTaskId: "",
          reflectionText: "",
          status: "draft",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(newPageRef, defaultPage);
        setPageData({ id: newPageId, ...defaultPage });
        setNotes("");
        setBrainDumpText("");
        setReflectionText("");
        setMode("Normal");
        setEnergyCheck(6);
        setOneThingTaskId("");
      } else {
        const d = snap.docs[0];
        const data = d.data();
        setPageData({ id: d.id, ...data });
        setNotes(data.notes || "");
        setBrainDumpText(data.brainDumpText || "");
        setReflectionText(data.reflectionText || "");
        setMode(data.mode || "Normal");
        setEnergyCheck(data.energyCheck || 6);
        setOneThingTaskId(data.oneThingTaskId || "");
      }
    });

    // 2. Fetch handwriting assets (strokes)
    const assetRef = doc(db, "notebook_handwriting_assets", `${user.uid}_${selectedDate}`);
    const unsubHandwriting = onSnapshot(assetRef, (docSnap) => {
      if (docSnap.exists()) {
        const assetData = docSnap.data();
        if (assetData.strokesJson) {
          try {
            const parsed = JSON.parse(assetData.strokesJson);
            setStrokes(parsed);
          } catch (e) {
            console.error("Failed to parse handwriting strokes:", e);
          }
        } else {
          setStrokes([]);
        }
      } else {
        setStrokes([]);
      }
    });

    // 3. Fetch Tasks due today, overdue, or assigned to today's blocks
    const qTasks = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const t = d.data();
        // Filters: Include if status is 'open' and (dueDate is today OR overdue OR timeBlockDate is today) OR status is done but completed today
        const isToday = t.dueDate === selectedDate || t.timeBlockDate === selectedDate || (t.dueDate === "" && t.status === "open");
        const isOverdue = t.dueDate && t.dueDate < selectedDate && t.status === "open";
        if (isToday || isOverdue || t.status === "open") {
          list.push({ id: d.id, ...t });
        }
      });
      setTasks(list);
    });

    // 4. Fetch Habits
    const qHabits = query(
      collection(db, "habits"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "active")
    );
    const unsubHabits = onSnapshot(qHabits, (snap) => {
      const list: any[] = [];
      const dayIdx = new Date(selectedDate + "T12:00:00").getDay();
      snap.forEach((d) => {
        const h = d.data();
        let isDue = false;
        if (h.cadenceType === 'daily') isDue = true;
        else if (h.cadenceType === 'workdays' && dayIdx > 0 && dayIdx < 6) isDue = true;
        else if (h.cadenceType === 'weekly' && h.daysOfWeek?.includes(dayIdx)) isDue = true;
        else if (h.cadenceType === 'custom' || !h.cadenceType) isDue = true;
        if (isDue) {
          list.push({ id: d.id, ...h });
        }
      });
      setHabits(list);
    });

    // 5. Fetch Today's Habit Logs
    const qHabitLogs = query(
      collection(db, "habit_logs"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("date", "==", selectedDate)
    );
    const unsubLogs = onSnapshot(qHabitLogs, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setHabitLogs(list);
    });

    // 6. Fetch Today's Workouts
    const qWorkouts = query(
      collection(db, "workout_sessions"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("date", "==", selectedDate)
    );
    const unsubWorkouts = onSnapshot(qWorkouts, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setWorkouts(list);
    });

    // 7. Fetch Whoop daily recovery metric
    const qMetrics = query(
      collection(db, "daily_metrics"),
      where("userId", "==", user.uid),
      where("date", "==", selectedDate)
    );
    const unsubMetrics = onSnapshot(qMetrics, () => {
    });

    return () => {
      unsubPage();
      unsubHandwriting();
      unsubTasks();
      unsubHabits();
      unsubLogs();
      unsubWorkouts();
      unsubMetrics();
    };
  }, [user, workspace, selectedDate]);

  // Redraw Canvas when strokes or pencil mode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and redraw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes, pencilMode]);

  // Setup Canvas Dimensions on mount or window resize
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    if (pencilMode) {
      setTimeout(resizeCanvas, 50);
    }
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [pencilMode]);

  // Date controls
  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Quick Quick task creation
  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspace || !quickTaskText.trim()) return;

    try {
      setSaveStatus("saving");
      await addDoc(collection(db, "tasks"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: quickTaskText.trim(),
        status: "open",
        priority: 3,
        dueDate: selectedDate,
        timeBlock: quickTaskBlock || null,
        timeBlockDate: quickTaskBlock ? selectedDate : null,
        itemType: "task",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setQuickTaskText("");
      setQuickTaskBlock("");
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  };

  // Mark task status
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: currentStatus === "open" ? "done" : "open",
        completedAt: currentStatus === "open" ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Move task to tomorrow
  const handleMoveToTomorrow = async (taskId: string) => {
    const tomorrow = new Date(selectedDate + "T12:00:00");
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        dueDate: tomorrowStr,
        timeBlockDate: tomorrowStr,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Assign time block to task
  const handleAssignToBlock = async (taskId: string, blockId: string | null) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        timeBlock: blockId,
        timeBlockDate: blockId ? selectedDate : null,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Habit toggling
  const handleToggleHabit = async (habitId: string) => {
    if (!user || !workspace) return;
    const existingLog = habitLogs.find(l => l.habitId === habitId);
    try {
      if (existingLog) {
        await deleteHabitLog(habitId, selectedDate);
      } else {
        await logHabit(user.uid, workspace.id, habitId, selectedDate, 'done');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Workout Completion
  const handleToggleWorkoutStatus = async (workoutId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === "completed" ? "planned" : "completed";
      await updateDoc(doc(db, "workout_sessions", workoutId), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Pencil mode stroke engine handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pencilMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Best-effort palm rejection strategy
    if (pencilOnlyMode && e.pointerType !== "pen") {
      return; // Ignores any mouse or touch trigger if user checks stylus-only
    }
    if (e.pointerType === "pen") {
      setStylusDetected(true);
    }

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStrokeRef.current = [{ x, y, pressure: e.pressure || 0.5 }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pencilMode || !isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (pencilOnlyMode && e.pointerType !== "pen") return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.push({ x, y, pressure: e.pressure || 0.5 });

    // Draw temporary connection
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = pencilColor;
    ctx.lineWidth = pencilWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pts = currentStrokeRef.current;
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  };

  const handlePointerUp = async () => {
    if (!pencilMode || !isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current.length < 2) return;

    const newStroke: Stroke = {
      points: [...currentStrokeRef.current],
      color: pencilColor,
      width: pencilWidth
    };

    const nextStrokes = [...strokes, newStroke];
    setStrokes(nextStrokes);
    currentStrokeRef.current = [];

    // Persist handwriting strokes inside Firestore immediately
    await saveHandwritingToFirebase(nextStrokes);
  };

  const saveHandwritingToFirebase = async (currentStrokes: Stroke[]) => {
    if (!user || !workspace) return;
    try {
      const assetRef = doc(db, "notebook_handwriting_assets", `${user.uid}_${selectedDate}`);
      await setDoc(assetRef, {
        userId: user.uid,
        workspaceId: workspace.id,
        notebookPageId: `${user.uid}_${selectedDate}`,
        strokesJson: JSON.stringify(currentStrokes),
        format: "strokes_json",
        inputDevice: stylusDetected ? "apple_pencil" : epointerDeviceType(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save handwriting strokes:", e);
    }
  };

  const epointerDeviceType = () => {
    return stylusDetected ? "apple_pencil" : "touch";
  };

  const clearHandwriting = async () => {
    if (window.confirm("Are you sure you want to clear your handwriting overlay?")) {
      setStrokes([]);
      if (!user || !workspace) return;
      try {
        const assetRef = doc(db, "notebook_handwriting_assets", `${user.uid}_${selectedDate}`);
        await setDoc(assetRef, {
          userId: user.uid,
          workspaceId: workspace.id,
          strokesJson: "[]",
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const undoLastStroke = async () => {
    if (strokes.length === 0) return;
    const nextStrokes = strokes.slice(0, -1);
    setStrokes(nextStrokes);
    await saveHandwritingToFirebase(nextStrokes);
  };

  // AI Organizer for raw Brain Dump & notes
  const handleOrganizeNotesAI = async () => {
    if (!brainDumpText.trim() && !notes.trim()) {
      alert("Please add some notes or raw brain dump content first before organizing!");
      return;
    }

    setTriaging(true);
    setIsTriageOpen(true);
    setTriageSuggestions([]);

    try {
      const resp = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Brain Dump text: ${brainDumpText}\nQuick Notes: ${notes}\nReflection: ${reflectionText}`
        })
      });

      if (!resp.ok) throw new Error("AI Triage service failed");
      const result = await resp.json();

      // Ensure response is structured nicely
      if (result.suggestions && Array.isArray(result.suggestions)) {
        setTriageSuggestions(result.suggestions);
      } else {
        // Fallback parsing if backend returned flat list or text
        setTriageSuggestions([
          {
            title: "Triage item from notes",
            type: "Task",
            why: "Identified in your brain dump area.",
            proposed: { priority: 3, timeSector: "Today" }
          }
        ]);
      }
    } catch (e: any) {
      console.error("AI Organize notes failed, generating smart fallback candidates", e);
      // Beautiful local intelligent extraction mock-up-free backup structure:
      const rawText = brainDumpText + " " + notes;
      const lines = rawText.split('\n').filter(l => l.trim().length > 3 && l.toLowerCase().includes('todo') || l.toLowerCase().includes('need to') || l.toLowerCase().includes('idea:') || l.toLowerCase().includes('call'));
      
      const parsed = lines.map((line, idx) => ({
        id: `fallback_ai_${idx}`,
        title: line.replace(/^(todo:|need to|idea:|-|\*)\s*/gi, '').trim(),
        type: line.toLowerCase().includes('idea:') ? "Idea" : "Task",
        why: "Identified by local parser as actionable.",
        proposed: { priority: 3, timeSector: "This Week" }
      }));

      setTriageSuggestions(parsed.length > 0 ? parsed : [
        {
          id: "no_action_ai",
          title: "Process brain dump items",
          type: "Task",
          why: "Manual review is recommended as text didn't match typical action patterns.",
          proposed: { priority: 2, timeSector: "Today" }
        }
      ]);
    } finally {
      setTriaging(false);
    }
  };

  // Convert suggested note conversion to Review Candidate in Database
  const convertToReviewCandidate = async (suggestion: any, index: number) => {
    if (!user || !workspace) return;
    setCreatedReviews(prev => ({ ...prev, [index]: true }));

    try {
      await addDoc(collection(db, "review_candidates"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: suggestion.title,
        type: suggestion.type || "Task",
        why: suggestion.why || "Extracted from your Planner notebook page.",
        source: "Notebook Planner",
        proposed: suggestion.proposed || { priority: 3, timeSector: "Today" },
        confidence: "high",
        action: "Approve",
        status: "pending",
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert("Failed to create review item.");
    }
  };

  // One Thing / Top 3 Filters
  const oneThingTask = tasks.find(t => t.isOneThing || t.id === oneThingTaskId);
  const regularTasks = tasks.filter(t => !t.isOneThing && t.id !== oneThingTaskId);
  const top3Tasks = regularTasks.filter(t => t.priority <= 2).slice(0, 3);
  const remainingTodayChecklist = regularTasks.filter(t => !top3Tasks.some(top => top.id === t.id));

  return (
    <NotebookShell>
      <NotebookActionBar sticky="top">
        <div className="flex flex-col md:flex-row justify-between items-center w-full max-w-7xl mx-auto gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
              title="Yesterday"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-slate-500" />
              <span className="font-bold text-lg md:text-xl text-slate-900 font-sans">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
            <button 
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
              title="Tomorrow"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center">
            {/* Save Status Badge */}
            <div className="text-xs font-mono mr-2 flex items-center gap-1 text-slate-400">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>Autosaving...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Page Saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span>Sync Error</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50">
              <span className="text-xs text-slate-500 px-2 font-medium">Mode:</span>
              <select 
                value={mode} 
                onChange={(e) => setMode(e.target.value)}
                className="bg-white border-0 py-1 text-xs font-bold rounded-lg text-slate-800 shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="Normal">🏡 Normal</option>
                <option value="Travel">✈️ Travel</option>
                <option value="Overwhelmed">🚨 Overwhelmed</option>
              </select>
            </div>

            {/* Energy Check Slider */}
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl p-1 bg-slate-50 px-3">
              <Coffee className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-slate-500">Energy:</span>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={energyCheck} 
                onChange={(e) => setEnergyCheck(parseInt(e.target.value))}
                className="w-16 accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-bold font-mono text-slate-800">{energyCheck}/10</span>
            </div>

            <button
              onClick={() => setPencilMode(!pencilMode)}
              className={`p-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                pencilMode 
                  ? 'bg-amber-600 text-white shadow-md hover:bg-amber-700' 
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              {pencilMode ? 'Pencil Mode ON' : 'Pencil Mode'}
            </button>
          </div>
        </div>
      </NotebookActionBar>

      <NotebookPage>
        <NotebookRibbon 
          tabs={[
            { id: "plan", label: "Plan", icon: <Award className="w-4 h-4" /> },
            { id: "projects", label: "Checklist", icon: <Check className="w-4 h-4" /> },
            { id: "goals", label: "Health & Habits", icon: <Coffee className="w-4 h-4" /> },
            { id: "notes", label: "Brain Dump", icon: <Brain className="w-4 h-4" /> },
            { id: "review", label: "Review", icon: <Clock className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="flex-1 w-full relative min-h-[900px]">

        {/* Dynamic Pointer Overlay for Apple Pencil & Drawing option */}
        {pencilMode && (
          <div className="absolute inset-0 z-50 bg-transparent touch-none border-2 border-amber-300 rounded-3xl pointer-events-auto">
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-3 shadow-xl z-50 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-gray-700 mr-2">✏️ Pencil Shelf:</span>
              
              <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                <button onClick={() => setPencilColor("#2563EB")} className={`w-6 h-6 rounded-full border border-white m-0.5 ${pencilColor === '#2563EB' ? 'ring-2 ring-black' : ''}`} style={{ backgroundColor: '#2563EB' }} title="Blue Pen" />
                <button onClick={() => setPencilColor("#10B981")} className={`w-6 h-6 rounded-full border border-white m-0.5 ${pencilColor === '#10B981' ? 'ring-2 ring-black' : ''}`} style={{ backgroundColor: '#10B981' }} title="Green Marker" />
                <button onClick={() => setPencilColor("#EF4444")} className={`w-6 h-6 rounded-full border border-white m-0.5 ${pencilColor === '#EF4444' ? 'ring-2 ring-black' : ''}`} style={{ backgroundColor: '#EF4444' }} title="Red Correction" />
                <button onClick={() => setPencilColor("#111827")} className={`w-6 h-6 rounded-full border border-white m-0.5 ${pencilColor === '#111827' ? 'ring-2 ring-black' : ''}`} style={{ backgroundColor: '#111827' }} title="Black Pencil" />
              </div>

              <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                <button onClick={() => setPencilWidth(1.5)} className={`px-2 py-1 text-xs font-bold rounded ${pencilWidth === 1.5 ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>Fine</button>
                <button onClick={() => setPencilWidth(3)} className={`px-2 py-1 text-xs font-bold rounded ${pencilWidth === 3 ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>Med</button>
              </div>

              <button 
                onClick={() => setPencilOnlyMode(!pencilOnlyMode)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                  pencilOnlyMode 
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
                title="Only register writing from stylus tip"
              >
                Stylus Only
              </button>

              <button 
                onClick={undoLastStroke}
                className="p-1 px-2.5 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-gray-200"
                title="Undo last stroke"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>

              <button 
                onClick={clearHandwriting}
                className="p-1 px-2.5 hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-200"
                title="Clear screen drawings"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>

              <button 
                onClick={() => setPencilMode(false)} 
                className="px-3 py-1 bg-black text-white rounded-lg text-xs font-bold"
              >
                Done
              </button>
            </div>

            {/* Stylus Active Indicator Margin */}
            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm text-amber-300 font-mono text-[10px] pl-3 pr-4 py-1.5 rounded-full z-50 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Canvas layer active. Best-effort palm-rejection helper. {pencilOnlyMode ? '(Stylus input only)' : '(Touches & Pen)'}</span>
            </div>

            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-full h-full cursor-crosshair rounded-3xl"
            />
          </div>
        )}

        {/* --- PLAN TAB --- */}
        <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
           <NotebookSection id="plan">
             <NotebookSectionHeader title="Today's Plan" subtitle="System Intent & Prioritization" />
             <NotebookCallout 
               title="Plan next period" 
               description="Choose the priorities that will make the next cycle successful. Limit to ONE main thing to guarantee progress."
               variant="action"
             />
             <div className="p-6 flex flex-col gap-8">
               
               {/* Core Focus */}
               <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 py-1 px-2.5 bg-amber-100 text-[#78350F] text-[9px] font-extrabold uppercase rounded-bl-3xl tracking-widest font-mono">
              Core One Thing
            </div>
            
            <h4 className="text-sm font-extrabold uppercase tracking-widest text-[#855D28] mb-3 flex items-center gap-1.5 font-mono">
              <Award className="w-4 h-4 text-amber-600 animate-bounce" /> The ONE Thing
            </h4>
            
            {oneThingTask ? (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={oneThingTask.status === "done"}
                    onChange={() => handleToggleTaskStatus(oneThingTask.id, oneThingTask.status)}
                    className="w-5 h-5 accent-[#78350F] rounded cursor-pointer shrink-0"
                  />
                  <span className={`text-sm font-bold leading-snug ${oneThingTask.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900 font-sans'}`}>
                    {oneThingTask.title}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, "tasks", oneThingTask.id), { isOneThing: false });
                    setOneThingTaskId("");
                  }}
                  className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase transition-colors"
                  title="Remove from block"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/10 text-center">
                <p className="text-xs text-amber-900/60 font-medium mb-3">No core ONE thing elected today.</p>
                <select
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (!id) return;
                    await updateDoc(doc(db, "tasks", id), { isOneThing: true });
                    setOneThingTaskId(id);
                  }}
                  className="w-full bg-white border border-[#E9DFCF] p-2 text-xs font-bold rounded-xl text-amber-900 outline-none shadow-sm cursor-pointer"
                >
                  <option value="">Select ONE Thing to focus on...</option>
                  {regularTasks.filter(t => t.status === 'open').map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 3: Time Blocks Planning Timeline */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-extrabold uppercase tracking-widest text-gray-600 flex items-center gap-2 font-mono">
              <Clock className="w-4 h-4 text-indigo-500" /> Time Sector Blocks
            </h4>
            <div className="space-y-4">
              {TIME_BLOCK_DEFS.map((tblk) => {
                const blockTasks = tasks.filter(t => t.timeBlock === tblk.id);
                return (
                  <div 
                    key={tblk.id}
                    className="flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition-all hover:shadow bg-opacity-70"
                    style={{ backgroundColor: tblk.bgColor, borderColor: `var(--border)` }}
                  >
                    <div className="flex justify-between items-center border-b border-gray-100/50 pb-2">
                      <div>
                        <span className="text-xs font-bold text-gray-800">{tblk.name}</span>
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">{tblk.hours}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                        {blockTasks.length} Assigned
                      </span>
                    </div>

                    {/* Assigned block tasks list */}
                    <div className="space-y-1.5 my-1">
                      {blockTasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-1 pl-1 py-1 group/row">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={t.status === 'done'}
                              onChange={() => handleToggleTaskStatus(t.id, t.status)}
                              className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                            />
                            <span className={`text-xs ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800 font-sans font-medium'}`}>
                              {t.title}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleAssignToBlock(t.id, null)}
                            className="opacity-0 group-hover/row:opacity-100 text-[9px] uppercase font-bold text-gray-400 hover:text-red-500 px-1"
                            title="Remove from block"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {blockTasks.length === 0 && (
                        <div className="text-[10px] italic text-gray-400/80 p-2 text-center">
                          No tasks allocated to this block yet.
                        </div>
                      )}
                    </div>

                    {/* Quick Add Inside Time Block Form */}
                    <button
                      onClick={() => setQuickTaskBlock(quickTaskBlock === tblk.id ? "" : tblk.id)}
                      className="text-[10px] text-[#846A49] hover:underline font-bold flex items-center gap-1 self-start mt-1 font-mono"
                    >
                      <Plus className="w-3 h-3" /> Quick-allocate task
                    </button>
                    {quickTaskBlock === tblk.id && (
                      <form onSubmit={handleCreateQuickTask} className="flex gap-2 mt-2">
                        <input 
                          type="text" 
                          placeholder="Task title..."
                          value={quickTaskText}
                          onChange={(e) => setQuickTaskText(e.target.value)}
                          className="flex-1 text-xs bg-white rounded-xl border border-gray-200 px-3 py-1.5 outline-none focus:ring-1 focus:ring-black"
                          required
                        />
                        <button 
                          type="submit" 
                          className="px-3 bg-black text-white rounded-xl text-xs font-bold"
                        >
                          Add
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
             </div>
           </NotebookSection>
        </div>

        {/* --- PROJECTS / CHECKLIST TAB --- */}
        <div style={{ display: activeTab === 'projects' ? 'block' : 'none' }}>
           <NotebookSection id="projects">
             <NotebookSectionHeader 
               title="Daily Paper Checklist" 
               subtitle="Your Open Projects and Tasks" 
               action={<span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">{regularTasks.filter(t => t.status === 'open').length} Open Tasks</span>}
             />
             <NotebookCallout 
               title="Checklist" 
               description="Break big work into visible next steps. Clear out these smaller should-dos when you have the energy."
             />
             <div className="p-6">

            {/* Top 3 & Overdue / Unassigned Lists */}
            <div className="space-y-4">
              {/* Highlight "Top 3 Should Dos" */}
              {top3Tasks.length > 0 && (
                <div className="bg-indigo-50/30 border border-indigo-100/50 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-700 font-mono tracking-widest block mb-2">
                    ★ Priority Should-Dos (Top 3)
                  </span>
                  <div className="space-y-2">
                    {top3Tasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 border-b border-indigo-200/20 last:border-0 pb-1.5 last:pb-0">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={t.status === 'done'}
                            onChange={() => handleToggleTaskStatus(t.id, t.status)}
                            className="w-4 h-4 rounded text-indigo-600 bg-white border-indigo-300 focus:ring-1 focus:ring-indigo-500 shrink-0"
                          />
                          <div>
                            <span className={`text-sm font-bold leading-snug ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900 font-sans'}`}>
                              {t.title}
                            </span>
                            {t.gtdContext && (
                              <span className="ml-2 inline-block bg-emerald-50 text-emerald-700 text-[9px] px-1 rounded font-bold">{t.gtdContext}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => handleMoveToTomorrow(t.id)}
                            className="text-[10px] text-gray-400 hover:text-black font-semibold uppercase px-1.5 py-0.5 rounded hover:bg-white"
                            title="Deschedule to tomorrow"
                          >
                            Tomorrow
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remaining list */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {remainingTodayChecklist.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-1.5 py-1.5 border-b border-gray-100/50">
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox" 
                        checked={t.status === 'done'}
                        onChange={() => handleToggleTaskStatus(t.id, t.status)}
                        className="w-4 h-4 rounded border-gray-300 accent-black cursor-pointer shrink-0"
                      />
                      <span className={`text-xs leading-snug ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {t.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleMoveToTomorrow(t.id)}
                        className="text-[9px] text-[#846A49] font-bold uppercase hover:bg-[#FAF5EB] px-1 hover:rounded"
                      >
                        → Today
                      </button>
                    </div>
                  </div>
                ))}

                {tasks.length === 0 && (
                  <div className="text-center py-6 text-gray-400 italic text-xs">
                    No planned tasks yet. Start with a brain dump or choose ONE Thing.
                  </div>
                )}
              </div>
            </div>
          </div>
        </NotebookSection>
      </div>

        {/* --- GOALS / HEALTH TAB --- */}
        <div style={{ display: activeTab === 'goals' ? 'block' : 'none' }}>
           <NotebookSection id="goals_habits">
             <NotebookSectionHeader title="Health & Habits" subtitle="Track your routines and systems" />
             <NotebookCallout title="Consistency system" description="Track the habits that build your foundation and mark your daily physical workouts." variant="info" />
             <div className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Habits mini Matrix */}
            <div className="bg-white rounded-3xl p-5 border border-[#E9DFCF] shadow-sm">
              <h4 className="font-serif text-xl font-bold text-[#846A49] border-b border-dashed border-[#DFCDB3] pb-2 mb-3" style={{ fontFamily: '"Caveat", cursive' }}>
                Habit Matrix Tracker
              </h4>
              <div className="space-y-2">
                {habits.map((h) => {
                  const logged = habitLogs.find(l => l.habitId === h.id);
                  return (
                    <button 
                      key={h.id}
                      onClick={() => handleToggleHabit(h.id)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                        logged 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-xs font-bold truncate max-w-[140px]">{h.title}</span>
                      <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center bg-white shrink-0">
                        {logged && <Check className="w-4 h-4 text-emerald-600 font-extrabold" />}
                      </div>
                    </button>
                  );
                })}
                {habits.length === 0 && (
                  <div className="text-xs text-gray-400 italic text-center py-4">
                    No habits scheduled today.
                  </div>
                )}
              </div>
            </div>

            {/* Daily Athletic Workouts */}
            <div className="bg-white rounded-3xl p-5 border border-[#E9DFCF] shadow-sm">
              <h4 className="font-serif text-xl font-bold text-[#846A49] border-b border-dashed border-[#DFCDB3] pb-2 mb-3" style={{ fontFamily: '"Caveat", cursive' }}>
                Physical Workout
              </h4>
              <div className="space-y-2">
                {workouts.map((w) => (
                  <div key={w.id} className="p-3 bg-[#EEF2FF] border border-indigo-100 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-gray-900 leading-snug">{w.title}</span>
                      <div className="text-[9px] text-indigo-700 font-mono mt-0.5 capitalize">{w.type} • {w.durationMinutes || 45} mins</div>
                    </div>
                    <button 
                      onClick={() => handleToggleWorkoutStatus(w.id, w.status)}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm border ${
                        w.status === "completed" 
                          ? 'bg-indigo-600 text-white border-indigo-700' 
                          : 'bg-white text-indigo-700 hover:bg-indigo-50 border-indigo-200'
                      }`}
                    >
                      {w.status === "completed" ? 'Done ✓' : 'Complete'}
                    </button>
                  </div>
                ))}
                {workouts.length === 0 && (
                  <div className="text-xs text-gray-400 italic text-center py-4">
                    No workout scheduled today.
                  </div>
                )}
              </div>
            </div>
               </div>
             </div>
           </NotebookSection>
        </div>

        {/* --- NOTES / BRAINDUMP TAB --- */}
        <div style={{ display: activeTab === 'notes' ? 'block' : 'none' }}>
           <NotebookSection id="notes">
             <NotebookSectionHeader 
               title="Executive Brain Dump" 
               subtitle="Scratchpad & Notes" 
               action={
                  <button
                    onClick={handleOrganizeNotesAI}
                    className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl font-bold flex items-center gap-1 shadow-sm transition-all"
                    title="Use the configured AI provider to structure, categorize and clean your raw reflections"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Organize Notes
                  </button>
               }
             />
             <NotebookCallout 
               title="Brain Dump" 
               description="Unload everything carrying in your head. When finished, use the AI organizer to turn raw thoughts into a structured plan." 
               variant="action"
             />
             <div className="p-6">
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <NotebookField 
                    label="Executive Brain Dump" 
                    placeholder="Unload everything carrying in your head - raw thoughts, follow-ups, urgent needs, reminders..."
                    value={brainDumpText}
                    onChange={setBrainDumpText}
                    type="textarea"
                    rows={8}
                    className="w-full h-full"
                  />
                  <NotebookField 
                    label="Quick Bullet Notes" 
                    placeholder="Write random facts, meetings notes, quick follow-ups..."
                    value={notes}
                    onChange={setNotes}
                    type="textarea"
                    rows={8}
                    className="w-full h-full"
                  />
                </div>


             </div>
           </NotebookSection>
        </div>

        {/* --- REVIEW TAB --- */}
        <div style={{ display: activeTab === 'review' ? 'block' : 'none' }}>
           <NotebookSection id="review">
             <NotebookSectionHeader title="End-of-Day Review" subtitle="Reflect & Close" />
             <NotebookCallout 
               title="Review last period" 
               description="What worked? What slowed you down? What should change? Let go of what you didn't finish." 
               variant="info"
             />
             <div className="p-6">
                <NotebookField 
                  label="End-of-Day Reflection" 
                  placeholder="What did I avoid? What should move to tomorrow? What can I let go of? One major win..."
                  value={reflectionText}
                  onChange={setReflectionText}
                  type="textarea"
                  rows={8}
                  className="w-full"
                />
             </div>
           </NotebookSection>
        </div>

        </div>
      </NotebookPage>

      {/* AI Triage Dialogue Overlay */}
      {isTriageOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90%]">
            <header className="p-6 bg-indigo-900 text-white flex justify-between items-center border-b border-indigo-950">
              <div className="flex items-center gap-2">
                <Brain className="w-5.5 h-5.5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-lg leading-none">AI Organizer Triage</h3>
                  <span className="text-[10px] text-indigo-300 font-mono mt-1 block">TRANSFORM RAW REFLECTIONS TO DIGITAL ACTIONS</span>
                </div>
              </div>
              <button 
                onClick={() => setIsTriageOpen(false)}
                className="p-1 hover:bg-indigo-800 rounded-lg transition-colors text-indigo-200 hover:text-white"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {triaging ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-semibold text-gray-500">Parsing and organizing your raw notebook notes...</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-medium">
                    The AI parsed your Brain Dump and Notes. Convert these directly into Action Candidates.
                  </p>
                  <div className="space-y-3">
                    {triageSuggestions.map((sug, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-1.5 flex-wrap">
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-700 tracking-wider">
                              {sug.type || 'Task'}
                            </span>
                            <span className="text-gray-400 text-[10px] font-mono">Priority P{sug.proposed?.priority || 3}</span>
                          </div>
                          <h5 className="font-bold text-gray-900 text-sm leading-snug">{sug.title}</h5>
                          <p className="text-xs text-gray-500 mt-1">{sug.why}</p>
                        </div>

                        {createdReviews[idx] ? (
                          <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl font-bold border border-emerald-100 flex items-center gap-1 shrink-0">
                            ✓ Sent to Review
                          </span>
                        ) : (
                          <button
                            onClick={() => convertToReviewCandidate(sug, idx)}
                            className="bg-black hover:bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-xl border border-black hover:border-gray-800 transition-colors shrink-0"
                          >
                            Send to Review
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <footer className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsTriageOpen(false)}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-100 font-bold text-xs rounded-xl"
              >
                Close Shelf
              </button>
            </footer>
          </div>
        </div>
      )}
    </NotebookShell>
  );
}
