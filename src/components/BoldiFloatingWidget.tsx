import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, Bot, Send, Mic, MicOff, Loader2, Check, X, ShieldAlert, Cpu, 
  History, ChevronRight, Undo, Maximize2, Minimize2, Settings, Lock, Unlock, RefreshCw,
  BookOpen, Download
} from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, serverTimestamp, getDocs, setDoc 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-error-helper";
import { MetadataReportViewer } from "./MetadataReportViewer";

// Web Speech API
const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function BoldiFloatingWidget() {
  const { user, workspace } = useAuth();
  const location = useLocation();

  // Widget visibility and positioning
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  
  // Draggable state
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 680 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Resizable state
  const [size, setSize] = useState({ width: 380, height: 580 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toolLogs, setToolLogs] = useState<string[]>([]);
  const [proposedPlan, setProposedPlan] = useState<any | null>(null);
  const [currentConversation, setCurrentConversation] = useState<any | null>(null);
  
  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Mode state: 'tell_me' (read-only) vs 'co_work' (agentic, persistent in localStorage)
  const [mode, setMode] = useState<"tell_me" | "co_work">(() => {
    return (localStorage.getItem("boldi_mode") as "tell_me" | "co_work") || "tell_me";
  });

  // Safety level 3 validation code
  const [confirmInput, setConfirmInput] = useState("");

  // Reports and Audit logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync mode changes to localStorage
  const handleModeChange = (newMode: "tell_me" | "co_work") => {
    setMode(newMode);
    localStorage.setItem("boldi_mode", newMode);
    setToolLogs(prev => [...prev, `[System Mode] Switched to ${newMode === 'tell_me' ? 'Tell Me (Read Only)' : 'Co-Work (Agentic) Mode'}`]);
  };

  // Determine Active Module Context based on router path
  const getContextName = () => {
    const path = location.pathname;
    if (path === "/") return "Today";
    if (path.startsWith("/work/tasks")) return "Action Board";
    if (path.startsWith("/work/projects")) return "Projects Hub";
    if (path.startsWith("/work/routines")) return "Routines";
    if (path.startsWith("/work/calendar")) return "Unified Calendar";
    if (path.startsWith("/capture")) return "Capture Inbox";
    if (path.startsWith("/review")) return "Review Desk";
    if (path.startsWith("/work/strategy")) return "Strategy Center";
    if (path.startsWith("/work/meeting-intake")) return "Meeting Influx";
    if (path.startsWith("/me/analytics")) return "Progress Dashboard";
    if (path.startsWith("/me/self-mastery")) return "Self-Mastery Hub";
    if (path.startsWith("/me/metrics")) return "Health & Whoop";
    if (path.startsWith("/me")) return "Workspace Settings";
    return "Global Workspace";
  };

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const handleOpenBoldi = (e: any) => {
      setIsOpen(true);
      setIsMinimized(false);
      if (e.detail?.message) {
        setInputMessage(e.detail.message);
      }
    };
    window.addEventListener("open-boldi-assistant", handleOpenBoldi);

    if (SpeechRecognitionClass) {
      try {
        const rec = new SpeechRecognitionClass();
        rec.continuous = false;
        rec.interimResults = false;
        try {
          rec.lang = "es-ES"; // default to Spanish/English dual
        } catch (langErr) {
          console.warn("Unsupported language tag for SpeechRecognition", langErr);
        }
        
        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputMessage(prev => prev + " " + transcript);
        };
        rec.onerror = (e: any) => {
          console.error("Speech Recognition Error:", e);
          setIsListening(false);
        };
        
        recognitionRef.current = rec;
      } catch (initErr) {
        console.error("Failed to initialize SpeechRecognition:", initErr);
      }
    }

    return () => {
      window.removeEventListener("open-boldi-assistant", handleOpenBoldi);
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Load or Create Conversation
  useEffect(() => {
    if (!user || !workspace || !isOpen) return;
    
    // Index-safe query (no orderBy)
    const q = query(
      collection(db, "boldi_conversations"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("status", "==", "active")
    );

    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        // Create lazy initial conversation
        try {
          const res = await addDoc(collection(db, "boldi_conversations"), {
            userId: user.uid,
            workspaceId: workspace.id,
            title: "Default Sync Session",
            status: "active",
            sourceContext: "global",
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          setCurrentConversation({ id: res.id });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, "boldi_conversations");
        }
      } else {
        // Sort by updatedAt desc client-side
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a: any, b: any) => {
          const aTime = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 + a.updatedAt.nanoseconds / 1e6 : Date.now();
          const bTime = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 + b.updatedAt.nanoseconds / 1e6 : Date.now();
          return bTime - aTime;
        });
        setCurrentConversation(docs[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "boldi_conversations");
    });

    return () => unsub();
  }, [user, workspace, isOpen]);

  // Load Message History
  useEffect(() => {
    if (!user || !workspace || !currentConversation || !isOpen) return;

    const q = query(
      collection(db, "boldi_messages"),
      where("conversationId", "==", currentConversation.id),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      // Sort chronologically
      items.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 + a.createdAt.nanoseconds / 1e6 : Date.now();
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 + b.createdAt.nanoseconds / 1e6 : Date.now();
        return aTime - bTime;
      });
      setMessages(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "boldi_messages");
    });

    return () => unsub();
  }, [user, workspace, currentConversation, isOpen]);

  // Scroll Chat to Bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, submitting, isOpen]);

  // Load Audit reports & Action plans
  useEffect(() => {
    if (!user || !workspace || !isReportsOpen) return;

    // Index-safe query (no orderBy)
    const qActions = query(
      collection(db, "boldi_actions"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );

    const unsubActions = onSnapshot(qActions, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      // Sort client-side by createdAt desc
      items.sort((a: any, b: any) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 + a.createdAt.nanoseconds / 1e6 : 0;
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 + b.createdAt.nanoseconds / 1e6 : 0;
        return bTime - aTime;
      });
      setAuditLogs(items.slice(0, 25));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "boldi_actions");
    });

    return () => {
      unsubActions();
    };
  }, [user, workspace, isReportsOpen]);

  // Adjust widget coordinates on window resize to ensure it stays in bounds
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - size.width - 20),
        y: Math.min(prev.y, window.innerHeight - size.height - 20)
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input") || isMinimized) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(10, Math.min(e.clientX - dragStart.current.x, window.innerWidth - size.width - 10));
    const newY = Math.max(10, Math.min(e.clientY - dragStart.current.y, window.innerHeight - (isMinimized ? 60 : size.height) - 10));
    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const deltaW = e.clientX - resizeStart.current.x;
    const deltaH = e.clientY - resizeStart.current.y;
    const newWidth = Math.max(300, Math.min(resizeStart.current.w + deltaW, 800));
    const newHeight = Math.max(300, Math.min(resizeStart.current.h + deltaH, window.innerHeight - 50));
    setSize({ width: newWidth, height: newHeight });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDrag);
      window.addEventListener("mouseup", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDrag);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing]);

  // Download Markdown Report logic
  const downloadReport = (markdown: string) => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Certo Work_Executive_Report.md");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Send Message logic
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || !user || !workspace || submitting || !currentConversation) return;

    setInputMessage("");
    setSubmitting(true);
    setProposedPlan(null);
    setConfirmInput("");

    // Add User Message to local Firestore
    try {
      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: currentConversation.id,
        role: "user",
        content: text.trim(),
        inputType: "text",
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }

    setToolLogs(prev => [...prev, `[Context Aware] Detecting location: ${getContextName()}`]);
    setToolLogs(prev => [...prev, `[System Check] Reading Workspace Tasks & Projects...`]);

    // Fetch the actual location context to provide accurate context to Boldi
    const [tasksSnap, projectsSnap, goalsSnap] = await Promise.all([
      getDocs(query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "open"))),
      getDocs(query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id))),
      getDocs(query(collection(db, "strategic_goals"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)))
    ]);

    const activeTasksList = tasksSnap.docs.map(t => ({ id: t.id, title: t.data().title, priority: t.data().priority, dueDate: t.data().dueDate }));
    const projectsList = projectsSnap.docs.map(p => ({ id: p.id, title: p.data().title, status: p.data().status }));
    const goalsList = goalsSnap.docs.map(g => ({ id: g.id, title: g.data().title, type: g.data().type }));

    try {
      // Proxy message to the server-side AI model
      const idToken = await user.getIdToken();
      const res = await fetch("/api/boldi/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          messages: [...messages, { role: "user", content: text }],
          workspaceContext: {
            currentModule: getContextName(),
            currentPath: location.pathname,
            tasks: activeTasksList,
            projects: projectsList,
            goals: goalsList,
            mode: mode, // tell_me or co_work
            userId: user.uid,
            workspaceId: workspace.id
          }
        })
      });

      if (!res.ok) throw new Error("Cosmic Server response failed");
      const result = await res.json();

      setToolLogs(prev => [...prev, `[Success] Analyzed. Tool executed: ${result.toolName || "General Search"}`]);

      // Save onboarding profile if requested
      if (result.requiresProfileUpdate && result.profileData) {
        try {
          const profileRef = doc(db, "boldi_profiles", user.uid);
          await setDoc(profileRef, {
            ...result.profileData,
            updatedAt: serverTimestamp()
          }, { merge: true });
          setToolLogs(prev => [...prev, `[Profile Sync] Strategic memory profile updated.`]);
        } catch (profileErr) {
          console.error("Profile sync error:", profileErr);
        }
      }

      // If in Tell Me Mode but they asked for modifications
      let finalReply = result.reply;
      let actionPlan = result.actionPlan;

      if (mode === "tell_me") {
        // Redact any executable action plans since mutations are disallowed in Tell Me mode
        actionPlan = null;
        if (text.toLowerCase().match(/(create|make|delete|remove|schedule|update|reschedule|priority|add)/)) {
          finalReply += "\n\n⚠️ *Note: I detected that you want to apply changes. Modifications are disabled in **Tell Me (Read-Only) Mode**. Please switch to **Co-Work Mode** in the panel header to authorize action execution.*";
        }
      }

      // Save Assistant response
      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: currentConversation.id,
        role: "assistant",
        content: finalReply,
        inputType: "text",
        toolName: result.toolName || null,
        metadataReport: result.metadataReport || null,
        suggestedChips: result.suggestedChips || null,
        citations: result.citations || null,
        createdAt: serverTimestamp()
      });

      if (actionPlan && actionPlan.proposedActions && actionPlan.proposedActions.length > 0) {
        // Map safety levels to actions
        const enrichedActions = actionPlan.proposedActions.map((act: any) => {
          let sL = 1; // Default low risk
          const tL = act.type.toLowerCase();
          if (tL.includes("delete") || tL.includes("kill") || tL.includes("archive")) {
            sL = 4; // Destructive
          } else if (tL.includes("reschedule") && (act.proposedChange?.bulk || Array.isArray(act.proposedChange?.taskIds))) {
            sL = 3; // Bulk/High risk
          } else if (tL.includes("project") || tL.includes("milestone") || tL.includes("update")) {
            sL = 2; // Medium risk
          } else if (tL.includes("settings") || tL.includes("permission")) {
            sL = 5; // Config/System
          }
          return { ...act, safetyLevel: sL };
        });

        // Determine overall Safety Level for the entire Plan (max of actions)
        const maxSafety = enrichedActions.reduce((max: number, a: any) => Math.max(max, a.safetyLevel), 1);

        setProposedPlan({
          ...actionPlan,
          proposedActions: enrichedActions,
          safetyLevel: maxSafety,
          conversationId: currentConversation.id
        });
      }

    } catch (err: any) {
      console.error(err);
      setToolLogs(prev => [...prev, `[Failure] ${err.message}`]);
    } finally {
      setSubmitting(false);
    }
  };

  // Execute/Apply Action Plan (Dry run completed first, then approved)
  const handleApproveActionPlan = async () => {
    if (!user || !workspace || !proposedPlan) return;

    if (proposedPlan.title === "Standardize Task Metadata") {
      handleSendMessage("proceed");
      return;
    }

    // Safety Level 3 Verification Guard
    if (proposedPlan.safetyLevel === 3 && confirmInput.trim().toUpperCase() !== "CONFIRM") {
      setToolLogs(prev => [...prev, `[Safety Guard] Double confirmation required! Type CONFIRM.`]);
      return;
    }

    setToolLogs(prev => [...prev, `[Secure Execution] Paving approved changes securely to Firestore...`]);

    try {
      // 1. Create a persistent audit plan record
      const planRef = await addDoc(collection(db, "boldi_action_plans"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: proposedPlan.conversationId,
        title: proposedPlan.title,
        summary: proposedPlan.summary,
        status: "approved",
        riskLevel: proposedPlan.riskLevel,
        safetyLevel: proposedPlan.safetyLevel,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Process each structured action safely
      const createdProjectIds: string[] = [];

      for (const action of proposedPlan.proposedActions) {
        let beforeState: any = null;
        let targetId = action.proposedChange?.id || null;

        // Secure dry-run mapping and execution
        if (action.type === "create_task") {
          const linkedProjId = action.proposedChange.projectId || (createdProjectIds.length > 0 ? createdProjectIds[createdProjectIds.length - 1] : null);
          const docRef = await addDoc(collection(db, "tasks"), {
            userId: user.uid,
            workspaceId: workspace.id,
            title: action.proposedChange.title || "Untitled Task",
            description: action.proposedChange.description || "",
            status: "open",
            priority: Number(action.proposedChange.priority) || 4,
            dueDate: action.proposedChange.dueDate || null,
            projectId: linkedProjId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid
          });
          targetId = docRef.id;
          setToolLogs(prev => [...prev, `[Action Execute] Created task: "${action.proposedChange.title}"`]);

        } else if (action.type === "create_project") {
          const docRef = await addDoc(collection(db, "projects"), {
            userId: user.uid,
            workspaceId: workspace.id,
            title: action.proposedChange.title || "Untitled Project",
            projectType: action.proposedChange.projectType || "implementation",
            status: "open",
            description: action.proposedChange.reason || action.reason || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid
          });
          targetId = docRef.id;
          createdProjectIds.push(targetId);
          setToolLogs(prev => [...prev, `[Action Execute] Created project: "${action.proposedChange.title}"`]);

        } else if (action.type === "outbox_communication") {
          const docRef = await addDoc(collection(db, "boldi_outbox"), {
            userId: user.uid,
            workspaceId: workspace.id,
            recipient: action.proposedChange.recipient || "Unknown",
            channel: action.proposedChange.channel || "whatsapp",
            content: action.proposedChange.content || "",
            status: "approved",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          targetId = docRef.id;
          setToolLogs(prev => [...prev, `[Action Execute] Outbox message staged for: ${action.proposedChange.recipient}`]);

          if (action.proposedChange.channel === "whatsapp" && action.proposedChange.content) {
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(action.proposedChange.content)}`;
            window.open(waUrl, "_blank");
          }

        } else if (action.type === "reschedule_task" && targetId) {
          // Fetch before state for rollback support
          const taskDoc = await getDocs(query(collection(db, "tasks"), where("userId", "==", user.uid)));
          const exactDoc = taskDoc.docs.find(d => d.id === targetId);
          if (exactDoc) {
            beforeState = { dueDate: exactDoc.data().dueDate || null };
            await updateDoc(doc(db, "tasks", targetId), {
              dueDate: action.proposedChange.dueDate,
              updatedAt: serverTimestamp()
            });
            setToolLogs(prev => [...prev, `[Action Execute] Rescheduled task: "${exactDoc.data().title}" to ${action.proposedChange.dueDate}`]);
          }

        } else if (action.type === "update_task" && targetId) {
          const taskDoc = await getDocs(query(collection(db, "tasks"), where("userId", "==", user.uid)));
          const exactDoc = taskDoc.docs.find(d => d.id === targetId);
          if (exactDoc) {
            beforeState = exactDoc.data();
            await updateDoc(doc(db, "tasks", targetId), {
              ...action.proposedChange,
              updatedAt: serverTimestamp()
            });
            setToolLogs(prev => [...prev, `[Action Execute] Updated task: "${exactDoc.data().title}"`]);
          }

        } else if (action.type === "create_decision") {
          const docRef = await addDoc(collection(db, "decisions"), {
            userId: user.uid,
            title: action.proposedChange.title || "Untitled Decision",
            status: "open",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            content: action.proposedChange.description || "",
            source: "Certo Work Co-Pilot Plan",
            reason: action.reason
          });
          targetId = docRef.id;
          setToolLogs(prev => [...prev, `[Action Execute] Created decision: "${action.proposedChange.title}"`]);

        } else if (action.type === "create_followup") {
          const docRef = await addDoc(collection(db, "waiting_for"), {
            userId: user.uid,
            title: action.proposedChange.title || "Follow up with Stakeholder",
            status: "open",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            content: action.proposedChange.description || "",
            reason: action.reason
          });
          targetId = docRef.id;
          setToolLogs(prev => [...prev, `[Action Execute] Added waiting follow-up: "${action.proposedChange.title}"`]);

        } else if (action.type === "kill_or_archive" && targetId) {
          const taskDoc = await getDocs(query(collection(db, "tasks"), where("userId", "==", user.uid)));
          const exactDoc = taskDoc.docs.find(d => d.id === targetId);
          if (exactDoc) {
            beforeState = { status: exactDoc.data().status };
            await updateDoc(doc(db, "tasks", targetId), {
              status: "archived",
              updatedAt: serverTimestamp()
            });
            setToolLogs(prev => [...prev, `[Action Execute] Archived task: "${exactDoc.data().title}"`]);
          }
        }

        // Save detailed transaction action log for Certo Work Audit reporting and rollback tracking
        await addDoc(collection(db, "boldi_actions"), {
          userId: user.uid,
          workspaceId: workspace.id,
          actionPlanId: planRef.id,
          type: action.type,
          targetEntityType: action.type.includes("task") ? "tasks" : action.type.includes("decision") ? "decisions" : "waiting_for",
          targetEntityId: targetId,
          beforeState: beforeState,
          proposedChange: action.proposedChange,
          reason: action.reason,
          confidence: action.confidence || 0.95,
          status: "applied",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setToolLogs(prev => [...prev, `[Audit Log] Saved successfully! Logged in Certo Work logs.`]);

      // Save a local system message confirming execution
      await addDoc(collection(db, "boldi_messages"), {
        userId: user.uid,
        workspaceId: workspace.id,
        conversationId: proposedPlan.conversationId,
        role: "system",
        content: `⚡ **Action Plan Applied:** "${proposedPlan.title}" executed safely. ${proposedPlan.proposedActions.length} changes reported in Certo Work Panel.`,
        inputType: "system",
        createdAt: serverTimestamp()
      });

      setProposedPlan(null);
      setConfirmInput("");
    } catch (e: any) {
      console.error(e);
      setToolLogs(prev => [...prev, `[Secure Fail] Mutation failed: ${e.message}`]);
    }
  };

  // Boldi rollback support
  const handleRollback = async (action: any) => {
    if (!user || !action || revertingId === action.id) return;
    setRevertingId(action.id);
    setToolLogs(prev => [...prev, `[Rollback Engine] Reverting action: ${action.type}`]);

    try {
      if (action.type === "create_task") {
        await deleteDoc(doc(db, "tasks", action.targetEntityId));
        setToolLogs(prev => [...prev, `[Rollback Success] Deleted created task.`]);
      } else if (action.type === "create_decision") {
        await deleteDoc(doc(db, "decisions", action.targetEntityId));
        setToolLogs(prev => [...prev, `[Rollback Success] Deleted created decision.`]);
      } else if (action.type === "create_followup") {
        await deleteDoc(doc(db, "waiting_for", action.targetEntityId));
        setToolLogs(prev => [...prev, `[Rollback Success] Deleted follow-up item.`]);
      } else if ((action.type === "reschedule_task" || action.type === "update_task") && action.beforeState) {
        await updateDoc(doc(db, "tasks", action.targetEntityId), {
          ...action.beforeState,
          updatedAt: serverTimestamp()
        });
        setToolLogs(prev => [...prev, `[Rollback Success] Restored task fields.`]);
      } else if (action.type === "kill_or_archive" && action.beforeState) {
        await updateDoc(doc(db, "tasks", action.targetEntityId), {
          status: action.beforeState.status,
          updatedAt: serverTimestamp()
        });
        setToolLogs(prev => [...prev, `[Rollback Success] Restored archived task.`]);
      }

      // Mark action log as reverted
      await updateDoc(doc(db, "boldi_actions", action.id), {
        status: "reverted",
        updatedAt: serverTimestamp()
      });

    } catch (e: any) {
      console.error(e);
      setToolLogs(prev => [...prev, `[Rollback Failed] ${e.message}`]);
    } finally {
      setRevertingId(null);
    }
  };

  const starterPrompts = [
    { label: "Start my day brief", text: "Certo Work, start my day" },
    { label: "Check stuck tasks", text: "Certo Work, prioritize my tasks" },
    { label: "Audit strategic drift", text: "Certo Work, audit my workspace for strategic drift" }
  ];

  return (
    <>
      {/* 1. Floating Trigger Button */}
      <div 
        id="boldi-floating-button"
        className="fixed bottom-16 right-6 md:bottom-6 md:right-6 z-50 flex items-center gap-2"
      >
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-black text-white hover:bg-neutral-900 shadow-2xl rounded-full px-5 py-3.5 font-bold flex items-center gap-2 border border-neutral-800 transition-shadow duration-300"
        >
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
          <span className="text-sm font-extrabold tracking-wide">Certo Work</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute top-1 right-1" />
        </motion.button>
      </div>

      {/* 2. Chat Popup Panel Container (Draggable & Resizable) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dragRef}
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            style={{ 
              position: "fixed", 
              left: `${position.x}px`, 
              top: `${position.y}px`,
              width: `${size.width}px`,
              height: isMinimized ? "auto" : `${size.height}px`,
              zIndex: 1000
            }}
            className="bg-white border border-neutral-200 shadow-2xl rounded-3xl flex flex-col overflow-hidden transition-all duration-75"
          >
            {/* Header / Drag Bar */}
            <div 
              onMouseDown={handleDragStart}
              className={`bg-neutral-900 text-white px-4 py-3 flex items-center justify-between cursor-move select-none ${isDragging ? 'bg-neutral-800' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-neutral-800 text-yellow-400 rounded-lg">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wide uppercase">Certo Work Co-Pilot</h4>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-neutral-400 font-bold uppercase">{getContextName()}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Window Commands */}
              <div className="flex items-center gap-1.5">
                {/* Reports Button (Certo Work Logs) */}
                <button
                  onClick={() => setIsReportsOpen(!isReportsOpen)}
                  title="Certo Work Logs"
                  className={`p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors ${isReportsOpen ? 'bg-neutral-800 text-white' : ''}`}
                >
                  <History className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-neutral-800 text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body (Hidden if minimized) */}
            {!isMinimized && (
              <>
                {/* Mode Selector and Context Indicator Sub-header */}
                <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                  <div className="flex bg-neutral-200 p-0.5 rounded-lg text-[10px] font-extrabold w-44">
                    <button
                      onClick={() => handleModeChange("tell_me")}
                      className={`flex-1 py-1 rounded-md text-center transition-all ${mode === 'tell_me' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                    >
                      Tell Me
                    </button>
                    <button
                      onClick={() => handleModeChange("co_work")}
                      className={`flex-1 py-1 rounded-md text-center transition-all ${mode === 'co_work' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                    >
                      Co-Work
                    </button>
                  </div>

                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    {mode === 'tell_me' ? <Lock className="w-3 h-3 text-neutral-400" /> : <Unlock className="w-3 h-3 text-amber-500" />}
                    {mode === 'tell_me' ? 'Read-Only' : 'Agent Active'}
                  </span>
                </div>

                {/* Chat History bubble stage */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar bg-[var(--status-warning-soft)]">
                  {messages.length === 0 && (
                    <div className="py-12 text-center text-neutral-400 max-w-xs mx-auto space-y-4">
                      <Sparkles className="w-10 h-10 text-yellow-500 mx-auto animate-pulse" />
                      <div className="text-xs font-black uppercase tracking-widest text-neutral-500">I am ready to help, Alejandro</div>
                      <p className="text-[11px] text-neutral-500 font-medium">
                        I analyze active tasks, strategy gaps, calendar blocks, and suggest optimal adjustments. Type below or select a command.
                      </p>
                      
                      <div className="flex flex-col gap-2.5 pt-2">
                        {starterPrompts.map(p => (
                          <button
                            key={p.label}
                            onClick={() => handleSendMessage(p.text)}
                            className="bg-white hover:bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60 text-left text-xs font-bold text-neutral-700 shadow-sm flex items-center justify-between"
                          >
                            {p.label}
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m, idx) => (
                    <div key={m.id || idx} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                      {m.role !== 'user' && (
                        <div className="p-1 bg-black text-white rounded-lg mt-0.5">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1 max-w-[85%]">
                        <div className={`p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm whitespace-pre-wrap ${
                          m.role === 'user' 
                            ? 'bg-black text-white rounded-tr-none' 
                            : m.role === 'system'
                            ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-tl-none font-bold'
                            : 'bg-white text-neutral-800 border border-neutral-100 rounded-tl-none'
                        }`}>
                          {m.content}
                          
                          {/* Download Report Button */}
                          {m.content && m.content.includes("###") && (
                            <button
                              onClick={() => downloadReport(m.content)}
                              className="mt-2 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-xl flex items-center gap-1.5 w-fit shadow-md transition-colors cursor-pointer"
                            >
                              <Download className="w-3 h-3" /> Download Markdown Report
                            </button>
                          )}
                        </div>
                        
                        {/* Grounded RAG Citations */}
                        {m.citations && m.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 pl-1">
                            {m.citations.map((cit: any, citIdx: number) => (
                              <div key={citIdx} className="flex items-center gap-1 bg-neutral-150 hover:bg-neutral-200 text-[9px] text-neutral-500 px-2 py-0.5 rounded-full border border-neutral-200/50">
                                <BookOpen className="w-2.5 h-2.5 text-neutral-400" />
                                <span>{cit.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggested Response Chips */}
                        {m.suggestedChips && m.suggestedChips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1 pl-1">
                            {m.suggestedChips.map((chip: string, chipIdx: number) => (
                              <button
                                key={chipIdx}
                                onClick={() => handleSendMessage(chip)}
                                className="bg-neutral-50 hover:bg-neutral-100 text-[10px] font-bold text-neutral-700 px-2.5 py-1 rounded-xl border border-neutral-200/50 shadow-sm transition-all cursor-pointer"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}

                        {m.metadataReport && <MetadataReportViewer report={m.metadataReport} />}
                      </div>
                    </div>
                  ))}

                  {submitting && (
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-black text-white rounded-lg">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                      <div className="p-2.5 bg-white border border-neutral-100 rounded-2xl rounded-tl-none text-xs text-neutral-500 flex items-center gap-1.5 font-bold shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-spin" /> Certo Work is thinking...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Action Card UI: Structured proposed plan with safety validation */}
                <AnimatePresence>
                  {proposedPlan && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="absolute bottom-16 left-4 right-4 bg-white border-2 border-amber-200 rounded-3xl p-4 shadow-2xl space-y-3 z-40 max-h-[70%] overflow-y-auto"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Proposed Co-Work Plan
                        </span>
                        <button onClick={() => setProposedPlan(null)} className="p-1 hover:bg-neutral-50 rounded-lg text-neutral-400 hover:text-black">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="font-extrabold text-xs text-neutral-900">{proposedPlan.title}</div>
                      <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">{proposedPlan.summary}</p>
                      
                      {/* Safety Level Flagging Indicator */}
                      <div className="p-2 bg-neutral-50 border border-neutral-150 rounded-xl flex items-center gap-2">
                        <Settings className="w-4 h-4 text-neutral-500 animate-spin" style={{ animationDuration: '4s' }} />
                        <div className="text-[10px]">
                          <span className="font-bold text-neutral-700 block">Safety Level {proposedPlan.safetyLevel} Enforcement</span>
                          <span className="text-neutral-500">
                            {proposedPlan.safetyLevel === 1 && "Level 1: Low-risk single action. Fast-approved."}
                            {proposedPlan.safetyLevel === 2 && "Level 2: Medium-risk multi-entity write. Explicit consent."}
                            {proposedPlan.safetyLevel === 3 && "Level 3: Bulk/System modifications. Double CONFIRM code required."}
                            {proposedPlan.safetyLevel === 4 && "Level 4: Destructive archivals detected. Strict check."}
                            {proposedPlan.safetyLevel === 5 && "Level 5: System configuration update. Role checking required."}
                          </span>
                        </div>
                      </div>

                      {/* Detailed list of proposed write mutations */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Proposed Actions ({proposedPlan.proposedActions.length})</label>
                        {proposedPlan.proposedActions.map((act: any, idx: number) => (
                          <div key={idx} className="text-[10px] p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex justify-between gap-2 shadow-sm">
                            <div className="flex-1">
                              <span className="font-black text-neutral-800 capitalize">{act.type.replace(/_/g, ' ')}: </span>
                              <span className="text-neutral-600 font-semibold">{act.proposedChange?.title || "Update field checklist"}</span>
                              <div className="text-[9px] text-neutral-400 mt-1 italic leading-tight">"Justification: {act.reason}"</div>
                            </div>
                            <span className="text-[8px] bg-neutral-200 text-neutral-600 font-black px-1.5 py-0.5 rounded-md h-fit">L{act.safetyLevel}</span>
                          </div>
                        ))}
                      </div>

                      {/* Safety Double Confirm Box */}
                      {proposedPlan.safetyLevel === 3 && (
                        <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl space-y-1.5">
                          <span className="text-[10px] font-black text-red-800 block">⚠️ Security Double-Confirmation Required</span>
                          <p className="text-[9px] text-red-600">This plan reschedules or modifies multiple items. Type "CONFIRM" to authorize execution.</p>
                          <input
                            type="text"
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder="Type CONFIRM here"
                            className="w-full text-xs font-bold bg-white border border-red-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </div>
                      )}

                      {/* Approval Execution Buttons */}
                      <div className="flex justify-between items-center gap-2 pt-2 border-t border-neutral-100">
                        <span className="text-[10px] text-neutral-400 font-black">Risk: <b className="text-red-500 uppercase">{proposedPlan.riskLevel}</b></span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setProposedPlan(null)}
                            className="text-xs font-bold px-3 py-1.5 border border-neutral-200 hover:bg-neutral-100 rounded-xl transition-colors"
                          >
                            Decline
                          </button>
                          <button
                            onClick={handleApproveActionPlan}
                            disabled={proposedPlan.safetyLevel === 3 && confirmInput.trim().toUpperCase() !== "CONFIRM"}
                            className="text-xs font-extrabold bg-black hover:bg-neutral-900 text-white px-4 py-1.5 rounded-xl flex items-center gap-1.5 disabled:opacity-30 disabled:hover:bg-black shadow-lg transition-colors"
                          >
                            <Check className="w-4 h-4" /> Approve & Execute
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tool Logs activity tracker drawer */}
                {toolLogs.length > 0 && (
                  <div className="bg-neutral-50 border-t border-neutral-100 p-2.5 max-h-16 overflow-y-auto text-[8px] font-mono text-neutral-400 space-y-0.5 no-scrollbar flex-shrink-0">
                    <div className="flex items-center gap-1 text-[9px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">
                      <Cpu className="w-3 h-3 text-neutral-500" /> Active Tool Registry Logs
                    </div>
                    {toolLogs.slice(-3).map((log, i) => (
                      <div key={i} className="truncate">{log}</div>
                    ))}
                  </div>
                )}

                {/* Chat Action Input Field bar */}
                <div className="p-3 border-t border-neutral-100 flex gap-2 items-center bg-white flex-shrink-0">
                  <div className="flex-1 flex gap-2 items-center bg-neutral-50 border border-neutral-200 rounded-2xl p-1.5 focus-within:ring-1 focus-within:ring-black">
                    <input
                      type="text"
                      value={inputMessage}
                      disabled={submitting}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={submitting ? "Waiting for response..." : "Ask Certo Work anything..."}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                      className="flex-1 text-xs px-2 py-1.5 bg-transparent outline-none disabled:opacity-50"
                    />
                    
                    {/* Voice Input Trigger button */}
                    {SpeechRecognitionClass && (
                      <button
                        onClick={toggleListening}
                        title={isListening ? "Listening..." : "Voice Input"}
                        className={`p-1.5 rounded-xl hover:bg-neutral-200 text-neutral-500 transition-colors ${isListening ? 'bg-red-100 hover:bg-red-200 text-red-600 animate-pulse' : ''}`}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={submitting || !inputMessage.trim()}
                    className="p-3 bg-black hover:bg-neutral-900 text-white rounded-2xl disabled:opacity-30 disabled:hover:bg-black shadow-md transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}

            {/* Drag Resize Handle bar */}
            {!isMinimized && (
              <div 
                onMouseDown={handleResizeStart}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 flex items-end justify-end p-0.5"
              >
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Certo Work Logs Slide-out Right Panel Drawer */}
      <AnimatePresence>
        {isReportsOpen && isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-neutral-200 shadow-2xl z-[1050] flex flex-col p-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-neutral-900 text-yellow-400 rounded-xl">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900">Certo Work Changes Log</h3>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Certo Work Audit Desk</span>
                </div>
              </div>
              <button 
                onClick={() => setIsReportsOpen(false)}
                className="p-1.5 hover:bg-neutral-50 rounded-lg text-neutral-400 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Certo Work logs feed */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 no-scrollbar">
              <div className="space-y-1 bg-neutral-50 p-3 rounded-2xl border border-neutral-150 text-[11px] text-neutral-500 font-medium">
                <span className="font-black text-neutral-800 block">Agent Audit Traceability</span>
                All automated co-work edits, scheduling updates, and task configurations are recorded here with instant rollback capability.
              </div>

              {auditLogs.length === 0 ? (
                <div className="py-20 text-center text-neutral-400 space-y-2">
                  <Cpu className="w-8 h-8 text-neutral-300 mx-auto" />
                  <div className="text-xs font-bold uppercase text-neutral-400">No actions recorded</div>
                  <p className="text-[10px] text-neutral-500 max-w-xs px-4">Execute changes in Co-Work mode to populate logs.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Activity History ({auditLogs.length})</h4>
                  {auditLogs.map((log: any) => (
                    <div 
                      key={log.id} 
                      className={`p-3 rounded-2xl border border-neutral-150/80 shadow-sm space-y-2 relative transition-all ${log.status === 'reverted' ? 'bg-neutral-50 opacity-60' : 'bg-white hover:border-neutral-300'}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          log.status === 'reverted' ? 'bg-neutral-200 text-neutral-500' : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {log.status}
                        </span>
                        <span className="text-[8px] text-neutral-400 font-bold">
                          {log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now"}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-neutral-800">
                        {log.type === 'create_task' && "🆕 Task Created"}
                        {log.type === 'reschedule_task' && "📅 Task Rescheduled"}
                        {log.type === 'update_task' && "✍️ Task Properties Updated"}
                        {log.type === 'create_decision' && "⚖️ Decision Created"}
                        {log.type === 'create_followup' && "📌 Follow-up Registered"}
                        {log.type === 'kill_or_archive' && "🗄️ Task Archived"}
                      </div>

                      <p className="text-[10px] text-neutral-500 leading-normal font-semibold">
                        {log.proposedChange?.title || "Update attributes details"}
                      </p>

                      <div className="text-[9px] text-neutral-400 italic">
                        "Reason: {log.reason}"
                      </div>

                      {/* Boldi style Undo Rollback button */}
                      {log.status === "applied" && (
                        <div className="pt-2 border-t border-neutral-100 flex justify-end">
                          <button
                            onClick={() => handleRollback(log)}
                            disabled={revertingId === log.id}
                            className="text-[10px] font-extrabold text-neutral-900 hover:text-black flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-40"
                          >
                            {revertingId === log.id ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" /> Rollbacking...
                              </>
                            ) : (
                              <>
                                <Undo className="w-3 h-3" /> Rollback Change
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
