import { useMemo, useState } from "react";
import { StatusLight, taskDueStatus } from "../../../components/ui/StatusLight";
import { Flame, GripVertical, MoreHorizontal, Sparkles, Star, TrendingUp } from "../../../components/ui/Icon";
import { BUCKETS, BUCKET_ORDER } from "../buckets";
import type { PlanBucket } from "../types";
import type { JoinedEntry } from "../useDayPlan";
import type { PlanItem } from "../types";

function workKind(item: PlanItem | null): string {
  const raw = String(
    item?.workItemType || item?.type || item?.itemType || "",
  ).toLowerCase();
  if (raw.includes("epic")) return "epic";
  if (raw.includes("pbi") || raw.includes("feature") || raw.includes("story")) return "pbi";
  if (raw.includes("task") || raw.includes("bug") || raw.includes("subtask") || raw.includes("ticket")) {
    return "task";
  }
  if (!raw) return "pbi";
  return "task";
}

function ProjectChip({
  item,
  projects,
}: {
  item: PlanItem;
  projects: Array<{ id: string; title?: string; name?: string; color?: string }>;
}) {
  const project = projects.find((p) => p.id === item.projectId);
  const label = project?.title || project?.name || "";
  if (!label) return null;
  return (
    <span className="dp-project-chip" style={project?.color ? { borderColor: project.color } : undefined}>
      {label}
    </span>
  );
}

export function PlanEntryCard({
  entry,
  projects,
  readOnly,
  isKey,
  dragHandleProps,
  onOpen,
  onToggleDone,
  onMarkItemDone,
  onRemove,
  onMoveBucket,
  onToggleKey,
  onMoveToTomorrow,
}: {
  entry: JoinedEntry;
  projects: Array<{ id: string; title?: string; name?: string; color?: string }>;
  readOnly?: boolean;
  isKey?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onOpen: (itemId: string) => void;
  onToggleDone: (entry: JoinedEntry, next: boolean) => void;
  onMarkItemDone: (item: PlanItem) => void;
  onRemove: (itemId: string) => void;
  onMoveBucket: (itemId: string, bucket: PlanBucket) => void;
  onToggleKey: (itemId: string) => void;
  onMoveToTomorrow?: (itemId: string, bucket: PlanBucket) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const item = entry.item;
  const kind = workKind(item);
  const isProgressOnly = kind === "epic" || kind === "pbi";
  const due = item?.dueDate || item?.targetDate || null;
  const tone = taskDueStatus({ status: item?.status, dueDate: due });
  const bucket = BUCKETS[entry.bucket];

  if (!item) {
    return (
      <article className="dp-entry is-ghost" data-testid="daily-plan-ghost">
        <span className="dp-entry-title is-muted">Item no longer visible</span>
        {!readOnly ? (
          <button onClick={() => onRemove(entry.itemId)} type="button">
            Remove
          </button>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={`dp-entry ${entry.doneToday ? "is-done-today" : ""} ${isKey ? "is-key" : ""}`}
      data-bucket={entry.bucket}
      data-testid="daily-plan-entry"
      style={isKey ? { borderLeftColor: bucket.fg } : undefined}
    >
      {!readOnly ? (
        <button
          aria-label={entry.doneToday ? "Undo today mark" : "Mark for today"}
          className={`dp-entry-check ${entry.doneToday ? "is-checked" : ""}`}
          onClick={() => onToggleDone(entry, !entry.doneToday)}
          title={
            isProgressOnly
              ? 'Marks progress for today. Use "Mark done" to close the item.'
              : "Complete this task"
          }
          type="button"
        />
      ) : (
        <span className={`dp-entry-check ${entry.doneToday ? "is-checked" : ""}`} />
      )}
      <button
        className="dp-entry-title"
        onClick={() => onOpen(item.id)}
        type="button"
      >
        {String(item.title || "Untitled")}
      </button>
      <ProjectChip item={item} projects={projects} />
      {due ? <span className="dp-entry-due">{String(due).slice(0, 10)}</span> : null}
      <StatusLight label={false} size="sm" status={tone} />
      {!readOnly ? (
        <button
          aria-label={isKey ? "Unpin key task" : "Pin as key task"}
          className={`dp-entry-star ${isKey ? "is-on" : ""}`}
          onClick={() => onToggleKey(item.id)}
          type="button"
        >
          <Star size={14} />
        </button>
      ) : null}
      {!readOnly ? (
        <div className="dp-entry-more">
          <button
            aria-label="More actions"
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen ? (
            <div className="dp-entry-menu">
              {BUCKET_ORDER.filter((b) => b !== entry.bucket).map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    onMoveBucket(item.id, b);
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  Move to {BUCKETS[b].label}
                </button>
              ))}
              <button
                onClick={() => {
                  onRemove(item.id);
                  setMenuOpen(false);
                }}
                type="button"
              >
                Remove from today
              </button>
              {onMoveToTomorrow ? (
                <button
                  onClick={() => {
                    onMoveToTomorrow(item.id, entry.bucket);
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  Move to tomorrow
                </button>
              ) : null}
              {isProgressOnly ? (
                <button
                  onClick={() => {
                    onMarkItemDone(item);
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  Mark done
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!readOnly && dragHandleProps ? (
        <button
          aria-label="Drag"
          className="dp-entry-handle"
          type="button"
          {...dragHandleProps}
        >
          <GripVertical size={14} />
        </button>
      ) : null}
    </article>
  );
}

export function BucketIcon({ name }: { name: "flame" | "trending-up" | "sparkles" }) {
  if (name === "flame") return <Flame size={14} />;
  if (name === "trending-up") return <TrendingUp size={14} />;
  return <Sparkles size={14} />;
}

export function usePlannedIds(entriesByBucket: Record<PlanBucket, JoinedEntry[]>) {
  return useMemo(() => {
    const ids = new Set<string>();
    for (const bucket of BUCKET_ORDER) {
      for (const e of entriesByBucket[bucket]) ids.add(e.itemId);
    }
    return ids;
  }, [entriesByBucket]);
}
