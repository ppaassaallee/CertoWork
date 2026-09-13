import type { RitualCardProps } from "./types";

export type FindingRow = {
  id: string;
  title: string;
  evidence?: string;
  kind?: string;
  accepted?: boolean;
};

export type FindingAnswer = { acceptedIds: string[]; items: FindingRow[] };

function kindGlyph(kind?: string) {
  if (kind === "epic") return "⚡";
  if (kind === "progress") return "◎";
  if (kind === "mention") return "💬";
  return "✦";
}

export function FindingCard({
  prepared,
  props,
  value,
  onChange,
}: RitualCardProps) {
  const source = String(props?.source || "win_signals");
  const raw = (Array.isArray(prepared[source]) ? prepared[source] : []) as FindingRow[];
  const mapped =
    source === "epic_candidates"
      ? raw.map((row: any) => ({
          id: String(row.id),
          title: String(row.title),
          evidence: String(row.status || ""),
          kind: "epic",
          accepted: false,
        }))
      : raw;

  const answer: FindingAnswer =
    (value as FindingAnswer) ||
    ({
      acceptedIds: mapped.filter((row) => row.accepted !== false).map((row) => row.id),
      items: mapped,
    } as FindingAnswer);

  const toggle = (id: string) => {
    const set = new Set(answer.acceptedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ acceptedIds: [...set], items: mapped });
  };

  if (!mapped.length) {
    return <p className="cw-ritual-empty">Sin hallazgos todavía.</p>;
  }

  return (
    <ul className="cw-ritual-findings" data-testid="card-finding">
      {mapped.map((row) => {
        const on = answer.acceptedIds.includes(row.id);
        return (
          <li className={on ? "is-on" : "is-off"} key={row.id}>
            <span className={`cw-ritual-finding-icon is-${row.kind || "auto"}`}>
              {kindGlyph(row.kind)}
            </span>
            <div>
              <strong>{row.title}</strong>
              {row.evidence ? <em>{row.evidence}</em> : null}
            </div>
            <button
              aria-label={on ? "Aceptar" : "Descartar"}
              className={on ? "is-check" : "is-x"}
              onClick={() => toggle(row.id)}
              type="button"
            >
              {on ? "✓" : "✕"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
