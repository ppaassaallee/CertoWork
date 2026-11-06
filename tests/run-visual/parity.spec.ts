import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const directory = process.env.CERTO_RUN_GOLDEN_DIR!;
const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
for (const world of ["pure_ai", "boldr_ai"] as const) {
  test(`supplied v2 empty Today ${world}`, async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.clock.setFixedTime(new Date(manifest.clock));
    await page.addInitScript((world) => localStorage.setItem("certo-run-world", world), world === "pure_ai" ? "Pure AI" : "Boldr AI");
    await page.route("**/__run_visual_fixture", (route) => route.fulfill({ json: [] }));
    // Any unexpected Firestore/identity operation fails the test instead of
    // silently touching a live Firebase project from a local preview.
    const externalCalls: string[] = [];
    await page.route(/https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/, (route) => { externalCalls.push(route.request().url()); return route.abort(); });
    await page.goto("/tests/run-visual/harness.html?tab=today");
    await expect(page.getByTestId("certo-run-desk")).toBeVisible();
    for (const font of ['600 14px "Familjen Grotesk"', '400 14px "Atkinson Hyperlegible"', '400 14px "JetBrains Mono"']) {
      const loaded = await page.evaluate(async (font) => { const faces = await document.fonts.load(font); return { count: faces.length, ready: document.fonts.check(font) }; }, font);
      expect(loaded.count, `Self-hosted font ${font}`).toBeGreaterThan(0);
      expect(loaded.ready).toBe(true);
    }
    expect(externalCalls).toEqual([]);
    await expect(page).toHaveScreenshot(["desktop-empty", `${world}-Today.png`], { fullPage: true });
  });
}

test("phone has no page overflow and validation dialog restores focus", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, timezoneId:"America/Guatemala" });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(manifest.clock));
  await page.route("**/__run_visual_fixture", (route) => route.fulfill({ json: [] }));
  await page.goto("http://localhost:3000/tests/run-visual/harness.html?tab=today");
  await expect(page.getByTestId("certo-run-desk")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name:"Data & validation", exact:true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name:"Data & validation", exact:true })).toBeFocused();
  await context.close();
});
