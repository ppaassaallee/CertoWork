import assert from "node:assert/strict";
import test from "node:test";
import { resolveFeatureFlag, type FeatureFlagOverride } from "../src/lib/featureFlags";

test("user override wins over workspace, tenant, and environment", () => {
  const overrides: FeatureFlagOverride[] = [
    { key: "judgmentEngine", level: "environment", targetId: "production", enabled: false },
    { key: "judgmentEngine", level: "tenant", targetId: "tenant-a", enabled: true },
    { key: "judgmentEngine", level: "workspace", targetId: "workspace-a", enabled: false },
    { key: "judgmentEngine", level: "user", targetId: "user-a", enabled: true },
  ];

  assert.equal(
    resolveFeatureFlag(
      "judgmentEngine",
      {
        environment: "production",
        tenantId: "tenant-a",
        workspaceId: "workspace-a",
        userId: "user-a",
      },
      overrides,
    ),
    true,
  );
});

test("defaults remain enabled when no scoped override exists", () => {
  assert.equal(resolveFeatureFlag("offlineCapture", { environment: "test" }), true);
});

test("commandRun stays off until a tenant, workspace, or user turns it on", () => {
  assert.equal(resolveFeatureFlag("commandRun", { environment: "production" }), false);
  const scope = {
    environment: "production",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    userId: "user-a",
  };
  assert.equal(
    resolveFeatureFlag("commandRun", scope, [
      { key: "commandRun", level: "tenant", targetId: "tenant-a", enabled: true },
    ]),
    true,
  );
  assert.equal(
    resolveFeatureFlag("commandRun", scope, [
      { key: "commandRun", level: "tenant", targetId: "tenant-a", enabled: true },
      { key: "commandRun", level: "workspace", targetId: "workspace-a", enabled: false },
    ]),
    false,
  );
  assert.equal(
    resolveFeatureFlag("commandRun", scope, [
      { key: "commandRun", level: "workspace", targetId: "workspace-a", enabled: false },
      { key: "commandRun", level: "user", targetId: "user-a", enabled: true },
    ]),
    true,
  );
});

