import { useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { setKeyItem } from "../../../lib/dayplan";
import { Flame, Sparkles, TrendingUp, X } from "../../../components/ui/Icon";
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

  const setBucket = (itemId: string, bucket: PlanBucket) => {
    setDraft((d) => ({
      ...d,
      entries: d.entries.map((x) => (x.itemId === itemId ? { ...x, bucket } : x)),
    }));
  };

  return (
    <>
      <div className="dp-scrim" onClick={onClose} />
      <aside className="dp-sheet" data-testid="daily-plan-proposal-sheet">
        <header className="dp-sh">
          <h3>Odysseus proposes your day</h3>
          <button className="dp-icobtn" onClick={onClose} style={{ marginLeft: "auto" }} type="button">
            <X size={16} />
          </button>
        </header>
        <div className="dp-sb">
          <div className="dp-summary">{draft.summary}</div>
          {BUCKET_ORDER.map((bucket) => {
            const rows = draft.entries.filter((e) => e.bucket === bucket);
            if (!rows.length) return null;
            const meta = BUCKETS[bucket];
            return (
              <section className="dp-bucket" data-bucket={bucket} key={bucket} style={{ margin: "0 0 12px" }}>
                <div className="dp-bucket-head">
                  {bucket === "fire" ? <Flame size={15} /> : null}
                  {bucket === "growth" ? <TrendingUp size={15} /> : null}
                  {bucket === "extra" ? <Sparkles size={15} /> : null}
                  <strong>{meta.label}</strong>
                  <span className="dp-bucket-count">{rows.length}</span>
                </div>
                {rows.map((row) => {
                  const item = items.find((i) => i.id === row.itemId);
                  const already = plannedIds.has(row.itemId);
                  return (
                    <article className={`dp-entry ${already ? "is-done-today" : ""}`} key={row.itemId}>
                      <span className="dp-entry-title" style={{ cursor: "default" }}>
                        {String(item?.title || row.itemId)}
                        <span className="dp-prop-reason">{row.reason}</span>
                        {already ? <span className="dp-prop-reason">Already planned</span> : null}
                      </span>
                      {!already ? (
                        <span className="dp-swap">
                          {BUCKET_ORDER.map((b) => (
                            <button
                              className={`${b === "fire" ? "f" : b === "growth" ? "g" : "e"}${row.bucket === b ? " on" : ""}`}
                              key={b}
                              onClick={() => setBucket(row.itemId, b)}
                              type="button"
                            >
                              {b === "fire" ? <Flame size={11} /> : null}
                              {b === "growth" ? <TrendingUp size={11} /> : null}
                              {b === "extra" ? <Sparkles size={11} /> : null}
                            </button>
                          ))}
                        </span>
                      ) : null}
                      {!already ? (
                        <button
                          className="dp-icobtn"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              entries: d.entries.filter((x) => x.itemId !== row.itemId),
                              keyItemId: d.keyItemId === row.itemId ? null : d.keyItemId,
                            }))
                          }
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
        <div className="dp-sf">
          <button className="dp-btn" disabled={busy} onClick={() => void discard()} type="button">
            Discard
          </button>
          <button className="dp-btn pri" disabled={busy} onClick={() => void accept()} type="button">
            Accept {draft.entries.filter((e) => !plannedIds.has(e.itemId)).length} items
          </button>
        </div>
      </aside>
    </>
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
