import React, { useState, useEffect } from "react";
import { CheckCircle, Loader2, X, Zap } from "../ui/Icon";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { RecurrenceType, RecurrenceUnit } from "../../types";

interface ManualWorkoutFormProps {
  userId: string;
  workspaceId: string;
  onClose: () => void;
  onSave: () => void;
}

const SESSION_TYPES = [
  { value: "strength", label: "Strength (Gym / Dumbbell)" },
  { value: "spinning", label: "Spinning (C3NTRO class)" },
  { value: "boxing", label: "Boxing (C3NTRO class)" },
  { value: "run", label: "Running / Walking" },
  { value: "swim", label: "Swimming" },
  { value: "mountain_bike", label: "Mountain Bike (e.g. Sunday MTBs)" },
  { value: "mobility", label: "Recovery / Mobility" }
];

export function ManualWorkoutForm({ userId, workspaceId, onClose, onSave }: ManualWorkoutFormProps) {
  const [saving, setSaving] = useState(false);
  const [activeHabits, setActiveHabits] = useState<{ id: string; title: string }[]>([]);

  // Form Fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState("strength");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [intensity, setIntensity] = useState<"easy" | "moderate" | "hard">("moderate");
  const [location, setLocation] = useState<"gym" | "home" | "pool" | "outdoor" | "travel">("gym");
  const [notes, setNotes] = useState("");
  const [linkedHabitId, setLinkedHabitId] = useState("");

  // Recurrence Fields
  const [isRoutineWorkout, setIsRoutineWorkout] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("weekly");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>("weeks");
  const [recurrenceAnchorDate, setRecurrenceAnchorDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    // Fetch active habits to link
    const fetchHabits = async () => {
      try {
        const q = query(
          collection(db, "habits"),
          where("userId", "==", userId),
          where("workspaceId", "==", workspaceId),
          where("status", "==", "active")
        );
        const snap = await getDocs(q);
        const list: { id: string; title: string }[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, title: d.data().title });
        });
        setActiveHabits(list);
      } catch (err) {
        console.error("Error loading habits for linked selection:", err);
      }
    };
    fetchHabits();
  }, [userId, workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const payload: any = {
        userId,
        workspaceId,
        workoutPlanId: "manual",
        title: title.trim(),
        type,
        date,
        durationMinutes,
        intensity,
        location,
        notes: notes.trim(),
        status: "planned",
        calendarVisible: true,
        linkedHabitId: linkedHabitId || null,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        // Recurrence parameters
        isRoutineWorkout,
        recurrenceType: isRoutineWorkout ? recurrenceType : "none",
        recurrenceInterval: isRoutineWorkout ? recurrenceInterval : 1,
        recurrenceUnit: isRoutineWorkout ? recurrenceUnit : "days",
        recurrenceAnchorDate: isRoutineWorkout ? recurrenceAnchorDate : null,
        recurrenceStatus: isRoutineWorkout ? "active" : "ended",
        recurringSeriesId: isRoutineWorkout ? `manual_workout_series_${Date.now()}` : null
      };

      await addDoc(collection(db, "workout_sessions"), payload);
      onSave();
    } catch (err) {
      console.error("Error saving manual workout:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh]">
      <div className="flex justify-between items-center pb-2 border-b border-gray-50">
        <h2 className="text-xl font-bold text-gray-900">Schedule Workout</h2>
        <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-black rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Workout Title</label>
          <input
            type="text" required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:border-gray-200 focus:bg-white rounded-xl p-3 text-sm font-semibold transition-all focus:ring-2 focus:ring-black"
            placeholder="e.g., C3NTRO Boxing or Sunday MTB trails"
          />
        </div>

        {/* Type and Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Training Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-black"
            >
              {SESSION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Execution Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        {/* Duration and Intensity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Duration (min)</label>
            <input
              type="number" min="5" max="300"
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-black font-mono text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Workout Intensity</label>
            <select
              value={intensity}
              onChange={e => setIntensity(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-black"
            >
              <option value="easy">Easy (Recovery / Fat Burn)</option>
              <option value="moderate">Moderate (Standard training)</option>
              <option value="hard">Hard (HIIT / High Effort)</option>
            </select>
          </div>
        </div>

        {/* Location and Habit Link */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Environment</label>
            <select
              value={location}
              onChange={e => setLocation(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-black"
            >
              <option value="gym">Gym / C3NTRO</option>
              <option value="home">Home / Indoors</option>
              <option value="outdoor">Outdoors (Roads / Forest)</option>
              <option value="pool">Pool</option>
              <option value="travel">Travel mode (Minimal gear)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" /> Linked Habit (Optional)
            </label>
            <select
              value={linkedHabitId}
              onChange={e => setLinkedHabitId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-black"
            >
              <option value="">No linked habit</option>
              {activeHabits.map(h => (
                <option key={h.id} value={h.id}>{h.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Session notes</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-gray-50 border border-transparent focus:border-gray-100 focus:bg-white rounded-xl p-3 text-sm font-medium transition-all focus:ring-2 focus:ring-black"
            placeholder="Warmup, structure, specific target reps..."
          />
        </div>

        {/* Recurrence Toggle */}
        <div className="pt-2 border-t border-gray-50">
          <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100/50 transition-colors">
            <input
              type="checkbox"
              checked={isRoutineWorkout}
              onChange={e => setIsRoutineWorkout(e.target.checked)}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-bold text-gray-700">Make this a Recurring Workout Routine</span>
          </label>
        </div>

        {/* Recurrence Config Details */}
        {isRoutineWorkout && (
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-3 animate-fadeIn">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Recurrence Type</label>
                <select
                  value={recurrenceType}
                  onChange={e => setRecurrenceType(e.target.value as any)}
                  className="w-full bg-white border border-gray-100 rounded-xl p-2 text-xs font-bold"
                >
                  <option value="daily">Daily</option>
                  <option value="workdays">Workdays (Mon-Fri)</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Anchor Date</label>
                <input
                  type="date"
                  value={recurrenceAnchorDate}
                  onChange={e => setRecurrenceAnchorDate(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-xl p-2 text-xs font-bold font-mono"
                />
              </div>
            </div>

            {recurrenceType === "weekly" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Repeat Interval</label>
                  <input
                    type="number" min="1" max="12"
                    value={recurrenceInterval}
                    onChange={e => setRecurrenceInterval(Number(e.target.value))}
                    className="w-full bg-white border border-gray-100 rounded-xl p-2 text-xs font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Interval Unit</label>
                  <select
                    value={recurrenceUnit}
                    onChange={e => setRecurrenceUnit(e.target.value as any)}
                    className="w-full bg-white border border-gray-100 rounded-xl p-2 text-xs font-bold"
                  >
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-50">
        <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-400 border border-gray-100 rounded-xl hover:bg-gray-50">
          Cancel
        </button>
        <button disabled={saving} className="flex-[2] py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-gray-100 transition-all">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Schedule Session
        </button>
      </div>
    </form>
  );
}
