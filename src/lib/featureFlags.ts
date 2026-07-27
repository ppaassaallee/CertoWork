export type FeatureFlagKey =
  | "conversationalHome"
  | "judgmentEngine"
  | "openAIProvider"
  | "semanticMemory"
  | "safeActionReview"
  | "offlineCapture";

export type FeatureFlagLevel = "environment" | "tenant" | "workspace" | "user";

export interface FeatureFlagScope {
  environment: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  userId?: string | null;
}

export interface FeatureFlagOverride {
  key: FeatureFlagKey;
  level: FeatureFlagLevel;
  targetId: string;
  enabled: boolean;
}

export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  conversationalHome: true,
  judgmentEngine: true,
  openAIProvider: true,
  semanticMemory: true,
  safeActionReview: true,
  offlineCapture: true,
};

const LEVEL_PRECEDENCE: FeatureFlagLevel[] = [
  "environment",
  "tenant",
  "workspace",
  "user",
];

function targetForLevel(level: FeatureFlagLevel, scope: FeatureFlagScope) {
  if (level === "environment") return scope.environment;
  if (level === "tenant") return scope.tenantId;
  if (level === "workspace") return scope.workspaceId;
  return scope.userId;
}

export function resolveFeatureFlag(
  key: FeatureFlagKey,
  scope: FeatureFlagScope,
  overrides: FeatureFlagOverride[] = [],
) {
  let enabled = DEFAULT_FEATURE_FLAGS[key];
  for (const level of LEVEL_PRECEDENCE) {
    const targetId = targetForLevel(level, scope);
    if (!targetId) continue;
    const override = overrides.find(
      (item) => item.key === key && item.level === level && item.targetId === targetId,
    );
    if (override) enabled = override.enabled;
  }
  return enabled;
}
