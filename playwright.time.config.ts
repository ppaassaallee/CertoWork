import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/time",
  testMatch: "*.spec.ts",
  outputDir: "./test-results/time",
  workers: 1,
  use: {
    baseURL: "http://localhost:3120",
    timezoneId: "America/Guatemala",
    locale: "en-US",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "PORT=3120 npm run dev",
    url: "http://localhost:3120",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
