import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Sparkles } from "../../components/ui/Icon";

export type DashboardWidget = {
  id: string;
  title: string;
  kind: "number" | "chart" | "list";
  source: "table" | "billing" | "projects";
  tableId?: string;
  metric?: string;
  value?: number | string;
  items?: string[];
  w?: number;
  h?: number;
};

export type DashboardDoc = {
  id: string;
  workspaceId: string;
  name: string;
  widgets: DashboardWidget[];
  updatedAt: string;
};

function WidgetCard({
  widget,
  onRemove,
}: {
  widget: DashboardWidget;
  onRemove(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: "#fff",
    border: "1px solid #ECEEF3",
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-testid={`dash-widget-${widget.id}`}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13, color: "#1F2430" }}>{widget.title}</strong>
        <button type="button" onClick={onRemove} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF" }}>
          ×
        </button>
      </div>
      {widget.kind === "number" ? (
        <div style={{ fontSize: 28, fontWeight: 700, color: "#2547C4", fontFamily: "ui-monospace, monospace" }}>
          {widget.value ?? "—"}
        </div>
      ) : null}
      {widget.kind === "list" ? (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
          {(widget.items || []).map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      ) : null}
      {widget.kind === "chart" ? (
        <div style={{ height: 80, background: "linear-gradient(180deg,#E8EEFF,#F7F8FA)", borderRadius: 8 }} />
      ) : null}
    </div>
  );
}

export function DashboardPage(props: {
  dashboardId: string;
  workspaceId: string;
  onOpenOdysseus?(): void;
}) {
  const [dash, setDash] = useState<DashboardDoc | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    void getDoc(doc(db, "dashboards", props.dashboardId)).then((snap) => {
      if (snap.exists()) setDash({ id: snap.id, ...(snap.data() as Omit<DashboardDoc, "id">) });
      else {
        const seed: DashboardDoc = {
          id: props.dashboardId,
          workspaceId: props.workspaceId,
          name: "Property operations",
          widgets: [
            { id: "w1", title: "Rent collected this month", kind: "number", source: "table", value: "$0", metric: "rent_collected" },
            { id: "w2", title: "Occupancy rate", kind: "number", source: "table", value: "—", metric: "occupancy" },
            { id: "w3", title: "Open maintenance by priority", kind: "chart", source: "table", metric: "maint_priority" },
            { id: "w4", title: "Overdue accounting tasks", kind: "number", source: "table", value: 0, metric: "overdue" },
            { id: "w5", title: "Lease expirations next 90 days", kind: "list", source: "table", items: [], metric: "lease_exp" },
          ],
          updatedAt: new Date().toISOString(),
        };
        setDash(seed);
        void setDoc(doc(db, "dashboards", props.dashboardId), seed, { merge: true });
      }
    });
  }, [props.dashboardId, props.workspaceId]);

  const ids = useMemo(() => (dash?.widgets || []).map((w) => w.id), [dash]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!dash || !e.over || e.active.id === e.over.id) return;
    const oldIndex = dash.widgets.findIndex((w) => w.id === e.active.id);
    const newIndex = dash.widgets.findIndex((w) => w.id === e.over!.id);
    const widgets = arrayMove(dash.widgets, oldIndex, newIndex);
    const next = { ...dash, widgets, updatedAt: new Date().toISOString() };
    setDash(next);
    void setDoc(doc(db, "dashboards", dash.id), next, { merge: true });
  };

  if (!dash) return <div style={{ padding: 24 }}>Loading dashboard…</div>;

  return (
    <div className="cw-dashboard" data-testid="dashboard-page" style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: "#1F2430" }}>{dash.name}</h1>
        {props.onOpenOdysseus ? (
          <button type="button" className="cw-tables-chip-btn" onClick={props.onOpenOdysseus}>
            <Sparkles size={14} /> What changed this week?
          </button>
        ) : null}
      </header>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {dash.widgets.map((w) => (
              <WidgetCard
                key={w.id}
                widget={w}
                onRemove={() => {
                  const widgets = dash.widgets.filter((x) => x.id !== w.id);
                  const next = { ...dash, widgets };
                  setDash(next);
                  void setDoc(doc(db, "dashboards", dash.id), next, { merge: true });
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
