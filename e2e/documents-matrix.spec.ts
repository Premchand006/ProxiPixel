import { test, expect, type Page } from "@playwright/test";
import { fx, runAndCollect, reportAndAssert, type ComboResult } from "./helpers";

/**
 * Every Documents cross-conversion the UI offers. Documents uses one global
 * "Convert to" target (like Pixel's), so for each readable source we read
 * every option from that dropdown and convert to each in turn (doc⇄doc,
 * sheet⇄sheet, and the cross-family bridges) — skipping the source's own
 * format, which the UI marks "Already X" and won't run.
 */
const SOURCES = ["txt", "md", "html", "rtf", "docx", "odt", "pdf", "pptx", "csv", "xlsx", "ods"];

async function gotoDocs(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#tab-documents").click();
  await expect(page.getByRole("heading", { name: /Drop documents/i })).toBeVisible();
}

for (const src of SOURCES) {
  test(`documents: ${src} → every offered target`, async ({ page }) => {
    test.setTimeout(180_000);
    await gotoDocs(page);
    await page.locator('input[type="file"]').setInputFiles(fx(`sample.${src}`));

    const row = page.locator(".docrow").last();
    const targets = await page
      .locator("#docFmt option")
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));

    const rows: ComboResult[] = [];
    for (const target of targets) {
      if (target === src) continue; // the UI marks this "Already X" and disables the run
      await page.selectOption("#docFmt", target);
      await page.getByRole("button", { name: "Convert all", exact: true }).click();
      rows.push(
        await runAndCollect(page, `${src}→${target}`, target, {
          scope: row,
          timeout: 60_000,
        }),
      );
    }
    reportAndAssert(`documents ${src}`, rows);
  });
}
