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
  buildProjectAdapter,
  type ProjectRow,
} from "./adapters/projectAdapter";
import { t } from "../../lib/i18n";

export function ProjectsViewsSurface({
  projects,
  tasks = [],
  risks = [],
  actorId,
  workspaceId,
  members = [],
  onUpdateProject,
  onArchiveProject,
  onOpenProject,
  onOpenBrief,
  onOpenSummary,
  selectedIds,
  onSelectionChange,
  ctxExtras,
}: {
  projects: ProjectRow[];
  tasks?: Array<Record<string, unknown> & { id?: string; projectId?: string }>;
  risks?: Array<Record<string, unknown> & { projectId?: string }>;
  actorId: string;
  workspaceId: string;
  members?: Array<{ id: string; displayName?: string; email?: string; publicAlias?: string }>;
  onUpdateProject(projectId: string, patch: Record<string, unknown>): Promise<void> | void;
  onArchiveProject(project: ProjectRow): Promise<void> | void;
  onOpenProject(project: ProjectRow): void;
  onOpenBrief?(project: ProjectRow): void;
  onOpenSummary?(project: ProjectRow): void;
  selectedIds?: string[];
  onSelectionChange?(ids: string[]): void;
  ctxExtras?: Partial<ActionContext>;
}) {
  const surface: Surface = "projects-list";
  const adapter = useMemo(
    () =>
      buildProjectAdapter({
        actorId,
        workspaceId,
        tasks,
        risks,
        onUpdateProject,
        onArchiveProject,
        onOpenProject,
        onOpenBrief,
        onOpenSummary,
      }),
    [
      actorId,
      workspaceId,
      tasks,
      risks,
      onUpdateProject,
      onArchiveProject,
      onOpenProject,
      onOpenBrief,
      onOpenSummary,
    ],
  );
  const defaultView = useMemo(() => adapter.defaultView(surface), [adapter]);
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
  }, [workspaceId, actorId, defaultView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = views.find((view) => view.id === activeId) || defaultView;

  const ctx: ActionContext = {
    userId: actorId,
    workspaceId,
    navigate: ctxExtras?.navigate || (() => undefined),
    openItem: ctxExtras?.openItem || (() => undefined),
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
    <div className="cw-views-surface" data-testid="projects-views-surface">
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
          members={members.map((member) => ({
            id: member.id,
            name: member.displayName || member.publicAlias || member.email || member.id,
            email: member.email || "",
          }))}
          onOpenRow={(row) => onOpenProject(row)}
          onSelectionChange={onSelectionChange}
          onViewChange={(next) => {
            void (async () => {
              const saved = await ensurePersisted(next);
              setViews((current) => {
                const without = current.filter(
                  (view) => view.id !== saved.id && view.id !== next.id,
                );
                return [defaultView, ...without.filter((view) => !view.isDefault), saved];
              });
              setActiveId(saved.id);
            })();
          }}
          rows={projects}
          selectedIds={selectedIds}
          testId="projects-grid"
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
