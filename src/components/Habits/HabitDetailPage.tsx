import { useState } from "react";
import { Eye, EyeOff, Loader2, ArrowLeft, Trash, Play, Pause, Archive } from "lucide-react";
import { Habit, HabitLog } from "../../types";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getGamificationLevel, computeHabitStats } from "../../lib/habitUtils";

interface HabitDetailPageProps {
  habit: Habit;
  logs: HabitLog[];
  onClose: () => void;
  periodDays: Date[];
}

export function HabitDetailPage({ habit, logs, onClose, periodDays }: HabitDetailPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Edit fields
  const [title, setTitle] = useState(habit.title);
  const [description, setDescription] = useState(habit.description || "");
  const [identityStatement, setIdentityStatement] = useState(habit.identityStatement || "");
  const [minimumVersion, setMinimumVersion] = useState(habit.minimumVersion || "");
  const [idealVersion, setIdealVersion] = useState(habit.idealVersion || "");
  const [cadenceType, setCadenceType] = useState<Habit["cadenceType"]>(habit.cadenceType);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(habit.daysOfWeek || []);
  const [calendarVisible, setCalendarVisible] = useState(habit.calendarVisible);
  const [color, setColor] = useState(habit.color || "#6366f1");
  const [type, setType] = useState<Habit["type"]>(habit.type);

  const stats = computeHabitStats(habit, logs, periodDays);
  const currentLvl = getGamificationLevel(stats.consistency);

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const handleUpdateStatus = async (newStatus: Habit["status"]) => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "habits", habit.id);
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!title.trim()) return;
    setIsLoading(true);
    try {
      const docRef = doc(db, "habits", habit.id);
      await updateDoc(docRef, {
        title,
        description,
        identityStatement,
        minimumVersion,
        idealVersion,
        cadenceType,
        daysOfWeek: cadenceType === "weekly" ? daysOfWeek : null,
        calendarVisible,
        color,
        type,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update habit settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHabit = async () => {
    if (!confirm("Are you sure you want to permanently delete this habit and all its specs?")) return;
    setIsLoading(true);
    try {
      const docRef = doc(db, "habits", habit.id);
      await deleteDoc(docRef);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to delete habit");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end transition-opacity">
      <div className="bg-white w-full max-w-xl h-full flex flex-col justify-between shadow-2xl relative animate-slide-in p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-gray-50 pb-4">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold font-mono uppercase tracking-wider"
                >
                  Edit Specs
                </button>
              )}
              <button
                onClick={handleDeleteHabit}
                className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                title="Delete Habit"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-5">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Edit Habit Specs</h3>

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Habit Name</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium"
                    rows={2}
                  />
                </div>

                {/* Type & Color */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Category</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as Habit["type"])}
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
                    <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Color Tag</label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full h-11 p-1 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer"
                    />
                  </div>
                </div>

                {/* Identity Statement */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Identity Statement</label>
                  <input
                    type="text"
                    value={identityStatement}
                    placeholder="e.g. I am some who plans ahead"
                    onChange={(e) => setIdentityStatement(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium"
                  />
                </div>

                {/* Cadence */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest block">Cadence</label>
                  <div className="flex gap-2">
                    {["daily", "workdays", "weekly"].map((cad) => (
                      <button
                        key={cad}
                        type="button"
                        onClick={() => setCadenceType(cad as any)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                          cadenceType === cad
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {cad}
                      </button>
                    ))}
                  </div>

                  {cadenceType === "weekly" && (
                    <div className="flex justify-between p-2 border border-dashed border-gray-200 rounded-xl mt-2 select-none">
                      {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => {
                        const active = daysOfWeek.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDayOfWeek(idx)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                              active ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Versions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Minimum Version (No Shame)</label>
                    <input
                      type="text"
                      value={minimumVersion}
                      onChange={(e) => setMinimumVersion(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium"
                      placeholder="e.g. read 1 page"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Ideal Version</label>
                    <input
                      type="text"
                      value={idealVersion}
                      onChange={(e) => setIdealVersion(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium"
                      placeholder="e.g. read 10 pages"
                    />
                  </div>
                </div>

                {/* Calendar Visibility */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <h5 className="font-bold text-xs text-gray-900">Show on Calendar</h5>
                    <p className="text-[10px] text-gray-400">Makes habit visible in Unified Calendar</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalendarVisible(!calendarVisible)}
                    className={`p-2 rounded-xl transition-colors ${
                      calendarVisible ? "bg-black text-white" : "bg-gray-200"
                    }`}
                  >
                    {calendarVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-gray-100 font-bold text-xs uppercase text-gray-500 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-black text-white font-bold text-xs uppercase rounded-xl hover:bg-gray-900 flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
                  <span>Save Specs</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Core Presentation */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{type}</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{habit.title}</h2>
                {description && <p className="text-gray-500 text-sm">{description}</p>}
                {identityStatement && (
                  <p className="text-xs bg-gray-50 text-gray-600 italic border-l-2 border-black p-3 rounded-lg">
                    "{identityStatement}"
                  </p>
                )}
              </div>

              {/* Status Bar */}
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-2xl">
                <button
                  onClick={() => handleUpdateStatus("active")}
                  disabled={habit.status === "active" || isLoading}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                    habit.status === "active"
                      ? "bg-black text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Active</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus("paused")}
                  disabled={habit.status === "paused" || isLoading}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                    habit.status === "paused"
                      ? "bg-amber-100 text-amber-800 shadow-sm"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus("archived")}
                  disabled={habit.status === "archived" || isLoading}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                    habit.status === "archived"
                      ? "bg-slate-200 text-slate-700 shadow-sm"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive</span>
                </button>
              </div>

              {/* Gamification card */}
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-6 rounded-3xl border border-indigo-100/50 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-[10px] uppercase font-black text-indigo-500 tracking-widest">Identity Level</h4>
                    <span className="text-lg font-black text-gray-900">Level {currentLvl.level}: {currentLvl.name}</span>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full border text-xs font-bold ${currentLvl.badgeColor}`}>
                    {stats.consistency}% Complete
                  </span>
                </div>
                <p className="text-xs text-indigo-900/80 leading-relaxed font-semibold italic">
                  "{currentLvl.message}"
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">Current Streak</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900">{stats.currentStreak}</span>
                    <span className="text-xs font-bold text-gray-400">days</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">Best Streak</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900">{stats.bestStreak}</span>
                    <span className="text-xs font-bold text-gray-400">days</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">Recovery Rate</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900">{stats.recoveryRate}%</span>
                    <span className="text-[9px] font-bold text-gray-400">next day follow up</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">Time Investment</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-black text-gray-900">{cadenceType}</span>
                  </div>
                </div>
              </div>

              {/* Versions list */}
              {(minimumVersion || idealVersion) && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest block font-mono">Action Formats</h4>
                  <div className="space-y-2">
                    {minimumVersion && (
                      <div className="text-xs flex items-start gap-2.5">
                        <span className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[9px] font-mono mt-0.5 uppercase shrink-0">Min</span>
                        <div>
                          <span className="font-semibold text-gray-800">{minimumVersion}</span>
                        </div>
                      </div>
                    )}
                    {idealVersion && (
                      <div className="text-xs flex items-start gap-2.5">
                        <span className="bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[9px] font-mono mt-0.5 uppercase shrink-0">Ideal</span>
                        <div>
                          <span className="font-semibold text-gray-800">{idealVersion}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
