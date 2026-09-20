import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DAvatarStack, DPill } from "../../desktop/ui";
import "../../desktop/ui/desktop-ui.css";

export type GroupedListItem = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  projectName?: string;
  due?: string | null;
  assignees?: string[];
  monoId?: string;
};

const STATUS_TINT: Record<string, string> = {
  backlog: "is-backlog",
  "in progress": "is-progress",
  progress: "is-progress",
  review: "is-review",
  done: "is-done",
  completed: "is-done",
};

function priorityTone(p?: string) {
  const v = (p || "").toLowerCase();
  if (v === "high" || v === "critical") return "overdue";
  if (v === "medium") return "pending";
  if (v === "low") return "ok";
  return "neutral";
}

export function GroupedItemsList({
  items,
  density = "regular",
  onOpen,
  onComplete,
  onAddInStatus,
  onDueChange,
}: {
  items: GroupedListItem[];
  density?: "compact" | "regular";
  onOpen: (id: string) => void;
  onComplete?: (id: string) => void;
  onAddInStatus?: (status: string) => void;
  onDueChange?: (id: string, due: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, GroupedListItem[]>();
    for (const it of items) {
      const key = it.status || "Backlog";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()];
  }, [items]);

  const flat = useMemo(() => groups.flatMap(([, rows]) => rows), [groups]);
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") {
        e.preventDefault();
        setFocus((f) => Math.min(flat.length - 1, f + 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocus((f) => Math.max(0, f - 1));
      } else if (e.key === "Enter" && flat[focus]) {
        onOpen(flat[focus].id);
      } else if (e.key === "c" && flat[focus]) {
        onComplete?.(flat[focus].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, focus, onOpen, onComplete]);

  const rowH = density === "compact" ? 36 : 44;

  return (
    <div className="grouped-lists d-root" data-testid="grouped-items-list">
      {groups.map(([status, rows]) => {
        const tint =
          STATUS_TINT[status.toLowerCase()] ||
          (status.toLowerCase().includes("progress") ? "is-progress" : "is-backlog");
        return (
          <section className={`d-list-group ${tint}`} key={status} style={{ marginBottom: 14 }}>
            <div className="d-list-group-head">
              <span className="dot" style={{ width: 8, height: 8, borderRadius: 99, background: "currentColor" }} />
              <span className="mono">{status}</span>
              <span className="cnt">{rows.length}</span>
              <button aria-label={`Add in ${status}`} onClick={() => onAddInStatus?.(status)} type="button">
                +
              </button>
            </div>
            <div className="grouped-cols" style={{ display: "grid", gridTemplateColumns: "1fr 90px 120px 100px 80px", padding: "4px 12px", fontSize: 11, color: "var(--c-ink-3)" }}>
              <span>Name</span>
              <span>Priority</span>
              <span>Project</span>
              <span>Due</span>
              <span>Assignee</span>
            </div>
            {rows.map((row) => {
              const idx = flat.findIndex((r) => r.id === row.id);
              return (
                <button
                  className={`grouped-row${idx === focus ? " is-focus" : ""}`}
                  key={row.id}
                  onClick={() => onOpen(row.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 120px 100px 80px",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    height: rowH,
                    padding: "0 12px",
                    border: 0,
                    background: idx === focus ? "rgba(37,71,196,.08)" : "transparent",
                    textAlign: "left",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  <span>
                    <span className="mono" style={{ color: "var(--c-ink-3)", marginRight: 8 }}>
                      {row.monoId || row.id.slice(0, 6)}
                    </span>
                    {row.title}
                  </span>
                  <DPill tone={priorityTone(row.priority)}>{row.priority || "Not set"}</DPill>
                  <span style={{ color: "var(--c-ink-2)", fontSize: 12 }}>{row.projectName || "—"}</span>
                  <span>
                    {row.due ? (
                      row.due
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = window.prompt("Due date YYYY-MM-DD");
                          if (v) onDueChange?.(row.id, v);
                        }}
                        style={{ color: "var(--c-blue)" }}
                      >
                        Add date
                      </span>
                    )}
                  </span>
                  <DAvatarStack labels={row.assignees || []} />
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

export function GroupedListShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
