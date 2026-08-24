import assert from "node:assert/strict";
import test from "node:test";

import {
  DELIVERY_PHASES_BY_STAGE,
  DELIVERY_STAGES,
  deliveryPhase,
  normalizeDeliveryPhase,
  normalizeDeliveryStage,
  phasesForStage,
} from "../src/lib/projectDelivery";

test("delivery uses five stable stages with four controlled phases each", () => {
  assert.deepEqual(DELIVERY_STAGES, [
    "define",
    "onboarding",
    "build",
    "deploy",
    "operations",
  ]);
  for (const stage of DELIVERY_STAGES) {
    assert.equal(DELIVERY_PHASES_BY_STAGE[stage].length, 4);
  }
});

test("legacy project phases normalize into the controlled stage model", () => {
  assert.equal(
    deliveryPhase({ deliveryStage: "build", phase: "Desarrollo" }),
    "development",
  );
  assert.equal(deliveryPhase({ deliveryStage: "deploy", phase: "QA" }), "uat");
  assert.equal(
    deliveryPhase({ deliveryStage: "operations", phase: "Producción" }),
    "live",
  );
});

test("Spanish Excel phases map to delivery stages instead of collapsing to Build", () => {
  assert.equal(normalizeDeliveryStage({ phase: "Producción" }), "operations");
  assert.equal(normalizeDeliveryStage({ phase: "Desarrollo" }), "build");
  assert.equal(normalizeDeliveryStage({ phase: "Discovery" }), "onboarding");
  assert.equal(normalizeDeliveryStage({ phase: "QA" }), "deploy");
  assert.equal(normalizeDeliveryStage({ phase: "Diseño" }), "define");
  assert.equal(
    normalizeDeliveryStage({ deliveryStage: "operations", phase: "Desarrollo" }),
    "operations",
  );
});

test("a saved deliveryPhase wins over the Excel fase field", () => {
  assert.equal(
    deliveryPhase({
      deliveryStage: "operations",
      deliveryPhase: "live",
      phase: "Desarrollo",
    }),
    "live",
  );
});

test("an incompatible phase falls back to the first valid phase", () => {
  assert.equal(normalizeDeliveryPhase("development", "deploy"), "uat");
  assert.equal(phasesForStage("deploy").includes("uat"), true);
  assert.equal(
    normalizeDeliveryStage({ deliveryStage: "onboarding" }),
    "onboarding",
  );
});
