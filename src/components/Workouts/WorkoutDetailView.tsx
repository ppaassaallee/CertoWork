import { useState, useEffect, useRef } from "react";
import { CheckCircle, Loader2, Play, Pause, ChevronLeft, Save, AlertCircle, Info } from "lucide-react";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { WorkoutSession, WorkoutExercise } from "../../types";
import { getNextOccurrence } from "../../lib/recurrence-utils";

interface WorkoutDetailViewProps {
  session: WorkoutSession;
  onBack: () => void;
}

export function WorkoutDetailView({ session, onBack }: WorkoutDetailViewProps) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [activeHabits, setActiveHabits] = useState<{ id: string; title: string }[]>([]);

  // Timer state
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<any>(null);

  // Completion Form State
  const [completing, setCompleting] = useState(false);
  const [whoopStrain, setWhoopStrain] = useState("");
  const [whoopCalories, setWhoopCalories] = useState("");
  const [whoopAvgHR, setWhoopAvgHR] = useState("");
  const [whoopMaxHR, setWhoopMaxHR] = useState("");
  const [perceivedEffort, setPerceivedEffort] = useState(5);
  const [energyBefore, setEnergyBefore] = useState<"low" | "medium" | "high">("medium");
  const [energyAfter, setEnergyAfter] = useState<"low" | "medium" | "high">("medium");
  const [notes, setNotes] = useState("");
  const [linkedHabitId, setLinkedHabitId] = useState(session.linkedHabitId || "");

  useEffect(() => {
    // Fetch exercises for this session
    const fetchExercises = async () => {
      try {
        const q = query(
          collection(db, "workout_exercises"),
          where("workoutSessionId", "==", session.id)
        );
        const snap = await getDocs(q);
        const list: WorkoutExercise[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as WorkoutExercise);
        });
        setExercises(list.sort((a, b) => a.order - b.order));
      } catch (err) {
        console.error("Error loading exercises:", err);
      } finally {
        setLoadingExercises(false);
      }
    };

    // Fetch active habits to link
    const fetchHabits = async () => {
      try {
        const q = query(
          collection(db, "habits"),
          where("userId", "==", session.userId),
          where("workspaceId", "==", session.workspaceId),
          where("status", "==", "active")
        );
        const snap = await getDocs(q);
        const list: { id: string; title: string }[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, title: d.data().title });
        });
        setActiveHabits(list);
      } catch (err) {
        console.error("Error loading habits for completion auto-link:", err);
      }
    };

    fetchExercises();
    fetchHabits();
  }, [session.id, session.userId, session.workspaceId]);

  // Timer runner
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCompleteSession = async () => {
    setCompleting(true);
    try {
      // 1. We run a Firestore transaction to mark the workout session as completed, 
      // write the log, check linked habits, and calculate precise recurrence occurrences.
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, "workout_sessions", session.id);
        const sessionSnap = await transaction.get(sessionRef);

        if (!sessionSnap.exists()) throw new Error("Workout session does not exist");
        const freshSession = { id: sessionSnap.id, ...sessionSnap.data() } as any;

        // Idempotency: bypass if completed already
        if (freshSession.status === "completed") return;

        // A. Mark session as completed
        transaction.update(sessionRef, {
          status: "completed",
          updatedAt: serverTimestamp()
        });

        // B. Add a log record (idempotent setup)
        const logId = `log_${session.id}_${Date.now()}`;
        const logRef = doc(db, "workout_logs", logId);
        transaction.set(logRef, {
          userId: session.userId,
          workspaceId: session.workspaceId,
          workoutSessionId: session.id,
          date: new Date().toISOString().split("T")[0],
          status: "completed",
          durationMinutes: Math.floor(timer / 60) || session.durationMinutes,
          perceivedEffort,
          energyBefore,
          energyAfter,
          whoopStrain: whoopStrain ? parseFloat(whoopStrain) : null,
          whoopAvgHeartRate: whoopAvgHR ? parseInt(whoopAvgHR) : null,
          whoopMaxHeartRate: whoopMaxHR ? parseInt(whoopMaxHR) : null,
          whoopCalories: whoopCalories ? parseInt(whoopCalories) : null,
          notes: notes.trim() || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // C. If a linkedHabitId is selected, register an active complete HabitLog for today
        const actualHabitId = linkedHabitId || freshSession.linkedHabitId;
        if (actualHabitId) {
          const todayStr = new Date().toISOString().split("T")[0];
          const habitLogId = `${actualHabitId}_${todayStr}`;
          const habitLogRef = doc(db, "habit_logs", habitLogId);
          
          transaction.set(habitLogRef, {
            id: habitLogId,
            userId: session.userId,
            workspaceId: session.workspaceId,
            habitId: actualHabitId,
            date: todayStr,
            status: "done",
            completedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        // D. Recurrence engine calculation
        if (freshSession.isRoutineWorkout && freshSession.recurrenceType && freshSession.recurrenceType !== "none") {
          const recurrenceAnchor = freshSession.recurrenceAnchorDate || freshSession.date;
          
          const nextDateStr = getNextOccurrence(
            recurrenceAnchor,
            freshSession.date,
            new Date(),
            {
              type: freshSession.recurrenceType,
              interval: freshSession.recurrenceInterval || 1,
              unit: freshSession.recurrenceUnit || "weeks"
            }
          );

          if (nextDateStr) {
            const seriesId = freshSession.recurringSeriesId || `series_${session.id}`;
            const deterministicNextId = `workout_routine_${seriesId}_${nextDateStr}`;
            const nextSessionRef = doc(db, "workout_sessions", deterministicNextId);
            const nextSessionSnap = await transaction.get(nextSessionRef);

            // Create only if it doesn't already exist to prevent redundant duplicates
            if (!nextSessionSnap.exists()) {
              transaction.set(nextSessionRef, {
                userId: session.userId,
                workspaceId: session.workspaceId,
                workoutPlanId: freshSession.workoutPlanId || "manual",
                title: freshSession.title,
                type: freshSession.type,
                date: nextDateStr,
                durationMinutes: freshSession.durationMinutes,
                intensity: freshSession.intensity,
                location: freshSession.location || "gym",
                status: "planned",
                warmup: freshSession.warmup || "",
                mainWorkout: freshSession.mainWorkout || "",
                cooldown: freshSession.cooldown || "",
                calendarVisible: freshSession.calendarVisible ?? true,
                linkedHabitId: actualHabitId || null,
                createdBy: freshSession.createdBy || session.userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),

                // Inherit Recurrence Rules
                isRoutineWorkout: true,
                recurrenceType: freshSession.recurrenceType,
                recurrenceInterval: freshSession.recurrenceInterval || 1,
                recurrenceUnit: freshSession.recurrenceUnit || "weeks",
                recurrenceAnchorDate: recurrenceAnchor,
                recurrenceStatus: "active",
                recurringSeriesId: seriesId
              });
            }
          }
        }
      });

      onBack();
    } catch (err) {
      console.error("Error logging completed workout session under transaction:", err);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header and Back navigation */}
      <header className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 font-bold hover:text-black">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <div className="text-center">
          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">{session.type} training</span>
          <h1 className="font-extrabold text-xl text-gray-900 mt-1">{session.title}</h1>
        </div>
        <div className="bg-black text-white px-4 py-2 rounded-2xl font-mono font-bold flex items-center gap-3">
          <span className="text-base text-gray-200">{formatTime(timer)}</span>
          <button onClick={() => setTimerActive(!timerActive)} className="hover:text-indigo-400">
            {timerActive ? <Pause className="w-5 h-5 fill-current text-red-400" /> : <Play className="w-5 h-5 fill-current text-green-400 animate-pulse" />}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exercises Details Column */}
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 space-y-6">
            {session.warmup && (
              <div className="border-b border-gray-50 pb-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Recommended Warmup</h3>
                <p className="text-sm text-gray-700 leading-relaxed font-semibold">{session.warmup}</p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Main Block Routine Exercises</h3>
              {loadingExercises ? (
                <div className="flex justify-center p-6"><Loader2 className="animate-spin text-gray-300 w-6 h-6" /></div>
              ) : exercises.length > 0 ? (
                <div className="space-y-3">
                  {exercises.map((ex, idx) => (
                    <div key={ex.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100/50 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all group">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-xs font-black text-gray-500 group-hover:bg-black group-hover:text-white transition-all">{idx + 1}</span>
                          <h4 className="font-bold text-gray-900 text-sm">{ex.name}</h4>
                        </div>
                        <div className="flex gap-2 text-[9px] font-black text-gray-400 tracking-wider uppercase">
                          {ex.sets && <span>{ex.sets} Sets</span>}
                          {ex.reps && <span>{ex.reps} Reps</span>}
                          {ex.distance && <span>{ex.distance} km</span>}
                        </div>
                      </div>
                      {ex.explanation && (
                        <p className="text-xs text-gray-500 mt-2 italic flex items-start gap-1 pb-1">
                          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span>{ex.explanation}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50/40 border border-dashed border-gray-100 p-6 rounded-2xl text-center">
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">No structured sub-exercises. Follow the core guide description:</p>
                  <p className="text-sm font-semibold text-gray-800 mt-2">{session.mainWorkout || "Workout Session scheduled"}</p>
                </div>
              )}
            </div>

            {session.cooldown && (
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Recommended Cooldown</h3>
                <p className="text-sm text-gray-700 leading-relaxed font-semibold">{session.cooldown}</p>
              </div>
            )}
          </section>
        </div>

        {/* Complete Form Metadata Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 space-y-6 shadow-sm">
            <h2 className="font-bold text-gray-900 border-b border-gray-50 pb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" /> Log Session Metrics
            </h2>

            <div className="space-y-4">
              {/* Whoop Strain and Calories */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Whoop Strain</label>
                  <input
                    type="number" step="0.1" min="0" max="21"
                    value={whoopStrain}
                    onChange={e => setWhoopStrain(e.target.value)}
                    placeholder="e.g. 14.5"
                    className="w-full bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-black text-center font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Calories Burned</label>
                  <input
                    type="number" min="0" max="6000"
                    value={whoopCalories}
                    onChange={e => setWhoopCalories(e.target.value)}
                    placeholder="e.g. 450"
                    className="w-full bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-black text-center font-mono"
                  />
                </div>
              </div>

              {/* Heart rates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Avg HR (bpm)</label>
                  <input
                    type="number"
                    value={whoopAvgHR}
                    onChange={e => setWhoopAvgHR(e.target.value)}
                    placeholder="e.g. 135"
                    className="w-full bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-black text-center font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Max HR (bpm)</label>
                  <input
                    type="number"
                    value={whoopMaxHR}
                    onChange={e => setWhoopMaxHR(e.target.value)}
                    placeholder="e.g. 175"
                    className="w-full bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-black text-center font-mono"
                  />
                </div>
              </div>

              {/* Effort slider */}
              <div className="space-y-1 shadow-sm/50 p-2 border border-gray-50 bg-gray-50/20 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Perceived Effort</label>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{perceivedEffort} / 10</span>
                </div>
                <input
                  type="range" min="1" max="10"
                  value={perceivedEffort}
                  onChange={e => setPerceivedEffort(parseInt(e.target.value))}
                  className="w-full accent-black cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
                />
              </div>

              {/* Energy levels before and after */}
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Energy Before Workout</label>
                  <div className="flex gap-1.5">
                    {(["low", "medium", "high"] as const).map(en => (
                      <button
                        key={en}
                        type="button"
                        onClick={() => setEnergyBefore(en)}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                          energyBefore === en ? "bg-black text-white border-black" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        {en}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Energy After Workout</label>
                  <div className="flex gap-1.5">
                    {(["low", "medium", "high"] as const).map(en => (
                      <button
                        key={en}
                        type="button"
                        onClick={() => setEnergyAfter(en)}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                          energyAfter === en ? "bg-black text-white border-black" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        {en}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Linking Habits Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Associate with Active Habit</label>
                <select
                  value={linkedHabitId}
                  onChange={e => setLinkedHabitId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-black"
                >
                  <option value="">No linked habit</option>
                  {activeHabits.map((h) => (
                    <option key={h.id} value={h.id}>{h.title}</option>
                  ))}
                </select>
              </div>

              {/* General Completion Notes */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Training Log Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Set details, weights used, breathing details, fatigue..."
                  className="w-full bg-gray-50 border border-transparent focus:border-gray-100 focus:bg-white rounded-xl p-3 text-xs font-medium h-20 focus:ring-2 focus:ring-black resize-none"
                />
              </div>

              {/* Disclaimer */}
              <div className="text-[9px] text-amber-600 bg-amber-50 rounded-xl p-2.5 border border-amber-100 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Recommendations are general guidance, not medical/clinical advice.</span>
              </div>

              {/* Action */}
              <button
                onClick={handleCompleteSession}
                disabled={completing}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all disabled:opacity-50"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Log & Complete Training
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
