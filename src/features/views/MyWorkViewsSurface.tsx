import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createView,
  getLastUsedViewId,
  listViews,
  persistDefaultCopy,
  setLastUsedView,
  updateView,
} from "../../lib/views/storage";
import { applyView } from "../../lib/views/apply";
import type { ActionContext, SavedView, Surface } from "../../lib/views/types";
import { ViewsBar } from "./ViewsBar";
import { ViewCustomizer, type CustomizerSection } from "./ViewCustomizer";
import {
  buildMyWorkSystemViews,
  buildTaskAdapter,
  type TaskRow,
} from "./adapters/taskAdapter";
import { t } from "../../lib/i18n";
import { actorEquivalentMemberIds } from "../../lib/myWorkItems";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";
import { WorkItemsCenter } from "../../components/WorkItemsCenter";
import type { WorkLane } from "../../lib/projectPortfolio";
import { GroupedItemsList } from "../lists/GroupedItemsList";

const LIST_LANG_KEY = "certoListLanguage";

function listLanguageOn() {
  try {
    return localStorage.getItem(LIST_LANG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Props forwarded into the Asana-style list body (WorkItemsCenter). */
export type MyWorkListBodyProps = {
  hierarchyTasks?: unknown[];
  tags?: unknown[];
  sprints?: unknown[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onAsk: (prompt: string) => void;
  onAskOdysseus?: (item: unknown) => void;
  onAddTask: (
    projectId: string,
    title: string,
    status: WorkLane,
    patch?: Record<string, unknown>,
  ) => Promise<string | void> | void;
  onCreateControlledOption?: (
    group: "delivery_entity" | "client_entity" | "tag",
    name: string,
  ) => Promise<string | void> | string | void;
  onRenameControlledOption?: (
    group: "delivery_entity" | "client_entity",
    option: { id?: string; name: string },
    name: string,
  ) => Promise<void> | void;
  onRenameWorkCategory?: (previous: string, name: string) => Promise<void> | void;
  onCreateProject?: (name: string) => Promise<string | void> | string | void;
  onOpenProjectConsole: (project: unknown) => void;
  onOpenFinanceLine?: (financeLineId: string) => void;
  onCreateSprint?: (patch: Record<string, unknown>) => Promise<void> | void;
  onUpdateSprint?: (sprintId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onInviteAssigneeEmail?: (email: string) => Promise<void> | void;
  notebookEntries?: unknown[];
  onOpenNote?: (noteId: string) => void;
  workspaceTables?: unknown[];
  workspaceRecords?: unknown[];
  onOpenRecord?: (tableId: string, recordId: string) => void;
  renderRowExtra?: (item: unknown) => ReactNode;
};

/**
 * My Work hybrid:
 * - Views engine chrome (saved views, filters, customizer, applyView)
 * - Asana-like list body via WorkItemsCenter (action buttons, attr icons, hierarchy)
 */
export function MyWorkViewsSurface({
  tasks,
  actorId,
  workspaceId,
  projects = [],
  members = [],
  actorEmail = "",
  actorMemberId = null,
  onUpdateTask,
  onOpenCollab,
  onDuplicate,
  preferredSystemViewId,
  listBody,
  /** Optional escape hatch: spreadsheet ViewGrid instead of Asana list. */
  listRenderer,
  /** Hide heavy views chrome (for Daily Plan tray / mobile). */
  compact = false,
}: {
  tasks: TaskRow[];
  actorId: string;
  workspaceId: string;
  projects?: Array<{ id: string; title?: string; name?: string }>;
  members?: WorkspaceMember[];
  actorEmail?: string;
  actorMemberId?: string | null;
  onUpdateTask(taskId: string, patch: Record<string, unknown>): Promise<void> | void;
  onOpenItem?(id: string): void;
  onOpenCollab?(projectId: string): void;
  onDuplicate?(row: TaskRow): Promise<void> | void;
  ctxExtras?: Partial<ActionContext>;
  preferredSystemViewId?: string | null;
  listBody: MyWorkListBodyProps;
  listRenderer?: (args: {
    rows: TaskRow[];
    view: SavedView;
    memberIds: string[];
  }) => ReactNode;
  compact?: boolean;
}) {
  const surface: Surface = "my-work";
  const meMemberIds = useMemo(
    () =>
      actorEquivalentMemberIds(
        { userId: actorId, memberId: actorMemberId, email: actorEmail },
        members,
      ),
    [actorId, actorMemberId, actorEmail, members],
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
        onDuplicate,
      }),
    [actorId, workspaceId, projects, members, onUpdateTask, onOpenCollab, onDuplicate],
  );
  const defaultView = useMemo(() => adapter.defaultView(surface), [adapter]);
  const systemViews = useMemo(
    () => buildMyWorkSystemViews(workspaceId, actorId, defaultView),
    [workspaceId, actorId, defaultView],
  );
  const [remoteViews, setRemoteViews] = useState<SavedView[]>([]);
  const [previewView, setPreviewView] = useState<SavedView | null>(null);
  const [groupedLook, setGroupedLook] = useState(() => listLanguageOn());
  const [activeId, setActiveId] = useState(defaultView.id);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerSection, setCustomizerSection] = useState<CustomizerSection>("customize");
  const [viewError, setViewError] = useState("");
  const openCustomizer = (section: CustomizerSection = "customize") => {
    setCustomizerSection(section);
    setCustomizerOpen(true);
    setViewError("");
  };

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
    } catch (error) {
      setRemoteViews([]);
      setViewError(error instanceof Error ? error.message : "Could not load saved views.");
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

  const selectedView = views.find((view) => view.id === activeId) || defaultView;
  const active = previewView?.id === selectedView.id ? previewView : selectedView;

  const appliedResult = useMemo(
    () =>
      applyView(tasks, adapter, active, {
        userId: actorId,
        memberIds: meMemberIds,
      }),
    [tasks, adapter, active, actorId, meMemberIds],
  );
  const appliedRows = appliedResult.rows;
  const toGroupedItem = (row: TaskRow) => ({
    id: row.id,
    title: String(row.title || row.name || "Untitled"),
    status: String(row.status || "Backlog"),
    priority: row.priority != null ? String(row.priority) : undefined,
    projectName: projects.find((project) => project.id === row.projectId)?.title ||
      projects.find((project) => project.id === row.projectId)?.name,
    due: row.dueDate ? String(row.dueDate) : row.due ? String(row.due) : null,
    assignees: Array.isArray(row.assignees)
      ? row.assignees.map((assignee: unknown) => String(assignee))
      : row.assigneeId ? [String(row.assigneeId)] : [],
    monoId: String(row.key || row.id).slice(0, 8),
  });

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
      setPreviewView(next);
      try {
        const saved = await ensurePersisted(next);
        setRemoteViews((current) =>
          current.map((view) => (view.id === saved.id ? saved : view)),
        );
        setActiveId(saved.id);
        setPreviewView(null);
        setViewError("");
      } catch (error) {
        setViewError(`Filter active only for this session; it could not be saved: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    })();
  };

  return (
    <div
      className={`cw-views-surface is-asana-list${compact ? " is-compact" : ""}`}
      data-testid="my-work-views-surface"
    >
      {compact ? (
        <div className="cw-views-bar is-compact" data-testid="views-bar">
          <button
            className="cw-views-compact-tool"
            data-testid="views-customize"
            onClick={() => openCustomizer("filter")}
            type="button"
          >
            Filter · Sort
            {active.filters.length ? ` · ${active.filters.length}` : ""}
          </button>
        </div>
      ) : (
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
            try {
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
              setViewError("");
              await setLastUsedView(actorId, surface, created.id);
            } catch (error) {
              setViewError(error instanceof Error ? error.message : "Could not create the view.");
            }
          })();
        }}
        onOpenCustomizer={openCustomizer}
        onSelect={(viewId) => {
          setPreviewView(null);
          setCustomizerOpen(false);
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
      )}
      {viewError ? <div className="cw-views-error" role="alert">{viewError}</div> : null}
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
      <div className="cw-views-body is-asana-list" data-testid="my-work-asana-list">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={() => {
              const next = !groupedLook;
              setGroupedLook(next);
              try {
                if (next) localStorage.setItem(LIST_LANG_KEY, "1");
                else localStorage.removeItem(LIST_LANG_KEY);
              } catch {
                /* ignore */
              }
            }}
            style={{
              border: "1px solid var(--c-line, #ECEEF3)",
              borderRadius: 8,
              background: groupedLook ? "rgba(37,71,196,.08)" : "#fff",
              color: "var(--c-blue, #2547C4)",
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              cursor: "pointer",
            }}
            type="button"
          >
            {groupedLook ? "Classic list" : "Grouped list"}
          </button>
        </div>
        {groupedLook && !listRenderer ? (
          <GroupedItemsList
            density={active.density === "compact" ? "compact" : "regular"}
            groupedRows={appliedResult.groups.map((group) => ({ key: group.key, label: group.label, items: group.rows.map(toGroupedItem) }))}
            items={appliedRows.map(toGroupedItem)}
            onComplete={(id) => void onUpdateTask(id, { status: "done" })}
            onDueChange={(id, due) => void onUpdateTask(id, { dueDate: due })}
            onOpen={(id) => listBody.onSelectItem(id)}
          />
        ) : listRenderer ? (
          listRenderer({ rows: appliedRows, view: active, memberIds: meMemberIds })
        ) : (
          <WorkItemsCenter
            activeProject={null}
            forceMode="list"
            savedView={active}
            hierarchyTasks={listBody.hierarchyTasks}
            notebookEntries={listBody.notebookEntries as any[]}
            onAddTask={listBody.onAddTask as any}
            onAsk={listBody.onAsk}
            onAskOdysseus={listBody.onAskOdysseus as any}
            onCreateControlledOption={listBody.onCreateControlledOption}
            onCreateProject={listBody.onCreateProject}
            onRenameControlledOption={listBody.onRenameControlledOption}
            onRenameWorkCategory={listBody.onRenameWorkCategory}
            onCreateSprint={listBody.onCreateSprint}
            onInviteAssigneeEmail={listBody.onInviteAssigneeEmail}
            onOpenCollabProject={onOpenCollab}
            onOpenFinanceLine={listBody.onOpenFinanceLine}
            onOpenNote={listBody.onOpenNote}
            onOpenProjectConsole={listBody.onOpenProjectConsole as any}
            onOpenRecord={listBody.onOpenRecord}
            onSelectItem={listBody.onSelectItem}
            onUpdateSprint={listBody.onUpdateSprint}
            onUpdateTask={onUpdateTask}
            projects={projects}
            selectedItemId={listBody.selectedItemId}
            sprints={listBody.sprints as any[]}
            tags={listBody.tags as any[]}
            tasks={appliedRows}
            workspaceMembers={members}
            workspaceRecords={listBody.workspaceRecords as any[]}
            workspaceTables={listBody.workspaceTables as any[]}
            renderRowExtra={listBody.renderRowExtra as any}
          />
        )}
        <ViewCustomizer
          adapter={adapter}
          onChange={(next) => {
            setPreviewView(next);
            void (async () => {
              try {
                const saved = await ensurePersisted(next);
                setRemoteViews((current) => {
                  const without = current.filter((view) => view.id !== saved.id);
                  return [...without, saved];
                });
                setActiveId(saved.id);
                setPreviewView(null);
                setViewError("");
              } catch (error) {
                setViewError(`Changes active only for this session; they could not be saved: ${error instanceof Error ? error.message : "Unknown error"}`);
              }
            })();
          }}
          onClose={() => setCustomizerOpen(false)}
          onReset={() => {
            setPreviewView(null);
            setActiveId(defaultView.id);
            setCustomizerOpen(false);
          }}
          onSaveAsTeam={(draft) => {
            void (async () => {
              try {
                const { id: _id, isDefault: _d, createdAt: _c, updatedAt: _u, ...rest } = draft;
                const created = await createView({
                  ...rest,
                  scope: "team",
                  name: `${draft.name} · team`,
                  ownerId: actorId,
                });
                setRemoteViews((current) => [...current, created]);
                setActiveId(created.id);
                setViewError("");
              } catch (error) {
                setViewError(error instanceof Error ? error.message : "Could not create the team view.");
              }
            })();
          }}
          open={customizerOpen}
          section={customizerSection}
          showQuickActions={false}
          columnIds={["title", "type", "status", "priority", "assignee", "due", "sprint", "project", "tags", "delivery", "client", "category", "phase", "gtd", "action_board"]}
          customizeColumnIds={["title", "status", "priority", "assignee", "due", "sprint", "project", "tags", "delivery", "client", "category", "phase", "gtd", "action_board"]}
          view={active}
        />
      </div>
    </div>
  );
}
