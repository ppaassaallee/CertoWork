import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { Task, RecurrenceStatus } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, Play, Pause, Square, Calendar, CheckCircle2, ChevronRight, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

export function RoutineTasksView() {
  const { user, workspace } = useAuth();
  const [routines, setRoutines] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !workspace) return;

    const q = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("isRoutineTask", "==", true)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: Task[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Task));
      
      // We only want to show the current/series overview? 
      // The prompt says "Routine Tasks view/section". 
      // Usually these systems show each series once.
      // I'll group by recurringSeriesId and show the latest active one or just the template if we had one.
      // Since we create a new task for each occurrence, I'll filter to the one that is NOT completed
      // and represents the next occurrence for that series.
      
      const seriesMap = new Map<string, Task>();
      items.forEach(task => {
        const sid = task.recurringSeriesId || task.id;
        const existing = seriesMap.get(sid);
        
        // Prefer the open one. If multiple open (shouldn't happen), prefer the one with furthest nextOccurrenceAt
        if (!existing || (task.status === 'open' && existing.status === 'done')) {
          seriesMap.set(sid, task);
        } else if (task.status === existing.status) {
           const dTask = new Date(task.occurrenceDate || 0);
           const dExisting = new Date(existing.occurrenceDate || 0);
           if (dTask > dExisting) seriesMap.set(sid, task);
        }
      });

      setRoutines(Array.from(seriesMap.values()).sort((a, b) => a.title.localeCompare(b.title)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "tasks (routines)"));

    return unsub;
  }, [user, workspace]);

  const handleUpdateStatus = async (task: Task, status: RecurrenceStatus) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        recurrenceStatus: status,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleStop = async (task: Task) => {
    if (!confirm("Are you sure you want to stop this routine? Future occurrences will not be created.")) return;
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        recurrenceStatus: 'ended',
        isRoutineTask: false, // effectively stop it
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const getCadenceLabel = (task: Task) => {
    if (task.recurrenceType === 'daily') return "Daily";
    if (task.recurrenceType === 'workdays') return "Workdays";
    if (task.recurrenceType === 'weekly') return "Weekly";
    if (task.recurrenceType === 'monthly') return "Monthly";
    if (task.recurrenceType === 'quarterly') return "Quarterly";
    if (task.recurrenceType === 'custom') return `Every ${task.recurrenceInterval} ${task.recurrenceUnit}`;
    return task.recurrence || "None";
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading routines...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Link to="/work/tasks" className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Routine Tasks</h1>
          <p className="text-gray-500 text-sm">Mathematically scheduled recurring execution</p>
        </div>
      </header>

      {routines.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100">
           <RefreshCw className="w-12 h-12 text-gray-200 mx-auto mb-4" />
           <p className="text-gray-500 font-medium">No routine tasks found.</p>
           <p className="text-gray-400 text-sm mt-1">Add cadence to any task to make it a routine.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {routines.map((routine) => (
              <motion.div
                key={routine.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-indigo-200 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{routine.title}</h3>
                      {routine.recurrenceStatus === 'paused' && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                          <Pause className="w-2.5 h-2.5" /> Paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-indigo-500" /> {getCadenceLabel(routine)}</span>
                      {routine.nextOccurrenceAt && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Next: {routine.nextOccurrenceAt}</span>
                      )}
                      {routine.occurrenceDate && (
                        <span className="flex items-center gap-1 text-indigo-600 font-medium"><CheckCircle2 className="w-3 h-3" /> Current: {routine.occurrenceDate}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {routine.recurrenceStatus === 'paused' ? (
                      <button 
                        onClick={() => handleUpdateStatus(routine, 'active')}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Resume Routine"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    ) : (
                      <button 
                         onClick={() => handleUpdateStatus(routine, 'paused')}
                         className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                         title="Pause Routine"
                      >
                         <Pause className="w-4 h-4 fill-current" />
                      </button>
                    )}
                    <button 
                       onClick={() => handleStop(routine)}
                       className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                       title="Stop Routine"
                    >
                       <Square className="w-4 h-4 fill-current" />
                    </button>
                    <Link 
                       to={`/work/tasks/${routine.id}`}
                       className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all"
                    >
                       <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
