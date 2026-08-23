import type { Express } from "express";
import { dataManagementAuditBody, fieldErrors } from "../lib/schemas";
import { sendPublicError } from "../middleware/errors";
import { DATA_MANAGEMENT_COLLECTIONS, normalizeString } from "./dataManagementHelpers";

export function registerDataManagementAuditRoutes(app: Express, deps: { getDb: () => any }) {
  // 1. Live Data Quality Audit
  app.post("/api/data-management/audit", async (req, res) => {
    try {
      const parsed = dataManagementAuditBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          code: "invalid_request",
          requestId: req.requestId,
          fields: fieldErrors(parsed.error),
        });
      }
      const { userId, workspaceId } = parsed.data;
      if (!userId || !workspaceId) {
        return res.status(400).json({ error: "userId and workspaceId are required in body." });
      }

      const dbAdmin = deps.getDb();
      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured. Database operations are unavailable." });
      }

      const issues: any[] = [];
      const stats: any = {};
      let criticalCount = 0;
      let totalCount = 0;

      // Map to hold known project IDs to detect orphaned tasks/milestones
      const projectIdsSet = new Set<string>();
      const projectWorkspaceMap = new Map<string, string>();

      // Pre-scan projects
      try {
        const projSnap = await dbAdmin.collection("projects").where("userId", "==", userId).get();
        projSnap.forEach((doc: any) => {
          projectIdsSet.add(doc.id);
          const data = doc.data();
          if (data.workspaceId) {
            projectWorkspaceMap.set(doc.id, data.workspaceId);
          }
        });
      } catch (err) {
        console.error("Failed to pre-scan projects:", err);
      }

      // Scan each collection
      for (const col of DATA_MANAGEMENT_COLLECTIONS) {
        try {
          const snapshot = await dbAdmin.collection(col).where("userId", "==", userId).get();
          stats[col] = snapshot.size;
          totalCount += snapshot.size;

          const tagsSeenInWorkspace = new Set<string>();
          const categoriesSeenInWorkspace = new Set<string>();

          snapshot.forEach((doc: any) => {
            const data = doc.data();
            const recordId = doc.id;

            // Check Workspace Scope
            if (!data.workspaceId) {
              criticalCount++;
              issues.push({
                id: `ws-${col}-${recordId}`,
                severity: "critical",
                collection: col,
                recordId,
                issueType: "missing_workspace_id",
                description: `Record is missing its workspaceId. This violates multi-tenant isolation.`,
                suggestedFix: `Assign default workspaceId: ${workspaceId}`,
                autoFixAvailable: true
              });
            } else if (data.workspaceId !== workspaceId) {
              // Not an issue if they are in another valid workspace, but we log if it has a mismatch
            }

            // Check Timestamps
            if (!data.createdAt) {
              issues.push({
                id: `ts-create-${col}-${recordId}`,
                severity: "medium",
                collection: col,
                recordId,
                issueType: "missing_created_at",
                description: `Record is missing its createdAt timestamp.`,
                suggestedFix: `Assign current server timestamp.`,
                autoFixAvailable: true
              });
            }
            if (!data.updatedAt && !data.createdAt) {
              issues.push({
                id: `ts-update-${col}-${recordId}`,
                severity: "low",
                collection: col,
                recordId,
                issueType: "missing_updated_at",
                description: `Record is missing its updatedAt timestamp.`,
                suggestedFix: `Set updatedAt to createdAt.`,
                autoFixAvailable: true
              });
            }

            // Specific validation rules for Projects
            if (col === "projects") {
              const title = data.title || "";
              if (!title) {
                issues.push({
                  id: `proj-title-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "empty_title",
                  description: `Project is missing a title.`,
                  suggestedFix: `Assign a placeholder title.`,
                  autoFixAvailable: true
                });
              }

              // Check normalization
              if (title && !data.normalizedTitle) {
                issues.push({
                  id: `proj-norm-${recordId}`,
                  severity: "low",
                  collection: col,
                  recordId,
                  issueType: "missing_normalization",
                  description: `Project is missing its search-optimized normalizedTitle.`,
                  suggestedFix: `Generate normalizedTitle from "${title}"`,
                  autoFixAvailable: true
                });
              }

              // Duplicate Tags inside projects
              if (Array.isArray(data.tags)) {
                data.tags.forEach((tag: string) => {
                  const norm = normalizeString(tag);
                  if (tagsSeenInWorkspace.has(norm)) {
                    issues.push({
                      id: `proj-tag-dup-${recordId}-${norm}`,
                      severity: "low",
                      collection: col,
                      recordId,
                      issueType: "duplicate_tag",
                      description: `Case-insensitive duplicate tag "${tag}" exists in the same project workspace.`,
                      suggestedFix: `Merge duplicate tags.`,
                      autoFixAvailable: true
                    });
                  } else {
                    tagsSeenInWorkspace.add(norm);
                  }
                });
              }
            }

            // Specific validation rules for Tasks
            if (col === "tasks") {
              const title = data.title || "";
              if (!title) {
                issues.push({
                  id: `task-title-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "empty_title",
                  description: `Task is missing a title.`,
                  suggestedFix: `Assign a placeholder title.`,
                  autoFixAvailable: true
                });
              }

              // Orphaned Tasks pointing to non-existent projects
              if (data.projectId && !projectIdsSet.has(data.projectId)) {
                issues.push({
                  id: `task-orphan-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "orphaned_project_reference",
                  description: `Task points to non-existent projectId "${data.projectId}".`,
                  suggestedFix: `Remove project reference or move to an active project.`,
                  autoFixAvailable: true
                });
              }

              // Cross-workspace mismatch
              if (data.projectId && projectIdsSet.has(data.projectId)) {
                const pWs = projectWorkspaceMap.get(data.projectId);
                if (pWs && data.workspaceId && pWs !== data.workspaceId) {
                  criticalCount++;
                  issues.push({
                    id: `task-ws-mismatch-${recordId}`,
                    severity: "critical",
                    collection: col,
                    recordId,
                    issueType: "workspace_isolation_breach",
                    description: `Task workspaceId ("${data.workspaceId}") does not match its parent project workspaceId ("${pWs}").`,
                    suggestedFix: `Update task workspaceId to align with parent project.`,
                    autoFixAvailable: true
                  });
                }
              }

              // Check priority: "P4" or 4 fallback checks
              if (data.priority === 4 || data.priority === "P4") {
                issues.push({
                  id: `task-priority-fallback-${recordId}`,
                  severity: "medium",
                  collection: col,
                  recordId,
                  issueType: "priority_fallback_p4",
                  description: `Task has priority P4. Priority null should represent Unprioritized. P4 is reserved for intentional distraction level only.`,
                  suggestedFix: `Convert priority value to null (Unprioritized).`,
                  autoFixAvailable: true
                });
              }

              if (title && !data.normalizedTitle) {
                issues.push({
                  id: `task-norm-${recordId}`,
                  severity: "low",
                  collection: col,
                  recordId,
                  issueType: "missing_normalization",
                  description: `Task is missing its search-optimized normalizedTitle.`,
                  suggestedFix: `Generate normalizedTitle from "${title}"`,
                  autoFixAvailable: true
                });
              }
            }

            // Specific validation rules for Milestones
            if (col === "milestones") {
              if (data.projectId && !projectIdsSet.has(data.projectId)) {
                issues.push({
                  id: `milestone-orphan-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "orphaned_project_reference",
                  description: `Milestone points to non-existent projectId "${data.projectId}".`,
                  suggestedFix: `Clean up milestone reference.`,
                  autoFixAvailable: true
                });
              }
            }

            // Generic search normalization checks
            const name = data.name || "";
            if (name && !data.normalizedName && ["stakeholders", "skills"].includes(col)) {
              issues.push({
                id: `norm-name-${col}-${recordId}`,
                severity: "low",
                collection: col,
                recordId,
                issueType: "missing_normalization",
                description: `Record is missing its search-optimized normalizedName.`,
                suggestedFix: `Generate normalizedName from "${name}"`,
                autoFixAvailable: true
              });
            }
          });
        } catch (e) {
          console.error(`Error auditing collection ${col}:`, e);
        }
      }

      // Fetch latest run info
      let latestMigration: any = null;
      try {
        const migSnap = await dbAdmin.collection("migration_runs")
          .where("userId", "==", userId)
          .where("workspaceId", "==", workspaceId)
          .orderBy("completedAt", "desc")
          .limit(1)
          .get();
        if (!migSnap.empty) {
          latestMigration = migSnap.docs[0].data();
          latestMigration.id = migSnap.docs[0].id;
        }
      } catch (e) {
        console.warn("Could not read latest migration runs:", e);
      }

      let latestExport: any = null;
      try {
        const expSnap = await dbAdmin.collection("backup_runs")
          .where("userId", "==", userId)
          .where("workspaceId", "==", workspaceId)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();
        if (!expSnap.empty) {
          latestExport = expSnap.docs[0].data();
          latestExport.id = expSnap.docs[0].id;
        }
      } catch (e) {
        console.warn("Could not read latest export runs:", e);
      }

      res.json({
        workspaceId,
        checkedAt: new Date().toISOString(),
        totalCount,
        criticalCount,
        stats,
        issues,
        latestMigration,
        latestExport
      });

    } catch (e: any) {
      console.error("[Database Audit Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });
}
