import { z } from "zod";

export const workspaceScopedBody = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

export const dataManagementAuditBody = workspaceScopedBody.extend({
  collections: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

export const dataManagementMigrateBody = workspaceScopedBody.extend({
  mode: z.enum(["dry-run", "apply", "audit"]).or(z.string()),
  collections: z.array(z.string()).optional(),
});

export const dataManagementLogBody = z.object({
  workspaceId: z.string().min(1),
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
});

export function fieldErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
