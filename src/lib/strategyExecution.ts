export type StrategyHealth = "on_track" | "at_risk" | "off_track" | "done";

export function measureProgress(measure: any) {
  const start = Number(measure?.startValue || 0);
  const target = Number(measure?.targetValue || 0);
  const current = Number(measure?.currentValue ?? start);
  if (!Number.isFinite(start) || !Number.isFinite(target) || target === start)
    return current >= target ? 100 : 0;
  const progress = ((current - start) / (target - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function linkedWorkProgress(measure: any, projects: any[], tasks: any[]) {
  if (measure?.sourceType === "project") {
    const project = projects.find((item) => item.id === measure.sourceId);
    if (!project) return measureProgress(measure);
    if (["completed", "done", "archived"].includes(String(project.status)))
      return 100;
    const progress = Number(project.progress);
    return Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  }
  if (measure?.sourceType === "work_item") {
    const task = tasks.find((item) => item.id === measure.sourceId);
    if (!task) return measureProgress(measure);
    if (["done", "completed", "closed"].includes(String(task.status)))
      return 100;
    const progress = Number(task.progress);
    return Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  }
  return measureProgress(measure);
}

export function objectiveProgress(
  objectiveId: string,
  measures: any[],
  projects: any[] = [],
  tasks: any[] = [],
) {
  const related = measures.filter(
    (measure) =>
      measure.strategicGoalId === objectiveId &&
      String(measure.measureKind || "outcome") === "outcome",
  );
  const scored = related.length
    ? related
    : measures.filter((measure) => measure.strategicGoalId === objectiveId);
  if (!scored.length) return 0;
  return Math.round(
    scored.reduce(
      (sum, measure) => sum + linkedWorkProgress(measure, projects, tasks),
      0,
    ) / scored.length,
  );
}

function dateMs(value: unknown) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function objectiveHealth(
  objective: any,
  progress: number,
  now = new Date(),
): StrategyHealth {
  if (progress >= 100 || String(objective?.status) === "completed") return "done";
  const start = dateMs(objective?.periodStart);
  const end = dateMs(objective?.periodEnd);
  if (!end) return progress > 0 ? "on_track" : "at_risk";
  if (now.getTime() > end) return "off_track";
  if (!start || end <= start) return progress > 0 ? "on_track" : "at_risk";
  const elapsed = Math.max(
    0,
    Math.min(100, ((now.getTime() - start) / (end - start)) * 100),
  );
  if (progress + 20 < elapsed) return "off_track";
  if (progress + 8 < elapsed) return "at_risk";
  return "on_track";
}

export function gemBalance(records: any[], walletEntityId: string) {
  return records
    .filter(
      (record) =>
        record.walletEntityId === walletEntityId &&
        ["gem_boost", "gem_redemption"].includes(String(record.recordType)),
    )
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
}

function comparable(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function canAwardBoost(
  member: any,
  project: any,
  user: any,
) {
  const role = comparable(member?.role);
  if (["owner", "admin"].includes(role)) return true;
  const identities = new Set(
    [member?.id, member?.userId, member?.displayName, member?.email, user?.uid, user?.email]
      .map(comparable)
      .filter(Boolean),
  );
  const projectLeaders = [
    project?.projectManager,
    project?.projectManagerId,
    project?.sponsor,
    project?.sponsorId,
    project?.executiveSponsor,
    project?.accountableOwner,
    ...(Array.isArray(project?.sponsors) ? project.sponsors : []),
  ].map(comparable);
  return projectLeaders.some((value) => identities.has(value));
}

export function strategyCycleLabel(date = new Date()) {
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}
