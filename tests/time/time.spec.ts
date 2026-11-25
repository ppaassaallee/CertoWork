import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/.*(googleapis|firebaseio)\.com/, (route) => route.abort());
  await page.goto("/tests/time/harness.html");
});
test("paste from Excel previews, validates and saves linked rows; charts reconcile", async ({ page }) => {
  await page.getByRole("button", { name: "Paste from Excel" }).click();
  const dialog = page.getByRole("dialog");
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await dialog
    .getByLabel("Paste rows", { exact: true })
    .fill(`${today}\tArchitecture\t1:30\n${today}\tCode review\t0:30`);
  await expect(dialog.getByRole("table")).toContainText("Review before saving");
  await dialog.getByRole("combobox", { name: "Project", exact: true }).selectOption("p");
  await dialog.getByRole("button", { name: "Save entries" }).click();
  await expect(page.locator(".cw-time-summary")).toContainText("2:00");
  await expect(page.locator(".cw-time-legend")).toContainText("Certo engineering");
  await expect(page.locator(".cw-time-legend")).toContainText("2:00");
  await page.screenshot({
    path: "test-results/time/final-week.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Paste from Excel" }).click();
  await dialog.getByLabel("Paste rows", { exact: true }).fill(`${today}\tInvalid\t1:99`);
  await expect(dialog.getByRole("button", { name: "Save entries" })).toBeDisabled();
  await dialog
    .getByLabel("Or upload a tab-separated file")
    .setInputFiles({
      name: "week.tsv",
      mimeType: "text/tab-separated-values",
      buffer: Buffer.from(`${today}\tUploaded hours\t0:45`),
    });
  await expect(dialog.getByLabel("Paste rows", { exact: true })).toHaveValue(`${today}\tUploaded hours\t0:45`);
  await expect(dialog.getByRole("button", { name: "Save entries" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("rowheader", { name: /Invalid/ })).toHaveCount(0);
});
test("manual project/item entry, edit, billable total, sheet and bilingual UI", async ({ page }) => {
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description", { exact: true }).fill("Architecture review");
  await dialog.getByRole("combobox", { name: "Project", exact: true }).selectOption("p");
  await dialog.getByRole("combobox", { name: "Linked item (any type)" }).selectOption("i");
  await dialog.getByLabel("Duration (H:MM or hours)").fill("1.5");
  await dialog.getByLabel("Billable time").check();
  await dialog.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.getByRole("rowheader", { name: /Architecture review/ })).toBeVisible();
  await expect(page.locator(".cw-time-summary")).toContainText("1:30");
  await page.getByRole("button", { name: /^Edit time:/ }).click();
  await dialog.getByLabel("Duration (H:MM or hours)").fill("2:15");
  await dialog.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.locator(".cw-time-summary")).toContainText("2:15");
  await page.screenshot({
    path: "test-results/time/weekly-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "New sheet", exact: true }).click();
  await dialog.getByLabel("Sheet name").fill("Legal review");
  await dialog.getByRole("button", { name: "Create sheet" }).click();
  await expect(page.getByRole("combobox", { name: "Sheet", exact: true })).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Español" }).click();
  await expect(page.getByRole("heading", { name: "Mi tiempo" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar tiempo", exact: true }).click();
  await expect(dialog.getByLabel("Descripción", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
test("timer links to item and stops into a single entry", async ({ page }) => {
  await page.getByRole("combobox", { name: "Timer project", exact: true }).selectOption("p");
  await page.getByLabel("Timer item").selectOption("i");
  await page.getByRole("textbox", { name: "What are you working on?" }).fill("Focused engineering");
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("rowheader", { name: /Focused engineering/ })).toHaveCount(1);
  await expect(page.getByRole("rowheader", { name: /Focused engineering/ })).toContainText("Build time tracking");
});
test("phone: form scrolls, no body overflow, validation and delete confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description", { exact: true }).fill("Legal narrative");
  await dialog.getByLabel("Duration (H:MM or hours)").fill("1:90");
  await dialog.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Use H:MM");
  await page.screenshot({
    path: "test-results/time/mobile-form.png",
    fullPage: true,
  });
  await dialog.getByLabel("Duration (H:MM or hours)").fill("0:06");
  await dialog.getByRole("button", { name: "Save time", exact: true }).click();
  await page.getByRole("button", { name: /^Edit time:/ }).click();
  await dialog.getByRole("button", { name: "Delete entry" }).click();
  await expect(dialog.getByRole("alert")).toContainText("permanently");
  await dialog.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page.getByRole("rowheader", { name: /Legal narrative/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
