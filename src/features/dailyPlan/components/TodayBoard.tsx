import { useMemo, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus, Search } from "../../../components/ui/Icon";
import { BUCKETS, BUCKET_ORDER } from "../buckets";
import type { JoinedEntry } from "../useDayPlan";
import type { PlanBucket, PlanItem } from "../types";
import { BucketIcon, PlanEntryCard, usePlannedIds } from "./PlanEntryCard";

function ItemPicker({
  items,
  plannedIds,
  onPick,
  onClose,
}: {
  items: PlanItem[];
  plannedIds: Set<string>;
  onPick: (itemId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((item) => !plannedIds.has(item.id))
      .filter((item) => !needle || String(item.title || "").toLowerCase().includes(needle))
      .slice(0, 40);
  }, [items, plannedIds, q]);

  return (
    <div className="dp-item-picker" data-testid="daily-plan-item-picker">
      <div className="dp-item-picker-head">
        <Search size={14} />
        <input
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your items…"
          value={q}
        />
        <button onClick={onClose} type="button">
          Close
        </button>
      </div>
      <ul>
        {filtered.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => {
                onPick(item.id);
                onClose();
              }}
              type="button"
            >
              {String(item.title || "Untitled")}
            </button>
          </li>
        ))}
        {!filtered.length ? <li className="is-muted">No matching items</li> : null}
      </ul>
    </div>
  );
}

export function TodayBoard({
  entriesByBucket,
  items,
  projects,
  readOnly,
  keyItemId,
  onAdd,
  onMove,
  onRemove,
  onOpen,
  onToggleDone,
  onMarkItemDone,
  onToggleKey,
  onMoveToTomorrow,
}: {
  entriesByBucket: Record<PlanBucket, JoinedEntry[]>;
  items: PlanItem[];
  projects: Array<{ id: string; title?: string; name?: string; color?: string }>;
  readOnly?: boolean;
  keyItemId?: string | null;
  onAdd: (itemId: string, bucket: PlanBucket) => void;
  onMove: (itemId: string, toBucket: PlanBucket, toIndex: number) => void;
  onRemove: (itemId: string) => void;
  onOpen: (itemId: string) => void;
  onToggleDone: (entry: JoinedEntry, next: boolean) => void;
  onMarkItemDone: (item: PlanItem) => void;
  onToggleKey: (itemId: string) => void;
  onMoveToTomorrow?: (itemId: string, bucket: PlanBucket) => void;
}) {
  const plannedIds = usePlannedIds(entriesByBucket);
  const [pickerBucket, setPickerBucket] = useState<PlanBucket | null>(null);

  const onDragEnd = (result: DropResult) => {
    if (readOnly || !result.destination) return;
    const toBucket = result.destination.droppableId as PlanBucket;
    if (!BUCKET_ORDER.includes(toBucket)) return;
    onMove(result.draggableId, toBucket, result.destination.index);
  };

  return (
    <div className="dp-today-board" data-testid="daily-plan-today-board">
      <DragDropContext onDragEnd={onDragEnd}>
        {BUCKET_ORDER.map((bucketKey) => {
          const meta = BUCKETS[bucketKey];
          const entries = entriesByBucket[bucketKey];
          // Pin key item to top visually within its section
          const sorted = [...entries].sort((a, b) => {
            const aKey = keyItemId && a.itemId === keyItemId ? 0 : 1;
            const bKey = keyItemId && b.itemId === keyItemId ? 0 : 1;
            if (aKey !== bKey) return aKey - bKey;
            if (a.doneToday !== b.doneToday) return a.doneToday ? 1 : -1;
            return a.order - b.order;
          });
          return (
            <section
              className="dp-bucket"
              data-bucket={bucketKey}
              key={bucketKey}
              style={{ background: meta.bg, borderColor: meta.border }}
            >
              <header className="dp-bucket-head">
                <span className="dp-bucket-icon" style={{ color: meta.fg }}>
                  <BucketIcon name={meta.icon} />
                </span>
                <strong style={{ color: meta.fg }}>{meta.label}</strong>
                <span className="dp-bucket-count">{entries.length}</span>
                {!readOnly ? (
                  <button
                    aria-label={`Add to ${meta.label}`}
                    className="dp-bucket-add"
                    onClick={() => setPickerBucket(bucketKey)}
                    type="button"
                  >
                    <Plus size={14} />
                  </button>
                ) : null}
              </header>
              {pickerBucket === bucketKey ? (
                <ItemPicker
                  items={items}
                  onClose={() => setPickerBucket(null)}
                  onPick={(itemId) => onAdd(itemId, bucketKey)}
                  plannedIds={plannedIds}
                />
              ) : null}
              <Droppable droppableId={bucketKey} isDropDisabled={Boolean(readOnly)}>
                {(provided) => (
                  <div
                    className="dp-bucket-list"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {!sorted.length ? (
                      <p className="dp-bucket-hint">{meta.hint}</p>
                    ) : (
                      sorted.map((entry, index) => (
                        <Draggable
                          draggableId={entry.itemId}
                          index={index}
                          isDragDisabled={Boolean(readOnly)}
                          key={entry.itemId}
                        >
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                            >
                              <PlanEntryCard
                                dragHandleProps={
                                  readOnly
                                    ? undefined
                                    : ((dragProvided.dragHandleProps || {}) as unknown as Record<
                                        string,
                                        unknown
                                      >)
                                }
                                entry={entry}
                                isKey={Boolean(keyItemId && entry.itemId === keyItemId)}
                                onMarkItemDone={onMarkItemDone}
                                onMoveBucket={(itemId, bucket) => onMove(itemId, bucket, 0)}
                                onMoveToTomorrow={onMoveToTomorrow}
                                onOpen={onOpen}
                                onRemove={onRemove}
                                onToggleDone={onToggleDone}
                                onToggleKey={onToggleKey}
                                projects={projects}
                                readOnly={readOnly}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          );
        })}
      </DragDropContext>
    </div>
  );
}
