import type { WorkspaceMember } from "./workspaceCollaboration";
import { normalizeAlias, isAssignableMember } from "./workspaceCollaboration";
import { normalizeAccessEmail } from "./accessControl";
import { normalizeDeliveryStage } from "./projectDelivery";
import type { ProductPhase } from "./workClassification";

export const PORTFOLIO_MASTER_IMPORT_KEY = "ago2026-apversion";
export const PORTFOLIO_MASTER_SOURCE =
  "Portafolio_Super_Sheet1_Ago2026 - apversion.xlsx";
export const PORTFOLIO_SHARE_ALIASES = [
  "cesar",
  "nico",
  "jose",
  "rafael",
  "regina",
] as const;

export type PortfolioMasterRow = {
  sourceRow: number;
  portfolioBlock?: string | null;
  portfolioBlockKey?: string | null;
  sourceStatus?: string | null;
  projectName: string;
  bpo?: string | null;
  client?: string | null;
  project?: string | null;
  technology?: string | null;
  phase?: string | null;
  contact?: string | null;
  prodPlanDate?: string | null;
  qaPlanDate?: string | null;
  daysToProd?: number | null;
  description?: string | null;
  managementFocus?: string | null;
  juneUsd?: number | null;
  julyUsd?: number | null;
  totalUsd?: number | null;
};

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "";
}

function token(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function money(value: unknown) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function isPureAiWorkspace(workspace?: { name?: string | null } | null) {
  const name = clean(workspace?.name).toLowerCase().replace(/\s+/g, " ");
  return name === "pure ai" || name === "pureai" || name.includes("pure ai");
}

export function shouldReplacePureAiPortfolio(workspace?: {
  name?: string | null;
  portfolioImportKey?: string | null;
} | null) {
  return (
    isPureAiWorkspace(workspace) &&
    String(workspace?.portfolioImportKey || "") !== PORTFOLIO_MASTER_IMPORT_KEY
  );
}

export function portfolioImportKey(row: Pick<PortfolioMasterRow, "bpo" | "client" | "project" | "technology" | "sourceRow">) {
  return [
    token(row.bpo),
    token(row.client),
    token(row.project),
    token(row.technology),
    String(row.sourceRow),
  ].join("|");
}

export function portfolioProjectKey(row: PortfolioMasterRow) {
  const base = [row.bpo, row.client, row.project || row.projectName]
    .map((value) => token(value).replace(/_/g, "-"))
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .slice(0, 36);
  return `${base || "PROJECT"}-${String(row.sourceRow).padStart(2, "0")}`;
}

export function mapSourceHealth(sourceStatus?: string | null) {
  const value = token(sourceStatus);
  if (value.includes("bloqueado")) return "blocked" as const;
  if (
    value.includes("vencido") ||
    value.includes("riesgo") ||
    value.includes("hold") ||
    value.includes("proxima")
  )
    return "at_risk" as const;
  return "on_track" as const;
}

export function mapSourceStatus(sourceStatus?: string | null, phase?: string | null) {
  const value = token(sourceStatus || phase);
  if (value.includes("hold")) return "paused";
  if (value.includes("end_of_life") || value === "eol") return "completed";
  if (value.includes("reclasificado")) return "paused";
  if (value === "tbc") return "planning";
  return "active";
}

export function mapProductPhase(phase?: string | null): ProductPhase {
  const value = token(phase);
  if (value.includes("discovery")) return "Explore";
  if (value.includes("diseno") || value.includes("design") || value.includes("propuesta"))
    return "Shape";
  if (value.includes("desarrollo") || value.includes("development")) return "Build";
  if (value === "qa") return "Beta";
  if (value.includes("pre_produccion") || value.includes("preproduccion")) return "Launch";
  if (value.includes("produccion") || value.includes("production") || value === "eol")
    return "Grow";
  return "Explore";
}

function memberSearchText(member: WorkspaceMember) {
  const email = normalizeAccessEmail(member.email || member.emailLower);
  return {
    alias: normalizeAlias(member.alias).toLowerCase(),
    display: clean(member.displayName).toLowerCase(),
    email,
    local: email.split("@")[0] || "",
  };
}

export function memberMatchesShareAlias(member: WorkspaceMember, alias: string) {
  const needle = alias.trim().toLowerCase();
  if (!needle) return false;
  const text = memberSearchText(member);
  const words = text.display.split(/\s+/).filter(Boolean);
  return (
    text.alias === needle ||
    text.alias.startsWith(needle) ||
    words[0] === needle ||
    words.includes(needle) ||
    text.local === needle ||
    text.local.startsWith(`${needle}.`) ||
    text.local.startsWith(needle)
  );
}

export function resolvePortfolioShareTargets(
  members: WorkspaceMember[],
  aliases: readonly string[] = PORTFOLIO_SHARE_ALIASES,
) {
  const active = members.filter(isAssignableMember);
  const matched = aliases.map((alias) => {
    const member = active.find((candidate) => memberMatchesShareAlias(candidate, alias));
    return { alias, member };
  });
  return {
    matched,
    missingAliases: matched.filter((item) => !item.member).map((item) => item.alias),
    userIds: unique(matched.map((item) => item.member?.userId)),
    memberIds: unique(matched.map((item) => item.member?.id)),
    emails: unique(matched.map((item) => item.member?.email || item.member?.emailLower)),
    labels: unique(
      matched.map(
        (item) =>
          normalizeAlias(item.member?.alias) ||
          normalizeAlias(item.member?.displayName) ||
          item.alias,
      ),
    ),
  };
}

export function buildPortfolioProjectPayload(
  row: PortfolioMasterRow,
  context: {
    userId: string;
    email?: string | null;
    workspaceId: string;
    shareUserIds?: string[];
    shareMemberIds?: string[];
    shareEmails?: string[];
    shareLabels?: string[];
  },
) {
  const title = clean(row.projectName) || clean(row.project) || "Untitled project";
  const shortTitle = clean(row.project) || title;
  const bpo = clean(row.bpo) || "Internal";
  const client = clean(row.client) || "Internal";
  const technology = clean(row.technology);
  const phase = clean(row.phase);
  const dueDate = clean(row.prodPlanDate) || null;
  const qaPlanDate = clean(row.qaPlanDate) || null;
  const juneUsd = money(row.juneUsd);
  const julyUsd = money(row.julyUsd);
  const totalUsd = money(row.totalUsd);
  const health = mapSourceHealth(row.sourceStatus);
  const status = mapSourceStatus(row.sourceStatus, row.phase);
  const deliveryStage = normalizeDeliveryStage({
    phase,
    status: row.sourceStatus,
    deliveryStage: undefined,
  });
  const visibleToUserIds = unique([context.userId, ...(context.shareUserIds || [])]);
  const visibleToEmails = unique([
    normalizeAccessEmail(context.email),
    ...(context.shareEmails || []),
  ]);
  const sharedWithUserIds = unique(context.shareUserIds || []);
  const teamMemberIds = unique(context.shareMemberIds || []);
  const teamMembers = unique(context.shareLabels || []);

  return {
    userId: context.userId,
    workspaceId: context.workspaceId,
    createdBy: context.userId,
    ownerId: context.userId,
    visibility: sharedWithUserIds.length ? "shared" : "private",
    visibleToUserIds,
    visibleToEmails,
    sharedWithUserIds,
    teamMemberIds,
    teamMembers,
    title,
    name: title,
    shortTitle,
    normalizedTitle: title.toLowerCase().replace(/\s+/g, " "),
    description: clean(row.description),
    bpo,
    deliveryEntity: bpo,
    client,
    clientEntity: client,
    technology,
    category: technology,
    serviceLine: technology,
    phase,
    productPhase: mapProductPhase(row.phase),
    workCategory: "Client Delivery",
    projectType: "delivery",
    methodology: "hybrid",
    sourceStatus: clean(row.sourceStatus),
    contact: clean(row.contact) || null,
    projectManager: clean(row.contact) || null,
    originalDueDate: dueDate,
    targetDate: dueDate,
    dueDate,
    qaPlanDate,
    prodPlanDate: dueDate,
    daysToProd: row.daysToProd == null ? null : Number(row.daysToProd),
    nextAction: clean(row.managementFocus),
    managementFocus: clean(row.managementFocus),
    juneUsd,
    julyUsd,
    totalUsd,
    consumptionJunJulUsd: totalUsd,
    recurringMonthlyCost: julyUsd,
    portfolioBlock: clean(row.portfolioBlock),
    portfolioBlockKey: clean(row.portfolioBlockKey),
    portfolioPriority: clean(row.portfolioBlockKey),
    projectKey: portfolioProjectKey(row),
    importKey: portfolioImportKey(row),
    deliveryStage,
    status,
    health,
    healthOverride: health,
    excel: {
      estado: clean(row.sourceStatus),
      projectName: clean(row.projectName),
      bpo,
      cliente: client,
      proyecto: shortTitle,
      tecnologia: technology,
      fase: phase,
      ownerPoc: clean(row.contact),
      prodPlan: dueDate,
      qaPlan: qaPlanDate,
      diasAProd: row.daysToProd == null ? null : Number(row.daysToProd),
      descripcion: clean(row.description),
      focoDeGestion: clean(row.managementFocus),
      junUsd: juneUsd,
      julUsd: julyUsd,
      totalUsd,
    },
    source: PORTFOLIO_MASTER_SOURCE,
    sourceRow: row.sourceRow,
    importedFrom: PORTFOLIO_MASTER_IMPORT_KEY,
    favorite: ["CRÍTICA", "ALTA"].includes(clean(row.portfolioBlockKey)),
  };
}
