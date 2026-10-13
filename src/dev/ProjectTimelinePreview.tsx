import { useState } from "react";
import { ProjectTimeline } from "../components/ProjectTimeline";
import { ItemModal } from "../features/items/ItemModal";
import { timelineDate, timelineToday, type TimelineItem, type TimelineScale } from "../lib/projectTimeline";

const today = timelineToday();
const date = (offset: number) => timelineDate(today + offset).toISOString().slice(0, 10);
const task = (id: string, title: string, parentId: string, start: number | null, end: number | null, assignee: string, kind = "pbi", status = "in_progress"): TimelineItem => ({
  id, title, kind, parentId, projectId: "vanguard", projectLabel: "Project Vanguard", status,
  startDate: start === null ? undefined : date(start), dueDate: end === null ? undefined : date(end), assigneeIds: assignee ? [assignee] : [],
});
const items = [
  task("tmt", "TMT Automation", "", null, null, "", "epic"),
  task("process", "Process weekly TMT tickets", "tmt", null, 0, "camila"),
  task("views", "Update the monitoring views", "tmt", null, 0, "nina"),
  task("roles", "Define roles and ownership", "tmt", null, 1, "nina"),
  task("audit", "Revalidate audit controls", "tmt", 1, 4, "nina"),
  task("looker", "Deliver Looker MVP & scorecard", "tmt", 3, 11, "camila"),
  task("infra", "Review infrastructure options", "tmt", null, 17, "lina"),
  task("care", "Customer Care Integration", "", null, null, "", "epic"),
  task("build", "Build the interaction layer", "care", -6, 3, "lina", "feature"),
  task("edition", "Editions based on audit findings", "build", -3, 4, "camila"),
  task("unit", "Unit & workforce planning", "build", 2, 8, "camila", "task"),
  task("review", "Review AI processing costs", "care", null, 5, "camila"),
  task("meeting", "Meeting with John", "care", null, 7, "camila"),
  task("assistant", "Audit Assistant", "", null, null, "", "epic"),
  task("evidence", "Collect evidence and source links", "assistant", 7, 12, "lina"),
  task("coverage", "Validate policy coverage", "assistant", 10, 18, "nina", "pbi", "blocked"),
  task("release", "Audit assistant pilot release", "assistant", null, 21, "camila"),
  task("loyalty", "Loyalty reward points", "", null, 2, "camila"),
  task("sales", "Sales integrity & fraud review", "", null, 6, "camila"),
  task("metrics", "TMT metrics dashboard", "", 14, 20, "nina"),
  task("done", "Confirm stakeholder interviews", "", -9, -6, "lina", "pbi", "done"),
  task("nodate", "Scope the next rollout", "", null, null, "lina", "feature"),
];
const members = [{ id: "lina", displayName: "Lina Ortiz" }, { id: "camila", displayName: "Camila Ruiz" }, { id: "nina", displayName: "Nina Chen" }];

/** Local visual fixture: no Firestore reads or writes. Excluded from production. */
export function ProjectTimelinePreview() {
  const [scale, setScale] = useState<TimelineScale>("week");
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState("");
  const [previewItems, setPreviewItems] = useState(items);
  const selectedItem = previewItems.find((item) => item.id === selected);
  return <main style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)" }}>
    {!focused && <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 26px", borderBottom: "1px solid var(--border)" }}><div><span style={{ color: "var(--text-muted)", fontSize: 11 }}>CERTO WORK · LOCAL PREVIEW</span><h1 style={{ margin: "5px 0 0", fontSize: 22 }}>Project Vanguard</h1></div><span style={{ color: "var(--accent)", fontSize: 13 }}>Timeline</span></header>}
    <div style={{ display: "grid", gridTemplateColumns: selectedItem ? "minmax(0, 1fr) 420px" : "minmax(0, 1fr)", minHeight: 0, flex: 1 }}>
      <ProjectTimeline items={previewItems} selectedItemId={selected} members={members} projectMode scale={scale} onScaleChange={setScale} focused={focused} onFocusChange={setFocused} onOpenItem={setSelected} onAddItem={() => setSelected("add")} />
      {selectedItem && <ItemModal key={selectedItem.id} item={selectedItem} projects={[{ id: "vanguard", name: "Project Vanguard" }]} tasks={previewItems} tags={[]} workspaceMembers={members} sprints={[]} docked layout="panel" onClose={() => setSelected("")} onUpdateTask={(id, patch) => setPreviewItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))} onChangeType={() => {}} onArchive={() => setSelected("")} parentEditor={null} subtaskItems={previewItems.filter((item) => item.parentId === selectedItem.id)} />}
    </div>
    {selected === "add" && <button onClick={() => setSelected("")} type="button">Close preview action</button>}
  </main>;
}
