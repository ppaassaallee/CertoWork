import { useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Layers
} from "lucide-react";

interface MetadataReportViewerProps {
  report: {
    actionPlanId: string;
    requestedUpdates: number;
    appliedUpdates: number;
    verifiedUpdates: number;
    failedUpdates: number;
    skippedUpdates: number;
    needsReview: number;
    results: Array<{
      taskId: string;
      title: string;
      status: "applied" | "failed" | "skipped";
      before: any;
      after: any;
      verified: boolean;
      error: string | null;
    }>;
  };
}

export function MetadataReportViewer({ report }: MetadataReportViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    requestedUpdates = 0,
    appliedUpdates = 0,
    verifiedUpdates = 0,
    failedUpdates = 0,
    results = []
  } = report;

  // Find elements that still need review
  const stillNeedsReview = results.filter(
    (r) => r.status === "failed" || !r.verified
  );

  return (
    <div className="mt-4 p-5 bg-neutral-50 rounded-2xl border border-neutral-200/60 shadow-sm space-y-4 text-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-neutral-900 text-white rounded-xl shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-neutral-900">
              Boldi applied task metadata updates
            </h4>
            <span className="text-[9px] text-neutral-400 font-mono">
              Plan ID: {report.actionPlanId.slice(0, 8)}...
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 hover:bg-neutral-200/60 rounded-lg text-neutral-500 hover:text-black transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-2.5 rounded-xl border border-neutral-150 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Scanned</div>
          <div className="text-sm font-extrabold text-neutral-900">{requestedUpdates}</div>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-neutral-150 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-emerald-600">Applied</div>
          <div className="text-sm font-extrabold text-emerald-700">{appliedUpdates}</div>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-neutral-150 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-blue-600">Verified</div>
          <div className="text-sm font-extrabold text-blue-700">{verifiedUpdates}</div>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-neutral-150 text-center col-span-3 sm:col-span-1">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-rose-600">Failed</div>
          <div className="text-sm font-extrabold text-rose-700">{failedUpdates}</div>
        </div>
      </div>

      {/* Expandable Table of updates */}
      {expanded && results.length > 0 && (
        <div className="border border-neutral-200/60 rounded-xl overflow-hidden bg-white shadow-inner max-h-72 overflow-y-auto">
          <table className="min-w-full divide-y divide-neutral-100 text-[10px]">
            <thead className="bg-neutral-50 font-bold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Task</th>
                <th className="px-2 py-2 text-left">Field Changes</th>
                <th className="px-2 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {results.map((item, idx) => {
                const changesList: Array<{ field: string; before: any; after: any }> = [];
                const fields = ["priority", "dueDate", "context", "actionType"];
                fields.forEach((f) => {
                  const bVal = item.before?.[f];
                  const aVal = item.after?.[f];
                  if (bVal !== aVal) {
                    changesList.push({ field: f, before: bVal, after: aVal });
                  }
                });

                return (
                  <tr key={idx} className="hover:bg-neutral-50/50">
                    <td className="px-3 py-2 font-bold text-neutral-850 max-w-[120px] truncate">
                      {item.title}
                    </td>
                    <td className="px-2 py-2 text-neutral-600 space-y-1">
                      {changesList.length === 0 ? (
                        <span className="text-neutral-400 italic">No change (already aligned)</span>
                      ) : (
                        changesList.map((c, cIdx) => (
                          <div key={cIdx} className="flex flex-wrap items-center gap-1">
                            <span className="font-semibold capitalize text-neutral-500">{c.field}:</span>
                            <span className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-400 max-w-[60px] truncate">{c.before || "None"}</span>
                            <span>→</span>
                            <span className="bg-amber-50 text-amber-800 px-1 py-0.5 rounded font-semibold max-w-[60px] truncate">{c.after || "None"}</span>
                          </div>
                        ))
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex justify-center">
                        {item.verified ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> {item.status}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Still Needs Review Segment */}
      {stillNeedsReview.length > 0 && (
        <div className="bg-rose-50/55 p-3.5 rounded-xl border border-rose-100 space-y-2.5">
          <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Still needs review ({stillNeedsReview.length})
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {stillNeedsReview.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px] p-2 bg-white rounded-lg border border-rose-100">
                <div>
                  <div className="font-bold text-neutral-900">{item.title}</div>
                  <div className="text-neutral-400 mt-0.5">
                    Reason unresolved: {item.error || "Metadata was ambiguous or writing mismatched database verification"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="px-2 py-1 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-bold rounded-md transition-all">
                    Review manually
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
