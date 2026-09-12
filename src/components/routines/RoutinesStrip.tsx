import { useEffect, useState } from "react";
import { Sparkles } from "../ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import {
  listRoutinesForScope,
  relativeNextRunLabel,
  routineStatusTone,
  type RoutineSpec,
} from "../../lib/routines";
import { useRoutineHost } from "./RoutineHost";

/** Cockpit right-panel strip: Rutinas (N) for the current project/item. */
export function RoutinesStrip({
  entityType,
  entityId,
  entityTitle,
}: {
  entityType: "project" | "task" | "portfolio";
  entityId: string | null;
  entityTitle?: string;
}) {
  const { workspace } = useAuth();
  const { openRoutine } = useRoutineHost();
  const [routines, setRoutines] = useState<RoutineSpec[]>([]);

  useEffect(() => {
    if (!workspace?.id) return;
    void listRoutinesForScope(workspace.id, { entityType, entityId })
      .then(setRoutines)
      .catch(() => setRoutines([]));
  }, [workspace?.id, entityType, entityId]);

  if (!routines.length) return null;

  return (
    <section className="do-routines-strip" data-testid="routines-strip">
      <header>
        <strong>
          <Sparkles size={13} /> Rutinas ({routines.length})
        </strong>
        <button
          onClick={() =>
            openRoutine({
              entityType,
              entityId,
              entityTitle,
            })
          }
          type="button"
        >
          Nueva
        </button>
      </header>
      <ul>
        {routines.slice(0, 5).map((routine) => (
          <li key={routine.id}>
            <span className={`do-routine-status is-${routineStatusTone(routine.status)}`} />
            <div>
              <b>{routine.title}</b>
              <small>
                {routine.status === "active"
                  ? relativeNextRunLabel(routine.nextRunAt)
                  : routine.status}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
