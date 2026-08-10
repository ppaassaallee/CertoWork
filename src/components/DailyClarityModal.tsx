import React, { useState, useEffect, useRef } from "react";
import { 
  X, Check, AlertCircle, Sparkles, Brain, Plus, Trash2, Edit2, Play, Pause, ChevronRight, ChevronLeft, 
  RefreshCw, Calendar, CheckCircle2, Timer as TimerIcon
} from "lucide-react";
import { 
  collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { logHabit } from "../lib/habits";
import { useAuth } from "../lib/AuthContext";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

interface DailyClarityModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function DailyClarityModal({ isOpen, onClose, workspaceId }: DailyClarityModalProps) {
  const { user } = useAuth();
  
  // Timer States
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Flow State
  const [step, setStep] = useState(1); // 1: Intro, 2: Brain Dump, 3: Choose/Prioritize, 4: Preview, 5: Celebration
  const [activeTab, setActiveTab] = useState<"pendientes" | "decisiones" | "ideas" | "dejarIr">("pendientes");

  // Session & Items States
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorString, setErrorString] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dump items
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [decisiones, setDecisiones] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [dejarIr, setDejarIr] = useState<any[]>([]);

  // Input states
  const [inputVal, setInputVal] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Projects and Categories catalogs
  const [allProjects, setAllProjects] = useState<{ [id: string]: string }>({});
  const [allCategories, setAllCategories] = useState<{ [id: string]: { name: string, color?: string } }>({});
  const [stakeholders, setStakeholders] = useState<any[]>([]);

  // Search autocomplete states
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [reviewResults, setReviewResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  // Duplicate Warning Alert state
  const [duplicateWarningTask, setDuplicateWarningTask] = useState<any | null>(null);

  // AI Support recommendations
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  // Format Timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const ss = secs % 60;
    return `${mins}:${ss < 10 ? '0' : ''}${ss}`;
  };

  // Timer Effect
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Stop timer if step changes to something other than the Brain Dump step (2)
  useEffect(() => {
    if (step !== 2) {
      setTimerRunning(false);
    }
  }, [step]);

  // Load Preferences and Session on Open
  useEffect(() => {
    if (!isOpen || !user) return;
    initSession();
  }, [isOpen, user]);

  // Load Projects and Categories catalogs on open
  useEffect(() => {
    if (!isOpen || !user || !workspaceId) return;
    
    const loadCatalogs = async () => {
      try {
        const qProj = query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspaceId));
        const projSnap = await getDocs(qProj);
        const pm: { [id: string]: string } = {};
        projSnap.forEach(d => {
          const data = d.data();
          pm[d.id] = data.title || data.name || "Untitled Project";
        });
        setAllProjects(pm);

        const qCat = query(collection(db, "categories"), where("userId", "==", user.uid), where("workspaceId", "==", workspaceId));
        const catSnap = await getDocs(qCat);
        const cm: { [id: string]: { name: string, color?: string } } = {};
        catSnap.forEach(d => {
          const data = d.data();
          cm[d.id] = { name: data.name, color: data.color };
        });
        setAllCategories(cm);

        const qStake = query(collection(db, "stakeholders"), where("userId", "==", user.uid));
        const stakeSnap = await getDocs(qStake);
        const stList: any[] = [];
        stakeSnap.forEach(d => {
          const data = d.data();
          stList.push({ id: d.id, name: data.name || data.title || "Untitled Stakeholder" });
        });
        setStakeholders(stList);
      } catch (e: any) {
        console.error("Error loading projects/categories/stakeholders in ClarityReset:", e);
        handleFirestoreError(e, OperationType.LIST, "catalogs/load");
      }
    };
    
    loadCatalogs();
  }, [isOpen, user, workspaceId]);

  // Perform search helper
  const performSearch = async (queryStr: string) => {
    if (!user || !workspaceId) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const normalizedQuery = queryStr.toLowerCase().trim();

      // Fetch tasks scoped
      const qTasks = query(
        collection(db, "tasks"),
        where("userId", "==", user.uid),
        where("workspaceId", "==", workspaceId)
      );
      const tasksSnap = await getDocs(qTasks);
      const foundTasks: any[] = [];
      tasksSnap.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() } as any;
        
        // Filter by completed/archived flags
        if (d.status === "done" && !includeCompleted) return;
        if (d.status === "archived" && !includeArchived) return;

        // Matches normalized title contains query or tags/project contain query
        const titleMatch = d.title?.toLowerCase().includes(normalizedQuery);
        const descMatch = d.description?.toLowerCase().includes(normalizedQuery);
        
        // Match project
        const projectTitle = allProjects[d.projectId || ""] || "";
        const projectMatch = projectTitle.toLowerCase().includes(normalizedQuery);

        // Match categories/tags
        let tagsMatch = false;
        if (d.categoryId && allCategories[d.categoryId]) {
          tagsMatch = allCategories[d.categoryId].name.toLowerCase().includes(normalizedQuery);
        }
        if (d.categoryIds) {
          tagsMatch = tagsMatch || d.categoryIds.some((cid: string) => 
            allCategories[cid]?.name.toLowerCase().includes(normalizedQuery)
          );
        }

        if (titleMatch || descMatch || projectMatch || tagsMatch) {
          let score = 0;
          if (d.title?.toLowerCase() === normalizedQuery) score = 100;
          else if (d.title?.toLowerCase().startsWith(normalizedQuery)) score = 80;
          else if (titleMatch) score = 60;
          else if (projectMatch || tagsMatch) score = 40;
          else if (descMatch) score = 20;

          foundTasks.push({ ...d, _score: score });
        }
      });

      // Sort by score (descending) and then creation date (descending)
      foundTasks.sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });

      setSearchResults(foundTasks);

      // Fetch review candidates scoped
      const qReview = query(
        collection(db, "review_candidates"),
        where("userId", "==", user.uid),
        where("workspaceId", "==", workspaceId)
      );
      const reviewSnap = await getDocs(qReview);
      const foundReviews: any[] = [];
      reviewSnap.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() } as any;
        
        if (d.status === "approved" || d.status === "killed" || d.status === "archived") return;

        const titleMatch = d.title?.toLowerCase().includes(normalizedQuery);
        const whyMatch = d.why?.toLowerCase().includes(normalizedQuery);

        if (titleMatch || whyMatch) {
          let score = 0;
          if (d.title?.toLowerCase() === normalizedQuery) score = 100;
          else if (d.title?.toLowerCase().startsWith(normalizedQuery)) score = 80;
          else score = 60;

          foundReviews.push({ ...d, _score: score });
        }
      });

      foundReviews.sort((a, b) => b._score - a._score);
      setReviewResults(foundReviews);

    } catch (err: any) {
      console.error(err);
      setSearchError("Ocurrió un error al buscar tareas existentes.");
      handleFirestoreError(err, OperationType.LIST, "tasks/search");
    } finally {
      setSearchLoading(false);
    }
  };

  // Search Debounce Effect
  useEffect(() => {
    if (activeTab !== "pendientes") {
      setSearchResults([]);
      setReviewResults([]);
      return;
    }

    if (inputVal.trim().length < 2) {
      setSearchResults([]);
      setReviewResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(inputVal);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputVal, activeTab, includeCompleted, includeArchived]);

  // Link existing task helper
  const handleLinkExistingTask = async (task: any) => {
    if (!sessionId || !user) return;
    setLoading(true);
    try {
      if (pendientes.some(p => p.linkedEntityId === task.id)) {
        return;
      }

      const itemData = {
        userId: user.uid,
        sessionId: sessionId,
        type: "pendientes",
        title: task.title,
        selectedForAction: false,
        isExistingEntity: true,
        linkedEntityType: "task",
        linkedEntityId: task.id,
        linkedEntityTitle: task.title,
        proposedType: "task",
        status: "captured",
        createdAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, "mental_clarity_items"), itemData);
      
      const newItem = { 
        id: ref.id, 
        title: task.title, 
        selectedForAction: false,
        isExistingEntity: true,
        linkedEntityType: "task" as const,
        linkedEntityId: task.id,
        linkedEntityTitle: task.title,
        proposedType: "task",
        status: "captured"
      };

      setPendientes(prev => [...prev, newItem]);
      saveDuration();
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "mental_clarity_items/link");
    } finally {
      setLoading(false);
    }
  };

  const initSession = async () => {
    if (!user) return;
    setLoading(true);
    setErrorString(null);
    try {
      // 1. Get/Create Preferences
      const qPref = query(collection(db, "daily_clarity_preferences"), where("userId", "==", user.uid));
      const prefSnap = await getDocs(qPref);
      let prefDoc: any = null;
      if (prefSnap.empty) {
        const newPref = {
          userId: user.uid,
          autoShowEnabled: true,
          habitLinked: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const ref = await addDoc(collection(db, "daily_clarity_preferences"), newPref);
        prefDoc = { id: ref.id, ...newPref };
      } else {
        prefDoc = { id: prefSnap.docs[0].id, ...prefSnap.docs[0].data() };
      }
      setPreferences(prefDoc);

      // Update last shown
      const today = new Date().toISOString().split('T')[0];
      await updateDoc(doc(db, "daily_clarity_preferences", prefDoc.id), {
        lastShownDate: today,
        updatedAt: serverTimestamp()
      });

      // 2. Load existing draft session for today or general open draft
      const qSession = query(
        collection(db, "mental_clarity_sessions"), 
        where("userId", "==", user.uid), 
        where("status", "==", "draft")
      );
      const sessionSnap = await getDocs(qSession);
      let activeSessionId = "";
      
      if (!sessionSnap.empty) {
        // Load draft session
        const sessDoc = sessionSnap.docs[0];
        activeSessionId = sessDoc.id;
        setSessionId(activeSessionId);
        
        // Load duration if present
        const sessData = sessDoc.data();
        if (sessData.durationSeconds) {
          setTimeLeft(Math.max(0, 600 - sessData.durationSeconds));
        }

        // Load items
        await loadItems(activeSessionId);
        setStep(2); // Jump to dump step if we already have a draft going
      } else {
        // Create new session
        const newSess = {
          userId: user.uid,
          createdAt: serverTimestamp(),
          status: "draft",
          durationSeconds: 0
        };
        const sessRef = await addDoc(collection(db, "mental_clarity_sessions"), newSess);
        activeSessionId = sessRef.id;
        setSessionId(activeSessionId);
        
        setPendientes([]);
        setDecisiones([]);
        setIdeas([]);
        setDejarIr([]);
        setStep(1);
        setTimeLeft(600);
      }
    } catch (err: any) {
      console.error(err);
      setErrorString("Could not start session. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (sessId: string) => {
    if (!user) return;
    try {
      const qItems = query(collection(db, "mental_clarity_items"), where("userId", "==", user.uid), where("sessionId", "==", sessId));
      const itemsSnap = await getDocs(qItems);
      const pArr: any[] = [];
      const dArr: any[] = [];
      const iArr: any[] = [];
      itemsSnap.forEach(docSnap => {
        const item = { id: docSnap.id, ...docSnap.data() };
        if ((item as any).type === "pendiente" || (item as any).type === "pendientes") pArr.push(item);
        if ((item as any).type === "decision" || (item as any).type === "decisiones") dArr.push(item);
        if ((item as any).type === "idea" || (item as any).type === "ideas") iArr.push(item);
      });
      setPendientes(pArr);
      setDecisiones(dArr);
      setIdeas(iArr);

      const qLetGo = query(collection(db, "let_go_items"), where("userId", "==", user.uid), where("sessionId", "==", sessId));
      const letGoSnap = await getDocs(qLetGo);
      const lgArr: any[] = [];
      letGoSnap.forEach(docSnap => {
        lgArr.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDejarIr(lgArr);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.LIST, "loadItems");
    }
  };

  // Add Item handler
  const handleAddItem = async (e?: React.FormEvent, forceNew = false) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || !sessionId || !user) return;

    setLoading(true);
    try {
      const text = inputVal.trim();

      // Duplicate prevention for "pendientes"
      if (activeTab === "pendientes" && !forceNew) {
        const qCheck = query(
          collection(db, "tasks"),
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspaceId)
        );
        const checkSnap = await getDocs(qCheck);
        let foundExisting: any = null;
        checkSnap.forEach(snap => {
          const t = snap.data();
          if (t.status !== "done" && t.status !== "archived" && t.title?.toLowerCase() === text.toLowerCase()) {
            foundExisting = { id: snap.id, ...t };
          }
        });

        if (foundExisting) {
          setDuplicateWarningTask(foundExisting);
          setLoading(false);
          return; // Stop and prompt user
        }
      }

      setDuplicateWarningTask(null);
      setInputVal("");
      
      if (activeTab === "dejarIr") {
        const itemData = {
          userId: user.uid,
          sessionId: sessionId,
          title: text,
          createdAt: serverTimestamp()
        };
        const ref = await addDoc(collection(db, "let_go_items"), itemData);
        setDejarIr(prev => [...prev, { id: ref.id, title: text }]);
      } else {
        const initialFields = {
          priority: 1, // "all the thinks I add in brain dump triage in the 10 mins dump process should be p1"
          dueDate: "",
          projectId: "",
          stakeholderIds: []
        };
        const itemData = {
          userId: user.uid,
          sessionId: sessionId,
          type: activeTab,
          title: text,
          selectedForAction: false,
          isExistingEntity: false,
          linkedEntityType: null,
          linkedEntityId: null,
          proposedType: "task",
          status: "captured",
          createdAt: serverTimestamp(),
          ...initialFields
        };
        const ref = await addDoc(collection(db, "mental_clarity_items"), itemData);
        const newItem = { 
          id: ref.id, 
          title: text, 
          selectedForAction: false,
          isExistingEntity: false,
          linkedEntityType: null,
          linkedEntityId: null,
          proposedType: "task",
          status: "captured",
          ...initialFields
        };
        
        if (activeTab === "pendientes") setPendientes(prev => [...prev, newItem]);
        if (activeTab === "decisiones") setDecisiones(prev => [...prev, newItem]);
        if (activeTab === "ideas") setIdeas(prev => [...prev, newItem]);
      }
      saveDuration();
    } catch (err: any) {
      console.error(err);
      setErrorString("Error saving the item.");
      handleFirestoreError(err, OperationType.CREATE, "addItem");
    } finally {
      setLoading(false);
    }
  };

  // Batch / autosave duration regularly
  const saveDuration = async () => {
    if (!sessionId) return;
    try {
      const elapsed = 600 - timeLeft;
      await updateDoc(doc(db, "mental_clarity_sessions", sessionId), {
        durationSeconds: elapsed
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Start Edit Mode
  const startEditItem = (id: string, text: string) => {
    setEditingItemId(id);
    setEditingText(text);
  };

  // Save Edit Item
  const handleSaveEdit = async (id: string, listType: typeof activeTab) => {
    if (!editingText.trim()) return;
    try {
      if (listType === "dejarIr") {
        await updateDoc(doc(db, "let_go_items", id), { title: editingText.trim() });
        setDejarIr(prev => prev.map(item => item.id === id ? { ...item, title: editingText.trim() } : item));
      } else {
        await updateDoc(doc(db, "mental_clarity_items", id), { title: editingText.trim() });
        if (listType === "pendientes") setPendientes(prev => prev.map(item => item.id === id ? { ...item, title: editingText.trim() } : item));
        if (listType === "decisiones") setDecisiones(prev => prev.map(item => item.id === id ? { ...item, title: editingText.trim() } : item));
        if (listType === "ideas") setIdeas(prev => prev.map(item => item.id === id ? { ...item, title: editingText.trim() } : item));
      }
      setEditingItemId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to instantly update individual triage metadata fields during Step 2 Brain Dump
  const handleUpdateItemField = async (itemId: string, field: string, value: any) => {
    try {
      await updateDoc(doc(db, "mental_clarity_items", itemId), { [field]: value });
      // Update local state reactive bindings
      setPendientes(prev => prev.map(p => p.id === itemId ? { ...p, [field]: value } : p));
      setDecisiones(prev => prev.map(d => d.id === itemId ? { ...d, [field]: value } : d));
      setIdeas(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
    } catch (err) {
      console.error("Error updating item field", err);
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string, listType: typeof activeTab) => {
    try {
      if (listType === "dejarIr") {
        await deleteDoc(doc(db, "let_go_items", id));
        setDejarIr(prev => prev.filter(item => item.id !== id));
      } else {
        await deleteDoc(doc(db, "mental_clarity_items", id));
        if (listType === "pendientes") setPendientes(prev => prev.filter(item => item.id !== id));
        if (listType === "decisiones") setDecisiones(prev => prev.filter(item => item.id !== id));
        if (listType === "ideas") setIdeas(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle selection for action (Step 3 choose priorities manually)
  const toggleActionSelect = async (id: string, listType: "pendientes" | "decision" | "idea") => {
    let list: any[] = [];
    if (listType === "pendientes") list = pendientes;
    if (listType === "decision") list = decisiones;
    if (listType === "idea") list = ideas;

    const item = list.find(i => i.id === id);
    if (!item) return;

    const futureVal = !item.selectedForAction;

    // Enforce selection limit constraints dynamically
    if (futureVal) {
      if (listType === "pendientes" && pendientes.filter(i => i.selectedForAction).length >= 3) {
        return; // limit 3
      }
      if (listType === "decision" && decisiones.filter(i => i.selectedForAction).length >= 1) {
        // Turn off other decision item automatically to make it exactly 1
        const activeDecisions = decisiones.filter(i => i.selectedForAction);
        for (const dec of activeDecisions) {
          await updateDoc(doc(db, "mental_clarity_items", dec.id), { selectedForAction: false });
        }
        setDecisiones(prev => prev.map(i => ({ ...i, selectedForAction: false })));
      }
      if (listType === "idea" && ideas.filter(i => i.selectedForAction).length >= 1) {
        // Turn off other ideas automatically to make it exactly 1
        const activeIdeas = ideas.filter(i => i.selectedForAction);
        for (const idItem of activeIdeas) {
          await updateDoc(doc(db, "mental_clarity_items", idItem.id), { selectedForAction: false });
        }
        setIdeas(prev => prev.map(i => ({ ...i, selectedForAction: false })));
      }
    }

    try {
      await updateDoc(doc(db, "mental_clarity_items", id), { selectedForAction: futureVal });
      
      if (listType === "pendientes") setPendientes(prev => prev.map(i => i.id === id ? { ...i, selectedForAction: futureVal } : i));
      if (listType === "decision") setDecisiones(prev => prev.map(i => i.id === id ? { ...i, selectedForAction: futureVal } : { ...i, selectedForAction: false }));
      if (listType === "idea") setIdeas(prev => prev.map(i => i.id === id ? { ...i, selectedForAction: futureVal } : { ...i, selectedForAction: false }));
    } catch (e) {
      console.error(e);
    }
  };

  // Skip Reset
  const handleSkipToday = async () => {
    if (!preferences || !user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const skipped = preferences.skippedDates || [];
      if (!skipped.includes(today)) {
        skipped.push(today);
      }
      await updateDoc(doc(db, "daily_clarity_preferences", preferences.id), {
        skippedDates: skipped,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (e) {
      console.error(e);
      onClose();
    }
  };

  // Snoop Reset (Remind Later)
  const handleRemindLater = async () => {
    if (!preferences) return;
    try {
      const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, "daily_clarity_preferences", preferences.id), {
        remindLaterDate: oneHourLater,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (e) {
      console.error(e);
      onClose();
    }
  };

  // Toggle AutoShow preferences
  const handleToggleAutoShow = async (enabled: boolean) => {
    if (!preferences) return;
    try {
      await updateDoc(doc(db, "daily_clarity_preferences", preferences.id), {
        autoShowEnabled: enabled,
        updatedAt: serverTimestamp()
      });
      setPreferences((prev: any) => ({ ...prev, autoShowEnabled: enabled }));
    } catch (e) {
      console.error(e);
    }
  };

  // AI Priorities Assistant: Help me choose
  const handleAiPrioritization = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setErrorString(null);

    try {
      const resVal = await fetch("/api/clarity/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendientes,
          decisiones,
          ideas,
          dejarIr
        })
      });
      if (!resVal.ok) throw new Error("Could not retrieve AI suggestions.");
      const data = await resVal.json();
      setAiSuggestions(data);

      const batch = writeBatch(db);

      // Auto check selection draft with AI recommendations
      const recPIds = (data.suggestedPendientes || []).map((x: any) => x.itemId);
      const recDId = data.suggestedDecision?.itemId;
      const recIId = data.suggestedIdea?.itemId;

      // Update state & sync batch
      const pUpdate = pendientes.map(p => {
        const selected = recPIds.includes(p.id);
        const reason = (data.suggestedPendientes || []).find((x: any) => x.itemId === p.id)?.reason;
        batch.update(doc(db, "mental_clarity_items", p.id), { selectedForAction: selected });
        return { ...p, selectedForAction: selected, reason };
      });
      setPendientes(pUpdate);

      const dUpdate = decisiones.map(d => {
        const selected = d.id === recDId;
        const reason = selected ? data.suggestedDecision?.reason : "";
        batch.update(doc(db, "mental_clarity_items", d.id), { selectedForAction: selected });
        return { ...d, selectedForAction: selected, reason };
      });
      setDecisiones(dUpdate);

      const iUpdate = ideas.map(i => {
        const selected = i.id === recIId;
        const reason = selected ? data.suggestedIdea?.reason : "";
        const block = selected ? data.suggestedIdea?.suggestedCalendarBlock : i.suggestedCalendarBlock;
        batch.update(doc(db, "mental_clarity_items", i.id), { 
          selectedForAction: selected,
          suggestedCalendarBlock: block || null
        });
        return { ...i, selectedForAction: selected, reason, suggestedCalendarBlock: block };
      });
      setIdeas(iUpdate);

      await batch.commit();
      
      if (data.reflection) {
        setSuccessMsg(data.reflection);
      }
    } catch (err: any) {
      console.error(err);
      setErrorString("Could not connect to Certo Work. Select your priorities today.");
    } finally {
      setAiLoading(false);
    }
  };

  // Finishes Reset: Sends all captured items (prioritized and deferred) to Review Candidates so nothing is lost!
  const handleFinalizeReset = async () => {
    if (!sessionId || !user) return;
    setLoading(true);
    setErrorString(null);

    try {
      const elapsed = 600 - timeLeft;

      // 1. Submit review candidates for all items
      const batchList: any[] = [];
      
      // Process PENDIENTES
      for (const p of pendientes) {
        if (p.isExistingEntity) {
          if (p.selectedForAction) {
            batchList.push({
              userId: user.uid,
              createdBy: user.uid,
              workspaceId: workspaceId || user.uid,
              title: p.title,
              type: "task_update",
              why: "Selected during Daily Clarity Reset as an existing pending task that needs attention.",
              action: "Prioritize / schedule / make next action",
              confidence: "high",
              proposed: {
                proposedType: "existing_task_action",
                linkedEntityId: p.linkedEntityId,
                linkedEntityType: "task"
              },
              source: `Daily Clarity Reset Session - ${new Date().toLocaleDateString()}`,
              sourceType: "mental_clarity_session",
              sourceId: sessionId,
              sourceReviewItemId: p.id,
              sourceItemId: p.id,
              linkedEntityType: "task",
              linkedEntityId: p.linkedEntityId,
              status: "pending",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        } else {
          // Newly captured pendiente
          batchList.push({
            userId: user.uid,
            createdBy: user.uid,
            workspaceId: workspaceId || user.uid,
            title: p.title,
            type: "task",
            why: p.selectedForAction ? "Daily Clarity Reset - prioritized pendiente" : "Daily Clarity Reset - deferred brain dump item",
            action: p.selectedForAction ? "Execute prioritized day-to-day task" : "Process deferred task",
            confidence: "high",
            proposed: {
              priority: "P1", // all brain dump items are P1
              dueDate: p.dueDate || "",
              projectId: p.projectId || "",
              stakeholderIds: p.stakeholderIds || [],
              timeSector: p.selectedForAction ? "Today" : "This Week"
            },
            source: `Daily Clarity Reset Session - ${new Date().toLocaleDateString()}`,
            sourceType: "clarity_reset",
            sourceId: sessionId,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Process DECISIONES
      for (const d of decisiones) {
        if (!d.isExistingEntity) {
          batchList.push({
            userId: user.uid,
            createdBy: user.uid,
            workspaceId: workspaceId || user.uid,
            title: d.title,
            type: "decision",
            why: d.selectedForAction ? "Daily Clarity Reset - prioritized decision" : "Daily Clarity Reset - deferred decision",
            action: d.selectedForAction ? "Resolve this decision today to free mental space" : "Process deferred decision",
            confidence: "high",
            proposed: {
              timeSector: d.selectedForAction ? "Today" : "This Week"
            },
            source: `Daily Clarity Reset Session - ${new Date().toLocaleDateString()}`,
            sourceType: "clarity_reset",
            sourceId: sessionId,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Process IDEAS
      for (const i of ideas) {
        if (!i.isExistingEntity) {
          batchList.push({
            userId: user.uid,
            createdBy: user.uid,
            workspaceId: workspaceId || user.uid,
            title: i.title,
            type: "someday",
            why: i.selectedForAction ? "Daily Clarity Reset - protected creative idea" : "Daily Clarity Reset - deferred idea",
            action: i.selectedForAction ? "Schedule and work on this creative priority" : "Process deferred idea",
            confidence: "high",
            proposed: i.selectedForAction ? { 
              timeSector: "Today", 
              calendarBlock: i.suggestedCalendarBlock || ""
            } : { timeSector: "This Week" },
            source: `Daily Clarity Reset Session - ${new Date().toLocaleDateString()}`,
            sourceType: "clarity_reset",
            sourceId: sessionId,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Add actual documents
      for (const candidate of batchList) {
        await addDoc(collection(db, "review_candidates"), candidate);
      }

      // 2. Mark Session Completed
      await updateDoc(doc(db, "mental_clarity_sessions", sessionId), {
        status: "completed",
        completedAt: serverTimestamp(),
        durationSeconds: elapsed,
        reflection: successMsg || aiSuggestions?.reflection || "Mental space reorganized successfully."
      });

      // 3. Increment reset completion stats in analytics
      // 4. Complete Linked Habit check off if preferred
      if (preferences?.habitLinked) {
        // Query user's habits for mental clarity habits
        const qHabit = query(
          collection(db, "habits"), 
          where("userId", "==", user.uid), 
          where("status", "==", "active")
        );
        const habitsSnap = await getDocs(qHabit);
        let mentalHabit = habitsSnap.docs.find(d => {
          const t = d.data().title?.toLowerCase() || '';
          return t.includes("clarity") || t.includes("reset") || t.includes("priorities");
        });

        const todayStr = new Date().toISOString().split('T')[0];

        if (mentalHabit) {
          await logHabit(user.uid, workspaceId || user.uid, mentalHabit.id, todayStr, 'done');
        } else {
          // Auto create Daily Clarity Reset habit so they have it registered!
          const newHabit = {
            userId: user.uid,
            workspaceId: workspaceId || user.uid,
            title: "Daily Clarity Reset",
            description: "10-minute morning mental dump and organization ritual.",
            type: "system",
            status: "active",
            cadenceType: "daily",
            startDate: todayStr,
            minimumVersion: "Dumping 3 items onto Dejar Ir list to release stress",
            idealVersion: "Complete standard 10-Min Clarity Reset and priorize daily core work",
            difficulty: "easy",
            identityStatement: "I am a disciplined and focused deep organizer of my mind.",
            color: "#1e293b",
            icon: "Brain",
            priority: 1,
            calendarVisible: false,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          const habitRef = await addDoc(collection(db, "habits"), newHabit);
          await logHabit(user.uid, workspaceId || user.uid, habitRef.id, todayStr, 'done');
          
          // Save link preferences
          await updateDoc(doc(db, "daily_clarity_preferences", preferences.id), {
            habitId: habitRef.id,
            habitLinked: true
          });
        }
      }

      setStep(5);
    } catch (err: any) {
      console.error(err);
      setErrorString("Could not complete the reset.");
    } finally {
      setLoading(false);
    }
  };

  // Close draft option
  const handleSaveAsDraftAndClose = async () => {
    await saveDuration();
    onClose();
  };

  // Focus trigger (calls page custom action or window hook)
  const handleStartFocus = () => {
    onClose();
    // Dispatch general focus event listener to let sidebar / today page start FocusMode
    window.dispatchEvent(new CustomEvent('open-focus-mode'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FAF9F5] rounded-3xl w-full max-w-4xl shadow-2xl border border-amber-100 flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
        
        {/* Left Side: Dynamic Timer, instructions & strategic notes */}
        <div className="bg-[#1c1d1a] text-amber-50 p-6 md:w-80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-widest block text-amber-400">CERTO WORK</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Mental Strategy</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#242621] p-5 rounded-2xl border border-white/5 flex flex-col items-center text-center">
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Time Bandwidth</span>
                <div className="text-4xl font-black font-mono tracking-tight text-amber-400 mb-3">
                  {formatTime(timeLeft)}
                </div>
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => setTimerRunning(!timerRunning)} 
                    className="flex-1 bg-white hover:bg-neutral-200 text-black py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                    {timerRunning ? "Pause" : "Start"}
                  </button>
                  <button 
                    onClick={() => { setTimeLeft(600); setTimerRunning(false); }}
                    className="px-3 border border-white/10 hover:bg-white/5 text-amber-100 rounded-xl transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Strategic Quote matches step */}
              <div className="p-4 bg-white/5 rounded-2xl text-xs text-gray-400 leading-relaxed border border-white/5">
                {step === 1 && "Dumping everything in your head reduces cortisol and decision fatigue. Prepare to let go of the noise."}
                {step === 2 && "Write down everything freely. Do not filter your thoughts; empty out everything currently occupying your mind's RAM."}
                {step === 3 && (
                  <div className="space-y-2">
                    <p className="font-semibold text-amber-400">Certo Work System Rules:</p>
                    <p>• Max 3 **Pending** (Core Work).</p>
                    <p>• Exactly 1 **Decision** (to free mental fatigue).</p>
                    <p>• Exactly 1 **Idea** (to schedule today).</p>
                  </div>
                )}
                {step === 4 && "Selected items will be sent to your Review Pipeline before integration as live tasks or items."}
                {step === 5 && "Priorities filtered. Noise released. You have protected your focus today. Ready to deliver?"}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/5 pt-4 text-[10px] text-gray-500 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span>Auto-show daily:</span>
              <button 
                onClick={() => handleToggleAutoShow(!preferences?.autoShowEnabled)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${preferences?.autoShowEnabled ? 'bg-amber-500/10 text-amber-400' : 'bg-neutral-800 text-gray-600'}`}
              >
                {preferences?.autoShowEnabled ? "ENABLED" : "DISABLED"}
              </button>
            </div>
            <div>Completing logs automatically checks off the connected habit.</div>
          </div>
        </div>

        {/* Right Side: The actual flow steps */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          
          {/* Header row */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 group">
                {step === 1 && "Start Your Day"}
                {step === 2 && "Brain Dump Triage"}
                {step === 3 && "Prioritization Matrix"}
                {step === 4 && "Review Candidate Pipeline"}
                {step === 5 && "High Performance Alignment"}
              </h2>
              <p className="text-xs text-gray-400">
                {step === 1 && "Give yourself 10 minutes to declutter and select your Core Work."}
                {step === 2 && "Type and extract mental items directly. Let nothing escape."}
                {step === 3 && "Select only what matters most today. Do not solve; choose."}
                {step === 4 && "Confirm GTD review destinations before sending off."}
                {step === 5 && "Your mind is clear. Let's attack the day."}
              </p>
            </div>

            <button 
              onClick={handleSaveAsDraftAndClose} 
              className="p-1 rounded-full hover:bg-neutral-200 transition-colors text-neutral-400 hover:text-neutral-900"
              title="Save draft and close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Step Content */}
          <div className="flex-1 mb-6">
            
            {/* Error notifications */}
            {errorString && (
              <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs mb-4 flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorString}</span>
              </div>
            )}

            {/* Step 1 Content: Intro Panel */}
            {step === 1 && (
              <div className="space-y-6 text-center py-8">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto text-amber-800 shadow-inner">
                    <Brain className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-black text-neutral-800">10-Minute Mental Clarity Ritual</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    "Do not overload your mind holding tasks. Write them down, make 1 single tough decision, protect 1 inspiring idea, and cross out what you cannot control."
                  </p>
                  
                  <div className="flex flex-col gap-2 pt-4">
                    <button 
                      onClick={() => { setStep(2); setTimerRunning(true); saveDuration(); }} 
                      className="bg-black text-white hover:bg-neutral-800 py-3 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      Start Clarity Reset
                    </button>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button 
                        onClick={handleSkipToday}
                        className="border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 transition-colors"
                      >
                        Skip today
                      </button>
                      <button 
                        onClick={handleRemindLater}
                        className="border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 transition-colors"
                      >
                        Remind me later
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Content: Section inputs and list management */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Horizontal tabs */}
                <div className="flex border-b border-neutral-200 overflow-x-auto no-scrollbar gap-1">
                  <button 
                    onClick={() => setActiveTab("pendientes")}
                    className={`pb-3 px-4 font-bold text-xs tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5 border-b-2 ${activeTab === 'pendientes' ? 'text-black border-black' : 'text-neutral-400 border-transparent hover:text-neutral-700'}`}
                  >
                    1. Pending ({pendientes.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab("decisiones")}
                    className={`pb-3 px-4 font-bold text-xs tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5 border-b-2 ${activeTab === 'decisiones' ? 'text-black border-black' : 'text-neutral-400 border-transparent hover:text-neutral-700'}`}
                  >
                    2. Decisions ({decisiones.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab("ideas")}
                    className={`pb-3 px-4 font-bold text-xs tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5 border-b-2 ${activeTab === 'ideas' ? 'text-black border-black' : 'text-neutral-400 border-transparent hover:text-neutral-700'}`}
                  >
                    3. Ideas ({ideas.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab("dejarIr")}
                    className={`pb-3 px-4 font-bold text-xs tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5 border-b-2 ${activeTab === 'dejarIr' ? 'text-black border-black' : 'text-neutral-400 border-transparent hover:text-neutral-700'}`}
                  >
                    4. Let Go ({dejarIr.length})
                  </button>
                </div>

                {/* Info block for selected section */}
                <div className="p-4 bg-white/60 border border-neutral-200/50 rounded-2xl text-xs text-neutral-600">
                  {activeTab === "pendientes" && "• PENDING: Commitments, tasks, actions, or outstanding items. Write down everything waiting to be solved."}
                  {activeTab === "decisiones" && "• DECISIONS: Things waiting for a decision that consume mental energy ('Should I buy Carlos's PC?', 'Should I cancel the subscription?')."}
                  {activeTab === "ideas" && "• IDEAS: Creative thoughts or personal aspirations that excite you but don't fit as tasks ('Learn Scala', 'Logo Design')."}
                  {activeTab === "dejarIr" && "• LET GO: Concerns, annoyances, trivial things, or things outside your control that you choose to cross out and release today."}
                </div>

                {/* Input block */}
                {activeTab === "pendientes" ? (
                  <div className="space-y-3">
                    {/* Filter and control toggles for search */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200/60">
                      <span className="font-medium text-neutral-600 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        Automated GTD Tasks Search:
                      </span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-700 select-none">
                          <input
                            type="checkbox"
                            checked={includeCompleted}
                            onChange={e => setIncludeCompleted(e.target.checked)}
                            className="rounded text-black focus:ring-0 focus:outline-none"
                          />
                          <span>Completed</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-700 select-none">
                          <input
                            type="checkbox"
                            checked={includeArchived}
                            onChange={e => setIncludeArchived(e.target.checked)}
                            className="rounded text-black focus:ring-0 focus:outline-none"
                          />
                          <span>Archived</span>
                        </label>
                      </div>
                    </div>

                    {/* Input search box */}
                    <form onSubmit={handleAddItem} className="relative flex gap-2 w-full">
                      <input
                        type="text"
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        placeholder="Type a pending task… search existing tasks or create new"
                        className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 shadow-sm"
                      />
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-black hover:bg-neutral-800 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 shrink-0"
                      >
                        <Plus className="w-4 h-4" /> Add New
                      </button>
                    </form>

                    {/* Duplicate Warning Alert */}
                    {duplicateWarningTask && (
                      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3 animate-fade-in text-xs text-amber-800">
                        <div className="flex gap-2.5 items-start">
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-extrabold text-amber-900">Possible Existing Task Found!</p>
                            <p className="mt-1 text-amber-700">
                              A task with the title <strong className="font-bold underline">"{duplicateWarningTask.title}"</strong> is already in your dashboard.
                              To maintain focus and avoid duplicate bloat, please select or link this existing task.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              handleLinkExistingTask(duplicateWarningTask);
                              setInputVal("");
                              setDuplicateWarningTask(null);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Link Existing Task instead
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAddItem(e, true)}
                            className="bg-transparent hover:bg-amber-100 text-amber-800 border border-amber-300 font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Create Duplicate Anyway
                          </button>
                          <button
                            type="button"
                            onClick={() => setDuplicateWarningTask(null)}
                            className="bg-transparent hover:bg-amber-100/50 text-neutral-600 font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Auto-complete Search Results Overlay Option */}
                    {inputVal.trim().length >= 2 && (
                      <div className="bg-white border border-neutral-200 rounded-2xl p-3 shadow-md space-y-3 max-h-[250px] overflow-y-auto w-full z-10 animate-fade-in text-left">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 border-b border-neutral-100 pb-1.5 flex justify-between items-center">
                          <span>Real-time Search Results</span>
                          {searchLoading && <span className="animate-spin h-3.5 w-3.5 border-2 border-neutral-500 border-t-transparent rounded-full" />}
                        </div>

                        {searchError && (
                          <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{searchError}</span>
                          </div>
                        )}

                        {!searchLoading && searchResults.length === 0 && reviewResults.length === 0 && (
                          <div className="text-center py-6 text-xs text-neutral-400 space-y-2">
                            <p>No matching active tasks found.</p>
                            <button
                              type="button"
                              onClick={(e) => handleAddItem(e)}
                              className="text-xs text-neutral-800 font-extrabold underline hover:text-black cursor-pointer"
                            >
                              Create new pending item: "{inputVal}"
                            </button>
                          </div>
                        )}

                        {/* Existing Tasks Results */}
                        {searchResults.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[10px] font-extrabold text-neutral-500 tracking-wide uppercase px-1">Tasks ({searchResults.length})</h5>
                            <div className="grid grid-cols-1 gap-1.5">
                              {searchResults.slice(0, 5).map(task => {
                                const isLinked = pendientes.some(p => p.linkedEntityId === task.id);
                                const projName = allProjects[task.projectId || ""] || "";
                                const catName = allCategories[task.categoryId || ""]?.name || "";
                                const catColor = allCategories[task.categoryId || ""]?.color || "";
                                return (
                                  <div
                                    key={task.id}
                                    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 rounded-xl border text-xs gap-2 transition-all ${isLinked ? 'bg-amber-50/50 border-amber-200' : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200/70'}`}
                                  >
                                    <div className="flex-1 min-w-0 space-y-1 text-left">
                                      <div className="font-semibold text-neutral-800 truncate flex items-center gap-1">
                                        <span>{task.title}</span>
                                        {task.status === "done" && (
                                          <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 rounded-full font-extrabold">Completed</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-400 font-medium">
                                        {projName && (
                                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">📂 {projName}</span>
                                        )}
                                        {catName && (
                                          <span 
                                            style={{ backgroundColor: `${catColor}15`, color: catColor || '#555' }}
                                            className="px-1.5 py-0.5 rounded-md font-bold"
                                          >
                                            🏷️ {catName}
                                          </span>
                                        )}
                                        {task.dueDate && (
                                          <span>📅 {task.dueDate}</span>
                                        )}
                                        {task.priority !== undefined && (
                                          <span className="text-amber-600 font-bold">⚡ P{task.priority}</span>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isLinked) {
                                          const foundItem = pendientes.find(p => p.linkedEntityId === task.id);
                                          if (foundItem) handleDeleteItem(foundItem.id, "pendientes");
                                        } else {
                                          handleLinkExistingTask(task);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shrink-0 ${isLinked ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200' : 'bg-black hover:bg-neutral-800 text-white'}`}
                                    >
                                      {isLinked ? 'Unlink' : 'Link Task'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Review Candidates Results */}
                        {reviewResults.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            <h5 className="text-[10px] font-extrabold text-neutral-500 tracking-wide uppercase px-1">Already in Review ({reviewResults.length})</h5>
                            <div className="grid grid-cols-1 gap-1.5">
                              {reviewResults.slice(0, 3).map(rev => (
                                <div
                                  key={rev.id}
                                  className="flex justify-between items-center p-2.5 rounded-xl border bg-indigo-50/30 border-indigo-100 text-xs text-left"
                                >
                                  <div>
                                    <div className="font-semibold text-neutral-800 truncate">{rev.title}</div>
                                    <div className="text-[10px] text-indigo-500 font-bold mt-0.5">Status: Already in Review Stack ({rev.status || "pending"})</div>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-1 rounded-md shrink-0">Linked via Review</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleAddItem} className="flex gap-2">
                    <input
                      type="text"
                      value={inputVal}
                      onChange={e => setInputVal(e.target.value)}
                      placeholder={
                        activeTab === "decisiones" ? "Type a key decision..." :
                        activeTab === "ideas" ? "Write down an exciting idea..." :
                        "Write down something you are letting go of today..."
                      }
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 shadow-sm"
                    />
                    <button 
                      type="submit" 
                      className="bg-black hover:bg-neutral-800 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 shrink-0"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>
                )}

                {/* List container */}
                <div className="bg-white border border-neutral-200 rounded-3xl p-4 min-h-[160px] max-h-[220px] overflow-y-auto space-y-2">
                  {activeTab === "pendientes" && pendientes.length === 0 && (
                    <div className="text-center py-8 text-xs text-neutral-400">Capture loose ends in your mind. List is empty.</div>
                  )}
                  {activeTab === "decisiones" && decisiones.length === 0 && (
                    <div className="text-center py-8 text-xs text-neutral-400">Close a door that drains your energy. No decisions recorded.</div>
                  )}
                  {activeTab === "ideas" && ideas.length === 0 && (
                    <div className="text-center py-8 text-xs text-neutral-400">Protect an idea that motivates you. List is empty.</div>
                  )}
                  {activeTab === "dejarIr" && dejarIr.length === 0 && (
                    <div className="text-center py-8 text-xs text-neutral-400">Cross out unnecessary noise. Release yourself.</div>
                  )}

                  {/* Render current list */}
                  {activeTab === "pendientes" && pendientes.map(item => renderListItem(item, "pendientes"))}
                  {activeTab === "decisiones" && decisiones.map(item => renderListItem(item, "decisiones"))}
                  {activeTab === "ideas" && ideas.map(item => renderListItem(item, "ideas"))}
                  {activeTab === "dejarIr" && dejarIr.map(item => renderListItem(item, "dejarIr"))}
                </div>
              </div>
            )}

            {/* Step 3 Content: Priorities Matrix (Choose) */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-amber-50 p-3.5 rounded-2xl border border-amber-200/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800">Certo Work Strategy Priority Matrix</h4>
                      <p className="text-[10px] text-neutral-500">Select maximum 3 tasks, exactly 1 Decision, and exactly 1 Idea. The rest will be deferred.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAiPrioritization}
                    disabled={aiLoading}
                    className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0"
                  >
                    {aiLoading ? <RefreshCw className="w-3" /> : <Sparkles className="w-3" />}
                    {aiLoading ? "Evaluating..." : "Help me prioritize"}
                  </button>
                </div>

                {successMsg && (
                  <div className="bg-[#FAF9F5] p-3 text-xs text-emerald-800 italic font-medium rounded-xl border border-emerald-100/50 flex gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>Reflection: "{successMsg}"</span>
                  </div>
                )}

                {/* 2x2 Grid Selection Panels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[30vh] overflow-y-auto">
                  
                  {/* Pendientes Chooser */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-500">1. Pending (Max 3)</h4>
                      <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded-md font-bold text-neutral-700">
                        {pendientes.filter(p => p.selectedForAction).length}/3
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                      {pendientes.length === 0 && <span className="text-[10px] text-gray-400 block italic">No captured candidates.</span>}
                      {pendientes.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => toggleActionSelect(p.id, "pendientes")}
                          className={`p-2 rounded-xl text-xs cursor-pointer border flex justify-between items-center transition-all ${p.selectedForAction ? 'bg-black text-white border-black shadow-sm' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border-neutral-200'}`}
                        >
                          <span className="truncate pr-2 font-medium">{p.title}</span>
                          {p.selectedForAction ? <Check className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 border border-gray-300 rounded-md shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Decisiones Chooser */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-500">2. Decisions (Choose 1)</h4>
                      {decisiones.find(d => d.selectedForAction) && <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />}
                    </div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                      {decisiones.length === 0 && <span className="text-[10px] text-gray-400 block italic">No captured candidates.</span>}
                      {decisiones.map(d => (
                        <div 
                          key={d.id}
                          onClick={() => toggleActionSelect(d.id, "decision")}
                          className={`p-2 rounded-xl text-xs cursor-pointer border flex justify-between items-center transition-all ${(d as any).selectedForAction ? 'bg-black text-white border-black shadow-sm' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border-neutral-200'}`}
                        >
                          <span className="truncate pr-2 font-medium">{d.title}</span>
                          {(d as any).selectedForAction ? <Check className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 border border-gray-300 rounded-md shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ideas Chooser */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-500">3. Ideas (Choose 1)</h4>
                      {ideas.find(i => i.selectedForAction) && <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />}
                    </div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                      {ideas.length === 0 && <span className="text-[10px] text-gray-400 block italic">No captured candidates.</span>}
                      {ideas.map(i => (
                        <div 
                          key={i.id}
                          onClick={() => toggleActionSelect(i.id, "idea")}
                          className={`p-2 rounded-xl text-xs cursor-pointer border flex justify-between items-center transition-all ${(i as any).selectedForAction ? 'bg-black text-white border-black shadow-sm' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border-neutral-200'}`}
                        >
                          <span className="truncate pr-2 font-medium">{i.title}</span>
                          {(i as any).selectedForAction ? <Check className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 border border-gray-300 rounded-md shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dejar Ir List (Visual Cross Out) */}
                  <div className="bg-neutral-100/70 p-4 rounded-xl border border-neutral-200 space-y-2">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-400">4. Let Go (Crossed Out / Released)</h4>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                      {dejarIr.length === 0 && <span className="text-[10px] text-gray-400 block italic">No captured candidates.</span>}
                      {dejarIr.map(dj => (
                        <div 
                          key={dj.id}
                          className="p-2 rounded-xl text-xs bg-neutral-200/50 border border-neutral-300/30 text-gray-400 line-through select-none"
                        >
                          {dj.title}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Step 4 Content: Preview Candidate list pipeline mapping */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl flex flex-col gap-3">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Verify Final Destination</span>
                  
                  <div className="space-y-2">
                    
                    {/* Tasks candidate */}
                    <div>
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-blue-500 mb-1">To GTD Tasks Candidates:</div>
                      {pendientes.filter(p => p.selectedForAction).length === 0 ? (
                        <span className="text-xs text-neutral-400 italic">Core activities deferred.</span>
                      ) : (
                        pendientes.filter(p => p.selectedForAction).map(item => (
                          <div key={item.id} className="p-2 bg-blue-50/50 border border-blue-100 rounded-xl text-neutral-700 text-xs font-semibold flex justify-between items-center mb-1">
                            <span>{item.title}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-black">Tasks</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Decisions candidate */}
                    <div className="pt-2">
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-purple-500 mb-1">To Decisions Candidates:</div>
                      {decisiones.find(d => d.selectedForAction) ? (
                        <div className="p-2 bg-purple-50/50 border border-purple-100 rounded-xl text-neutral-700 text-xs font-semibold flex justify-between items-center">
                          <span>{decisiones.find(d => d.selectedForAction)?.title}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-black">Decisions</span>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">No decisions focused today.</span>
                      )}
                    </div>

                    {/* Ideas candidate */}
                    <div className="pt-2">
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-teal-500 mb-1">To Ideas / Someday Candidates:</div>
                      {ideas.find(i => i.selectedForAction) ? (
                        <div className="p-2 bg-teal-50/50 border border-teal-100 rounded-xl text-neutral-700 text-xs font-semibold flex justify-between flex-wrap gap-2 items-center">
                          <span>{ideas.find(i => i.selectedForAction)?.title}</span>
                          <div className="flex gap-1.5 shrink-0">
                            {ideas.find(i => i.selectedForAction)?.suggestedCalendarBlock && (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-black flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" /> Book: {ideas.find(i => i.selectedForAction)?.suggestedCalendarBlock}
                              </span>
                            )}
                            <span className="text-[9px] uppercase px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded font-black">Someday</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">No creative ideas scheduled.</span>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* Step 5 Content: Completion Screen */}
            {step === 5 && (
              <div className="space-y-6 text-center py-6">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 bg-neutral-900 border border-amber-400/20 rounded-full flex items-center justify-center mx-auto text-amber-400 shadow-md">
                    <CheckCircle2 className="w-10 h-10 text-amber-400" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-neutral-800">Reset Complete</h3>
                    <p className="text-xs text-amber-600 font-extrabold uppercase tracking-widest">Your mind is lighter & sharper</p>
                  </div>

                  <p className="text-sm text-neutral-500 max-w-sm mx-auto">
                    Everything captured is in Review. The clutter has been released. Your habits log is verified. Let's attack core focus blocks.
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-white border border-neutral-150 p-4 rounded-2xl text-left shadow-sm">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Reset Summary:</span>
                      <span className="text-sm font-bold text-neutral-800">
                        {pendientes.length + decisiones.length + ideas.length + dejarIr.length} captured items
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Review Targets:</span>
                      <span className="text-sm font-bold text-neutral-800">
                        {pendientes.filter(p => p.selectedForAction).length + (decisiones.find(d => d.selectedForAction) ? 1 : 0) + (ideas.find(i => i.selectedForAction) ? 1 : 0)} candidates
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button 
                      onClick={handleStartFocus}
                      className="bg-black hover:bg-neutral-800 text-white font-extrabold text-sm py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <TimerIcon className="w-4 h-4 animate-pulse text-amber-400" /> Start Focus Mode
                    </button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { onClose(); window.location.href = '/review'; }}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs py-2.5 rounded-xl border border-neutral-200/50 transition-colors"
                      >
                        Open Review Stack
                      </button>
                      <button 
                        onClick={() => { onClose(); window.location.href = '/work/tasks'; }}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs py-2.5 rounded-xl border border-neutral-200/50 transition-colors"
                      >
                        Return to Action Board
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* Bottom Dialog Navigation Buttons */}
          {step < 5 && (
            <div className="flex justify-between items-center border-t border-neutral-200 pt-4 mt-auto">
              <div>
                {step > 1 && (
                  <button 
                    onClick={() => setStep(prev => prev - 1)}
                    className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-black font-semibold bg-neutral-100 hover:bg-neutral-200 p-2 px-3.5 rounded-xl transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {step === 2 && (
                  <button 
                    onClick={async () => { await saveDuration(); setStep(3); }}
                    className="flex items-center gap-1 text-xs bg-black text-white hover:bg-neutral-800 font-extrabold p-2 px-4 rounded-xl transition-all shadow-sm"
                  >
                    Go to Prioritization <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {step === 3 && (
                  <button 
                    onClick={() => setStep(4)}
                    className="flex items-center gap-1 text-xs bg-black text-white hover:bg-neutral-800 font-extrabold p-2 px-4 rounded-xl transition-all shadow-sm"
                  >
                    View Preview <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {step === 4 && (
                  <button 
                    onClick={handleFinalizeReset}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs bg-black text-white hover:bg-[#2e7d32] hover:shadow-emerald-100 font-extrabold p-2 px-5 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-emerald-400" />}
                    Send to Review & Complete Reset
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );

  // Render inline custom items in Brain Dump Lists
  function renderListItem(item: any, type: typeof activeTab) {
    const isEditing = editingItemId === item.id;
    if (type === "pendientes" && item.isExistingEntity) {
      const projName = allProjects[item.projectId || ""] || "";
      return (
        <div 
          key={item.id} 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-amber-50/20 border border-amber-200/50 rounded-2xl max-w-full text-xs hover:border-amber-300 transition-colors text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-neutral-800 truncate max-w-[200px] sm:max-w-xs">{item.title}</span>
              <span className="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded-full font-bold">Linked Task</span>
              {projName && (
                <span className="bg-neutral-100 text-neutral-600 text-[9px] px-1.5 py-0.5 rounded-md font-bold">📂 {projName}</span>
              )}
            </div>
            {item.linkedEntityId && (
              <span className="text-[10px] text-neutral-400 block mt-0.5">ID: {item.linkedEntityId}</span>
            )}
          </div>

          <div className="flex gap-2 self-end sm:self-auto shrink-0 items-center">
            <a
              href={`/tasks?id=${item.linkedEntityId}`}
              className="text-[11px] font-extrabold text-neutral-600 hover:text-black bg-white hover:bg-neutral-100 border border-neutral-200 px-2 py-1 rounded-lg transition-colors inline-flex items-center gap-0.5"
              title="Open task details"
            >
              Open task
            </a>

            <button 
              onClick={() => handleDeleteItem(item.id, "pendientes")}
              className="p-1 px-2 border border-red-200/40 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-[10px] font-bold cursor-pointer"
              title="Remove from clarity reset list"
            >
              Remove
            </button>
          </div>
        </div>
      );
    }

    if (type === "pendientes") {
      return (
        <div 
          key={item.id} 
          className="flex flex-col gap-3 p-3.5 bg-white border border-neutral-200 rounded-2xl max-w-full text-xs hover:border-neutral-300 transition-shadow hover:shadow-sm text-left"
        >
          <div className="flex justify-between items-center gap-2">
            {isEditing ? (
              <input
                type="text"
                value={editingText}
                onChange={e => setEditingText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item.id, type); }}
                autoFocus
                className="flex-1 px-2.5 py-1 border border-neutral-300 rounded-xl bg-[#FAF9F5] text-xs text-neutral-800 focus:outline-none"
              />
            ) : (
              <span className="flex-1 text-neutral-800 font-bold leading-tight select-none">
                {item.title}
              </span>
            )}

            <div className="flex gap-1 shrink-0">
              {isEditing ? (
                <button 
                  onClick={() => handleSaveEdit(item.id, type)}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                  title="Save"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button 
                  onClick={() => startEditItem(item.id, item.title)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button 
                onClick={() => handleDeleteItem(item.id, type)}
                className="p-1 text-neutral-400 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-neutral-100">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-neutral-400 block pb-0.5">Work On</label>
              <select
                value={item.projectId || ""}
                onChange={(e) => handleUpdateItemField(item.id, "projectId", e.target.value)}
                className="w-full text-[11px] bg-[#FAF9F5] border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-black font-semibold text-neutral-700 cursor-pointer"
              >
                <option value="">Select Project...</option>
                {Object.entries(allProjects).map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-neutral-400 block pb-0.5">Due Date</label>
              <input
                type="date"
                value={item.dueDate && /^\d{4}-\d{2}-\d{2}/.test(item.dueDate) ? item.dueDate.substring(0, 10) : ""}
                onChange={(e) => handleUpdateItemField(item.id, "dueDate", e.target.value)}
                className="w-full text-[11px] bg-[#FAF9F5] border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:border-black font-semibold text-neutral-700 cursor-pointer select-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-neutral-400 block pb-0.5">Stakeholder</label>
              <select
                value={item.stakeholderIds?.[0] || ""}
                onChange={(e) => handleUpdateItemField(item.id, "stakeholderIds", e.target.value ? [e.target.value] : [])}
                className="w-full text-[11px] bg-[#FAF9F5] border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-black font-semibold text-neutral-700 cursor-pointer"
              >
                <option value="">Select Stakeholder...</option>
                {stakeholders.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        key={item.id} 
        className="flex items-center justify-between gap-3 p-2 bg-[#FAF9F5] border border-neutral-150 rounded-xl max-w-full text-xs hover:border-neutral-300 transition-colors"
      >
        {isEditing ? (
          <input
            type="text"
            value={editingText}
            onChange={e => setEditingText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item.id, type); }}
            autoFocus
            className="flex-1 px-2 py-0.5 border border-amber-300 rounded bg-white text-xs text-neutral-800"
          />
        ) : (
          <span className="flex-1 text-neutral-700 font-semibold truncate select-none">
            {item.title}
          </span>
        )}

        <div className="flex gap-1 shrink-0">
          {isEditing ? (
            <button 
              onClick={() => handleSaveEdit(item.id, type)}
              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button 
              onClick={() => startEditItem(item.id, item.title)}
              className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded transition-colors"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button 
            onClick={() => handleDeleteItem(item.id, type)}
            className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
}
