import { defineConfig } from "@playwright/test";
import path from "node:path";

const goldenDir = process.env.CERTO_RUN_GOLDEN_DIR;
if (!goldenDir) throw new Error("Set CERTO_RUN_GOLDEN_DIR to the extracted supplied v2 archive. Never generate replacement baselines from the implementation.");
export default defineConfig({
  testDir: "./tests/run-visual",
  outputDir: "./test-results/run-visual",
  snapshotPathTemplate: path.resolve(goldenDir, "{arg}{ext}"),
  updateSnapshots: "none",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  use: { baseURL: "http://localhost:3000", timezoneId: "America/Guatemala", locale: "en-US", screenshot: "only-on-failure" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: false, timeout: 120_000 },
  workers: 1,
});
