import { saveRoutineDraft } from "./storage";
import { getManifest } from "./guided";
import type { RoutineCompileResult } from "./types";
import { defaultRoutinePermissions, emptyRoutineStats } from "./types";

/** Activate a guided personal recipe (WRAP / Plan) in Mi trabajo. */
export async function activateGuidedRecipe(input: {
  workspaceId: string;
  ownerUserId: string;
  recipeId: string;
  timezone?: string;
}): Promise<string> {
  const manifest = getManifest(input.recipeId);
  if (!manifest) throw new Error(`Unknown guided recipe: ${input.recipeId}`);
  const compiled: RoutineCompileResult = {
    spec: {
      title: manifest.name,
      sentence: manifest.activationSentence,
      scope: { entityType: "person", entityId: null, entityTitle: "Mi trabajo" },
      trigger: {
        kind: "schedule",
        human: manifest.cadence.humanText,
        cron: manifest.cadence.cron,
        timezone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
      goal: manifest.tagline,
      deliverable: {
        channel: "session",
        to: [],
        format: "long",
        language: "es",
      },
      permissions: {
        ...defaultRoutinePermissions(),
        editItems: "ask",
        writeOthers: "never",
        ...(manifest.permissions || {}),
      },
      status: "active",
      class: "guided",
      recipeId: manifest.id,
      stats: emptyRoutineStats(),
    },
    questions: [],
    estimatedCostUsd: 0,
    estimatedMinutesSaved: manifest.estimatedMinutes,
  };
  return saveRoutineDraft({
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    compiled,
    activate: true,
  });
}
