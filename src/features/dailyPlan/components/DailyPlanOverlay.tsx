import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { setKeyItem } from "../../../lib/dayplan";
import { useDayPlan as useLegacyDayPlan } from "../../dayplan/useDayPlan";
import { useAuth } from "../../../lib/AuthContext";
import { completeItem, reopenItem } from "../adapters/items";
import { confirmAction, toast } from "../adapters/ui";
import { addDays, getTodayKey, labelForKey } from "../dateKeys";
import { addEntries, addEntry, removeEntry, updatePlanFields } from "../dayPlanService";
import { computeFocusScore } from "../focusScore";
import "../dailyPlan.css";
import { CloseDaySheet } from "./CloseDaySheet";
import { DailyPlanCTA } from "./DailyPlanCTA";
import { PlanningTray, RowTodayAffordance } from "./PlanningTray";
import { TodayBoard } from "./TodayBoard";
import { WeekStrip } from "./WeekStrip";
import type { JoinedEntry } from "../useDayPlan";
import { useDayPlan } from "../useDayPlan";
import { useIsDesktop } from "../useIsDesktop";
import type { PlanBucket, PlanItem } from "../types";
import { BUCKET_ORDER } from "../buckets";

export type DailyPlanView = "items" | "today" | "events";

function readViewParam(): DailyPlanView | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("view");
  if (v === "items" || v === "today" || v === "events") return v;
  return null;
}

function writeViewParam(view: DailyPlanView) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.history.replaceState({}, "", url.toString());
}

export function DailyPlanOverlay({
  items,
  projects,
  workspaceId,
  onUpdateTask,
  onOpenItem,
  onNotice,
  listRenderer,
}: {
  items: PlanItem[];
  projects: Array<{ id: string; title?: string; name?: string; color?: string }>;
  workspaceId: string;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onOpenItem: (itemId: string) => void;
  onNotice?: (msg: string) => void;
  listRenderer: (args: {
    renderRowExtra?: (item: PlanItem) => ReactNode;
  }) => ReactNode;
}) {
  const { user } = useAuth();
  const desktop = useIsDesktop();
  const todayKey = getTodayKey();
  const [boardDateKey, setBoardDateKey] = useState(todayKey);
  const [view, setViewState] = useState<DailyPlanView>(() => readViewParam() || "items");
  const [closeOpen, setCloseOpen] = useState(false);

  const setView = useCallback((next: DailyPlanView) => {
    setViewState(next);
    writeViewParam(next);
  }, []);

  const day = useDayPlan(boardDateKey, items, {
    onError: (msg: string) => toast(msg, onNotice),
  });

  const legacyKey = useLegacyDayPlan({
    userId: user?.uid,
    workspaceId,
    items: items.map((item) => ({
      id: item.id,
      status: (String(item.status || "open").toLowerCase() === "done" ? "done" : "open") as
        | "open"
        | "done"
        | "archived",
    })),
  });

  useEffect(() => {
    const fromQuery = readViewParam();
    if (fromQuery) {
      setViewState(fromQuery);
      return;
    }
    if ((day.plan?.entries.length || 0) >= 1) setView("today");
  }, [day.plan?.entries.length, setView]);

  const plannedBucketById = useMemo(() => {
    const map = new Map<string, PlanBucket>();
    for (const bucket of BUCKET_ORDER) {
      for (const e of day.entriesByBucket[bucket]) map.set(e.itemId, bucket);
    }
    return map;
  }, [day.entriesByBucket]);

  const plannedIds = useMemo(() => new Set(plannedBucketById.keys()), [plannedBucketById]);

  const readOnly =
    boardDateKey < todayKey || Boolean(day.plan?.closedAt);

  const keyItemId = legacyKey.plan?.keyItemId ?? null;

  const onToggleDone = async (entry: JoinedEntry, next: boolean) => {
    const item = entry.item;
    if (!item) return;
    const kind = String(item.workItemType || item.type || item.itemType || "").toLowerCase();
    const isTaskLike =
      kind.includes("task") ||
      kind.includes("bug") ||
      kind.includes("subtask") ||
      kind.includes("ticket") ||
      kind.includes("issue");
    if (isTaskLike) {
      if (next) {
        try {
          await completeItem(onUpdateTask, item.id);
          await day.actions.setDoneToday(item.id, true);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Could not complete", onNotice);
        }
      } else {
        await day.actions.setDoneToday(item.id, false);
        try {
          await reopenItem(onUpdateTask, item.id);
        } catch {
          /* reopen best-effort */
        }
      }
      return;
    }
    await day.actions.setDoneToday(item.id, next);
  };

  const onMarkItemDone = async (item: PlanItem) => {
    if (!confirmAction(`Mark "${String(item.title || "item")}" done?`)) return;
    try {
      await completeItem(onUpdateTask, item.id);
      await day.actions.setDoneToday(item.id, true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not complete", onNotice);
    }
  };

  const onToggleKey = async (itemId: string) => {
    if (!user?.uid || !workspaceId) return;
    const next = keyItemId === itemId ? null : itemId;
    try {
      await setKeyItem(user.uid, workspaceId, boardDateKey, next);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not set key task", onNotice);
    }
  };

  const onMoveAllLeftovers = async (bucket: PlanBucket) => {
    if (!user?.uid) return;
    await addEntries(
      user.uid,
      boardDateKey,
      day.leftovers
        .filter((e) => !plannedIds.has(e.itemId))
        .map((e) => ({ itemId: e.itemId, bucket })),
    );
  };

  const onMoveToTomorrow = async (itemId: string, bucket: PlanBucket) => {
    if (!user?.uid) return;
    const tomorrow = addDays(boardDateKey, 1);
    try {
      await removeEntry(user.uid, boardDateKey, itemId);
      try {
        await addEntry(user.uid, tomorrow, itemId, bucket);
      } catch (err) {
        await addEntry(user.uid, boardDateKey, itemId, bucket);
        toast(err instanceof Error ? err.message : "Could not move to tomorrow", onNotice);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not move to tomorrow", onNotice);
    }
  };

  const focusScore = computeFocusScore(day.plan, keyItemId);

  const board = (
    <>
      <WeekStrip
        activeKey={boardDateKey}
        onSelectDay={(key) => {
          setBoardDateKey(key);
          setView("today");
        }}
        planRevision={day.plan?.updatedAt?.toMillis?.() || day.plan?.entries.length || 0}
        todayKey={todayKey}
      />
      <div className="dp-board-header">
        <h3>{labelForKey(boardDateKey, todayKey)}</h3>
        {boardDateKey === todayKey && focusScore != null ? (
          <span
            className="dp-focus-ring"
            title="Growth 3 · Fires 2 · Extras 1"
          >
            {focusScore}
          </span>
        ) : null}
        {boardDateKey !== todayKey ? (
          <button
            className="dp-link"
            onClick={() => setBoardDateKey(todayKey)}
            type="button"
          >
            Back to today
          </button>
        ) : null}
        {boardDateKey === todayKey && day.plan?.closedAt ? (
          <button
            className="dp-link"
            onClick={() =>
              user?.uid &&
              void updatePlanFields(user.uid, boardDateKey, { closedAt: null })
            }
            type="button"
          >
            Reopen day
          </button>
        ) : null}
        {boardDateKey === todayKey && !day.plan?.closedAt ? (
          <button
            className="dp-link"
            onClick={() => setCloseOpen(true)}
            type="button"
          >
            Close the day
          </button>
        ) : null}
      </div>
      {closeOpen && day.plan && user?.uid ? (
        <CloseDaySheet
          dateKey={boardDateKey}
          entriesByBucket={day.entriesByBucket}
          keyItemId={keyItemId}
          onCancel={() => setCloseOpen(false)}
          onClosed={() => setCloseOpen(false)}
          plan={day.plan}
          uid={user.uid}
          workspaceId={workspaceId}
        />
      ) : null}
      <TodayBoard
        entriesByBucket={day.entriesByBucket}
        items={items}
        keyItemId={keyItemId}
        onAdd={(itemId, bucket) => void day.actions.add(itemId, bucket)}
        onMarkItemDone={(item) => void onMarkItemDone(item)}
        onMove={(itemId, bucket, index) => void day.actions.move(itemId, bucket, index)}
        onMoveToTomorrow={
          readOnly ? undefined : (itemId, bucket) => void onMoveToTomorrow(itemId, bucket)
        }
        onOpen={onOpenItem}
        onRemove={(itemId) => void day.actions.remove(itemId)}
        onToggleDone={(entry, next) => void onToggleDone(entry, next)}
        onToggleKey={(itemId) => void onToggleKey(itemId)}
        projects={projects}
        readOnly={readOnly}
      />
    </>
  );

  const tray = (
    <PlanningTray
      leftovers={day.leftovers}
      onAdd={(itemId, bucket) => void day.actions.add(itemId, bucket)}
      onMoveAll={(bucket) => void onMoveAllLeftovers(bucket)}
      plannedIds={plannedIds}
      todayKey={todayKey}
    >
      {view === "items" && !day.plan?.entries.length ? (
        <DailyPlanCTA onPlan={() => setView("today")} />
      ) : null}
      {listRenderer({
        renderRowExtra: (item) => (
          <RowTodayAffordance
            item={item}
            onAdd={(itemId, bucket) => void day.actions.add(itemId, bucket)}
            onMove={(itemId, bucket) => void day.actions.move(itemId, bucket, 0)}
            plannedBucket={plannedBucketById.get(item.id) || null}
          />
        ),
      })}
    </PlanningTray>
  );

  if (desktop) {
    return (
      <div className="dp-shell dp-shell-desktop" data-testid="daily-plan-shell">
        <div className="dp-shell-left">{tray}</div>
        <div className="dp-shell-right">{board}</div>
      </div>
    );
  }

  return (
    <div className="dp-shell" data-testid="daily-plan-shell">
      <div className="dp-segments" role="tablist">
        <button
          className={view === "items" ? "is-active" : ""}
          onClick={() => setView("items")}
          type="button"
        >
          My items
        </button>
        <button
          className={view === "today" ? "is-active" : ""}
          onClick={() => setView("today")}
          type="button"
        >
          Today
        </button>
      </div>
      {view === "today" ? board : tray}
    </div>
  );
}
