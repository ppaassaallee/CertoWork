import { useState } from "react";
import { CheckSquare, Square, Info } from "../ui/Icon";
import { STARTER_HABITS_LIST, StarterHabitDefinition } from "../../lib/habits";

interface StarterHabitsConfigProps {
  onCreate: (selected: StarterHabitDefinition[]) => void;
  isLoading: boolean;
}

export function StarterHabitConfig({ onCreate, isLoading }: StarterHabitsConfigProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>(STARTER_HABITS_LIST.map((_, i) => i));

  const toggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleCreate = () => {
    if (selectedIndices.length === 0) return;
    const selected = STARTER_HABITS_LIST.filter((_, idx) => selectedIndices.includes(idx));
    onCreate(selected);
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">Load Your Core Starter Matrix</h2>
        <p className="text-sm text-gray-500">
          Certo Work leverages a foundational physical-matrix blueprint. Review and select the routines that correspond to your current Core Work and recovery goals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[380px] overflow-y-auto p-2 border border-gray-100 rounded-2xl">
        {STARTER_HABITS_LIST.map((habit, index) => {
          const isSelected = selectedIndices.includes(index);
          return (
            <div
              key={habit.title}
              onClick={() => toggleSelect(index)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left flex items-start gap-3 select-none ${
                isSelected
                  ? "border-black bg-gray-50/50 shadow-sm"
                  : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className="mt-1 shrink-0">
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-black" />
                ) : (
                  <Square className="w-5 h-5 text-gray-300" />
                )}
              </div>
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <h4 className="font-bold text-xs text-gray-900 truncate">{habit.title}</h4>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal line-clamp-2">
                  {habit.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-1 text-[9px] font-bold uppercase tracking-wider">
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {habit.cadenceType}
                  </span>
                  <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                    {habit.type}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Info className="w-4 h-4 shrink-0" />
          <span>Selected {selectedIndices.length} of {STARTER_HABITS_LIST.length} starter habits to log.</span>
        </div>
        <button
          onClick={handleCreate}
          disabled={isLoading || selectedIndices.length === 0}
          className="w-full sm:w-auto bg-black text-white hover:bg-gray-900 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:scale-100 disabled:opacity-50"
        >
          {isLoading ? "Creating..." : "Create Selected starter habits"}
        </button>
      </div>
    </div>
  );
}
