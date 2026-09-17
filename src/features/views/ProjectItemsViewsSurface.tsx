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
import { viewToQuery } from "../../lib/views/apply";
import { ViewGrid } from "./ViewGrid";
import { ViewsBar } from "./ViewsBar";
import { ViewCustomizer } from "./ViewCustomizer";
import { buildTaskAdapter, type TaskRow } from "./adapters/taskAdapter";
import { t } from "../../lib/i18n";
import { actorEquivalentMemberIds } from "../../lib/myWorkItems";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";

export function ProjectItemsViewsSurface({
  projectId,
  tasks,
  actorId,
  workspaceId,
  projects = [],
  members = [],
  onUpdateTask,
  onOpenItem,
  onOpenCollab,
  onViewChange,
  ctxExtras,
}: {
  projectId: string;
  tasks: TaskRow[];
  actorId: string;
  workspaceId: string;
  projects?: Array<{ id: string; title?: string; name?: string }>;
  members?: WorkspaceMember[];
  onUpdateTask(taskId: string, patch: Record<string, unknown>): Promise<void> | void;
  onOpenItem(id: string): void;
  onOpenCollab?(projectId: string): void;
  onViewChange?(view: SavedView): void;
  ctxExtras?: Partial<ActionContext>;
}) {
  const surface = `project:${projectId}` as Surface;
  const meMemberIds = useMemo(
    () =>
      actorEquivalentMemberIds(
        {
          userId: actorId,
          memberId: members.find((member) => member.userId === actorId)?.id,
        },
        members,
      ),
    [actorId, members],
  );
  const adapter = useMemo(
    () =>
      buildTaskAdapter({
        actorId,
        workspaceId,
        projects,
        members,
        onUpdateTask,
        onOpenCollab,
      }),
    [actorId, workspaceId, projects, members, onUpdateTask, onOpenCollab],
  );
  const defaultView = useMemo(
    () => adapter.defaultView(surface),
    [adapter, surface],
  );
  const [views, setViews] = useState<SavedView[]>([defaultView]);
  const [activeId, setActiveId] = useState(defaultView.id);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const remote = await listViews(workspaceId, surface, actorId);
      const next = remote.length ? [defaultView, ...remote] : [defaultView];
      setViews(next);
      const last = getLastUsedViewId(actorId, surface);
      if (last && next.some((view) => view.id === last)) setActiveId(last);
    } catch {
      setViews([defaultView]);
    }
  }, [workspaceId, surface, actorId, defaultView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = views.find((view) => view.id === activeId) || defaultView;

  useEffect(() => {
    onViewChange?.(active);
  }, [active, onViewChange]);

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
      setViews((current) => [
        ...current.filter((view) => view.id !== defaultView.id && view.id !== created.id),
        defaultView,
        created,
      ]);
      setActiveId(created.id);
      await setLastUsedView(actorId, surface, created.id);
      return created;
    }
    return updateView(next.id, next, { userId: actorId }, next);
  };

  return (
    <div className="cw-views-surface" data-testid="project-items-views-surface">
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
            setViews((current) => [...current, created]);
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
      <div className="cw-views-body">
        <ViewGrid
          adapter={adapter}
          ctx={ctx}
          memberIds={meMemberIds}
          members={members.map((member) => ({
            id: member.id,
            name: member.displayName || member.alias || member.email || member.id,
            email: member.email || "",
          }))}
          onOpenRow={(row) => onOpenItem(String(row.id))}
          rows={tasks}
          testId="project-items-grid"
          view={active}
        />
        <ViewCustomizer
          adapter={adapter}
          onChange={(next) => {
            void (async () => {
              const saved = await ensurePersisted(next);
              setViews((current) =>
                current.map((view) => (view.id === saved.id ? saved : view)),
              );
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
              setViews((current) => [...current, created]);
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

export { viewToQuery };
