import type { RitualCardProps } from "./types";

export type GoalAction = {
  id: string;
  title: string;
  itemId?: string | null;
  isNew?: boolean;
};

export type Goal = {
  id: string;
  title: string;
  actions: GoalAction[];
};

export type GoalComposerAnswer = { goals: Goal[] };

let seq = 0;
function nid(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export function GoalComposerCard({
  value,
  onChange,
  prepared,
  props,
  locale = "es",
}: RitualCardProps) {
  const maxGoals = Number(props?.maxGoals || 3);
  const maxActions = Number(props?.maxActions || 4);
  const answer = (value as GoalComposerAnswer) || {
    goals: [{ id: nid("g"), title: "", actions: [] }],
  };

  const setGoals = (goals: Goal[]) => onChange({ goals });

  const candidates = (Array.isArray(prepared.epic_candidates)
    ? prepared.epic_candidates
    : Array.isArray(prepared.week_deadlines)
      ? prepared.week_deadlines
      : []) as Array<{ id: string; title: string }>;

  return (
    <div className="cw-ritual-goals" data-testid="card-goal-composer">
      {answer.goals.map((goal, index) => (
        <div className="cw-ritual-goal" key={goal.id}>
          <label>
            <span>
              {locale === "es" ? "Meta" : "Goal"} {index + 1}
            </span>
            <input
              list={`goal-suggestions-${goal.id}`}
              onChange={(event) => {
                const goals = answer.goals.map((row) =>
                  row.id === goal.id ? { ...row, title: event.target.value } : row,
                );
                setGoals(goals);
              }}
              placeholder={
                locale === "es"
                  ? "Qué hace que la semana valga"
                  : "What makes the week count"
              }
              value={goal.title}
            />
            <datalist id={`goal-suggestions-${goal.id}`}>
              {candidates.map((c) => (
                <option key={c.id} value={c.title} />
              ))}
            </datalist>
          </label>
          <ul>
            {goal.actions.map((action) => (
              <li key={action.id}>
                <input
                  onChange={(event) => {
                    const goals = answer.goals.map((row) =>
                      row.id === goal.id
                        ? {
                            ...row,
                            actions: row.actions.map((a) =>
                              a.id === action.id
                                ? { ...a, title: event.target.value, isNew: true }
                                : a,
                            ),
                          }
                        : row,
                    );
                    setGoals(goals);
                  }}
                  placeholder={locale === "es" ? "Acción / ítem" : "Action / item"}
                  value={action.title}
                />
              </li>
            ))}
          </ul>
          {goal.actions.length < maxActions ? (
            <button
              onClick={() => {
                const goals = answer.goals.map((row) =>
                  row.id === goal.id
                    ? {
                        ...row,
                        actions: [
                          ...row.actions,
                          { id: nid("a"), title: "", isNew: true },
                        ],
                      }
                    : row,
                );
                setGoals(goals);
              }}
              type="button"
            >
              + {locale === "es" ? "Acción" : "Action"}
            </button>
          ) : null}
        </div>
      ))}
      {answer.goals.length < maxGoals ? (
        <button
          className="cw-ritual-add-goal"
          onClick={() =>
            setGoals([...answer.goals, { id: nid("g"), title: "", actions: [] }])
          }
          type="button"
        >
          + {locale === "es" ? "Meta" : "Goal"}
        </button>
      ) : null}
    </div>
  );
}
