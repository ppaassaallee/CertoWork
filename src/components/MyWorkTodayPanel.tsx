import { useState } from "react";
import { Calendar, Check, Circle, FileText, LayoutGrid, Star, Zap } from "./ui/Icon";
import { todayPlanGroups } from "../lib/myWorkItems";
import type { CalendarEvent } from "../lib/calendar";
import { localDayKey } from "../lib/calendar/dates";
import { MyWorkDaySchedule } from "./MyWorkDaySchedule";
import "../features/dayplan/dayplan.css";

function titleOf(item: Record<string, unknown>) {
  return String(item?.title || item?.name || "Untitled").trim() || "Untitled";
}

function isDone(item: Record<string, unknown>) {
  return ["done", "completed", "closed"].includes(String(item?.status || "").toLowerCase());
}

function isRecord(item: Record<string, unknown>) {
  return item?.entityKind === "record" || item?.workItemType === "record";
}

export function MyWorkTodayPanel({
  tasks,
  onSelectItem,
  onUpdateTask,
  keyItemId = null,
  onSetKey,
  locale = "es",
  onOpenWeek,
  onPrepareEvent,
}: {
  tasks: Array<Record<string, unknown>>;
  onSelectItem: (id: string | null) => void;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  keyItemId?: string | null;
  onSetKey?: (itemId: string | null) => void;
  locale?: "es" | "en";
  onOpenWeek?: () => void;
  onPrepareEvent?(event: CalendarEvent): void;
}) {
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const isViewingToday = localDayKey(selectedDay) === localDayKey(new Date());
  const plan = todayPlanGroups(tasks);
  const sections = [
    {
      key: "must",
      label: locale === "es" ? "Must dos" : "Must dos",
      hint: locale === "es" ? "Hasta 2" : "Up to 2",
      items: plan.mustDos,
    },
    {
      key: "should",
      label: locale === "es" ? "Should dos" : "Should dos",
      hint: locale === "es" ? "Hasta 8" : "Up to 8",
      items: plan.shouldDos,
    },
    {
      key: "could",
      label: locale === "es" ? "Could dos" : "Could dos",
      hint: locale === "es" ? "Si queda energía" : "If energy remains",
      items: plan.couldDos,
    },
  ].filter((section) => section.items.length > 0 || section.key !== "could");

  return (
    <div className="do-today-layout" data-testid="my-work-today-layout">
      <section className="do-today-panel" data-testid="my-work-today">
        <header className="do-today-panel-head">
          <Zap size={16} />
          <div>
            <strong>{locale === "es" ? "Tareas de hoy" : "Today's tasks"}</strong>
            <span>
              {locale === "es"
                ? "Must / Should / Could · lo marcado para hoy o con vencimiento de hoy."
                : "Must / Should / Could · marked for today or due today."}
            </span>
          </div>
        </header>
        {!isViewingToday ? (
          <p className="do-today-day-note">
            {locale === "es"
              ? "La lista 2+8 sigue siendo de hoy; la agenda a la derecha muestra el día seleccionado."
              : "The 2+8 list stays on today; the schedule on the right shows the selected day."}
          </p>
        ) : null}
        {tasks.length === 0 ? (
          <div className="do-today-empty">
            <Calendar size={22} />
            <strong>
              {locale === "es" ? "Nada planificado para hoy" : "Nothing planned for today"}
            </strong>
            <span>
              {locale === "es"
                ? "Poné vencimiento de hoy, marcá Today en el Action Board, o elegí la tarea clave."
                : "Set a due date to today, mark Today on the Action Board, or star the one thing."}
            </span>
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
                <p className="do-today-section-empty">
                  {locale === "es"
                    ? `Sin ${section.label.toLowerCase()} todavía.`
                    : `No ${section.label.toLowerCase()} yet.`}
                </p>
              ) : (
                <ul>
                  {section.items.map((item) => {
                    const done = isDone(item);
                    const id = String(item.id || "");
                    const isKey = Boolean(keyItemId && id === keyItemId);
                    const linked = Array.isArray(item.linkedDocumentIds)
                      ? item.linkedDocumentIds.length
                      : 0;
                    const record = isRecord(item);
                    return (
                      <li className={done ? "is-done" : ""} key={id}>
                        {record ? (
                          <span className="do-items-check" aria-hidden>
                            <LayoutGrid size={12} />
                          </span>
                        ) : (
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
                        )}
                        <button onClick={() => onSelectItem(id)} type="button">
                          {record ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <LayoutGrid size={11} />
                              {titleOf(item)}
                              {item.tableName ? (
                                <em
                                  style={{
                                    color: "var(--text-muted)",
                                    fontStyle: "normal",
                                    fontSize: 11,
                                  }}
                                >
                                  {String(item.tableName)}
                                </em>
                              ) : null}
                            </span>
                          ) : (
                            titleOf(item)
                          )}
                        </button>
                        {linked > 0 ? (
                          <FileText
                            aria-hidden
                            size={12}
                            style={{ color: "var(--text-muted)", marginLeft: 4 }}
                          />
                        ) : null}
                        {onSetKey && !record ? (
                          <button
                            aria-label={
                              isKey
                                ? locale === "es"
                                  ? "Quitar tarea clave"
                                  : "Remove key task"
                                : locale === "es"
                                  ? "Tarea clave de hoy"
                                  : "Key task today"
                            }
                            className={`cw-dayplan-star ${isKey ? "is-key" : ""}`}
                            onClick={() => onSetKey(isKey ? null : id)}
                            type="button"
                          >
                            <Star size={14} />
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))
        )}
      </section>

      {onOpenWeek ? (
        <MyWorkDaySchedule
          locale={locale}
          onOpenWeek={onOpenWeek}
          onPrepareEvent={onPrepareEvent}
          onSelectDay={setSelectedDay}
          selectedDay={selectedDay}
        />
      ) : null}
    </div>
  );
}
