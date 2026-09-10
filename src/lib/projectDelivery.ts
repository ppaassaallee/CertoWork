export const DELIVERY_STAGES = [
  "define",
  "onboarding",
  "build",
  "deploy",
  "operations",
] as const;

export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

export const deliveryStageLabels: Record<DeliveryStage, string> = {
  define: "Define",
  onboarding: "Onboarding",
  build: "Build",
  deploy: "Deploy",
  operations: "Operations",
};

export const DELIVERY_PHASES_BY_STAGE = {
  define: [
    "intake",
    "qualification",
    "discovery",
    "business_case_approval",
  ],
  onboarding: [
    "kickoff",
    "requirements",
    "solution_design",
    "ready_for_build",
  ],
  build: [
    "development",
    "integration",
    "internal_qa",
    "ready_for_uat",
  ],
  deploy: ["uat", "release_readiness", "go_live", "hypercare"],
  operations: ["live", "support_sla", "optimization", "renewal_closure"],
} as const satisfies Record<DeliveryStage, readonly string[]>;

export type DeliveryPhase =
  (typeof DELIVERY_PHASES_BY_STAGE)[DeliveryStage][number];

export const deliveryPhaseLabels: Record<DeliveryPhase, string> = {
  intake: "Intake",
  qualification: "Qualification",
  discovery: "Discovery",
  business_case_approval: "Business case & approval",
  kickoff: "Kickoff",
  requirements: "Requirements",
  solution_design: "Solution design",
  ready_for_build: "Ready for build",
  development: "Development",
  integration: "Integration",
  internal_qa: "Internal QA",
  ready_for_uat: "Ready for UAT",
  uat: "User acceptance testing",
  release_readiness: "Release readiness",
  go_live: "Go-live",
  hypercare: "Hypercare",
  live: "Live operations",
  support_sla: "Support & SLA",
  optimization: "Optimization",
  renewal_closure: "Renewal / closure",
};

const ALL_DELIVERY_PHASES = Object.values(DELIVERY_PHASES_BY_STAGE).flat();

function token(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isDeliveryStage(value: string): value is DeliveryStage {
  return (DELIVERY_STAGES as readonly string[]).includes(value);
}

/** Infer stage from Excel / pricing phase labels (and Grow product phase). */
export function inferDeliveryStageFromPhase(value: unknown): DeliveryStage | null {
  const normalized = token(value);
  if (!normalized) return null;
  if (isDeliveryStage(normalized)) return normalized;
  if (
    normalized.includes("define") ||
    normalized.includes("idea") ||
    normalized.includes("diseno") ||
    normalized.includes("propuesta") ||
    normalized.includes("hold") ||
    normalized === "tbc"
  )
    return "define";
  if (normalized.includes("onboard") || normalized.includes("discovery"))
    return "onboarding";
  if (
    normalized.includes("deploy") ||
    normalized.includes("pre_production") ||
    normalized.includes("preproduccion") ||
    normalized.includes("pre_produccion") ||
    normalized === "qa"
  )
    return "deploy";
  if (
    normalized.includes("operat") ||
    normalized.includes("production") ||
    normalized.includes("produccion") ||
    normalized.includes("end_of_life") ||
    normalized === "eol" ||
    normalized === "grow"
  )
    return "operations";
  if (
    normalized.includes("desarrollo") ||
    normalized.includes("development") ||
    normalized.includes("en_curso") ||
    normalized.includes("in_progress")
  )
    return "build";
  return null;
}

export function normalizeDeliveryStage(project: any): DeliveryStage {
  const explicit = token(project?.deliveryStage);
  if (isDeliveryStage(explicit)) {
    return explicit;
  }
  const inferred =
    inferDeliveryStageFromPhase(project?.phase) ||
    inferDeliveryStageFromPhase(project?.excel?.fase) ||
    inferDeliveryStageFromPhase(project?.productPhase) ||
    inferDeliveryStageFromPhase(project?.sourceStatus) ||
    inferDeliveryStageFromPhase(project?.status);
  return inferred || "build";
}

/** Keep an existing stage unless the sheet/phase clearly says the project is live. */
export function resolvePricingDeliveryStage(input: {
  existing?: Record<string, unknown> | null;
  phase?: unknown;
  status?: unknown;
  productPhase?: unknown;
  excelFase?: unknown;
}): DeliveryStage {
  const fromSheet =
    inferDeliveryStageFromPhase(input.phase) ||
    inferDeliveryStageFromPhase(input.excelFase) ||
    inferDeliveryStageFromPhase(input.productPhase) ||
    inferDeliveryStageFromPhase(input.status) ||
    "build";
  const existing = token(input.existing?.deliveryStage);
  if (fromSheet === "operations") return "operations";
  if (isDeliveryStage(existing)) {
    // Never knock a live project out of Operations when the sheet maps elsewhere.
    if (existing === "operations") return "operations";
    return existing;
  }
  return fromSheet;
}

export function phasesForStage(stage: DeliveryStage) {
  return DELIVERY_PHASES_BY_STAGE[stage] as readonly DeliveryPhase[];
}

export function defaultPhaseForStage(stage: DeliveryStage): DeliveryPhase {
  return phasesForStage(stage)[0];
}

export function normalizeDeliveryPhase(
  value: unknown,
  stage: DeliveryStage,
): DeliveryPhase {
  const normalized = token(value);
  const exact = ALL_DELIVERY_PHASES.find((phase) => phase === normalized);
  if (exact && phasesForStage(stage).includes(exact)) return exact;

  const alias: Partial<Record<string, DeliveryPhase>> = {
    propuesta: "business_case_approval",
    hold: "qualification",
    discovery: "discovery",
    diseno: "solution_design",
    design: "solution_design",
    desarrollo: "development",
    development: "development",
    pre_produccion: "release_readiness",
    preproduction: "release_readiness",
    produccion: stage === "operations" ? "live" : "go_live",
    production: stage === "operations" ? "live" : "go_live",
    qa: stage === "build" ? "internal_qa" : "uat",
  };
  const mapped = alias[normalized];
  return mapped && phasesForStage(stage).includes(mapped)
    ? mapped
    : defaultPhaseForStage(stage);
}

export function deliveryPhase(project: any): DeliveryPhase {
  const stage = normalizeDeliveryStage(project);
  return normalizeDeliveryPhase(
    project?.deliveryPhase || project?.phase,
    stage,
  );
}

export function deliveryPhaseLabel(project: any) {
  return deliveryPhaseLabels[deliveryPhase(project)];
}
