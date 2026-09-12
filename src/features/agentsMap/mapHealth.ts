export type MapHealth = "sana" | "degradada" | "fallando";

export type RunLike = {
  status?: string | null;
  chainDepth?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  usage?: { durationMs?: number; costUsd?: number } | null;
  error?: string | null;
};

/**
 * Health from observed runs — never invented.
 * ≥90% sana · 70–90% degradada · <70% or ≥3 consecutive failures → fallando
 */
export function computeMapHealth(input: {
  runs: RunLike[];
  failStreak?: number | null;
}): MapHealth {
  const runs = input.runs || [];
  const streak = Number(input.failStreak || 0);
  if (streak >= 3) return "fallando";

  const decided = runs.filter((run) => {
    const status = String(run.status || "").toLowerCase();
    return status === "completed" || status === "failed" || status === "rejected";
  });
  if (!decided.length) return "sana";

  const success = decided.filter(
    (run) => String(run.status || "").toLowerCase() === "completed",
  ).length;
  const rate = success / decided.length;
  if (rate < 0.7) return "fallando";
  if (rate < 0.9) return "degradada";
  return "sana";
}

export function successRate(runs: RunLike[]): number | null {
  const decided = runs.filter((run) => {
    const status = String(run.status || "").toLowerCase();
    return status === "completed" || status === "failed" || status === "rejected";
  });
  if (!decided.length) return null;
  const success = decided.filter(
    (run) => String(run.status || "").toLowerCase() === "completed",
  ).length;
  return Math.round((success / decided.length) * 100);
}

export function consecutiveFailures(runs: RunLike[]): number {
  const ordered = [...runs].sort((a, b) =>
    String(b.startedAt || "").localeCompare(String(a.startedAt || "")),
  );
  let streak = 0;
  for (const run of ordered) {
    const status = String(run.status || "").toLowerCase();
    if (status === "failed" || status === "rejected") streak += 1;
    else if (status === "completed") break;
  }
  return streak;
}

export function hasLoop(runs: RunLike[], threshold = 3): boolean {
  return runs.some((run) => Number(run.chainDepth || 0) >= threshold);
}

export function averageDurationMs(runs: RunLike[]): number | null {
  const values = runs
    .map((run) => Number(run.usage?.durationMs || 0))
    .filter((value) => value > 0);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function totalCostUsd(runs: RunLike[]): number {
  return runs.reduce((sum, run) => sum + Number(run.usage?.costUsd || 0), 0);
}

export function healthLabel(health: MapHealth) {
  if (health === "sana") return "Sana";
  if (health === "degradada") return "Degradada";
  return "Fallando";
}
