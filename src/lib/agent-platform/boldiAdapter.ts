/**
 * Read adapter: legacy `boldi_agents` → AgentDefinition + AgentVersion.
 * War Room keeps working; migration is dry-run by default.
 */
import type {
  AgentDefinition,
  AgentStatus,
  AgentVersion,
} from "./types";

export type BoldiAgentDoc = {
  id?: string;
  workspaceId?: string;
  userId?: string;
  ownerUserId?: string;
  name?: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  instructions?: string;
  toolsAllowed?: string[];
  permissionsProfile?: Record<string, string>;
  memoryPolicy?: { recall?: boolean; rememberRequiresApproval?: boolean };
  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function mapStatus(value?: string): AgentStatus {
  const s = String(value || "draft").toLowerCase();
  if (s === "active" || s === "published") return "published";
  if (s === "paused") return "paused";
  if (s === "testing") return "testing";
  if (s === "archived") return "archived";
  return "draft";
}

function mapActionPolicy(
  profile?: Record<string, string>,
): Record<string, "allow" | "ask" | "deny"> {
  const out: Record<string, "allow" | "ask" | "deny"> = {
    read: "allow",
    post_update: "ask",
    add_label: "ask",
    change_state: "ask",
    reassign: "ask",
    create_item: "ask",
    send_email: "deny",
    external_side_effect: "deny",
  };
  if (!profile) return out;
  for (const [key, raw] of Object.entries(profile)) {
    const v = String(raw || "").toLowerCase();
    if (v === "allow" || v === "ask" || v === "deny") out[key] = v;
  }
  return out;
}

export function boldiAgentToDefinition(
  doc: BoldiAgentDoc,
  workspaceId: string,
): AgentDefinition {
  const id = String(doc.id || "unknown");
  const slug =
    String(doc.slug || doc.name || id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || id;
  return {
    id,
    workspaceId: String(doc.workspaceId || workspaceId),
    ownerUserId: String(doc.ownerUserId || doc.userId || ""),
    name: String(doc.name || "Untitled agent"),
    slug,
    description: String(doc.description || ""),
    scope: "workspace",
    status: mapStatus(doc.status),
    source: { type: "certo", sourceVersion: "boldi_agents" },
    currentVersionId: `${id}:v1`,
    runtime: "legacy_odysseus",
    runtimeBindingId: null,
    visibility: "workspace",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function boldiAgentToVersion(
  doc: BoldiAgentDoc,
  workspaceId: string,
): AgentVersion {
  const id = String(doc.id || "unknown");
  const tools = Array.isArray(doc.toolsAllowed) ? doc.toolsAllowed : [];
  return {
    id: `${id}:v1`,
    workspaceId: String(doc.workspaceId || workspaceId),
    agentId: id,
    version: 1,
    instructions: String(doc.instructions || doc.systemPrompt || ""),
    owns: String(doc.description || "").slice(0, 120) || "Legacy War Room agent",
    outcome: "Assist the team through Odysseus / War Room",
    icon: { emoji: "✦", color: "#2547C4" },
    model: { provider: "legacy", name: "odysseus", tier: "balanced" },
    skills: [],
    dataAccess: [{ resource: "workspace", mode: "read" }],
    connections: [
      {
        connectionId: "legacy-tools",
        allowedTools: tools,
        account: { mode: "service" },
      },
    ],
    actionPolicy: mapActionPolicy(doc.permissionsProfile),
    memoryPolicy: {
      recall: Boolean(doc.memoryPolicy?.recall ?? true),
      rememberRequiresApproval: Boolean(
        doc.memoryPolicy?.rememberRequiresApproval ?? true,
      ),
    },
    runtimePolicy: { terminal: false, browser: false, web: true },
    checksum: `boldi:${id}:v1`,
    createdBy: String(doc.ownerUserId || doc.userId || "system"),
    createdAt: doc.createdAt,
  };
}

export function migrateBoldiAgents(
  docs: BoldiAgentDoc[],
  workspaceId: string,
  opts: { dryRun?: boolean } = { dryRun: true },
) {
  const dryRun = opts.dryRun !== false;
  const migrated = docs.map((doc) => ({
    definition: boldiAgentToDefinition(doc, workspaceId),
    version: boldiAgentToVersion(doc, workspaceId),
  }));
  return {
    dryRun,
    count: migrated.length,
    migrated,
  };
}
