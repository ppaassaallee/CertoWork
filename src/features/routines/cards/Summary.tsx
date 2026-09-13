import type { RitualCardProps } from "./types";

export function SummaryCard({
  props,
  prepared,
  locale = "es",
}: RitualCardProps) {
  const mode = String(props?.mode || "finish");
  const metrics = (prepared.metrics || {}) as {
    planned?: number;
    done?: number;
    undone?: number;
  };

  if (mode === "chain") {
    return (
      <div className="cw-ritual-summary" data-testid="card-summary">
        <p>
          {locale === "es"
            ? "Al continuar se abre el Plan semanal (metas + tiempo protegido)."
            : "Next opens Weekly plan (goals + protected time)."}
        </p>
      </div>
    );
  }

  return (
    <div className="cw-ritual-summary" data-testid="card-summary">
      <p>
        {locale === "es"
          ? `Moviste o revisaste ${metrics.undone ?? 0} ítems, cerraste ${metrics.done ?? 0}, guardaste tu revisión.`
          : `You moved or reviewed ${metrics.undone ?? 0} items, closed ${metrics.done ?? 0}, and saved your review.`}
      </p>
      <ul>
        <li>{locale === "es" ? "Nota en Revisiones" : "Note in Reviews"}</li>
        <li>{locale === "es" ? "Acciones aplicadas con política" : "Actions applied via policy"}</li>
      </ul>
    </div>
  );
}
