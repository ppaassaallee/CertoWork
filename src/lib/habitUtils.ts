import { Habit, HabitLog } from "../types";

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  recoveryRate: number; // percentage of recoveries on next due day after a miss
  consistency: number;  // completion percentage based on due days
  totalCompleted: number;
  totalPartial: number;
  totalSkipped: number;
  totalMissed: number;
  totalDue: number;
}

// Check if a habit is due on a specific local date string (YYYY-MM-DD)
export function isHabitDueOnDate(habit: Habit, date: Date): boolean {
  if (habit.status !== "active") return false;
  
  // Check start date
  const dateStr = date.toISOString().split("T")[0];
  if (habit.startDate && dateStr < habit.startDate) return false;
  if (habit.endDate && dateStr > habit.endDate) return false;

  const dayIdx = date.getDay(); // 0 is Sunday, 1 is Monday...

  if (habit.cadenceType === "daily") {
    return true;
  }
  if (habit.cadenceType === "workdays") {
    return dayIdx >= 1 && dayIdx <= 5;
  }
  if (habit.cadenceType === "weekly") {
    return habit.daysOfWeek?.includes(dayIdx) || false;
  }
  if (habit.cadenceType === "monthly") {
    // Standard Monthly: due on the 1st of the month or we see if day is matching start day's date
    const startDayNum = habit.startDate ? parseInt(habit.startDate.split("-")[2], 10) : 1;
    return date.getDate() === startDayNum;
  }
  return true;
}

export function getDaysInPeriod(year: number, monthIndex: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, monthIndex, 1);
  while (date.getMonth() === monthIndex) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

// Given a list of habit logs for a specific habit, compute all stats
export function computeHabitStats(
  habit: Habit,
  allLogs: HabitLog[],
  periodDays: Date[]
): HabitStats {
  const habitLogs = allLogs.filter(l => l.habitId === habit.id);
  const logsMap = new Map<string, 'done' | 'skipped' | 'partial' | 'missed'>();
  
  habitLogs.forEach(l => {
    logsMap.set(l.date, l.status);
  });

  const todayStr = new Date().toISOString().split("T")[0];

  let totalCompleted = 0;
  let totalPartial = 0;
  let totalSkipped = 0;
  let totalMissed = 0;
  let totalDue = 0;

  // Identify all due days and their actual statuses
  const sortedDueDates: { dateStr: string; status: 'done' | 'skipped' | 'partial' | 'missed' | 'pending' }[] = [];

  periodDays.forEach(day => {
    const isDue = isHabitDueOnDate(habit, day);
    if (!isDue) return;

    totalDue++;
    const dateStr = day.toISOString().split("T")[0];
    const logStatus = logsMap.get(dateStr);

    if (logStatus === "done") {
      totalCompleted++;
      sortedDueDates.push({ dateStr, status: "done" });
    } else if (logStatus === "partial") {
      totalPartial++;
      sortedDueDates.push({ dateStr, status: "partial" });
    } else if (logStatus === "skipped") {
      totalSkipped++;
      sortedDueDates.push({ dateStr, status: "skipped" });
    } else {
      // No log
      if (dateStr < todayStr) {
        totalMissed++;
        sortedDueDates.push({ dateStr, status: "missed" });
      } else {
        sortedDueDates.push({ dateStr, status: "pending" });
      }
    }
  });

  // Streaks calculation (needs backward scanning starting from today/yesterday)
  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  // Let's sort sortedDueDates chronologically for easy streak calculations
  sortedDueDates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  // Scanning chronologically to find best streak, and tracking current streak
  for (let i = 0; i < sortedDueDates.length; i++) {
    const item = sortedDueDates[i];
    if (item.dateStr > todayStr) continue; // skip future

    if (item.status === "done" || item.status === "partial") {
      runningStreak++;
      if (runningStreak > bestStreak) {
        bestStreak = runningStreak;
      }
    } else if (item.status === "skipped") {
      // neutral, continues streak
    } else if (item.status === "missed") {
      runningStreak = 0;
    }
  }

  // To find current active streak: scan backward from today
  const pastItems = sortedDueDates.filter(item => item.dateStr <= todayStr).reverse();
  for (const item of pastItems) {
    if (item.status === "done" || item.status === "partial") {
      currentStreak++;
    } else if (item.status === "skipped") {
      // neutral, continue scanning back
    } else if (item.status === "missed") {
      // broke!
      break;
    } else if (item.status === "pending" && item.dateStr === todayStr) {
      // today is due but pending; do not break streak yet, continue scanning previous days
    } else {
      break;
    }
  }

  // Recovery After Miss Rate calculation
  // Percentage of times user completed (done/partial) the habit the NEXT due day after a "missed" day.
  let missesCount = 0;
  let recoveriesCount = 0;

  for (let i = 0; i < sortedDueDates.length - 1; i++) {
    const current = sortedDueDates[i];
    if (current.dateStr >= todayStr) break; // skip future or today

    if (current.status === "missed") {
      missesCount++;
      // check the next due day
      const nextDueIndex = i + 1;
      if (nextDueIndex < sortedDueDates.length) {
        const nextDueItem = sortedDueDates[nextDueIndex];
        // If recovery happened the next day, it should be done or partial
        if (nextDueItem.status === "done" || nextDueItem.status === "partial") {
          recoveriesCount++;
        }
      }
    }
  }

  const recoveryRate = missesCount > 0 ? Math.round((recoveriesCount / missesCount) * 100) : 100;

  // Consistency = Completed score
  // Done = 100%, Partial = 50%, Skipped = neutral (not counted as due), Missed = 0%
  let effectiveDueCount = 0;
  let earnedScore = 0;

  sortedDueDates.forEach(item => {
    if (item.dateStr > todayStr) return; // ignore future
    if (item.status === "skipped") return; // neutral, skip from formula

    effectiveDueCount++;
    if (item.status === "done") earnedScore += 1;
    if (item.status === "partial") earnedScore += 0.5;
  });

  const consistency = effectiveDueCount > 0 ? Math.round((earnedScore / effectiveDueCount) * 100) : 0;

  return {
    currentStreak,
    bestStreak,
    recoveryRate,
    consistency,
    totalCompleted,
    totalPartial,
    totalSkipped,
    totalMissed,
    totalDue
  };
}

// 5 consistency levels
export interface GamificationLevel {
  level: number;
  name: string;
  minPercent: number;
  maxPercent: number;
  message: string;
  badgeColor: string;
}

export const GAMIFICATION_LEVELS: GamificationLevel[] = [
  {
    level: 1,
    name: "Started",
    minPercent: 0,
    maxPercent: 20,
    message: "Discipline is showing up when it is hard. Zero shame, just take page 1.",
    badgeColor: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300"
  },
  {
    level: 2,
    name: "Building",
    minPercent: 20,
    maxPercent: 45,
    message: "The physics of habits favor motion. You're overcoming inertia.",
    badgeColor: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
  },
  {
    level: 3,
    name: "Consistent",
    minPercent: 45,
    maxPercent: 70,
    message: "A steady track. Minimum version on busy days is your secret strength.",
    badgeColor: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
  },
  {
    level: 4,
    name: "Disciplined",
    minPercent: 70,
    maxPercent: 88,
    message: "You're carving out deep cognitive grooves. Exceptionally strong execution.",
    badgeColor: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
  },
  {
    level: 5,
    name: "Locked In",
    minPercent: 88,
    maxPercent: 100,
    message: "This habit defines you. Masterful ownership of your life blueprint.",
    badgeColor: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
  }
];

export function getGamificationLevel(consistency: number): GamificationLevel {
  return GAMIFICATION_LEVELS.find(l => consistency >= l.minPercent && consistency <= l.maxPercent) || GAMIFICATION_LEVELS[0];
}
