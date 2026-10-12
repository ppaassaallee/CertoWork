import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecordDoc, TableDoc } from "../../lib/tables";
import {
  createView,
  getLastUsedViewId,
  listViews,
  nextPersonalViewName,
  persistDefaultCopy,
  setLastUsedView,
  updateView,
} from "../../lib/views/storage";
import { copyOnWritePlan, dedupeViewsForDisplay } from "../../lib/views/displayViews";
import type { ActionContext, SavedView, Surface } from "../../lib/views/types";
import { ViewGrid } from "./ViewGrid";
import { ViewsBar } from "./ViewsBar";
import { ViewCustomizer, type CustomizerSection } from "./ViewCustomizer";
import { buildRecordAdapter } from "./adapters/recordAdapter";
import type { TableMember } from "./cells/RecordCells";
import { t } from "../../lib/i18n";

export function RecordsViewSurface({
  table,
  records,
  members,
  projects = [],
  actorId,
  workspaceId,
  onFieldChange: _onFieldChange,
  onCreateRecord,
  onDeleteRecords: _onDeleteRecords,
  onOpenRecord,
  onOpenProject,
  ctxExtras,
}: {
  table: TableDoc;
  records: RecordDoc[];
  members: TableMember[];
  projects?: Array<{ id: string; name: string }>;
  actorId: string;
  workspaceId: string;
  onFieldChange(recordId: string, columnId: string, value: unknown): void;
  onCreateRecord(title?: string): void;
  onDeleteRecords(ids: string[]): void;
  onOpenRecord(id: string): void;
  onOpenProject?(projectId: string): void;
  ctxExtras?: Partial<ActionContext>;
}) {
  const surface = `table:${table.id}` as Surface;
  const adapter = useMemo(
    () =>
      buildRecordAdapter({
        table,
        members,
        actorId,
        onOpenRecord,
      }),
    [table, members, actorId, onOpenRecord],
  );
  const defaultView = useMemo(
    () => adapter.defaultView(surface),
    [adapter, surface],
  );
  const [views, setViews] = useState<SavedView[]>([defaultView]);
  const [activeId, setActiveId] = useState(defaultView.id);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerSection, setCustomizerSection] = useState<CustomizerSection>("customize");

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

  const active =
    views.find((view) => view.id === activeId) || defaultView;

  const ctx: ActionContext = {
    userId: actorId,
    workspaceId,
    navigate: ctxExtras?.navigate || (() => undefined),
    openItem: (id) => onOpenRecord(id),
    openOdysseus: ctxExtras?.openOdysseus || (() => undefined),
    toast: ctxExtras?.toast || (() => undefined),
  };

  const ensurePersisted = async (next: SavedView): Promise<SavedView> => {
    if (!next.isDefault && !next.id.startsWith("default:") && !next.id.startsWith("system:")) {
      return updateView(next.id, next, { userId: actorId }, next);
    }
    const plan = copyOnWritePlan(views, t("views.myView"));
    if (plan.action === "update") {
      const existing = views.find((view) => view.id === plan.id);
      if (existing) {
        const saved = await updateView(
          existing.id,
          { ...next, name: existing.name, scope: "personal", ownerId: actorId },
          { userId: actorId },
          existing,
        );
        setViews((current) => current.map((view) => (view.id === saved.id ? saved : view)));
        setActiveId(saved.id);
        await setLastUsedView(actorId, surface, saved.id);
        return saved;
      }
    }
    const created = await persistDefaultCopy(
      next,
      actorId,
      plan.action === "create" ? plan.name : t("views.myView"),
    );
    setViews((current) => [...current.filter((v) => v.id !== defaultView.id), defaultView, created]);
    setActiveId(created.id);
    await setLastUsedView(actorId, surface, created.id);
    return created;
  };

  return (
    <div className="cw-views-surface" data-testid="records-view-surface">
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
              name: nextPersonalViewName(views.map((view) => view.name), t("views.myView")),
              scope: "personal",
              ownerId: actorId,
            });
            setViews((current) => [...current, created]);
            setActiveId(created.id);
            await setLastUsedView(actorId, surface, created.id);
          })();
        }}
        onOpenCustomizer={(section = "customize") => { setCustomizerSection(section); setCustomizerOpen(true); }}
        onSelect={(viewId) => {
          setActiveId(viewId);
          void setLastUsedView(actorId, surface, viewId);
        }}
        sortLabel={active.sort[0]?.columnId}
        views={dedupeViewsForDisplay(views, active.id)}
      />
      <div className="cw-views-body">
        <ViewGrid
          adapter={adapter}
          cellColumnLookup={(id) => table.columns.find((col) => col.id === id)}
          ctx={ctx}
          members={members}
          projects={projects}
          onOpenProject={onOpenProject}
          onCreateRow={onCreateRecord}
          onOpenRow={(row) => onOpenRecord(row.id)}
          rows={records}
          testId="tables-grid"
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
          onSaveAsTeam={(draft) => {
            void (async () => {
              const { id: _id, isDefault: _d, createdAt: _c, updatedAt: _u, ...rest } =
                draft;
              const created = await createView({
                ...rest,
                scope: "team",
                name: `${draft.name} · team`,
                ownerId: actorId,
              });
              setViews((current) => [...current, created]);
              setActiveId(created.id);
            })();
          }}
          open={customizerOpen}
          section={customizerSection}
          view={active}
        />
      </div>
    </div>
  );
}
