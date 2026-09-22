#!/usr/bin/env tsx
/**
 * Dry-run migration: boldi_agents → AgentDefinition + AgentVersion.
 * Usage: npx tsx scripts/migrateBoldiAgents.ts --workspace <id> [--apply]
 * Without --apply, only prints the planned migration (default).
 */
import { migrateBoldiAgents, type BoldiAgentDoc } from "../src/lib/agent-platform/boldiAdapter";

function parseArgs(argv: string[]) {
  const workspaceIdx = argv.indexOf("--workspace");
  return {
    workspaceId: workspaceIdx >= 0 ? argv[workspaceIdx + 1] : "demo-workspace",
    apply: argv.includes("--apply"),
  };
}

async function main() {
  const { workspaceId, apply } = parseArgs(process.argv.slice(2));
  // Script is intentionally offline — callers pass JSON via stdin or use empty set.
  let docs: BoldiAgentDoc[] = [];
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (raw) docs = JSON.parse(raw) as BoldiAgentDoc[];
  }
  const result = migrateBoldiAgents(docs, workspaceId, { dryRun: !apply });
  console.log(
    JSON.stringify(
      {
        workspaceId,
        dryRun: result.dryRun,
        count: result.count,
        sample: result.migrated.slice(0, 3).map((row) => ({
          id: row.definition.id,
          name: row.definition.name,
          versionId: row.version.id,
          owns: row.version.owns,
        })),
        note: apply
          ? "Apply mode selected — wire Firestore writes from a privileged admin job before enabling."
          : "Dry-run only. Pass JSON array of boldi_agents on stdin and --apply when ready.",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
