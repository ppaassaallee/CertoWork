import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, X, CheckSquare, Target } from 'lucide-react';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface FocusModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTaskIds: string[];
  tasks: any[];
}

export function FocusModeModal({ isOpen, onClose, selectedTaskIds, tasks }: FocusModeModalProps) {
  const { user, workspace } = useAuth();
  const [elapsed, setElapsed] = useState(0); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  
  // List of tasks matching selected
  const focusedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (isOpen) {
      if (elapsed === 0 && !isRunning) {
        setIsRunning(true);
        setSessionStartTime(Date.now());
      }
    } else {
      setIsRunning(false);
      setElapsed(0);
    }
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    
    if (h > 0) {
      const hh = h.toString().padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const handleMarkDone = async (taskId: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), { 
        status: 'done', 
        stageId: 'done',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleFinish = async () => {
    if (!user || !workspace || elapsed < 10) { // Don't log sessions shorter than 10s
      onClose();
      return;
    }

    try {
      await addDoc(collection(db, "focus_sessions"), {
        userId: user.uid,
        workspaceId: workspace.id,
        taskIds: selectedTaskIds,
        duration: elapsed,
        startedAt: sessionStartTime ? new Date(sessionStartTime).toISOString() : new Date().toISOString(),
        endedAt: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (err) {
      console.error("Failed to log focus session", err);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-auto overflow-hidden flex flex-col md:flex-row"
        >
          {/* Left panel - Timer */}
          <div className="bg-indigo-900 text-white p-8 md:w-1/2 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-800 flex items-center justify-center mb-6">
               <Target className="w-8 h-8 text-indigo-300" />
            </div>
            <h2 className="text-xl font-medium text-indigo-200 mb-2">Focus Session</h2>
            <div className="text-6xl font-black tracking-tight font-mono mb-8 tabular-nums">
               {formatTime(elapsed)}
            </div>
            
            <div className="flex items-center gap-4">
               <button
                 onClick={() => setIsRunning(!isRunning)}
                 className="w-14 h-14 rounded-full bg-white text-indigo-900 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
               >
                 {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
               </button>
               <button
                 onClick={() => {
                   setIsRunning(false);
                   setElapsed(0);
                 }}
                 className="w-14 h-14 rounded-full bg-indigo-800 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
               >
                 <Square className="w-5 h-5 fill-current" />
               </button>
            </div>
          </div>
          
          {/* Right panel - Tasks */}
          <div className="p-8 md:w-1/2 bg-gray-50 flex flex-col h-full max-h-[80vh] overflow-y-auto">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Task{focusedTasks.length !== 1 ? 's' : ''}</h3>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
             </div>
             
             <div className="flex-1 flex flex-col gap-3">
                {focusedTasks.map(task => (
                   <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4 transition-all">
                      <button
                        onClick={() => handleMarkDone(task.id)}
                        className={`mt-0.5 shrink-0 ${task.status === 'done' ? 'text-emerald-500' : 'text-gray-300 hover:text-emerald-500'} transition-colors`}
                      >
                         <CheckSquare className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                         <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                           {task.title}
                         </p>
                      </div>
                   </div>
                ))}
             </div>
             
             <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                <button
                  onClick={handleFinish}
                  className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors w-full"
                >
                  Finish Session
                </button>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
