import { useState } from "react";
import { Loader2, Brain, AlertTriangle, Lightbulb, Sparkles, ChevronRight, Check } from "../ui/Icon";
import { Habit, HabitLog } from "../../types";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface HabitAIAnalyzerProps {
  habits: Habit[];
  logs: HabitLog[];
  userId: string;
  workspaceId: string;
}

interface AIAnalysisReport {
  strongestHabit: { title: string; analysis: string };
  needsAttentionHabit: { title: string; analysis: string };
  planAmbitiousness: string;
  minimumVersionSuggestions: string;
  nextWeekChange: string;
  suggestedPauseOrSimplify: string;
}

export function HabitAIAnalyzer({ habits, logs, userId, workspaceId }: HabitAIAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<AIAnalysisReport | null>(null);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (habits.length === 0) return;
    setAnalyzing(true);
    setReport(null);

    try {
      const response = await fetch("/api/habits/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habits: habits.map(h => ({
            id: h.id,
            title: h.title,
            description: h.description,
            minimumVersion: h.minimumVersion,
            idealVersion: h.idealVersion,
            cadenceType: h.cadenceType
          })),
          logs: logs.map(l => ({
            habitId: l.habitId,
            date: l.date,
            status: l.status
          })),
          period: "current month"
        })
      });

      if (!response.ok) {
        throw new Error("Analysis request failed");
      }

      const data = await response.json();
      setReport(data);
    } catch (e) {
      console.error(e);
      alert("Habit analysis failed. Please verify that your dev server is active and the API is running.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSendToInbox = async (key: string, title: string, content: string) => {
    try {
      await addDoc(collection(db, "inbox_items"), {
        userId,
        workspaceId,
        content: `[AI RECOMMENDATION: ${title}] ${content}`,
        status: "raw",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCopiedAction(key);
      setTimeout(() => setCopiedAction(null), 2000);
    } catch (err) {
      console.error("Error writing to inbox: ", err);
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI Habit Strategist</h3>
            <p className="text-xs text-gray-400">Evaluate consistency, overload, and design next steps</p>
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || habits.length === 0}
          className="w-full sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 active:scale-95"
        >
          {analyzing ? (
            <>
              <Loader2 className="animate-spin w-4 h-4" />
              <span>Analyzing logs...</span>
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              <span>Analyze My Habits</span>
            </>
          )}
        </button>
      </div>

      {report ? (
        <div className="space-y-6 border-t border-gray-50 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strongest */}
            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100/50 space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest block">Anchor Habit (Strongest)</span>
              <h4 className="font-bold text-gray-900 text-sm">{report.strongestHabit.title}</h4>
              <p className="text-xs text-gray-600 leading-relaxed">{report.strongestHabit.analysis}</p>
            </div>

            {/* Needs Attention */}
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100/50 space-y-2">
              <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest block">Needs Attention</span>
              <h4 className="font-bold text-gray-900 text-sm">{report.needsAttentionHabit.title}</h4>
              <p className="text-xs text-gray-600 leading-relaxed">{report.needsAttentionHabit.analysis}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ambitiousness */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-500" /> Plan Ambitiousness
              </h4>
              <p className="text-xs text-gray-700 leading-relaxed">{report.planAmbitiousness}</p>
            </div>

            {/* Minimum Version Suggestions */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Minimum version strategy
              </h4>
              <p className="text-xs text-gray-700 leading-relaxed">{report.minimumVersionSuggestions}</p>
            </div>
          </div>

          {/* Actionable Next Steps */}
          <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/40 space-y-4">
            <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider">Next-Action Recommendations</h4>
            
            <div className="space-y-4">
              {/* One Change */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-100">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-indigo-600 uppercase">Primary Next Week Change</span>
                  <p className="text-xs text-gray-900 leading-relaxed">{report.nextWeekChange}</p>
                </div>
                <button
                  onClick={() => handleSendToInbox("nextChange", "Next Week Change", report.nextWeekChange)}
                  className="w-full sm:w-auto text-[10px] bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center gap-1 shrink-0 justify-center"
                >
                  {copiedAction === "nextChange" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Sent to Triage</span>
                    </>
                  ) : (
                    <>
                      <span>Send to GTD Inbox</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Pause or Simplify */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-100">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-amber-600 uppercase font-mono">Simplification Suggestion</span>
                  <p className="text-xs text-gray-900 leading-relaxed">{report.suggestedPauseOrSimplify}</p>
                </div>
                <button
                  onClick={() => handleSendToInbox("pauseSimplify", "Pause or Simplify Habit", report.suggestedPauseOrSimplify)}
                  className="w-full sm:w-auto text-[10px] bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center gap-1 shrink-0 justify-center"
                >
                  {copiedAction === "pauseSimplify" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Sent to Triage</span>
                    </>
                  ) : (
                    <>
                      <span>Send to GTD Inbox</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        habits.length === 0 && (
          <div className="text-center p-4 text-xs text-gray-400">
            Create or select habits first to trigger AI coaching and logs checks.
          </div>
        )
      )}
    </div>
  );
}
