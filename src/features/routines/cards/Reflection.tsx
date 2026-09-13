import type { RitualCardProps } from "./types";

export type ReflectionAnswer = {
  text: string;
  scale?: number | null;
  direction?: string;
};

export function ReflectionCard({
  props,
  value,
  onChange,
  prepared,
  locale = "es",
}: RitualCardProps) {
  const label = String(props?.label || (locale === "es" ? "Notas" : "Notes"));
  const withScale = Boolean(props?.scale);
  const rememberDirection = Boolean(props?.rememberDirection);
  const draftFromAi = props?.draftFrom === "ai";
  const answer = (value as ReflectionAnswer) || {
    text: draftFromAi
      ? locale === "es"
        ? `Planeaste ${(prepared.metrics as any)?.planned ?? 0} y cerraste ${(prepared.metrics as any)?.done ?? 0}.`
        : `You planned ${(prepared.metrics as any)?.planned ?? 0} and closed ${(prepared.metrics as any)?.done ?? 0}.`
      : "",
    scale: null,
    direction: String(prepared.last_alignment || ""),
  };

  return (
    <div className="cw-ritual-reflection" data-testid="card-reflection">
      <span className="cw-ritual-reflection-label">{label}</span>
      {rememberDirection ? (
        <label className="cw-ritual-direction">
          <span>{locale === "es" ? "Tu dirección" : "Your direction"}</span>
          <input
            onChange={(event) =>
              onChange({ ...answer, direction: event.target.value })
            }
            placeholder={
              locale === "es"
                ? "¿Hacia dónde querés ir este trimestre?"
                : "Where are you headed this quarter?"
            }
            value={answer.direction || ""}
          />
        </label>
      ) : null}
      <textarea
        onChange={(event) => onChange({ ...answer, text: event.target.value })}
        placeholder={locale === "es" ? "Escribí acá…" : "Write here…"}
        rows={3}
        value={answer.text || ""}
      />
      {withScale ? (
        <div className="cw-ritual-scale" role="group" aria-label="Alignment 1-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              className={answer.scale === n ? "is-active" : ""}
              key={n}
              onClick={() => onChange({ ...answer, scale: n })}
              type="button"
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
