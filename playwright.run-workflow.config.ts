import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/run-visual",testMatch:"workflow.spec.ts",outputDir:"./test-results/run-workflow",
  use:{baseURL:"http://localhost:3117",timezoneId:"America/Guatemala",locale:"en-US",screenshot:"only-on-failure"},
  webServer:{command:"PORT=3117 npm run dev",url:"http://localhost:3117",reuseExistingServer:false,timeout:120000},workers:1,
});
