import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Sparkles } from "../ui/Icon";
import { RoutineComposer } from "./RoutineComposer";
import type { RoutineEntityType } from "../../lib/routines";

export type RoutineLaunchScope = {
  entityType: RoutineEntityType;
  entityId: string | null;
  entityTitle?: string;
  contextStats?: { itemCount?: number; blockedCount?: number; overdueCount?: number };
  /** Prefill the composer sentence (e.g. from Odysseus “↻ Cada mañana”). */
  initialSentence?: string;
};

type RoutineHostValue = {
  openRoutine: (scope: RoutineLaunchScope) => void;
};

const RoutineHostContext = createContext<RoutineHostValue>({
  openRoutine: () => undefined,
});

export function useRoutineHost() {
  return useContext(RoutineHostContext);
}

export function RoutineHostProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<RoutineLaunchScope>({
    entityType: "portfolio",
    entityId: null,
    entityTitle: "Portafolio",
  });

  const openRoutine = useCallback((next: RoutineLaunchScope) => {
    setScope(next);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openRoutine }), [openRoutine]);

  return (
    <RoutineHostContext.Provider value={value}>
      {children}
      <RoutineComposer
        contextStats={scope.contextStats}
        initialSentence={scope.initialSentence}
        onClose={() => setOpen(false)}
        open={open}
        scope={{
          entityType: scope.entityType,
          entityId: scope.entityId,
          entityTitle: scope.entityTitle,
        }}
      />
    </RoutineHostContext.Provider>
  );
}

/** Shared ✦ Rutina chip — use on any item header. */
export function RoutineLaunchButton({
  scope,
  compact = false,
  className = "do-project-routine-btn",
  testId = "routine-launch-button",
}: {
  scope: RoutineLaunchScope;
  compact?: boolean;
  className?: string;
  testId?: string;
}) {
  const { openRoutine } = useRoutineHost();
  return (
    <button
      aria-label="Rutina"
      className={`${className}${compact ? " is-compact" : ""}`}
      data-testid={testId}
      onClick={() => openRoutine(scope)}
      title="Rutina"
      type="button"
    >
      <Sparkles size={14} />
      {compact ? null : <span>Rutina</span>}
    </button>
  );
}
