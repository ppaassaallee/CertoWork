import { useEffect, useState } from "react";
import { getLocale } from "../../lib/i18n";
import { weekLabel } from "../../lib/routines/manifest";
import {
  listCompletedSessions,
  type RoutineSession,
} from "../../lib/routines/sessions";
import type { ReflectionAnswer } from "./cards/Reflection";
import type { FindingAnswer } from "./cards/Finding";
import "./revisiones.css";

export type RevisionesViewProps = {
  workspaceId: string;
  userId: string;
  onOpenNote?: (noteId: string) => void;
};

export function RevisionesView({ workspaceId, userId, onOpenNote }: RevisionesViewProps) {
  const locale = getLocale() === "es" ? "es" : "en";
  const [rows, setRows] = useState<RoutineSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void listCompletedSessions(workspaceId, userId, "wrap-review", 52)
      .then((data) => {
        if (alive) setRows(data);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [workspaceId, userId]);

  return (
    <div className="cw-revisiones" data-testid="revisiones-view">
      <header>
        <h2>{locale === "es" ? "Revisiones" : "Reviews"}</h2>
        <p>
          {locale === "es"
            ? "Una fila por semana · escala de alineación · wins al pasar el mouse"
            : "One row per week · alignment score · wins on hover"}
        </p>
      </header>
      {loading ? (
        <p className="cw-revisiones-empty">…</p>
      ) : !rows.length ? (
        <p className="cw-revisiones-empty">
          {locale === "es"
            ? "Todavía no hay WRAP guardados. El viernes aparece la tarjeta en Home."
            : "No WRAP reviews yet. Friday’s card lands on Home."}
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const alignment = row.answers?.alignment as ReflectionAnswer | undefined;
            const wins = row.answers?.["win-findings"] as FindingAnswer | undefined;
            const winTitles =
              wins?.items
                ?.filter((item) => wins.acceptedIds.includes(item.id))
                .map((item) => item.title)
                .slice(0, 3) || [];
            const myWins = (row.answers?.["my-wins"] as ReflectionAnswer | undefined)?.text;
            if (myWins) winTitles.push(myWins.slice(0, 80));
            return (
              <li key={row.id} title={winTitles.join(" · ") || undefined}>
                <button
                  onClick={() => row.noteId && onOpenNote?.(row.noteId)}
                  type="button"
                >
                  <strong>{weekLabel(row.weekOf, locale)}</strong>
                  <span className="cw-revisiones-scale">
                    {alignment?.scale
                      ? `${alignment.scale}/5`
                      : locale === "es"
                        ? "sin escala"
                        : "no score"}
                  </span>
                  <em>
                    {winTitles[0] ||
                      (locale === "es" ? "Sin wins anotados" : "No wins logged")}
                  </em>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
