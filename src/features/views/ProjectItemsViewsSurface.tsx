import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createView,
  getLastUsedViewId,
  listViews,
  persistDefaultCopy,
  setLastUsedView,
  updateView,
} from "../../lib/views/storage";
import { applyView, viewToQuery } from "../../lib/views/apply";
import type { ActionContext, SavedView, Surface } from "../../lib/views/types";
import { ViewsBar } from "./ViewsBar";
import { ViewCustomizer } from "./ViewCustomizer";
import { buildTaskAdapter, type TaskRow } from "./adapters/taskAdapter";
import { t } from "../../lib/i18n";
import { actorEquivalentMemberIds } from "../../lib/myWorkItems";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";
import { WorkItemsCenter } from "../../components/WorkItemsCenter";
import type { WorkLane } from "../../lib/projectPortfolio";
import type { WorkItemsViewMode } from "../../lib/itemViewMemory";
import type { SprintRecord } from "../../lib/sprints";
import type { TagLike } from "../../lib/tagging";

/** Props for the Asana-style WorkItemsCenter body inside a project. */
export type ProjectItemsListBodyProps = {
  project: Record<string, unknown> & { id: string };
  hierarchyTasks?: unknown[];
  tags?: TagLike[];
  sprints?: SprintRecord[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onAsk?: (prompt: string) => void;
  onAskOdysseus?: (item: unknown) => void;
  onAddTask: (
    title: string,
    status: WorkLane,
    patch?: Record<string, unknown>,
  ) => Promise<string | void> | void;
  onCreateControlledOption?: (
    group: "delivery_entity" | "client_entity" | "tag",
    name: string,
  ) => Promise<string | void> | string | void;
  onCreateSprint?: (patch: Record<string, unknown>) => Promise<void> | void;
  onUpdateSprint?: (sprintId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onInviteAssigneeEmail?: (email: string) => Promise<void> | void;
  onOpenFinanceLine?: (financeLineId: string) => void;
  onTimelineModeChange?: (active: boolean) => void;
  onGanttFocusChange?: (focused: boolean) => void;
  /** Board/gantt/calendar chrome owned by the project shell. */
  mode?: WorkItemsViewMode;
  onModeChange?: (mode: WorkItemsViewMode) => void;
};

/**
 * Project Items hybrid:
 * - Views engine chrome (saved views, filters, customizer, applyView)
 * - Asana-like list body via WorkItemsCenter (not NotionProjectTable / ViewGrid)
 */
export function ProjectItemsViewsSurface({
  projectId,
  tasks,
  actorId,
  workspaceId,
  projects = [],
  members = [],
  onUpdateTask,
  onOpenCollab,
  onViewChange,
  listBody,
}: {
  projectId: string;
  tasks: TaskRow[];
  actorId: string;
  workspaceId: string;
  projects?: Array<{ id: string; title?: string; name?: string }>;
  members?: WorkspaceMember[];
  onUpdateTask(taskId: string, patch: Record<string, unknown>): Promise<void> | void;
  onOpenItem?(id: string): void;
  onOpenCollab?(projectId: string): void;
  onViewChange?(view: SavedView): void;
  ctxExtras?: Partial<ActionContext>;
  listBody: ProjectItemsListBodyProps;
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
  const defaultView = useMemo(() => adapter.defaultView(surface), [adapter, surface]);
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

  const appliedRows = useMemo(
    () =>
      applyView(tasks, adapter, active, {
        userId: actorId,
        memberIds: meMemberIds,
      }).rows,
    [tasks, adapter, active, actorId, meMemberIds],
  );

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

  const removeFilter = (index: number) => {
    void (async () => {
      const next = {
        ...active,
        filters: active.filters.filter((_, i) => i !== index),
      };
      const saved = await ensurePersisted(next);
      setViews((current) => current.map((view) => (view.id === saved.id ? saved : view)));
      setActiveId(saved.id);
    })();
  };

  const mode = listBody.mode || "list";
  const isList = mode === "list";

  return (
    <div
      className={`cw-views-surface is-asana-list${isList ? "" : " is-board-mode"}`}
      data-testid="project-items-views-surface"
    >
      {isList ? (
        <>
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
        </>
      ) : null}
      <div
        className={`cw-views-body is-asana-list`}
        data-testid="project-items-asana-list"
      >
        <WorkItemsCenter
          activeProject={listBody.project}
          compact
          forceMode={mode}
          hierarchyTasks={listBody.hierarchyTasks || tasks}
          onAddTask={(pid, title, status, patch) =>
            listBody.onAddTask(title, status, { ...patch, projectId: pid })
          }
          onAsk={listBody.onAsk || (() => undefined)}
          onAskOdysseus={listBody.onAskOdysseus as any}
          onCreateControlledOption={listBody.onCreateControlledOption}
          onCreateSprint={listBody.onCreateSprint}
          onGanttFocusChange={listBody.onGanttFocusChange}
          onInviteAssigneeEmail={listBody.onInviteAssigneeEmail}
          onOpenCollabProject={onOpenCollab}
          onOpenFinanceLine={listBody.onOpenFinanceLine}
          onOpenProjectConsole={() => undefined}
            onSelectItem={listBody.onSelectItem}
          onTimelineModeChange={listBody.onTimelineModeChange}
          onUpdateSprint={listBody.onUpdateSprint}
          onUpdateTask={onUpdateTask}
          projects={projects}
          selectedItemId={listBody.selectedItemId}
          sprints={listBody.sprints}
          tags={listBody.tags}
          tasks={appliedRows}
          workspaceMembers={members}
        />
        {isList ? (
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
        ) : null}
      </div>
    </div>
  );
}

export { viewToQuery };
