import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"./tests/run-visual",testMatch:"ux.spec.ts",outputDir:"./test-results/run-ux",
  use:{baseURL:"http://localhost:3118",timezoneId:"America/Guatemala",locale:"en-US",screenshot:"only-on-failure"},
  webServer:{command:"PORT=3118 npm run dev",url:"http://localhost:3118",reuseExistingServer:false,timeout:120000},workers:1});
