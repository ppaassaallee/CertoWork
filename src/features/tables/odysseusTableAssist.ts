import type { RecordDoc, TableDoc } from "../../lib/tables";
import { filterTableRecords, emptyTableFilters } from "../../lib/tables";

export type OdysseusTableAnswer = {
  text: string;
  recordIds: string[];
  suggestView?: { name: string; filters: Array<{ columnId: string; op: string; value?: unknown }> };
};

/** Answer table questions via filters (no direct writes). */
export function answerTableQuestion(
  table: TableDoc,
  records: RecordDoc[],
  question: string,
): OdysseusTableAnswer {
  const q = question.toLowerCase();
  if (q.includes("lease") && (q.includes("60") || q.includes("expire"))) {
    const leaseCol = table.columns.find((c) => /lease end/i.test(c.name))?.id;
    if (!leaseCol) {
      return { text: "No lease end column found.", recordIds: [] };
    }
    const now = Date.now();
    const in60 = now + 60 * 86400000;
    const hits = records.filter((r) => {
      const raw = String(r.values[leaseCol] || "");
      const t = Date.parse(raw);
      return Number.isFinite(t) && t >= now && t <= in60;
    });
    return {
      text:
        hits.length === 0
          ? "No leases expire in the next 60 days."
          : `${hits.length} lease(s) expire in the next 60 days: ${hits
              .map((h) => h.title || String(h.values[table.keyColumns.title] || ""))
              .join(", ")}`,
      recordIds: hits.map((h) => h.id),
      suggestView: {
        name: "Leases expiring in 60 days",
        filters: [{ columnId: leaseCol, op: "within_days", value: 60 }],
      },
    };
  }
  if (q.includes("pending") || q.includes("not complete")) {
    const statusCol = table.keyColumns.status || table.columns.find((c) => c.type === "status")?.id;
    if (!statusCol) return { text: "No status column.", recordIds: [] };
    const filters = emptyTableFilters();
    // Best-effort: return non-done statuses
    const hits = records.filter((r) => {
      const v = String(r.values[statusCol] || "").toLowerCase();
      return v && !v.includes("complete") && !v.includes("done");
    });
    void filterTableRecords;
    void filters;
    return {
      text: `${hits.length} open records`,
      recordIds: hits.map((h) => h.id),
    };
  }
  return {
    text: `I can filter this table (${records.length} records). Try: "which leases expire in the next 60 days?"`,
    recordIds: [],
  };
}

export function proposeAutomationsFromPatterns(patterns: {
  manualCompletionDateSets: number;
}): string | null {
  if (patterns.manualCompletionDateSets >= 12) {
    return "You set Completion date manually 12 times this month — automate it?";
  }
  return null;
}
