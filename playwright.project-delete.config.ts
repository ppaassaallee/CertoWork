import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/project-delete",
  testMatch: "*.spec.ts",
  outputDir: "./test-results/project-delete",
  workers: 1,
  use: {
    baseURL: "http://localhost:3124",
    timezoneId: "America/Guatemala",
    locale: "en-US",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "PORT=3124 npm run dev",
    url: "http://localhost:3124",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
