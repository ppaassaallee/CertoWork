import { useMemo, useState } from "react";
import { DButton, DSegmented } from "../../desktop/ui";
import "../../desktop/ui/desktop-ui.css";

export type MonthEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  bucket?: "fire" | "growth" | "extra" | string;
  allDay?: boolean;
};

const BUCKET_COLOR: Record<string, string> = {
  fire: "rgba(242,98,15,.2)",
  growth: "rgba(37,71,196,.18)",
  extra: "rgba(58,174,108,.18)",
};

export function CalendarMonthView({
  events,
  onAdd,
  initialMode = "month",
}: {
  events: MonthEvent[];
  onAdd?: (dateKey: string) => void;
  initialMode?: "day" | "week" | "month";
}) {
  const [mode, setMode] = useState(initialMode);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(12, 0, 0, 0);
    return d;
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ key: string; day: number | null; inMonth: boolean }> = [];
    for (let i = 0; i < firstDow; i++) out.push({ key: `pad-${i}`, day: null, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({ key, day: d, inMonth: true });
    }
    return out;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, MonthEvent[]>();
    for (const e of events) {
      const key = e.start.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  return (
    <div className="d-root" data-testid="calendar-month-view">
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <DSegmented
          onChange={(id) => setMode(id as "day" | "week" | "month")}
          options={[
            { id: "day", label: "Day" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
          ]}
          value={mode}
        />
        <DButton
          onClick={() => {
            const d = new Date();
            d.setDate(1);
            setCursor(d);
            setMode("month");
          }}
          size="sm"
          variant="secondary"
        >
          Today
        </DButton>
        <DButton
          onClick={() =>
            setCursor((c) => {
              const n = new Date(c);
              n.setMonth(n.getMonth() - 1);
              return n;
            })
          }
          size="sm"
          variant="ghost"
        >
          ‹
        </DButton>
        <strong>
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </strong>
        <DButton
          onClick={() =>
            setCursor((c) => {
              const n = new Date(c);
              n.setMonth(n.getMonth() + 1);
              return n;
            })
          }
          size="sm"
          variant="ghost"
        >
          ›
        </DButton>
      </div>

      {mode === "month" ? (
        <div
          aria-label="Month grid"
          role="grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} style={{ fontSize: 11, color: "var(--c-ink-3)", padding: "4px 6px" }}>
              {d}
            </div>
          ))}
          {cells.map((c) => (
            <div
              key={c.key}
              onDoubleClick={() => c.inMonth && onAdd?.(c.key)}
              role="gridcell"
              style={{
                minHeight: 88,
                border: "1px solid var(--c-line)",
                borderRadius: 10,
                padding: 6,
                background: c.key === todayKey ? "rgba(37,71,196,.06)" : "#fff",
                opacity: c.inMonth ? 1 : 0.35,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{c.day || ""}</div>
              {(byDay.get(c.key) || []).slice(0, 3).map((e) => (
                <div
                  key={e.id}
                  style={{
                    fontSize: 11,
                    marginTop: 2,
                    borderRadius: 6,
                    padding: "2px 4px",
                    background: BUCKET_COLOR[e.bucket || "growth"] || BUCKET_COLOR.growth,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={e.title}
                >
                  {e.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--c-ink-2)" }}>
          {mode === "day" ? "Day view uses the existing Events day sheet." : "Week view uses the existing week grid."}
        </p>
      )}
    </div>
  );
}
