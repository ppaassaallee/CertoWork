import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("RUN-1 fonts are self hosted and Run layout is scoped", () => {
  const css = readFileSync("src/features/certo-run/certo-run.css", "utf8");
  for (const family of ["atkinson-hyperlegible", "familjen-grotesk", "jetbrains-mono"]) assert.ok(css.includes(`@fontsource/${family}`));
  assert.doesNotMatch(css, /fonts.googleapis.com/);
  assert.match(css, /do-shell:has\(> \.do-main.is-run-module\)/);
  assert.match(css, /prefers-reduced-motion/);
});
test("RUN-1 visual comparisons cannot update the supplied baseline", () => {
  const config = readFileSync("playwright.run.config.ts", "utf8");
  assert.match(config, /updateSnapshots: "none"/);
  assert.match(config, /maxDiffPixelRatio: 0.01/);
  const harness = readFileSync("tests/run-visual/harness.tsx", "utf8");
  assert.match(harness, /RunDeskView/);
  assert.doesNotMatch(harness, /addDoc|updateDoc|writeBatch|onSnapshot/);
});
