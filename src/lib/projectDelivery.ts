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

export function normalizeDeliveryStage(project: any): DeliveryStage {
  const value = token(
    project?.deliveryStage || project?.phase || project?.status || "build",
  );
  if (
    value.includes("define") ||
    value.includes("idea") ||
    value.includes("diseno") ||
    value.includes("propuesta") ||
    value.includes("hold")
  )
    return "define";
  if (value.includes("onboard") || value.includes("discovery"))
    return "onboarding";
  if (
    value.includes("deploy") ||
    value.includes("pre_production") ||
    value.includes("preproduccion") ||
    value === "qa"
  )
    return "deploy";
  if (value.includes("operat") || value.includes("production"))
    return "operations";
  return "build";
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
  return normalizeDeliveryPhase(project?.phase, stage);
}

export function deliveryPhaseLabel(project: any) {
  return deliveryPhaseLabels[deliveryPhase(project)];
}
