import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecordDoc, TableDoc } from "../../lib/tables";
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
import { buildRecordAdapter } from "./adapters/recordAdapter";
import type { TableMember } from "./cells/RecordCells";
import { t } from "../../lib/i18n";

export function RecordsViewSurface({
  table,
  records,
  members,
  actorId,
  workspaceId,
  onFieldChange: _onFieldChange,
  onCreateRecord,
  onDeleteRecords: _onDeleteRecords,
  onOpenRecord,
  ctxExtras,
}: {
  table: TableDoc;
  records: RecordDoc[];
  members: TableMember[];
  actorId: string;
  workspaceId: string;
  onFieldChange(recordId: string, columnId: string, value: unknown): void;
  onCreateRecord(title?: string): void;
  onDeleteRecords(ids: string[]): void;
  onOpenRecord(id: string): void;
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
    if (!next.isDefault && !next.id.startsWith("default:")) {
      return updateView(next.id, next, { userId: actorId }, next);
    }
    const created = await persistDefaultCopy(next, actorId, t("views.myView"));
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
        sortLabel={active.sort[0]?.columnId}
        views={views}
      />
      <div className="cw-views-body">
        <ViewGrid
          adapter={adapter}
          cellColumnLookup={(id) => table.columns.find((col) => col.id === id)}
          ctx={ctx}
          members={members}
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
