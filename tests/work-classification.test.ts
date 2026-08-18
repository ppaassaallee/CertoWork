import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_PHASES,
  WORK_CATEGORIES,
  isProductDevelopment,
  productPhase,
  workCategory,
} from "../src/lib/workClassification";

test("work classification keeps product development separate from delivery stage", () => {
  const project = {
    deliveryStage: "build",
    phase: "development",
    workCategory: "Product Development",
    productPhase: "Beta",
  };

  assert.equal(workCategory(project), "Product Development");
  assert.equal(productPhase(project), "Beta");
  assert.equal(isProductDevelopment(project), true);
});

test("work classification infers product development from product-like legacy project types", () => {
  assert.equal(
    workCategory({ projectType: "SaaS Platform" }),
    "Product Development",
  );
  assert.equal(
    workCategory({ category: "Internal product app" }),
    "Product Development",
  );
});

test("work classification lets items inherit classification from their project", () => {
  const project = { workCategory: "Product Development", productPhase: "Shape" };
  const item = { title: "Define onboarding flow", projectId: "p1" };

  assert.equal(workCategory(item, project), "Product Development");
  assert.equal(productPhase(item, project), "Shape");
});

test("work classification has stable explicit option sets for UI dropdowns", () => {
  assert.ok(WORK_CATEGORIES.includes("Client Delivery"));
  assert.ok(WORK_CATEGORIES.includes("Product Development"));
  assert.deepEqual(PRODUCT_PHASES, [
    "Explore",
    "Shape",
    "Build",
    "Beta",
    "Launch",
    "Grow",
  ]);
});
