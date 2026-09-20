import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { BUCKETS, BUCKET_ORDER } from "../buckets";
import { addDays } from "../dateKeys";
import { addEntry, removeEntry, updatePlanFields } from "../dayPlanService";
import { computeFocusScore } from "../focusScore";
import type { DayPlan, PlanBucket } from "../types";
import type { JoinedEntry } from "../useDayPlan";
import { closeDayPlan } from "../../../lib/dayplan";

type LeftoverChoice = "tomorrow" | "leave" | "drop";

export function CloseDaySheet({
  plan,
  entriesByBucket,
  uid,
  workspaceId,
  dateKey,
  keyItemId,
  onClosed,
  onCancel,
}: {
  plan: DayPlan;
  entriesByBucket: Record<PlanBucket, JoinedEntry[]>;
  uid: string;
  workspaceId: string;
  dateKey: string;
  keyItemId?: string | null;
  onClosed: () => void;
  onCancel: () => void;
}) {
  const leftovers = BUCKET_ORDER.flatMap((b) =>
    entriesByBucket[b].filter((e) => !e.doneToday && e.item),
  );
  const [choices, setChoices] = useState<Record<string, LeftoverChoice>>(() => {
    const init: Record<string, LeftoverChoice> = {};
    for (const e of leftovers) init[e.itemId] = "leave";
    return init;
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const doneCounts = BUCKET_ORDER.map((b) => ({
    bucket: b,
    done: entriesByBucket[b].filter((e) => e.doneToday).length,
    total: entriesByBucket[b].length,
  }));

  const score = computeFocusScore(plan, keyItemId);

  const onClose = async () => {
    setBusy(true);
    try {
      const tomorrow = addDays(dateKey, 1);
      for (const entry of leftovers) {
        const choice = choices[entry.itemId] || "leave";
        if (choice === "tomorrow") {
          await removeEntry(uid, dateKey, entry.itemId);
          await addEntry(uid, tomorrow, entry.itemId, entry.bucket);
        } else if (choice === "drop") {
          await removeEntry(uid, dateKey, entry.itemId);
        }
      }
      await updatePlanFields(uid, dateKey, {
        closedAt: Timestamp.now(),
        closingNote: note.trim() || null,
        focusScore: score,
      });
      try {
        await closeDayPlan(uid, workspaceId, dateKey, {
          feel: "normal",
          energy: {},
          carryForward: note.trim() || null,
        });
      } catch {
        /* legacy close best-effort */
      }
      onClosed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dp-scrim" onClick={onCancel} />
      <aside className="dp-sheet" data-testid="daily-plan-close-sheet">
        <header className="dp-sh">
          <h3>Close the day</h3>
          <span className="dp-board-meta">{dateKey}</span>
          <button className="dp-icobtn" onClick={onCancel} style={{ marginLeft: "auto" }} type="button">
            ✕
          </button>
        </header>
        <div className="dp-sb">
          <div className="dp-stats">
            {doneCounts.map((row) => (
              <div className={`dp-stat ${row.bucket}`} key={row.bucket}>
                <div className="k">{BUCKETS[row.bucket].label}</div>
                <div className="v">
                  {row.done} / {row.total}
                </div>
              </div>
            ))}
          </div>
          {leftovers.length ? (
            <>
              <div className="dp-lab">Not finished. What happens to each?</div>
              <ul className="dp-close-leftovers">
                {leftovers.map((entry) => (
                  <li key={entry.itemId}>
                    <span>{String(entry.item?.title || "Untitled")}</span>
                    <div className="dp-seg">
                      {(["tomorrow", "leave", "drop"] as LeftoverChoice[]).map((c) => (
                        <button
                          className={choices[entry.itemId] === c ? "is-active" : ""}
                          key={c}
                          onClick={() =>
                            setChoices((prev) => ({ ...prev, [entry.itemId]: c }))
                          }
                          type="button"
                        >
                          {c === "tomorrow" ? "Tomorrow" : c === "leave" ? "Leave" : "Drop"}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <label className="dp-close-note">
            One line about today
            <textarea
              onChange={(e) => setNote(e.target.value)}
              placeholder="What mattered today?"
              value={note}
            />
          </label>
          <p className="dp-board-meta" style={{ marginTop: 14 }}>
            Focus score for today: {score ?? "—"}. No streaks, no penalties — tomorrow starts empty.
          </p>
        </div>
        <div className="dp-sf">
          <button className="dp-btn" onClick={onCancel} type="button">
            Not yet
          </button>
          <button className="dp-btn pri" disabled={busy} onClick={() => void onClose()} type="button">
            {busy ? "Closing…" : "Close the day"}
          </button>
        </div>
      </aside>
    </>
  );
}
