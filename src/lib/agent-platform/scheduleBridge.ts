/**
 * Schedule bridge for AgentTrigger.schedule (B6).
 * Hermes job when runtime on; otherwise routines scheduler — never both.
 */
import type { AgentTrigger } from "./types";

export type ScheduleBinding = {
  triggerId: string;
  agentId: string;
  mode: "hermes" | "routines";
  hermesJobId?: string;
  routineScheduleId?: string;
};

const bindings = new Map<string, ScheduleBinding>();

/** Client-safe flag — mirrors CERTO_HERMES_RUNTIME without importing hermesClient. */
export function hermesScheduleRuntimeEnabled(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): boolean {
  const raw = String(env.CERTO_HERMES_RUNTIME || env.VITE_CERTO_HERMES_RUNTIME || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export function clearScheduleBindings() {
  bindings.clear();
}

export function listScheduleBindings() {
  return [...bindings.values()];
}

/**
 * Register a schedule trigger with exactly one backend.
 */
export function bindAgentSchedule(
  trigger: AgentTrigger & { id: string },
  env?: Record<string, string | undefined>,
): ScheduleBinding {
  if (trigger.type !== "schedule" || !trigger.enabled) {
    throw new Error("bindAgentSchedule requires an enabled schedule trigger");
  }
  const existing = bindings.get(trigger.id);
  if (existing) return existing;

  const useHermes = hermesScheduleRuntimeEnabled(env);
  const binding: ScheduleBinding = useHermes
    ? {
        triggerId: trigger.id,
        agentId: trigger.agentId,
        mode: "hermes",
        hermesJobId: trigger.hermesJobId || `hermes_job_${trigger.id}`,
      }
    : {
        triggerId: trigger.id,
        agentId: trigger.agentId,
        mode: "routines",
        routineScheduleId: `routine_sched_${trigger.id}`,
      };

  bindings.set(trigger.id, binding);
  return binding;
}

export function unbindAgentSchedule(triggerId: string) {
  bindings.delete(triggerId);
}
