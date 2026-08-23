import { useState, useEffect } from "react";
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  X,
  Target,
  CalendarCheck
} from "../ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { Habit, HabitLog } from "../../types";
import { logHabit, deleteHabitLog, createStarterHabits, StarterHabitDefinition } from "../../lib/habits";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import { getDaysInPeriod } from "../../lib/habitUtils";

// Import Custom Modular Components
import { StarterHabitConfig } from "./StarterHabitConfig";
import { HabitAIAnalyzer } from "./HabitAIAnalyzer";
import { HabitDetailPage } from "./HabitDetailPage";
import { HabitMatrixGrid } from "./HabitMatrixGrid";
import { HabitLevelProgress } from "./HabitLevelProgress";

export function HabitsHome() {
  const { user, workspace } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHabitForDetail, setSelectedHabitForDetail] = useState<Habit | null>(null);

  // Selected Month State (Default to Current Month)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-indexed

  // Today Date details
  const todayStr = new Date().toISOString().split("T")[0];

  // Custom Habit Form States
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<Habit["type"]>("personal");
  const [formCadence, setFormCadence] = useState<Habit["cadenceType"]>("daily");
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([]);
  const [formMinVersion, setFormMinVersion] = useState("");
  const [formIdealVersion, setFormIdealVersion] = useState("");
  const [formIdentity, setFormIdentity] = useState("");
  const [formCalendarVisible, setFormCalendarVisible] = useState(true);
  const [formColor, setFormColor] = useState("#6366f1");

  // Get days list for the selected month
  const periodDays = getDaysInPeriod(selectedYear, selectedMonth);

  // Month Bounds formatting for query optimization
  const monthStartStr = periodDays[0].toISOString().split("T")[0];
  const monthEndStr = periodDays[periodDays.length - 1].toISOString().split("T")[0];

  useEffect(() => {
    if (!user || !workspace) return;
    setLoading(true);

    // List habits subscription
    const qHabits = query(
      collection(db, "habits"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );

    const unsubscribeHabits = onSnapshot(
      qHabits,
      (snapshot) => {
        const hList: Habit[] = [];
        snapshot.forEach((doc) => {
          const item = { id: doc.id, ...doc.data() } as Habit;
          if (item.status !== "archived") {
            hList.push(item);
          }
        });
        hList.sort((a, b) => (a.order || 5) - (b.order || 5));
        setHabits(hList);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "habits");
      }
    );

    // List habit logs within current month bounds
    const qLogs = query(
      collection(db, "habit_logs"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
      where("date", ">=", monthStartStr),
      where("date", "<=", monthEndStr)
    );

    const unsubscribeLogs = onSnapshot(
      qLogs,
      (snapshot) => {
        const lList: HabitLog[] = [];
        snapshot.forEach((doc) => {
          lList.push({ id: doc.id, ...doc.data() } as HabitLog);
        });
        setLogs(lList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "habit_logs");
      }
    );

    return () => {
      unsubscribeHabits();
      unsubscribeLogs();
    };
  }, [user, workspace, monthStartStr, monthEndStr]);

  // Handle cell checking/unchecking within the Month Matrix View
  const handleToggleCell = async (habitId: string, dateStr: string, currentStatus: string | undefined) => {
    if (!user || !workspace) return;

    try {
      if (!currentStatus) {
        // empty -> done
        await logHabit(user.uid, workspace.id, habitId, dateStr, "done");
      } else if (currentStatus === "done") {
        // done -> partial
        await logHabit(user.uid, workspace.id, habitId, dateStr, "partial");
      } else if (currentStatus === "partial") {
        // partial -> skipped
        await logHabit(user.uid, workspace.id, habitId, dateStr, "skipped");
      } else if (currentStatus === "skipped") {
        // skipped -> empty (delete)
        await deleteHabitLog(habitId, dateStr);
      }
    } catch (e) {
      console.error("Cell logging toggle failed: ", e);
    }
  };

  // Quick log actions for the Compact Today Panel
  const handleTodayLog = async (habitId: string, status: "done" | "partial" | "skipped") => {
    if (!user || !workspace) return;
    try {
      await logHabit(user.uid, workspace.id, habitId, todayStr, status);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateStarterHabits = async (selected: StarterHabitDefinition[]) => {
    if (!user || !workspace) return;
    setIsInitializing(true);
    try {
      await createStarterHabits(user.uid, workspace.id, selected);
    } catch (e) {
      console.error(e);
    } finally {
      setIsInitializing(false);
    }
  };

  // Create a Custom Habit Action
  const handleCreateCustomHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspace || !formTitle.trim() || !formMinVersion.trim()) return;

    setIsInitializing(true);
    try {
      const habitData = {
        userId: user.uid,
        workspaceId: workspace.id,
        title: formTitle,
        description: formDesc,
        type: formType,
        status: "active" as const,
        cadenceType: formCadence,
        daysOfWeek: formCadence === "weekly" ? formDaysOfWeek : null,
        startDate: todayStr,
        minimumVersion: formMinVersion,
        idealVersion: formIdealVersion,
        difficulty: "medium" as const,
        identityStatement: formIdentity,
        priority: 2,
        calendarVisible: formCalendarVisible,
        color: formColor,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, "habits"), habitData);

      // Reset
      setFormTitle("");
      setFormDesc("");
      setFormMinVersion("");
      setFormIdealVersion("");
      setFormIdentity("");
      setFormDaysOfWeek([]);
      setFormColor("#6366f1");
      setShowAddModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save habit");
    } finally {
      setIsInitializing(false);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const getMonthLabel = () => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${months[selectedMonth]} ${selectedYear}`;
  };

  const toggleFormDay = (day: number) => {
    if (formDaysOfWeek.includes(day)) {
      setFormDaysOfWeek(formDaysOfWeek.filter(d => d !== day));
    } else {
      setFormDaysOfWeek([...formDaysOfWeek, day]);
    }
  };

  // Today's list (active, not due today or due today)
  const activeHabits = habits.filter(h => h.status === "active");
  const todayDateObj = new Date();
  
  const todayDueHabits = activeHabits.filter(h => {
    // Check if due on today's local date
    const dayIdx = todayDateObj.getDay();
    if (h.cadenceType === "daily") return true;
    if (h.cadenceType === "workdays") return dayIdx >= 1 && dayIdx <= 5;
    if (h.cadenceType === "weekly") return h.daysOfWeek?.includes(dayIdx);
    return true;
  });

  const todayLogsMap = new Map<string, string>();
  logs.filter(l => l.date === todayStr).forEach(l => {
    todayLogsMap.set(l.habitId, l.status);
  });

  if (loading || !user || !workspace) {
    return (
      <div className="p-8 flex justify-center h-48 items-center">
        <Loader2 className="animate-spin text-gray-400 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Title Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Identity Habits</h1>
          <p className="text-gray-500 font-medium text-sm">Discipline without shame. Visible consistency.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Month selector navigation */}
          <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl">
            <button
              onClick={handlePrevMonth}
              className="p-1 px-1.5 hover:bg-white rounded-lg transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs font-black min-w-[124px] text-center uppercase tracking-wider text-gray-700">
              {getMonthLabel()}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 px-1.5 hover:bg-white rounded-lg transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-black text-white hover:bg-gray-900 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Habit</span>
          </button>
        </div>
      </header>

      {/* Empty State / Starter Config UI if no habits configured */}
      {habits.length === 0 ? (
        <StarterHabitConfig onCreate={handleCreateStarterHabits} isLoading={isInitializing} />
      ) : (
        <div className="space-y-8">
          {/* Daily Ritual Check-In (Compact Today View) */}
          {todayDueHabits.length > 0 && (
            <section className="bg-amber-50/20 p-6 rounded-[2rem] border border-amber-100/30 space-y-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <h3 className="text-xs font-black uppercase text-gray-600 tracking-wider">Today's Practice Rituals</h3>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">{todayStr}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todayDueHabits.map((habit) => {
                  const todayStatus = todayLogsMap.get(habit.id);
                  const isDone = todayStatus === "done";
                  const isPartial = todayStatus === "partial";
                  const isSkipped = todayStatus === "skipped";

                  return (
                    <div
                      key={habit.id}
                      className={`p-4 bg-white rounded-2xl border transition-all flex flex-col justify-between space-y-3 relative overflow-hidden group ${
                        isDone
                          ? "border-emerald-200 bg-emerald-50/5"
                          : isPartial
                          ? "border-amber-200 bg-amber-50/5"
                          : isSkipped
                          ? "border-gray-200 bg-gray-50/30 opacity-70"
                          : "border-gray-100/80"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: habit.color || "#6b7280" }}
                          />
                          <h4
                            onClick={() => setSelectedHabitForDetail(habit)}
                            className="font-bold text-gray-900 text-sm truncate cursor-pointer hover:underline"
                          >
                            {habit.title}
                          </h4>
                        </div>
                        {habit.minimumVersion && (
                          <div className="text-[11px] text-gray-500 font-medium">
                            <span className="font-bold uppercase tracking-wider text-[9px] text-amber-600/70 block">
                              Tiny Version (No Shame Check)
                            </span>
                            "{habit.minimumVersion}"
                          </div>
                        )}
                      </div>

                      {/* Log Selector Buttons */}
                      <div className="flex gap-1.5 pt-2 border-t border-gray-50">
                        <button
                          onClick={() => handleTodayLog(habit.id, "done")}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            isDone
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Done
                        </button>
                        <button
                          onClick={() => handleTodayLog(habit.id, "partial")}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            isPartial
                              ? "bg-amber-400 text-white shadow-sm"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Partial
                        </button>
                        <button
                          onClick={() => handleTodayLog(habit.id, "skipped")}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            isSkipped
                              ? "bg-slate-300 text-slate-700 shadow-sm"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Skip
                        </button>
                        {(isDone || isPartial || isSkipped) && (
                          <button
                            onClick={() => deleteHabitLog(habit.id, todayStr)}
                            className="p-1.5 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Clear"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Gamification Level & Monthly Stats Ring Progress */}
          <HabitLevelProgress
            habits={habits}
            logs={logs}
            days={periodDays}
            selectedMonthLabel={getMonthLabel()}
          />

          {/* Month Matrix Grid */}
          <HabitMatrixGrid
            habits={habits}
            logs={logs}
            days={periodDays}
            onToggleCell={handleToggleCell}
            onSelectHabit={setSelectedHabitForDetail}
          />

          {/* Strategic Habit AI support console */}
          <HabitAIAnalyzer
            habits={habits}
            logs={logs}
            userId={user.uid}
            workspaceId={workspace.id}
          />
        </div>
      )}

      {/* Detail dashboard overlay/drawer */}
      {selectedHabitForDetail && (
        <HabitDetailPage
          habit={selectedHabitForDetail}
          logs={logs}
          periodDays={periodDays}
          onClose={() => setSelectedHabitForDetail(null)}
        />
      )}

      {/* Add Custom Habit Modal Dialoque */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-6 top-6 p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                <span>Formulate New Habit Spec</span>
              </h3>
              <p className="text-xs text-gray-400">Establish the minimum acceptable requirement for busy days.</p>
            </div>

            <form onSubmit={handleCreateCustomHabit} className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest font-mono">
                  Habit Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-black"
                  placeholder="e.g. Read 10 pages"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest font-mono">
                  Operational Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black"
                  placeholder="What is the intent of this habit?"
                  rows={2}
                />
              </div>

              {/* Category & Color */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest font-mono">
                    Category
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as Habit["type"])}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  >
                    <option value="health">Health</option>
                    <option value="fitness">Fitness</option>
                    <option value="work">Core Work</option>
                    <option value="family">Family / Relationships</option>
                    <option value="personal">Personal / Life</option>
                    <option value="system">System / Admin</option>
                    <option value="learning">Learning</option>
                    <option value="recovery">Recovery / Rest</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest font-mono">
                    Color Tag
                  </label>
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-full h-11 p-1 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              {/* Identity statement */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest font-mono">
                  Identity Statement
                </label>
                <input
                  type="text"
                  value={formIdentity}
                  onChange={(e) => setFormIdentity(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black"
                  placeholder="e.g. I am a highly structured reader"
                />
              </div>

              {/* Cadence */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest block font-mono">
                  Cadence
                </label>
                <div className="flex gap-2">
                  {["daily", "workdays", "weekly"].map((cad) => (
                    <button
                      key={cad}
                      type="button"
                      onClick={() => setFormCadence(cad as any)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                        formCadence === cad
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {cad}
                    </button>
                  ))}
                </div>

                {formCadence === "weekly" && (
                  <div className="flex justify-between p-2 border border-dashed border-gray-200 rounded-xl mt-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                      const active = formDaysOfWeek.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleFormDay(idx)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                            active ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {day[0]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Formats / Versions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest font-mono">
                    Min Version *
                  </label>
                  <input
                    type="text"
                    required
                    value={formMinVersion}
                    onChange={(e) => setFormMinVersion(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none"
                    placeholder="e.g. read 1 page"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest font-mono">
                    Ideal Version
                  </label>
                  <input
                    type="text"
                    value={formIdealVersion}
                    onChange={(e) => setFormIdealVersion(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none"
                    placeholder="e.g. read 15 mins"
                  />
                </div>
              </div>

              {/* Show on Calendar Option */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h5 className="font-bold text-xs text-gray-900 flex items-center gap-1">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Show on Unified Calendar</span>
                  </h5>
                  <p className="text-[9px] text-gray-400">Displays this practice directly on schedule day cells</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormCalendarVisible(!formCalendarVisible)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    formCalendarVisible ? "bg-black text-white shadow-sm" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {formCalendarVisible ? "Visible" : "Hidden"}
                </button>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold text-xs uppercase rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInitializing}
                  className="flex-1 py-3 bg-black text-white font-bold text-xs uppercase rounded-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                >
                  {isInitializing && <Loader2 className="animate-spin w-4 h-4" />}
                  <span>Formulate Habit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
