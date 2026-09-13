import type { RitualCardProps } from "./types";

export type TimeBlock = {
  day: string; // Mon..Fri iso or weekday key
  start: string;
  end: string;
  label: string;
  goalId?: string;
};

export type TimeBlocksAnswer = {
  blocks: TimeBlock[];
  dayOff: string | null;
  /** Stored only — calendar push when connected (v1: store). */
  calendarConnected: boolean;
};

const DAYS = ["lun", "mar", "mié", "jue", "vie"] as const;

export function TimeBlocksCard({
  value,
  onChange,
  locale = "es",
}: RitualCardProps) {
  const answer = (value as TimeBlocksAnswer) || {
    blocks: [
      { day: "lun", start: "09:00", end: "11:00", label: locale === "es" ? "Foco" : "Focus" },
    ],
    dayOff: "vie",
    calendarConnected: false,
  };

  const set = (next: TimeBlocksAnswer) => onChange(next);

  return (
    <div className="cw-ritual-timeblocks" data-testid="card-time-blocks">
      <p className="cw-ritual-hint">
        {locale === "es"
          ? "Se guardan en Certo. Si conectás Google Calendar después, se pueden empujar."
          : "Stored in Certo. Push to Google Calendar when connected."}
      </p>
      <div className="cw-ritual-dayoff">
        <span>{locale === "es" ? "Día libre" : "Day off"}</span>
        <select
          onChange={(event) =>
            set({ ...answer, dayOff: event.target.value || null })
          }
          value={answer.dayOff || ""}
        >
          <option value="">{locale === "es" ? "Ninguno" : "None"}</option>
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
      <ul>
        {answer.blocks.map((block, index) => (
          <li key={`${block.day}-${index}`}>
            <select
              onChange={(event) => {
                const blocks = answer.blocks.map((row, i) =>
                  i === index ? { ...row, day: event.target.value } : row,
                );
                set({ ...answer, blocks });
              }}
              value={block.day}
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <input
              onChange={(event) => {
                const blocks = answer.blocks.map((row, i) =>
                  i === index ? { ...row, start: event.target.value } : row,
                );
                set({ ...answer, blocks });
              }}
              type="time"
              value={block.start}
            />
            <input
              onChange={(event) => {
                const blocks = answer.blocks.map((row, i) =>
                  i === index ? { ...row, end: event.target.value } : row,
                );
                set({ ...answer, blocks });
              }}
              type="time"
              value={block.end}
            />
            <input
              onChange={(event) => {
                const blocks = answer.blocks.map((row, i) =>
                  i === index ? { ...row, label: event.target.value } : row,
                );
                set({ ...answer, blocks });
              }}
              placeholder={locale === "es" ? "Etiqueta" : "Label"}
              value={block.label}
            />
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          set({
            ...answer,
            blocks: [
              ...answer.blocks,
              {
                day: "mar",
                start: "09:00",
                end: "11:00",
                label: locale === "es" ? "Foco" : "Focus",
              },
            ],
          })
        }
        type="button"
      >
        + {locale === "es" ? "Bloque" : "Block"}
      </button>
    </div>
  );
}
