import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { ViewCustomizer } from "./ViewCustomizer";
import {
  buildProjectAdapter,
  type ProjectRow,
} from "./adapters/projectAdapter";
import { t } from "../../lib/i18n";
import {
  projectHealth,
  projectHealthLabel,
  projectStatusLabel,
} from "../../lib/projectPortfolio";
import { deliveryStageLabels } from "../../lib/projectDelivery";
import { CheckCircle2, Circle, Minus } from "../../components/ui/Icon";

function groupByProjectId<T extends { projectId?: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = String(row.projectId || "");
    if (!id) continue;
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

function projectTitle(project: ProjectRow) {
  return String(project.title || project.name || "Untitled project");
}

function projectMetaLine(project: ProjectRow) {
  const key = String(project.key || project.projectKey || "").trim();
  const client = String(project.clientEntity || project.client || "").trim();
  return [key, client].filter(Boolean).join(" · ");
}

function isClosedStatus(status?: string) {
  return ["done", "completed", "closed", "archived", "cancelled", "canceled", "deleted"].includes(
    String(status || "").toLowerCase(),
  );
}

const ProjectTitleOpen = memo(function ProjectTitleOpen({
  project,
  onOpen,
  onRename,
}: {
  project: ProjectRow;
  onOpen: () => void;
  onRename: (title: string) => void;
}) {
  const name = projectTitle(project);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  if (editing) {
    return (
      <span className="do-command-project-title">
        <input
          aria-label={`Rename ${name}`}
          autoFocus
          data-testid="project-title-rename"
          onBlur={() => {
            const next = draft.trim();
            setEditing(false);
            if (next && next !== name) onRename(next);
            else setDraft(name);
          }}
          onChange={(event) => setDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(name);
              setEditing(false);
            }
          }}
          value={draft}
        />
        <small>{projectMetaLine(project)}</small>
      </span>
    );
  }

  return (
    <span className="do-command-project-title">
      <button
        aria-label={`Open ${name}`}
        className="do-command-project-title-open"
        data-testid="project-title-open"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (project.demo) return;
          setDraft(name);
          setEditing(true);
        }}
        title="Click to open · Double-click to rename"
        type="button"
      >
        {name}
      </button>
      <small>{projectMetaLine(project)}</small>
    </span>
  );
});

/**
 * Projects portfolio list — Asana-style rows (like My Work), not the heavy
 * spreadsheet ViewGrid. Single-click opens; checkboxes drive bulk selection.
 */
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
  ctxExtras: _ctxExtras,
}: {
  projects: ProjectRow[];
  tasks?: Array<Record<string, unknown> & { id?: string; projectId?: string; status?: string }>;
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
  const tasksByProject = useMemo(() => groupByProjectId(tasks), [tasks]);
  const risksByProject = useMemo(() => groupByProjectId(risks), [risks]);
  const memberLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      map.set(
        member.id,
        member.displayName || member.publicAlias || member.email || member.id,
      );
    }
    return map;
  }, [members]);

  const adapter = useMemo(
    () =>
      buildProjectAdapter({
        actorId,
        workspaceId,
        tasksByProject,
        risksByProject,
        onUpdateProject,
        onArchiveProject,
        onOpenProject,
        onOpenBrief,
        onOpenSummary,
      }),
    [
      actorId,
      workspaceId,
      tasksByProject,
      risksByProject,
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
      // Prefer list layout — migrate old table defaults in memory only.
      const normalized = remote.map((view) =>
        view.layout === "table" ? { ...view, layout: "list" as const } : view,
      );
      const next = normalized.length ? [defaultView, ...normalized] : [defaultView];
      setViews(next);
      const last = getLastUsedViewId(actorId, surface);
      if (last && next.some((view) => view.id === last)) setActiveId(last);
      else setActiveId(defaultView.id);
    } catch {
      setViews([defaultView]);
      setActiveId(defaultView.id);
    }
  }, [workspaceId, actorId, defaultView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = views.find((view) => view.id === activeId) || defaultView;
  // Force list layout even if a saved table view was last used.
  const listView: SavedView =
    active.layout === "table" ? { ...active, layout: "list" } : active;

  const applied = useMemo(
    () => applyView(projects, adapter, listView, { userId: actorId }),
    [projects, adapter, listView, actorId],
  );

  const selected = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const visibleIds = useMemo(
    () => applied.rows.map((row) => String(row.id)),
    [applied.rows],
  );
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange?.((selectedIds || []).filter((id) => !visibleIds.includes(id)));
      return;
    }
    const next = new Set(selectedIds || []);
    for (const id of visibleIds) next.add(id);
    onSelectionChange?.([...next]);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds || []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.([...next]);
  };

  const ensurePersisted = async (next: SavedView): Promise<SavedView> => {
    const withList = { ...next, layout: "list" as const };
    if (withList.isDefault || withList.id.startsWith("default:") || withList.id.startsWith("system:")) {
      const created = await persistDefaultCopy(withList, actorId, t("views.myView"));
      setViews((current) => [
        ...current.filter((view) => view.id !== defaultView.id && view.id !== created.id),
        defaultView,
        created,
      ]);
      setActiveId(created.id);
      await setLastUsedView(actorId, surface, created.id);
      return created;
    }
    return updateView(withList.id, withList, { userId: actorId }, withList);
  };

  const ownerLabel = (row: ProjectRow) => {
    const id = String(
      row.projectManagerId || row.ownerId || row.owner || row.contactId || "",
    );
    if (!id) return "—";
    return memberLabel.get(id) || String(row.projectManager || row.contact || id);
  };

  return (
    <div
      className="cw-views-surface is-asana-list"
      data-testid="projects-views-surface"
    >
      <ViewsBar
        activeViewId={listView.id}
        filterCount={listView.filters.length}
        groupLabel={
          listView.groupBy
            ? adapter.columns.find((col) => col.id === listView.groupBy)?.label
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
              layout: "list",
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
          listView.sort[0]
            ? adapter.columns.find((col) => col.id === listView.sort[0].columnId)?.label
            : undefined
        }
        views={views}
      />
      <div className="cw-views-body is-asana-list" data-testid="projects-asana-list">
        <div className="do-projects-asana-list">
          <div className="do-projects-asana-head" role="row">
            <button
              aria-label={allSelected ? "Deselect all" : "Select all visible projects"}
              className={`do-command-select-all ${allSelected ? "is-selected" : ""} ${
                someSelected && !allSelected ? "is-partial" : ""
              }`}
              data-testid="projects-select-all-header"
              disabled={visibleIds.length === 0}
              onClick={toggleAll}
              type="button"
            >
              {allSelected ? (
                <CheckCircle2 size={14} />
              ) : someSelected ? (
                <Minus size={14} />
              ) : (
                <Circle size={14} />
              )}
            </button>
            <span>Project</span>
            <span>Status</span>
            <span>Health</span>
            <span>Stage</span>
            <span>Owner</span>
            <span>Due</span>
            <span>Open</span>
          </div>
          {applied.rows.length === 0 ? (
            <div className="do-projects-asana-empty">No projects match this view.</div>
          ) : (
            applied.rows.map((project) => {
              const id = String(project.id);
              const projectTasks = tasksByProject.get(id) || [];
              const projectRisks = risksByProject.get(id) || [];
              const health =
                String(project.healthOverride || "") ||
                projectHealth(project, projectTasks, projectRisks);
              const openCount = projectTasks.filter((task) => !isClosedStatus(String(task.status))).length;
              const stage = String(project.deliveryStage || project.stage || "");
              const due = String(
                project.revisedDueDate || project.dueDate || project.targetDate || "",
              ).slice(0, 10);
              const selectedRow = selected.has(id);
              return (
                <article
                  className={`do-projects-asana-row do-command-project-block ${
                    selectedRow ? "is-selected" : ""
                  } ${project.demo ? "is-demo" : ""}`}
                  data-testid="projects-asana-row"
                  key={id}
                  onClick={() => onOpenProject(project)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenProject(project);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <button
                    aria-label={selectedRow ? "Deselect project" : "Select project"}
                    className={`do-command-select-all ${selectedRow ? "is-selected" : ""}`}
                    data-testid="projects-row-select"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleOne(id);
                    }}
                    type="button"
                  >
                    {selectedRow ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                  </button>
                  <div className="do-command-project-name">
                    <ProjectTitleOpen
                      onOpen={() => onOpenProject(project)}
                      onRename={(title) => void onUpdateProject(id, { title })}
                      project={project}
                    />
                  </div>
                  <span className="do-projects-asana-pill">
                    {projectStatusLabel(String(project.status || "active"))}
                  </span>
                  <span
                    className={`do-projects-asana-health is-${String(health).replace(/_/g, "-")}`}
                  >
                    {projectHealthLabel(health as any)}
                  </span>
                  <span>
                    {(deliveryStageLabels as Record<string, string>)[stage] || stage || "—"}
                  </span>
                  <span title={ownerLabel(project)}>{ownerLabel(project)}</span>
                  <span className="do-projects-asana-due">{due || "—"}</span>
                  <span className="do-projects-asana-open tabular-nums">{openCount}</span>
                </article>
              );
            })
          )}
        </div>
      </div>
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
              listView;
            const created = await createView({
              ...rest,
              scope: "team",
              name: `${listView.name} · team`,
              ownerId: actorId,
              layout: "list",
            });
            setViews((current) => [...current, created]);
            setActiveId(created.id);
          })();
        }}
        open={customizerOpen}
        view={listView}
      />
    </div>
  );
}
