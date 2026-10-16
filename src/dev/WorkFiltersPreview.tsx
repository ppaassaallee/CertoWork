import { useMemo, useState } from "react";
import { WorkItemsCenter } from "../components/WorkItemsCenter";
import { ViewCustomizer } from "../features/views/ViewCustomizer";
import { buildTaskAdapter, type TaskRow } from "../features/views/adapters/taskAdapter";
import { applyView } from "../lib/views/apply";
import { normalizeTaskView } from "../lib/views/filterDraft";

/** Isolated interaction fixture: never writes production data. */
export function WorkFiltersPreview() {
  const [items, setItems] = useState<TaskRow[]>([{ id: "open", title: "Pending review", status: "backlog" }, { id: "doing", title: "Active work", status: "in_progress" }, { id: "done", title: "Finished work", status: "done" }]);
  const [reject, setReject] = useState(false);
  const update = async (id: string, patch: Record<string, unknown>) => {
    if (reject) throw new Error("Quota exceeded.");
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const adapter = useMemo(() => buildTaskAdapter({ actorId: "preview", workspaceId: "preview", onUpdateTask: update }), [reject]);
  const [view, setView] = useState(() => adapter.defaultView("my-work"));
  const [open, setOpen] = useState(false);
  const rows = applyView(items, adapter, normalizeTaskView(view), { userId: "preview" }).rows;
  return <main style={{ height: "100dvh", display: "flex", flexDirection: "column", position: "relative" }}>
    <header style={{ padding: 16 }}><strong>Local filter / completion check</strong><button onClick={() => setOpen(true)}>Filter</button><button onClick={() => setView({ ...view, filters: [] })}>Clear filters</button><label><input type="checkbox" checked={reject} onChange={(event) => setReject(event.target.checked)} />Simulate quota rejection</label></header>
    <WorkItemsCenter activeProject={null} projects={[]} tasks={rows} hierarchyTasks={items} selectedItemId={null} onSelectItem={() => {}} onAsk={() => {}} onAddTask={() => {}} onUpdateTask={update} onOpenProjectConsole={() => {}} savedView={view} />
    <ViewCustomizer open={open} view={view} adapter={adapter} section="filter" onClose={() => setOpen(false)} onChange={setView} onReset={() => { setView(adapter.defaultView("my-work")); setOpen(false); }} onSaveAsTeam={() => {}} />
  </main>;
}
