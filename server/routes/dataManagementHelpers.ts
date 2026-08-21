export const DATA_MANAGEMENT_COLLECTIONS = [
  "projects",
  "tasks",
  "milestones",
  "stakeholders",
  "meetings",
  "decisions",
  "waiting_for",
  "playbooks",
  "skills",
  "knowledge_items",
  "review_candidates",
  "habits",
  "workout_sessions"
];

export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
}
