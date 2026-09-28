/**
 * Draft a ProjectUpdate from recent projected-safe changes for a portal-enabled project.
 * Never auto-publishes when needsClient is non-empty unless autoPublishUpdates is on.
 */
export function draftClientWeeklyUpdate(input: {
  projectId: string;
  clientId: string;
  workspaceId: string;
  authorUid: string;
  locale?: "en" | "es";
  changes: {
    completedTitles: string[];
    nextTitles: string[];
    needsClient: string[];
    newRequests: number;
    closedRequests: number;
    documentsAdded: number;
    checkpointsReached: string[];
    upcomingDates: string[];
  };
  costDetail?: boolean;
}) {
  const loc = input.locale === "en" ? "en" : "es";
  const c = input.changes;
  const summaryParts =
    loc === "en"
      ? [
          c.completedTitles.length
            ? `We completed ${c.completedTitles.length} items this week.`
            : "Delivery continued this week.",
          c.newRequests || c.closedRequests
            ? `Requests: ${c.newRequests} new, ${c.closedRequests} closed.`
            : null,
          c.checkpointsReached.length
            ? `Checkpoints reached: ${c.checkpointsReached.join(", ")}.`
            : null,
        ]
      : [
          c.completedTitles.length
            ? `Completamos ${c.completedTitles.length} ítems esta semana.`
            : "La entrega avanzó esta semana.",
          c.newRequests || c.closedRequests
            ? `Solicitudes: ${c.newRequests} nuevas, ${c.closedRequests} cerradas.`
            : null,
          c.checkpointsReached.length
            ? `Checkpoints alcanzados: ${c.checkpointsReached.join(", ")}.`
            : null,
        ];

  const summary = summaryParts.filter(Boolean).slice(0, 3).join(" ");
  const needsClient = c.needsClient.map((text) => ({ text }));
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  return {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    clientId: input.clientId,
    period: { from, to },
    title: loc === "en" ? "Weekly update" : "Actualización semanal",
    summary,
    done: c.completedTitles.slice(0, 8),
    next: [...c.nextTitles, ...c.upcomingDates.map((d) => `Upcoming: ${d}`)].slice(0, 8),
    needsClient,
    status: "draft" as const,
    source: "odysseus" as const,
    authorUid: input.authorUid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // costDetail reserved — never include costs unless explicitly enabled by caller
    _costDetailAllowed: Boolean(input.costDetail),
  };
}

export function shouldAutoPublishUpdate(draft: {
  needsClient: unknown[];
  autoPublishUpdates?: boolean;
}) {
  if (!draft.autoPublishUpdates) return false;
  return !Array.isArray(draft.needsClient) || draft.needsClient.length === 0;
}
