import type { Express } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { sendPublicError } from "../middleware/errors";
import { DATA_MANAGEMENT_COLLECTIONS } from "./dataManagementHelpers";
import { registerDataManagementAuditRoutes } from "./dataManagementAudit";
import { registerDataManagementMigrateRoutes } from "./dataManagementMigrate";

export function registerDataManagementRoutes(app: Express, deps: { getDb: () => any }) {
  registerDataManagementAuditRoutes(app, deps);
  registerDataManagementMigrateRoutes(app, deps);

  // 3. Export Workspace Data (Excluding Sensitive Credentials)
  app.post("/api/data-management/export", async (req, res) => {
    try {
      const { userId, workspaceId } = req.body;
      if (!userId || !workspaceId) {
        return res.status(400).json({ error: "userId and workspaceId are required." });
      }

      const dbAdmin = deps.getDb();
      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const backupData: any = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId,
        workspaceId,
        collections: {}
      };

      let totalRecords = 0;

      for (const col of DATA_MANAGEMENT_COLLECTIONS) {
        try {
          const snapshot = await dbAdmin.collection(col)
            .where("userId", "==", userId)
            .where("workspaceId", "==", workspaceId)
            .get();

          const records: any[] = [];
          snapshot.forEach((doc: any) => {
            const rawData = doc.data();
            const cleanData: any = {};

            // Security: Exclude credentials, keys, passwords, and tokens
            Object.keys(rawData).forEach((key) => {
              const lowerKey = key.toLowerCase();
              const isSensitive = lowerKey.includes("secret") || 
                                  lowerKey.includes("key") || 
                                  lowerKey.includes("token") || 
                                  lowerKey.includes("password") ||
                                  lowerKey.includes("auth") ||
                                  lowerKey.includes("credential");
              if (!isSensitive) {
                cleanData[key] = rawData[key];
              }
            });

            records.push({
              id: doc.id,
              ...cleanData
            });
          });

          backupData.collections[col] = records;
          totalRecords += records.length;
        } catch (e) {
          console.warn(`Skipped exporting collection ${col}:`, e);
        }
      }

      // Log export activity
      await dbAdmin.collection("backup_runs").add({
        userId,
        workspaceId,
        type: "api_export",
        format: "json",
        status: "success",
        recordCount: totalRecords,
        createdAt: FieldValue.serverTimestamp()
      });

      res.json(backupData);

    } catch (e: any) {
      console.error("[Workspace Export Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 4. Get Audit Logs
  app.get("/api/data-management/audit-logs", async (req, res) => {
    try {
      const { workspaceId, limit = "50" } = req.query;
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId is required as a query parameter." });
      }

      const dbAdmin = deps.getDb();
      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const snapshot = await dbAdmin.collection("audit_logs")
        .where("workspaceId", "==", workspaceId)
        .orderBy("createdAt", "desc")
        .limit(parseInt(limit as string, 10))
        .get();

      const logs: any[] = [];
      snapshot.forEach((doc: any) => {
        const d = doc.data();
        logs.push({
          id: doc.id,
          ...d,
          createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt) : null
        });
      });

      res.json(logs);
    } catch (e: any) {
      console.error("[Get Audit Logs Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 5. Create Audit Log (Server-side helper endpoint)
  app.post("/api/data-management/log-audit", async (req, res) => {
    try {
      const { workspaceId, actorId, actorType, action, entityType, entityId, before, after, metadata } = req.body;
      if (!workspaceId || !actorId || !action) {
        return res.status(400).json({ error: "workspaceId, actorId, and action are required." });
      }

      const dbAdmin = deps.getDb();
      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const logDoc = {
        workspaceId,
        actorId,
        actorType: actorType || "user",
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        before: before || null,
        after: after || null,
        metadata: metadata || null,
        createdAt: FieldValue.serverTimestamp()
      };

      const docRef = await dbAdmin.collection("audit_logs").add(logDoc);
      res.json({ id: docRef.id, status: "logged" });
    } catch (e: any) {
      console.error("[Log Audit Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 6. Create Platform Event (Server-side helper endpoint)
  app.post("/api/data-management/log-event", async (req, res) => {
    try {
      const { workspaceId, actorId, eventType, entityType, entityId, payload } = req.body;
      if (!workspaceId || !eventType) {
        return res.status(400).json({ error: "workspaceId and eventType are required." });
      }

      const dbAdmin = deps.getDb();
      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const eventDoc = {
        workspaceId,
        actorId: actorId || "system",
        eventType,
        entityType: entityType || null,
        entityId: entityId || null,
        payload: payload || null,
        createdAt: FieldValue.serverTimestamp()
      };

      const docRef = await dbAdmin.collection("platform_events").add(eventDoc);
      res.json({ id: docRef.id, status: "logged" });
    } catch (e: any) {
      console.error("[Log Event Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });
}
