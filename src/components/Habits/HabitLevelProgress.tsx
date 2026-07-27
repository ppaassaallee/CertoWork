import { Trophy, Sparkles } from "lucide-react";
import { Habit, HabitLog } from "../../types";
import { computeHabitStats, getGamificationLevel } from "../../lib/habitUtils";

interface HabitLevelProgressProps {
  habits: Habit[];
  logs: HabitLog[];
  days: Date[];
  selectedMonthLabel: string;
}

export function HabitLevelProgress({ habits, logs, days, selectedMonthLabel }: HabitLevelProgressProps) {
  // Aggregate stats across all habits for the given month
  let aggregateDue = 0;
  let aggregateCompleted = 0;
  let aggregatePartial = 0;
  let aggregateSkipped = 0;
  let aggregateMissed = 0;

  // Track max streak across all habits
  let maxStreak = 0;

  // Track strongest habit to report
  let strongestHabitName = "No active habits";
  let highestConsistency = -1;

  habits.forEach(habit => {
    const stats = computeHabitStats(habit, logs, days);
    aggregateDue += stats.totalDue;
    aggregateCompleted += stats.totalCompleted;
    aggregatePartial += stats.totalPartial;
    aggregateSkipped += stats.totalSkipped;
    aggregateMissed += stats.totalMissed;

    if (stats.currentStreak > maxStreak) {
      maxStreak = stats.currentStreak;
    }

    if (stats.consistency > highestConsistency) {
      highestConsistency = stats.consistency;
      strongestHabitName = habit.title;
    }
  });

  // Calculate overall consistency percentage
  // Consistency = Completed score
  // Done = 100%, Partial = 50%, Skipped = neutral, Missed = 0%
  const todayStr = new Date().toISOString().split("T")[0];
  let totalLogsEvaluated = 0;
  let totalScoreEarned = 0;

  habits.forEach(habit => {
    const habitLogs = logs.filter(l => l.habitId === habit.id);
    const logsMap = new Map<string, string>();
    habitLogs.forEach(l => logsMap.set(l.date, l.status));

    days.forEach(day => {
      const dateStr = day.toISOString().split("T")[0];
      if (dateStr > todayStr) return; // skip future

      const isDue = isHabitDueOnDate(habit, day);
      if (!isDue) return;

      const flag = logsMap.get(dateStr);
      if (flag === "skipped") return; // neutral

      totalLogsEvaluated++;
      if (flag === "done") totalScoreEarned += 1;
      if (flag === "partial") totalScoreEarned += 0.5;
    });
  });

  // Helper check for due
  function isHabitDueOnDate(habit: Habit, date: Date): boolean {
    if (habit.status !== "active") return false;
    const dateStr = date.toISOString().split("T")[0];
    if (habit.startDate && dateStr < habit.startDate) return false;
    if (habit.endDate && dateStr > habit.endDate) return false;
    const dayIdx = date.getDay();
    if (habit.cadenceType === "daily") return true;
    if (habit.cadenceType === "workdays") return dayIdx >= 1 && dayIdx <= 5;
    if (habit.cadenceType === "weekly") return habit.daysOfWeek?.includes(dayIdx) || false;
    if (habit.cadenceType === "monthly") {
      const startDayNum = habit.startDate ? parseInt(habit.startDate.split("-")[2], 10) : 1;
      return date.getDate() === startDayNum;
    }
    return true;
  }

  const overallConsistency = totalLogsEvaluated > 0 ? Math.round((totalScoreEarned / totalLogsEvaluated) * 100) : 0;
  const levelData = getGamificationLevel(overallConsistency);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gamification Identity Ring */}
      <div className="bg-gradient-to-br from-black to-gray-900 text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10">
          <Trophy className="w-64 h-64 text-white" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Alejandro's Matrix Level</span>
          </div>
          <h3 className="text-2xl font-black tracking-tight">{levelData.name} ({overallConsistency}%)</h3>
          <p className="text-gray-300 text-xs leading-relaxed italic pr-4">
            "{levelData.message}"
          </p>
        </div>

        {/* Level Ring/Details */}
        <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
          <div className="relative shrink-0 w-16 h-16 flex items-center justify-center bg-gray-800/60 rounded-full border border-gray-700">
            <span className="text-2xl font-black">{levelData.level}</span>
            <div className="absolute inset-0 border-2 border-emerald-500 rounded-full animate-pulse opacity-40" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest block font-mono">Current Peak</span>
            <span className="text-xs font-bold text-gray-100 block">
              {maxStreak > 0 ? `Active streak: ${maxStreak} days` : "Start logging to ignite streak!"}
            </span>
          </div>
        </div>
      </div>

      {/* Progress metrics ring card */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest block font-mono">
            {selectedMonthLabel} Metrics
          </span>
          <h3 className="text-xl font-bold text-gray-900 mt-1">Monthly Completion</h3>
        </div>

        <div className="flex items-center justify-around gap-4">
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-black transition-all duration-500"
                strokeDasharray={`${overallConsistency}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-lg font-black text-gray-900">{overallConsistency}%</span>
              <span className="text-[8px] uppercase text-gray-400 font-bold">score</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-emerald-500" />
              <span className="text-gray-500">Done: <strong className="text-gray-900 font-bold">{aggregateCompleted}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-amber-400" />
              <span className="text-gray-500">Partial: <strong className="text-gray-900 font-bold">{aggregatePartial}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-slate-200" />
              <span className="text-gray-500">Skipped: <strong className="text-gray-900 font-bold">{aggregateSkipped}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-rose-200" />
              <span className="text-gray-500">Missed: <strong className="text-gray-900 font-bold">{aggregateMissed}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Focus / Coaching block */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest block font-mono">
            Strategic Focus
          </span>
          <h3 className="text-xl font-bold text-gray-900 mt-1">Anchor Habit Performance</h3>
        </div>

        <div className="space-y-4 flex-1 flex flex-col justify-center">
          <div className="space-y-1">
            <div className="text-xs text-gray-400 font-bold">CURRENT LIGHTHOUSE (STRONGEST)</div>
            <div className="font-bold text-sm text-gray-900">{strongestHabitName}</div>
          </div>

          <div className="text-xs text-gray-500 leading-normal bg-gray-50 p-3 rounded-xl border border-gray-100/50">
            {overallConsistency < 50 ? (
              <span>Your lighthouse guide is establishing basic rhythm. Focus on logging <strong>minimum versions</strong> on heavy days. No excuses, but absolutely no shame.</span>
            ) : (
              <span>Your lighthouse habit has high structural consistency. Protect it at all costs, and expand these habits to anchor secondary habits.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
