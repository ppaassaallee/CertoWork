import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createView,
  getLastUsedViewId,
  listViews,
  persistDefaultCopy,
  setLastUsedView,
  updateView,
} from "../../lib/views/storage";
import type { ActionContext, SavedView, Surface } from "../../lib/views/types";
import { ViewGrid } from "./ViewGrid";
import { ViewsBar } from "./ViewsBar";
import { ViewCustomizer } from "./ViewCustomizer";
import {
  buildMyWorkSystemViews,
  buildTaskAdapter,
  type TaskRow,
} from "./adapters/taskAdapter";
import { t } from "../../lib/i18n";

export function MyWorkViewsSurface({
  tasks,
  actorId,
  workspaceId,
  projects = [],
  members = [],
  onUpdateTask,
  onOpenItem,
  onOpenCollab,
  onDuplicate,
  ctxExtras,
  preferredSystemViewId,
}: {
  tasks: TaskRow[];
  actorId: string;
  workspaceId: string;
  projects?: Array<{ id: string; title?: string; name?: string }>;
  members?: Array<{ id: string; displayName?: string; email?: string; publicAlias?: string }>;
  onUpdateTask(taskId: string, patch: Record<string, unknown>): Promise<void> | void;
  onOpenItem(id: string): void;
  onOpenCollab?(projectId: string): void;
  onDuplicate?(row: TaskRow): Promise<void> | void;
  ctxExtras?: Partial<ActionContext>;
  /** Sync from route: today / overdue / week */
  preferredSystemViewId?: string | null;
}) {
  const surface: Surface = "my-work";
  const adapter = useMemo(
    () =>
      buildTaskAdapter({
        actorId,
        workspaceId,
        projects,
        members,
        onUpdateTask,
        onOpenCollab,
        onDuplicate,
      }),
    [actorId, workspaceId, projects, members, onUpdateTask, onOpenCollab, onDuplicate],
  );
  const defaultView = useMemo(
    () => adapter.defaultView(surface),
    [adapter],
  );
  const systemViews = useMemo(
    () => buildMyWorkSystemViews(workspaceId, actorId, defaultView),
    [workspaceId, actorId, defaultView],
  );
  const [remoteViews, setRemoteViews] = useState<SavedView[]>([]);
  const [activeId, setActiveId] = useState(defaultView.id);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const views = useMemo(() => {
    const remote = remoteViews.filter(
      (view) => !systemViews.some((sys) => sys.id === view.id),
    );
    return [...systemViews, ...remote];
  }, [systemViews, remoteViews]);

  const refresh = useCallback(async () => {
    try {
      const listed = await listViews(workspaceId, surface, actorId);
      setRemoteViews(listed);
      if (preferredSystemViewId) {
        setActiveId(preferredSystemViewId);
        return;
      }
      const last = getLastUsedViewId(actorId, surface);
      if (
        last &&
        (listed.some((view) => view.id === last) ||
          systemViews.some((view) => view.id === last))
      ) {
        setActiveId(last);
      }
    } catch {
      setRemoteViews([]);
    }
  }, [workspaceId, actorId, systemViews, preferredSystemViewId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (preferredSystemViewId && systemViews.some((view) => view.id === preferredSystemViewId)) {
      setActiveId(preferredSystemViewId);
    }
  }, [preferredSystemViewId, systemViews]);

  const active = views.find((view) => view.id === activeId) || defaultView;

  const ctx: ActionContext = {
    userId: actorId,
    workspaceId,
    navigate: ctxExtras?.navigate || (() => undefined),
    openItem: (id) => onOpenItem(id),
    openOdysseus: ctxExtras?.openOdysseus || (() => undefined),
    toast: ctxExtras?.toast || (() => undefined),
  };

  const ensurePersisted = async (next: SavedView): Promise<SavedView> => {
    if (next.isDefault || next.id.startsWith("default:") || next.id.startsWith("system:")) {
      const created = await persistDefaultCopy(next, actorId, t("views.myView"));
      setRemoteViews((current) => [...current.filter((v) => v.id !== created.id), created]);
      setActiveId(created.id);
      await setLastUsedView(actorId, surface, created.id);
      return created;
    }
    return updateView(next.id, next, { userId: actorId }, next);
  };

  const removeFilter = (index: number) => {
    void (async () => {
      const next = {
        ...active,
        filters: active.filters.filter((_, i) => i !== index),
      };
      const saved = await ensurePersisted(next);
      setRemoteViews((current) =>
        current.map((view) => (view.id === saved.id ? saved : view)),
      );
      setActiveId(saved.id);
    })();
  };

  return (
    <div className="cw-views-surface" data-testid="my-work-views-surface">
      <ViewsBar
        activeViewId={active.id}
        filterCount={active.filters.length}
        groupLabel={
          active.groupBy
            ? adapter.columns.find((col) => col.id === active.groupBy)?.label
            : undefined
        }
        onCreate={() => {
          void (async () => {
            const { id: _id, isDefault: _d, createdAt: _c, updatedAt: _u, ...rest } =
              defaultView;
            const created = await createView({
              ...rest,
              name: t("views.myView"),
              scope: "personal",
              ownerId: actorId,
            });
            setRemoteViews((current) => [...current, created]);
            setActiveId(created.id);
            await setLastUsedView(actorId, surface, created.id);
          })();
        }}
        onOpenCustomizer={() => setCustomizerOpen(true)}
        onSelect={(viewId) => {
          setActiveId(viewId);
          void setLastUsedView(actorId, surface, viewId);
        }}
        sortLabel={
          active.sort[0]
            ? adapter.columns.find((col) => col.id === active.sort[0].columnId)?.label
            : undefined
        }
        views={views}
      />
      {active.filters.length ? (
        <div className="cw-views-filter-chips" data-testid="views-filter-chips">
          {active.filters.map((rule, index) => {
            const col = adapter.columns.find((entry) => entry.id === rule.columnId);
            const label = `${col?.label || rule.columnId}: ${rule.op}`;
            return (
              <button
                key={`${rule.columnId}-${rule.op}-${index}`}
                onClick={() => removeFilter(index)}
                type="button"
              >
                {label} ×
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="cw-views-body">
        <ViewGrid
          adapter={adapter}
          ctx={ctx}
          members={members.map((member) => ({
            id: member.id,
            name: member.displayName || member.publicAlias || member.email || member.id,
            email: member.email || "",
          }))}
          onOpenRow={(row) => onOpenItem(String(row.id))}
          rows={tasks}
          testId="my-work-grid"
          view={active}
        />
        <ViewCustomizer
          adapter={adapter}
          onChange={(next) => {
            void (async () => {
              const saved = await ensurePersisted(next);
              setRemoteViews((current) => {
                const without = current.filter((view) => view.id !== saved.id);
                return [...without, saved];
              });
              setActiveId(saved.id);
            })();
          }}
          onClose={() => setCustomizerOpen(false)}
          onReset={() => {
            setActiveId(defaultView.id);
            setCustomizerOpen(false);
          }}
          onSaveAsTeam={() => {
            void (async () => {
              const { id: _id, isDefault: _d, createdAt: _c, updatedAt: _u, ...rest } =
                active;
              const created = await createView({
                ...rest,
                scope: "team",
                name: `${active.name} · team`,
                ownerId: actorId,
              });
              setRemoteViews((current) => [...current, created]);
              setActiveId(created.id);
            })();
          }}
          open={customizerOpen}
          view={active}
        />
      </div>
    </div>
  );
}
