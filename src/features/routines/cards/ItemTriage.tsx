import type { RitualCardProps } from "./types";

export type TriageDecision = "next_week" | "drop" | "today";

export type TriageAnswer = {
  decisions: Record<string, TriageDecision>;
};

const LABELS = {
  es: {
    next: "Mover a la próxima semana",
    drop: "Ya no aplica",
    today: "Seguir hoy",
    all: "Aplicar a todos",
    empty: "Nada pendiente de la semana.",
  },
  en: {
    next: "Move to next week",
    drop: "No longer applies",
    today: "Keep for today",
    all: "Apply to all",
    empty: "Nothing left from this week.",
  },
} as const;

export function ItemTriageCard({
  prepared,
  props,
  value,
  onChange,
  locale = "es",
}: RitualCardProps) {
  const source = String(props?.source || "undone_items");
  const items = (Array.isArray(prepared[source]) ? prepared[source] : []) as Array<{
    id: string;
    title: string;
    dueIso?: string | null;
  }>;
  const answer = (value as TriageAnswer) || { decisions: {} };
  const t = LABELS[locale];

  const setAll = (decision: TriageDecision) => {
    const decisions: Record<string, TriageDecision> = {};
    for (const item of items) decisions[item.id] = decision;
    onChange({ decisions });
  };

  const setOne = (id: string, decision: TriageDecision) => {
    onChange({ decisions: { ...answer.decisions, [id]: decision } });
  };

  if (!items.length) {
    return <p className="cw-ritual-empty">{t.empty}</p>;
  }

  return (
    <div className="cw-ritual-triage" data-testid="card-item-triage">
      <div className="cw-ritual-triage-bulk">
        <button onClick={() => setAll("next_week")} type="button">
          {t.all}: {t.next}
        </button>
      </div>
      <ul>
        {items.map((item) => {
          const current = answer.decisions[item.id] || "next_week";
          return (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <div className="cw-ritual-triage-actions">
                {(
                  [
                    ["next_week", t.next],
                    ["drop", t.drop],
                    ["today", t.today],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    className={current === id ? "is-active" : ""}
                    key={id}
                    onClick={() => setOne(item.id, id)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
