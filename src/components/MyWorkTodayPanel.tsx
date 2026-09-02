import { Calendar, Check, Circle, Zap } from "./ui/Icon";
import { todayPlanGroups } from "../lib/myWorkItems";

function titleOf(item: Record<string, unknown>) {
  return String(item?.title || item?.name || "Untitled").trim() || "Untitled";
}

function isDone(item: Record<string, unknown>) {
  return ["done", "completed", "closed"].includes(String(item?.status || "").toLowerCase());
}

export function MyWorkTodayPanel({
  tasks,
  onSelectItem,
  onUpdateTask,
}: {
  tasks: Array<Record<string, unknown>>;
  onSelectItem: (id: string | null) => void;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
}) {
  const plan = todayPlanGroups(tasks);
  const sections = [
    { key: "must", label: "Must dos", hint: "Up to 2", items: plan.mustDos },
    { key: "should", label: "Should dos", hint: "Up to 8", items: plan.shouldDos },
    { key: "could", label: "Could dos", hint: "If energy remains", items: plan.couldDos },
  ].filter((section) => section.items.length > 0 || section.key !== "could");

  return (
    <section className="do-today-panel" data-testid="my-work-today">
      <header className="do-today-panel-head">
        <Zap size={16} />
        <div>
          <strong>Today</strong>
          <span>Goals you marked for today, due today, or set as the one thing.</span>
        </div>
      </header>
      {tasks.length === 0 ? (
        <div className="do-today-empty">
          <Calendar size={22} />
          <strong>Nothing planned for today</strong>
          <span>Set a due date to today, mark Today on the Action Board, or star the one thing.</span>
        </div>
      ) : (
        sections.map((section) => (
          <div className="do-today-section" key={section.key}>
            <h3>
              {section.label}
              <small>{section.hint}</small>
              <em>{section.items.length}</em>
            </h3>
            {section.items.length === 0 ? (
              <p className="do-today-section-empty">No {section.label.toLowerCase()} yet.</p>
            ) : (
              <ul>
                {section.items.map((item) => {
                  const done = isDone(item);
                  const id = String(item.id || "");
                  return (
                    <li className={done ? "is-done" : ""} key={id}>
                      <button
                        aria-label={`${done ? "Reopen" : "Mark done"} ${titleOf(item)}`}
                        className={`do-items-check ${done ? "is-done" : ""}`}
                        onClick={() =>
                          onUpdateTask(id, { status: done ? "backlog" : "done" })
                        }
                        type="button"
                      >
                        {done ? <Check size={12} /> : <Circle size={12} />}
                      </button>
                      <button onClick={() => onSelectItem(id)} type="button">
                        {titleOf(item)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))
      )}
    </section>
  );
}
