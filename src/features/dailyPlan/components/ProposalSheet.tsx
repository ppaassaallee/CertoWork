import { useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { setKeyItem } from "../../../lib/dayplan";
import { BUCKETS, BUCKET_ORDER } from "../buckets";
import { addEntries, updatePlanFields } from "../dayPlanService";
import { collectCandidates } from "../proposal/candidates";
import { heuristicProposal, llmProposal } from "../proposal/heuristics";
import type { DayPlan, PlanBucket, PlanItem, PlanProposal } from "../types";
import type { CalEvent } from "../calendar/types";
import type { LeftoverEntry } from "../useDayPlan";

export function ProposalSheet({
  uid,
  workspaceId,
  dateKey,
  items,
  leftovers,
  events,
  plan,
  plannedIds,
  onClose,
  onAccepted,
}: {
  uid: string;
  workspaceId: string;
  dateKey: string;
  items: PlanItem[];
  leftovers: LeftoverEntry[];
  events: CalEvent[];
  plan: DayPlan | null;
  plannedIds: Set<string>;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const seed = useMemo(() => {
    if (plan?.pendingProposal) return plan.pendingProposal;
    const candidates = collectCandidates(items, leftovers, events, dateKey, plannedIds);
    return heuristicProposal(candidates) as PlanProposal;
  }, [plan?.pendingProposal, items, leftovers, events, dateKey, plannedIds]);

  const [draft, setDraft] = useState<PlanProposal>(seed);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await addEntries(
        uid,
        dateKey,
        draft.entries.map((e) => ({ itemId: e.itemId, bucket: e.bucket })),
      );
      if (draft.keyItemId) {
        await setKeyItem(uid, workspaceId, dateKey, draft.keyItemId);
      }
      await updatePlanFields(uid, dateKey, { pendingProposal: null });
      onAccepted();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    await updatePlanFields(uid, dateKey, { pendingProposal: null });
    onClose();
  };

  return (
    <div className="dp-sheet" data-testid="daily-plan-proposal-sheet">
      <header>
        <h3>Plan my day</h3>
        <button onClick={onClose} type="button">
          Close
        </button>
      </header>
      <p>{draft.summary}</p>
      {BUCKET_ORDER.map((bucket) => {
        const rows = draft.entries.filter((e) => e.bucket === bucket);
        if (!rows.length) return null;
        return (
          <section key={bucket}>
            <strong style={{ color: BUCKETS[bucket].fg }}>{BUCKETS[bucket].label}</strong>
            <ul>
              {rows.map((row) => {
                const item = items.find((i) => i.id === row.itemId);
                const already = plannedIds.has(row.itemId);
                return (
                  <li key={row.itemId} className={already ? "is-muted" : ""}>
                    <span>{String(item?.title || row.itemId)}</span>
                    <small>{row.reason}</small>
                    {already ? <em>Already planned</em> : null}
                    <select
                      disabled={already}
                      onChange={(e) => {
                        const nextBucket = e.target.value as PlanBucket;
                        setDraft((d) => ({
                          ...d,
                          entries: d.entries.map((x) =>
                            x.itemId === row.itemId ? { ...x, bucket: nextBucket } : x,
                          ),
                        }));
                      }}
                      value={row.bucket}
                    >
                      {BUCKET_ORDER.map((b) => (
                        <option key={b} value={b}>
                          {BUCKETS[b].label}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={already}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          entries: d.entries.filter((x) => x.itemId !== row.itemId),
                          keyItemId: d.keyItemId === row.itemId ? null : d.keyItemId,
                        }))
                      }
                      type="button"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div className="dp-board-header">
        <button className="dp-cta-btn" disabled={busy} onClick={() => void accept()} type="button">
          Accept
        </button>
        <button disabled={busy} onClick={() => void discard()} type="button">
          Discard
        </button>
      </div>
    </div>
  );
}

export async function runPlanMyDayProposal(input: {
  uid: string;
  dateKey: string;
  items: PlanItem[];
  leftovers: LeftoverEntry[];
  events: CalEvent[];
  plannedIds: Set<string>;
}): Promise<PlanProposal> {
  const candidates = collectCandidates(
    input.items,
    input.leftovers,
    input.events,
    input.dateKey,
    input.plannedIds,
  );
  const heuristic = heuristicProposal(candidates);
  const proposal = await llmProposal(candidates, input.events, heuristic);
  await updatePlanFields(input.uid, input.dateKey, {
    pendingProposal: { ...proposal, createdAt: Timestamp.now() },
  });
  return proposal;
}
