import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/.*(googleapis|firebaseio)\.com/, (route) => route.abort());
  await page.goto("/tests/time/harness.html?report-fixture=1");
});
test("PDF selects sheets and dates, previews full detail and invokes native print", async ({ page, context }) => {
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeEnabled();
  await page.getByRole("button", { name: "Export PDF" }).click();
  const dialog = page.getByRole("dialog", { name: "Export timesheet to PDF" });
  await dialog.getByRole("button", { name: "Clear selection" }).click();
  await expect(dialog.getByRole("button", { name: "Preview report" })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Legal review", exact: true }).check();
  await dialog.getByRole("button", { name: "Preview report" }).click();
  const preview = page.frameLocator("iframe[title='Printable timesheet']");
  await expect(preview.getByRole("heading", { name: "Timesheet", exact: true })).toBeVisible();
  await expect(preview.locator(".owner")).toHaveText("Ana Martínez");
  await expect(preview.locator(".summary")).toContainText("25:00");
  await expect(preview.locator(".summary")).toContainText("50");
  await expect(preview.locator(".scope")).toContainText("Legal review");
  const srcdoc = await dialog.locator("iframe").getAttribute("srcdoc");
  const printPage = await context.newPage();
  await printPage.setContent(srcdoc!);
  await printPage.pdf({
    path: "output/pdf/certo-timesheet-sample.pdf",
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await printPage.close();
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("iframe[title='Printable timesheet']");
    frame!.contentWindow!.print = () => {
      frame!.dataset.printInvoked = "yes";
    };
  });
  await dialog.getByRole("button", { name: "Save PDF", exact: true }).click();
  await expect(dialog.locator("iframe")).toHaveAttribute("data-print-invoked", "yes");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeFocused();
});
test("PDF is bilingual, validates range and responds on phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Español" }).click();
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const dialog = page.getByRole("dialog", { name: "Exportar hoja de horas a PDF" });
  await dialog.getByRole("textbox", { name: "Desde", exact: true }).fill("2024-01-01");
  await expect(dialog.getByRole("button", { name: "Ver reporte" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Desde", exact: true }).fill("2026-11-01");
  await dialog.getByRole("textbox", { name: "Hasta", exact: true }).fill("2026-11-30");
  await dialog.getByRole("button", { name: "Ver reporte" }).click();
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "Hoja de horas", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Guardar PDF", exact: true })).toBeEnabled();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/time/pdf-mobile.png", fullPage: true });
});
