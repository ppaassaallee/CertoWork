import React from "react";
import { Check, Dot, ShieldMinus, AlertCircle } from "lucide-react";
import { Habit, HabitLog } from "../../types";
import { isHabitDueOnDate } from "../../lib/habitUtils";

interface HabitMatrixGridProps {
  habits: Habit[];
  logs: HabitLog[];
  days: Date[];
  onToggleCell: (habitId: string, dateStr: string, currentStatus: string | undefined) => void;
  onSelectHabit: (habit: Habit) => void;
}

export function HabitMatrixGrid({ habits, logs, days, onToggleCell, onSelectHabit }: HabitMatrixGridProps) {
  const todayStr = new Date().toISOString().split("T")[0];

  // Helper to map habit logs for O(1) retrieval
  const logMap = new Map<string, string>();
  logs.forEach(l => {
    logMap.set(`${l.habitId}_${l.date}`, l.status);
  });

  const getDayLabel = (d: Date) => {
    return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
  };

  const isWeekend = (d: Date) => {
    const idx = d.getDay();
    return idx === 0 || idx === 6;
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Monthly Habit Matrix</h3>
          <p className="text-[11px] text-gray-400">Click a due cell to cycle states (Done → Partial → Skipped → Empty). Tap habit name to view stats.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-md" />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-amber-400 rounded-md opacity-70" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-slate-300 rounded-md" />
            <span>Skipped</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 border-2 border-rose-300 border-dashed rounded-md" />
            <span>Missed</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="sticky left-0 bg-white p-4 text-left font-black text-[10px] text-gray-400 uppercase tracking-widest min-w-[180px] border-r border-gray-50 max-w-[200px] shadow-sm z-10">
                Habit Spec
              </th>
              {days.map((day) => {
                const dateNum = day.getDate();
                const weekend = isWeekend(day);
                const isToday = day.toISOString().split("T")[0] === todayStr;

                return (
                  <th
                    key={day.toISOString()}
                    className={`p-2 text-center min-w-[36px] border-r border-gray-50/50 select-none ${
                      isToday
                        ? "bg-black text-white"
                        : weekend
                        ? "bg-gray-50/80 text-gray-400"
                        : "bg-white text-gray-500"
                    }`}
                  >
                    <div className="text-[9px] font-black tracking-tighter opacity-80 uppercase leading-none">
                      {getDayLabel(day)}
                    </div>
                    <div className="text-sm font-black tracking-tight mt-0.5 leading-none">
                      {dateNum}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => (
              <tr key={habit.id} className="border-b border-gray-50 hover:bg-gray-50/40 group">
                {/* Habit Label */}
                <td
                  onClick={() => onSelectHabit(habit)}
                  className="sticky left-0 bg-white p-4 font-bold text-xs text-gray-800 border-r border-gray-50 cursor-pointer hover:text-black hover:underline max-w-[180px] shadow-sm z-10 flex items-center gap-2 group-hover:bg-gray-50"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: habit.color || "#6366f1" }}
                  />
                  <div className="min-w-0 flex-1 truncate">
                    <div className="truncate text-gray-900 font-bold" title={habit.title}>{habit.title}</div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-0.5 min-w-0 truncate">
                      {habit.cadenceType}
                    </div>
                  </div>
                </td>

                {/* Days matrix cells */}
                {days.map((day) => {
                  const dateStr = day.toISOString().split("T")[0];
                  const isDue = isHabitDueOnDate(habit, day);
                  const isFuture = dateStr > todayStr;
                  const logStatus = logMap.get(`${habit.id}_${dateStr}`);

                  // Determine colors based on status or missed state
                  let cellContent = null;
                  let cellClass = "hover:scale-105 active:scale-95";
                  let cellStyle: React.CSSProperties = {};

                  const habitColor = habit.color || "#10b981";

                  if (!isDue) {
                    cellClass = "cursor-not-allowed bg-transparent";
                    cellContent = <Dot className="w-4 h-4 mx-auto text-gray-100" />;
                  } else if (logStatus === "done") {
                    cellStyle = { backgroundColor: habitColor };
                    cellClass += " text-white shadow-sm font-semibold shadow-emerald-100";
                    cellContent = <Check className="w-3.5 h-3.5 mx-auto" />;
                  } else if (logStatus === "partial") {
                    cellStyle = { backgroundColor: habitColor, opacity: 0.5 };
                    cellClass += " text-white font-medium border border-dashed border-white/50";
                    cellContent = (
                      <span className="text-[8px] font-black uppercase text-center block leading-none">
                        Pt
                      </span>
                    );
                  } else if (logStatus === "skipped") {
                    cellClass += " bg-slate-200 text-slate-800 font-semibold";
                    cellContent = <ShieldMinus className="w-3.5 h-3.5 mx-auto opacity-75" />;
                  } else {
                    // No log exists for this due day
                    const isMissed = dateStr < todayStr;
                    if (isMissed) {
                      cellClass += " border-2 border-rose-300 border-dashed text-rose-500 hover:bg-rose-50/50 bg-rose-50/10";
                      cellContent = <AlertCircle className="w-3.5 h-3.5 mx-auto opacity-40 text-rose-400" />;
                    } else {
                      // Pending today or future
                      cellClass += " bg-gray-50 border border-gray-200/60 hover:bg-gray-100/60";
                    }
                  }

                  const handleCellClick = () => {
                    if (!isDue) return;
                    if (isFuture) {
                      // Allow planning check if desired but obey future boundary
                      alert("Future habit states cannot be logged in advance.");
                      return;
                    }
                    onToggleCell(habit.id, dateStr, logStatus);
                  };

                  return (
                    <td
                      key={day.toISOString()}
                      onClick={handleCellClick}
                      className="p-1 px-[3px] text-center border-r border-gray-50/50 align-middle"
                    >
                      <button
                        type="button"
                        className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center transition-all cursor-pointer ${cellClass}`}
                        style={cellStyle}
                        title={`${habit.title} on ${dateStr}${logStatus ? ` (${logStatus})` : ""}`}
                      >
                        {cellContent}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
