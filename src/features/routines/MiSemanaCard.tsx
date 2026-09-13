import { getLocale } from "../../lib/i18n";
import type { RoutineSession } from "../../lib/routines/sessions";
import type { GoalComposerAnswer } from "./cards/GoalComposer";
import type { TimeBlocksAnswer } from "./cards/TimeBlocks";
import "./miSemana.css";

export type MiSemanaCardProps = {
  session: RoutineSession | null;
  onReviewFriday?: () => void;
  closedActionIds?: string[];
};

const DAY_KEYS = ["lun", "mar", "mié", "jue", "vie"] as const;

function todayKey(now = new Date()) {
  const map = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
  return map[now.getDay()];
}

export function MiSemanaCard({
  session,
  onReviewFriday,
  closedActionIds = [],
}: MiSemanaCardProps) {
  const locale = getLocale() === "es" ? "es" : "en";
  if (!session) return null;

  const goals = (session.answers?.goals as GoalComposerAnswer | undefined)?.goals || [];
  const blocks = session.answers?.blocks as TimeBlocksAnswer | undefined;
  const today = todayKey();
  const todayBlock = blocks?.blocks?.find((b) => b.day === today);

  return (
    <section className="cw-mi-semana" data-testid="mi-semana-card">
      <header>
        <h2>{locale === "es" ? "Mi semana" : "My week"}</h2>
        <button onClick={onReviewFriday} type="button">
          {locale === "es" ? "Revisar el viernes" : "Review on Friday"}
        </button>
      </header>
      <ul>
        {goals
          .filter((g) => g.title.trim())
          .slice(0, 3)
          .map((goal) => {
            const total = goal.actions.filter((a) => a.title.trim()).length || 1;
            const done = goal.actions.filter(
              (a) => a.itemId && closedActionIds.includes(a.itemId),
            ).length;
            const pct = Math.round((done / total) * 100);
            return (
              <li key={goal.id}>
                <strong>{goal.title}</strong>
                <span className="cw-mi-semana-bar">
                  <i style={{ width: `${pct}%` }} />
                </span>
                <em>
                  {done}/{total}
                </em>
              </li>
            );
          })}
      </ul>
      {todayBlock ? (
        <p className="cw-mi-semana-block">
          {locale === "es" ? "Hoy protegido" : "Protected today"}: {todayBlock.start}–
          {todayBlock.end} · {todayBlock.label}
        </p>
      ) : (
        <p className="cw-mi-semana-block">
          {locale === "es"
            ? `Día libre: ${blocks?.dayOff || "—"}`
            : `Day off: ${blocks?.dayOff || "—"}`}
        </p>
      )}
      {!DAY_KEYS.includes(today as (typeof DAY_KEYS)[number]) ? null : null}
    </section>
  );
}
