import type { Express } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { dataManagementMigrateBody, fieldErrors } from "../lib/schemas";
import { sendPublicError } from "../middleware/errors";
import { DATA_MANAGEMENT_COLLECTIONS, normalizeString } from "./dataManagementHelpers";

export function registerDataManagementMigrateRoutes(app: Express, deps: { getDb: () => any }) {
  // 2. Dry Run & Apply Database Migrations
  app.post("/api/data-management/migrate", async (req, res) => {
    try {
      const parsed = dataManagementMigrateBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          code: "invalid_request",
          requestId: req.requestId,
          fields: fieldErrors(parsed.error),
        });
      }
      const { userId, workspaceId, mode } = parsed.data;
      if (!userId || !workspaceId || !mode) {
        return res.status(400).json({ error: "userId, workspaceId, and mode are required in body." });
      }

      const dbAdmin = deps.getDb();
      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const isDry = mode === "dry";
      const logs: string[] = [];
      let recordsScanned = 0;
      let recordsChanged = 0;
      const errors: string[] = [];

      // Pre-fetch projects for validation mapping
      const projectIdsSet = new Set<string>();
      const projectWorkspaceMap = new Map<string, string>();
      try {
        const projSnap = await dbAdmin.collection("projects").where("userId", "==", userId).get();
        projSnap.forEach((doc: any) => {
          projectIdsSet.add(doc.id);
          const d = doc.data();
          if (d.workspaceId) {
            projectWorkspaceMap.set(doc.id, d.workspaceId);
          }
        });
      } catch (e) {
        console.error("Failed to pre-fetch projects:", e);
      }

      // Loop through and perform migration
      for (const col of DATA_MANAGEMENT_COLLECTIONS) {
        try {
          const snapshot = await dbAdmin.collection(col).where("userId", "==", userId).get();
          logs.push(`Scanning collection "${col}"... Found ${snapshot.size} records.`);

          for (const doc of snapshot.docs) {
            recordsScanned++;
            const data = doc.data();
            let changed = false;
            const updateData: any = {};

            // 1. Missing workspaceId
            if (!data.workspaceId) {
              updateData.workspaceId = workspaceId;
              changed = true;
              logs.push(`[${col}:${doc.id}] Adding missing workspaceId: ${workspaceId}`);
            }

            // 2. Missing timestamps
            if (!data.createdAt) {
              updateData.createdAt = FieldValue.serverTimestamp();
              changed = true;
              logs.push(`[${col}:${doc.id}] Set missing createdAt to serverTimestamp`);
            }
            if (!data.updatedAt) {
              updateData.updatedAt = FieldValue.serverTimestamp();
              changed = true;
              logs.push(`[${col}:${doc.id}] Set missing updatedAt to serverTimestamp`);
            }

            // 3. Normalized Title / Name
            if (col === "projects" || col === "tasks") {
              const title = data.title || "";
              if (title && !data.normalizedTitle) {
                updateData.normalizedTitle = normalizeString(title);
                changed = true;
                logs.push(`[${col}:${doc.id}] Setting normalizedTitle: "${updateData.normalizedTitle}"`);
              }
            }
            if (["stakeholders", "skills"].includes(col)) {
              const name = data.name || "";
              if (name && !data.normalizedName) {
                updateData.normalizedName = normalizeString(name);
                changed = true;
                logs.push(`[${col}:${doc.id}] Setting normalizedName: "${updateData.normalizedName}"`);
              }
            }

            // 4. Task specific priority conversions (P4/4 fallback to null)
            if (col === "tasks") {
              if (data.priority === 4 || data.priority === "P4") {
                updateData.priority = null;
                changed = true;
                logs.push(`[tasks:${doc.id}] Resetting default priority P4 to null (Unprioritized)`);
              }

              // Align task workspaceId with its parent project
              if (data.projectId && projectIdsSet.has(data.projectId)) {
                const parentWs = projectWorkspaceMap.get(data.projectId);
                const currentWs = data.workspaceId || updateData.workspaceId || workspaceId;
                if (parentWs && parentWs !== currentWs) {
                  updateData.workspaceId = parentWs;
                  changed = true;
                  logs.push(`[tasks:${doc.id}] Correcting workspaceId mismatch to match parent project: ${parentWs}`);
                }
              }
            }

            // Write back if we are applying and have changes
            if (changed) {
              recordsChanged++;
              if (!isDry) {
                try {
                  await doc.ref.update({
                    ...updateData,
                    updatedAt: FieldValue.serverTimestamp()
                  });
                } catch (writeErr: any) {
                  errors.push(`Error writing doc ${col}:${doc.id}: ${writeErr.message}`);
                }
              }
            }
          }
        } catch (colErr: any) {
          errors.push(`Error processing collection ${col}: ${colErr.message}`);
        }
      }

      // Record run in database
      const runPayload = {
        userId,
        workspaceId,
        migrationName: "Gazelle Database Hardening Migration v1",
        status: isDry ? "dry_run" : (errors.length > 0 ? "completed_with_errors" : "completed"),
        recordsScanned,
        recordsChanged,
        errors,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      if (!isDry) {
        await dbAdmin.collection("migration_runs").add(runPayload);
        await dbAdmin.collection("schema_migrations").doc("gazelle_hardening_v1").set({
          name: "Gazelle Database Hardening",
          version: 1,
          appliedAt: new Date().toISOString(),
          appliedBy: userId,
          status: "success"
        });
      }

      res.json({
        status: "success",
        mode,
        recordsScanned,
        recordsChanged,
        errors,
        logs
      });

    } catch (e: any) {
      console.error("[Database Migration Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });
}
