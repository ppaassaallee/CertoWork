import React, { useState } from "react";
import { Save, Loader2, X, Dumbbell } from "../ui/Icon";
import { FitnessGoal, ExperienceLevel, FitnessProfile } from "../../types";
import { db } from "../../lib/firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

interface FitnessProfileFormProps {
  userId: string;
  workspaceId: string;
  initialData: FitnessProfile | null;
  onClose: () => void;
  onSave: () => void;
}

const GOALS: { value: FitnessGoal; label: string; desc: string }[] = [
  { value: "general_health", label: "General Health & Longevity", desc: "Balance cardio, strength, and recovery for overall well-being." },
  { value: "strength", label: "Strength & Muscle Gain", desc: "Focused on progressive overload, weight training, and power." },
  { value: "endurance", label: "Endurance Base", desc: "For runners, swimmers, and cyclists wanting cardio capacity." },
  { value: "fat_loss", label: "Body Recomposition", desc: "Combine strength training and active cardio for fat loss." },
  { value: "hybrid", label: "Hybrid Athlete", desc: "Both strength and endurance at a high level (e.g. C3NTRO membership)." },
  { value: "performance", label: "High Performance", desc: "Intense athletic development, power, and metabolic conditioning." }
];

const EQUIP_OPTIONS = [
  { id: "full_gym", label: "Full Gym Access" },
  { id: "barbell", label: "Barbell & Plates" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "bands", label: "Resistance Bands" },
  { id: "pool", label: "Swimming Pool" },
  { id: "bike", label: "Spin/Stationary/Mountain Bike" },
  { id: "bodyweight", label: "Bodyweight / No Equipment" }
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function FitnessProfileForm({ userId, workspaceId, initialData, onClose, onSave }: FitnessProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState<FitnessGoal>(initialData?.goal || "general_health");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(initialData?.experienceLevel || "intermediate");
  const [injuriesOrLimitations, setInjuriesOrLimitations] = useState(initialData?.injuriesOrLimitations || "");
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(initialData?.availableEquipment || []);
  const [preferredDuration, setPreferredDuration] = useState<number>(initialData?.preferredWorkoutDurationMinutes || 60);

  // Preferred training/rest days
  const [preferredTrainingDays, setPreferredTrainingDays] = useState<number[]>(initialData?.preferredTrainingDays || [1, 2, 4, 5]); // Mon, Tue, Thu, Fri default
  const [preferredRestDays, setPreferredRestDays] = useState<number[]>(initialData?.preferredRestDays || [0, 3, 6]); // Sun, Wed, Sat default

  const [strengthDays, setStrengthDays] = useState<number>(initialData?.strengthDaysPerWeek || 3);
  const [swimDays, setSwimDays] = useState<number>(initialData?.swimDaysPerWeek || 1);
  const [walkRunDays, setWalkRunDays] = useState<number>(initialData?.walkRunDaysPerWeek || 2);
  const [mountainBikeDay, setMountainBikeDay] = useState<number>(initialData?.mountainBikeDay ?? 0); // Sunday default

  const toggleEquipment = (eqId: string) => {
    if (availableEquipment.includes(eqId)) {
      setAvailableEquipment(availableEquipment.filter(e => e !== eqId));
    } else {
      setAvailableEquipment([...availableEquipment, eqId]);
    }
  };

  const toggleTrainingDay = (dayIndex: number) => {
    if (preferredTrainingDays.includes(dayIndex)) {
      setPreferredTrainingDays(preferredTrainingDays.filter(d => d !== dayIndex));
      if (!preferredRestDays.includes(dayIndex)) {
        setPreferredRestDays([...preferredRestDays, dayIndex].sort());
      }
    } else {
      setPreferredTrainingDays([...preferredTrainingDays, dayIndex].sort());
      setPreferredRestDays(preferredRestDays.filter(d => d !== dayIndex));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: Omit<FitnessProfile, "id"> = {
        userId,
        workspaceId,
        goal,
        experienceLevel,
        injuriesOrLimitations: injuriesOrLimitations.trim() || undefined,
        availableEquipment,
        preferredWorkoutDurationMinutes: preferredDuration,
        preferredTrainingDays,
        preferredRestDays,
        strengthDaysPerWeek: strengthDays,
        swimDaysPerWeek: swimDays,
        walkRunDaysPerWeek: walkRunDays,
        mountainBikeDay,
        createdAt: initialData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (initialData?.id) {
        await setDoc(doc(db, "fitness_profiles", initialData.id), {
          ...data,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await addDoc(collection(db, "fitness_profiles"), data);
      }
      onSave();
    } catch (err) {
      console.error("Error saving fitness profile:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 overflow-y-auto max-h-[90vh] shadow-2xl relative">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-50 rounded-xl text-orange-600">
            <Dumbbell className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Configure Fitness Profile</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-black rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Goal Selector */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-3">Primary Goal</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGoal(g.value)}
                className={`p-4 text-left rounded-2xl border transition-all ${
                  goal === g.value
                    ? "border-orange-500 bg-orange-50/50 ring-1 ring-orange-400"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="font-bold text-sm text-gray-900">{g.label}</div>
                <div className="text-xs text-gray-500 mt-1">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Level and Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Experience Level</label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-orange-500"
            >
              <option value="beginner">Beginner (Comfortable with basics)</option>
              <option value="intermediate">Intermediate (Regular athlete / C3NTRO user)</option>
              <option value="advanced">Advanced (High intensity / heavy builder)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Preferred Workout Length</label>
            <select
              value={preferredDuration}
              onChange={(e) => setPreferredDuration(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-orange-500"
            >
              <option value="30">30 Minutes (Fast blast)</option>
              <option value="45">45 Minutes (Efficient fit)</option>
              <option value="60">60 Minutes (Standard session)</option>
              <option value="90">90 Minutes (Deep load)</option>
            </select>
          </div>
        </div>

        {/* Cadence Split targets */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Weekly Cadence Focus Targets</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-500 block mb-1">Strength (gym)</label>
              <input
                type="number" min="0" max="7"
                value={strengthDays}
                onChange={e => setStrengthDays(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-100 text-center rounded-xl p-2 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-500 block mb-1">Swim Days</label>
              <input
                type="number" min="0" max="7"
                value={swimDays}
                onChange={e => setSwimDays(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-100 text-center rounded-xl p-2 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-500 block mb-1">Cardio Runs</label>
              <input
                type="number" min="0" max="7"
                value={walkRunDays}
                onChange={e => setWalkRunDays(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-100 text-center rounded-xl p-2 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-500 block mb-1">MTB Day (0-6)</label>
              <select
                value={mountainBikeDay}
                onChange={e => setMountainBikeDay(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2 font-semibold text-xs"
              >
                {DAYS_OF_WEEK.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Days Picker */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Preferred Training Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((dayName, dayIndex) => {
              const isTraining = preferredTrainingDays.includes(dayIndex);
              return (
                <button
                  key={dayIndex}
                  type="button"
                  onClick={() => toggleTrainingDay(dayIndex)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isTraining
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-black"
                  }`}
                >
                  {dayName.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-400 mt-2">
            Rest days are automatically calculated as: {preferredRestDays.map(d => DAYS_OF_WEEK[d]).join(", ") || "None"}
          </div>
        </div>

        {/* Equipment Selector */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-3">Available Equipment</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {EQUIP_OPTIONS.map((eq) => {
              const checked = availableEquipment.includes(eq.id);
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => toggleEquipment(eq.id)}
                  className={`p-3 text-left rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                    checked
                      ? "border-orange-500 bg-orange-50/20 text-orange-900"
                      : "border-gray-100 hover:border-gray-200 text-gray-600 bg-gray-50/30"
                  }`}
                >
                  <span>{eq.label}</span>
                  {checked && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Physical Limitations */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Physical Limitations & Injury Precautions</label>
          <textarea
            value={injuriesOrLimitations}
            onChange={(e) => setInjuriesOrLimitations(e.target.value)}
            placeholder="e.g. Tendinitis in right shoulder, lower back stiffness after heavy squats."
            className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium h-20 focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-sm font-bold text-gray-400 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-gray-100 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Training Profile
          </button>
        </div>
      </form>
    </div>
  );
}
