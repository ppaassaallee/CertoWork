import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "../../components/ui/Icon";
import type { RecordDoc, TableDoc } from "../../lib/tables";
import { t } from "../../lib/i18n";

export type RecordsCalendarProps = {
  table: TableDoc;
  records: RecordDoc[];
  onOpenRecord(id: string): void;
};

export function RecordsCalendar({ table, records, onOpenRecord }: RecordsCalendarProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const dateColId = table.keyColumns.date;
  const titleColId = table.keyColumns.title;
  const statusColId = table.keyColumns.status;
  const statusCol = table.columns.find((c) => c.id === statusColId);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, RecordDoc[]>();
    if (!dateColId) return map;
    for (const record of records) {
      const raw = String(record.values[dateColId] ?? "").slice(0, 10);
      if (!raw) continue;
      if (!map.has(raw)) map.set(raw, []);
      map.get(raw)!.push(record);
    }
    return map;
  }, [records, dateColId]);

  if (!dateColId) {
    return <div className="cw-tables-empty">{t("tables.calendar.needDate")}</div>;
  }

  const weekdays = [
    t("tables.calendar.mon"),
    t("tables.calendar.tue"),
    t("tables.calendar.wed"),
    t("tables.calendar.thu"),
    t("tables.calendar.fri"),
    t("tables.calendar.sat"),
    t("tables.calendar.sun"),
  ];

  return (
    <div className="cw-tables-calendar" data-testid="tables-calendar">
      <header className="cw-tables-calendar-head">
        <button
          type="button"
          className="cw-tables-icon-btn"
          aria-label={t("tables.calendar.prev")}
          onClick={() => setCursor((d) => addMonths(d, -1))}
        >
          <ChevronLeft size={16} />
        </button>
        <strong>{format(cursor, "MMMM yyyy")}</strong>
        <button
          type="button"
          className="cw-tables-icon-btn"
          aria-label={t("tables.calendar.next")}
          onClick={() => setCursor((d) => addMonths(d, 1))}
        >
          <ChevronRight size={16} />
        </button>
      </header>

      <div className="cw-tables-calendar-weekdays">
        {weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cw-tables-calendar-grid">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay.get(key) || [];
          const inMonth = isSameMonth(day, cursor);
          const today = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={[
                "cw-tables-calendar-day",
                inMonth ? "" : "is-outside",
                today ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="cw-tables-calendar-daynum">{format(day, "d")}</span>
              <div className="cw-tables-calendar-chips">
                {items.slice(0, 4).map((record) => {
                  const title = String(record.values[titleColId] ?? "") || t("tables.untitled");
                  const statusId = statusColId ? String(record.values[statusColId] ?? "") : "";
                  const tone =
                    statusCol?.options?.find((o) => o.id === statusId)?.tone || "neutral";
                  return (
                    <button
                      key={record.id}
                      type="button"
                      className={`cw-tables-cal-chip cw-tables-tone-${tone}`}
                      title={title}
                      onClick={() => onOpenRecord(record.id)}
                    >
                      {title}
                    </button>
                  );
                })}
                {items.length > 4 ? (
                  <span className="cw-tables-muted">+{items.length - 4}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
