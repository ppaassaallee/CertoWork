import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle2, Zap, Dumbbell, Plus, X, Check, ShieldMinus, Ban } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import { logHabit, deleteHabitLog } from "../../lib/habits";

export function UnifiedCalendar() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'week' | 'agenda'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<string, any>>({});
  
  useEffect(() => {
    if (!user || !workspace) return;

    // Calculate range for query (current week +- a few days)
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - 7);
    const end = new Date(currentDate);
    end.setDate(currentDate.getDate() + 14);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const qTasks = query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("dueDate", ">=", startStr), where("dueDate", "<=", endStr));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data(), dataType: 'task' }));
        setTasks(list);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "tasks");
    });

    const qHabitLogs = query(collection(db, "habit_logs"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("date", ">=", startStr), where("date", "<=", endStr));
    const unsubHabitLogs = onSnapshot(qHabitLogs, (snap) => {
        const map: Record<string, any> = {};
        snap.forEach(d => {
            const data = d.data();
            map[`${data.habitId}_${data.date}`] = data;
        });
        setHabitLogs(map);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "habit_logs");
    });

    const qHabits = query(collection(db, "habits"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "active"));
    const unsubHabits = onSnapshot(qHabits, (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data(), dataType: 'habit' }));
        setHabits(list);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "habits");
    });

    const qWorkouts = query(collection(db, "workout_sessions"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("date", ">=", startStr), where("date", "<=", endStr));
    const unsubWorkouts = onSnapshot(qWorkouts, (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data(), dataType: 'workout' }));
        setWorkouts(list);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "workout_sessions");
    });

    return () => { unsubTasks(); unsubHabits(); unsubHabitLogs(); unsubWorkouts(); };
  }, [user, workspace, currentDate]);

  const days = [];
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday

  for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
  }

  const navigateWeek = (dir: number) => {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() + (dir * 7));
      setCurrentDate(next);
  };

  const handleHabitCalendarLog = async (habitId: string, dateStr: string, status: 'done' | 'partial' | 'skipped' | 'clear') => {
    if (!user || !workspace) return;
    try {
      if (status === 'clear') {
        await deleteHabitLog(habitId, dateStr);
      } else {
        await logHabit(user.uid, workspace.id, habitId, dateStr, status);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getItemsForDay = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      const items: any[] = [];

      // Tasks
      tasks.filter(t => t.dueDate === dateStr).forEach(t => items.push(t));

      // Workouts
      workouts.filter(w => w.date === dateStr).forEach(w => items.push(w));

      // Habits (Active for this day)
      const dayIdx = date.getDay();
      habits.forEach(h => {
          if (h.calendarVisible === false) return; // skip if hidden on calendar
          let due = false;
          if (h.cadenceType === 'daily') due = true;
          if (h.cadenceType === 'workdays' && dayIdx > 0 && dayIdx < 6) due = true;
          if (h.cadenceType === 'weekly' && h.daysOfWeek?.includes(dayIdx)) due = true;
          
          if (due) items.push({ ...h, date: dateStr, log: habitLogs[`${h.id}_${dateStr}`] });
      });

      return items.sort((a, b) => (a.priority || 5) - (b.priority || 5));
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
           <h1 className="text-2xl font-bold text-gray-900">Unified Calendar</h1>
           <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setView('week')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'week' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Week</button>
              <button onClick={() => setView('agenda')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'agenda' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Agenda</button>
              <button onClick={() => navigate('/work/timeblocks')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors">Time Blocks</button>
           </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
               <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
               <span className="text-sm font-bold min-w-[120px] text-center">{weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
               <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
            </div>
            <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold bg-white border border-gray-100 px-3 py-2 rounded-xl hover:bg-gray-50">Today</button>
        </div>
      </header>

      {view === 'week' ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 bg-gray-50/50 p-4 rounded-[2.5rem] border border-gray-100 min-h-[500px]">
             {days.map(day => {
                  const items = getItemsForDay(day);
                  const isToday = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                  
                  return (
                      <div key={day.toISOString()} className={`flex flex-col gap-2`}>
                         <div className={`text-center py-2 px-1 rounded-2xl mb-1 ${isToday ? 'bg-black text-white' : 'bg-white text-gray-400'}`}>
                            <div className="text-[10px] font-black uppercase opacity-70">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()]}</div>
                            <div className="text-sm font-bold">{day.getDate()}</div>
                         </div>
                         <div className="space-y-2 flex-1">
                            {items.map(item => (
                                <CalendarItem 
                                  key={`${item.dataType}_${item.id}_${item.date || ''}`} 
                                  item={item} 
                                  onHabitLog={handleHabitCalendarLog}
                                />
                            ))}
                            {items.length === 0 && <div className="h-20 border-2 border-dashed border-gray-100 rounded-2xl flex items-center justify-center">
                               <Plus className="w-4 h-4 text-gray-200" />
                            </div>}
                         </div>
                      </div>
                  );
              })}
          </div>
      ) : (
          <div className="space-y-4">
              {days.map(day => {
                   const items = getItemsForDay(day);
                   if (items.length === 0) return null;
                   return (
                       <div key={day.toISOString()} className="flex gap-6 p-2 group">
                           <div className="w-16 pt-2 shrink-0">
                                <div className="text-xs font-black text-gray-400 uppercase">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()]}</div>
                                <div className="text-xl font-bold">{day.getDate()}</div>
                           </div>
                           <div className="flex-1 space-y-3">
                               {items.map(item => {
                                  const isHabDone = item.log?.status === 'done';
                                  const isHabPartial = item.log?.status === 'partial';
                                  const isHabSkipped = item.log?.status === 'skipped';
                                  const isDone = item.status === 'done' || isHabDone || item.status === 'completed';

                                  return (
                                   <div key={`${item.dataType}_${item.id}_${item.date || ''}`} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                                       <div className="flex items-center gap-4">
                                           <div className={`p-2 rounded-lg 
                                               ${item.dataType === 'task' ? 'bg-gray-100' : 
                                                 item.dataType === 'habit' ? 'bg-indigo-50' : 
                                                 'bg-orange-50'}
                                           `}>
                                               {item.dataType === 'task' ? <CheckCircle2 className="w-4 h-4 text-gray-500" /> : 
                                                 item.dataType === 'habit' ? <Zap className="w-4 h-4 text-indigo-600" /> : 
                                                 <Dumbbell className="w-4 h-4 text-orange-600" />}
                                           </div>
                                           <div>
                                               <h4 className="font-bold text-gray-900">{item.title}</h4>
                                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.dataType}</p>
                                           </div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                           {item.dataType === 'habit' ? (
                                              <div className="flex gap-1">
                                                  <button 
                                                    onClick={() => handleHabitCalendarLog(item.id, item.date, 'done')} 
                                                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${isHabDone ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                  >
                                                    Done
                                                  </button>
                                                  <button 
                                                    onClick={() => handleHabitCalendarLog(item.id, item.date, 'partial')} 
                                                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${isHabPartial ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                  >
                                                    Partial
                                                  </button>
                                                  <button 
                                                    onClick={() => handleHabitCalendarLog(item.id, item.date, 'skipped')} 
                                                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${isHabSkipped ? 'bg-slate-300 text-slate-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                  >
                                                    Skip
                                                  </button>
                                                  {(isHabDone || isHabPartial || isHabSkipped) && (
                                                    <button 
                                                      onClick={() => handleHabitCalendarLog(item.id, item.date, 'clear')} 
                                                      className="p-1 text-gray-400 hover:text-rose-500"
                                                    >
                                                      <X className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                              </div>
                                           ) : (
                                              isDone ? (
                                                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Completed</span>
                                              ) : (
                                                  <span className="text-[10px] font-bold text-gray-400 px-2 py-1 bg-gray-50 rounded-full border border-gray-100 uppercase">Pending</span>
                                              )
                                           )}
                                       </div>
                                   </div>
                                  );
                               })}
                           </div>
                       </div>
                   );
              })}
          </div>
      )}
    </div>
  );
}

function CalendarItem({ 
  item, 
  onHabitLog 
}: { 
  item: any; 
  onHabitLog?: (id: string, date: string, status: 'done' | 'partial' | 'skipped' | 'clear') => void;
}) {
    const isHabDone = item.log?.status === 'done';
    const isHabPartial = item.log?.status === 'partial';
    const isHabSkipped = item.log?.status === 'skipped';
    const isDone = item.status === 'done' || isHabDone || item.status === 'completed';
    const [showPopover, setShowPopover] = useState(false);
    
    return (
        <div 
          onClick={() => {
            if (item.dataType === 'habit') {
              setShowPopover(!showPopover);
            }
          }}
          className={`p-2 rounded-xl border transition-all text-left relative cursor-pointer select-none
            ${isHabDone ? 'bg-emerald-50/10 border-emerald-200 text-emerald-900 shadow-sm shadow-emerald-50/50' : 
              isHabPartial ? 'bg-amber-50/10 border-amber-200 text-amber-900 shadow-sm' :
              isHabSkipped ? 'opacity-40 bg-gray-50 border-gray-100 grayscale' :
              isDone ? 'opacity-40 grayscale bg-gray-50 border-gray-100' : 
              'bg-white shadow-sm border-gray-100'}
          `}
        >
           <div className="flex items-start justify-between gap-1">
               <span className={`text-[8px] font-bold uppercase truncate opacity-70 
                 ${item.dataType === 'task' ? 'text-gray-500' : 
                   item.dataType === 'habit' ? 'text-indigo-600' : 
                   'text-orange-600'}
               `}>
                 {item.dataType === 'habit' && item.log?.status ? `${item.dataType}:${item.log.status}` : item.dataType}
               </span>
               {item.priority && item.priority <= 2 && <div className="w-1 h-1 rounded-full bg-red-500" />}
           </div>
           <div className="text-[11px] font-bold leading-tight mt-0.5 line-clamp-2">
               {item.title}
           </div>

           {/* Habit Quick Popover menu */}
           {item.dataType === 'habit' && showPopover && onHabitLog && (
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="absolute left-1/2 top-full -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-xl p-1.5 shadow-xl flex gap-1 z-30 min-w-[130px] justify-between"
              >
                <button 
                  onClick={() => {
                    onHabitLog(item.id, item.date, 'done');
                    setShowPopover(false);
                  }}
                  className="p-1 bg-emerald-50 hover:bg-emerald-100 rounded text-emerald-600"
                  title="Mark Completed"
                >
                  <Check className="w-3" />
                </button>
                <button 
                  onClick={() => {
                    onHabitLog(item.id, item.date, 'partial');
                    setShowPopover(false);
                  }}
                  className="p-1 bg-amber-50 hover:bg-amber-100 rounded text-amber-600 font-bold text-[8px]"
                  title="Mark Partial"
                >
                  Pt
                </button>
                <button 
                  onClick={() => {
                    onHabitLog(item.id, item.date, 'skipped');
                    setShowPopover(false);
                  }}
                  className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                  title="Skip"
                >
                  <ShieldMinus className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => {
                    onHabitLog(item.id, item.date, 'clear');
                    setShowPopover(false);
                  }}
                  className="p-1 bg-rose-50 hover:bg-rose-100 rounded text-rose-500"
                  title="Clear Log"
                >
                  <Ban className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setShowPopover(false)}
                  className="p-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-400"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
           )}
        </div>
    );
}
