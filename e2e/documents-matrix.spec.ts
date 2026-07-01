import { test, expect, type Page } from "@playwright/test";
import { fx, runAndCollect, reportAndAssert, type ComboResult } from "./helpers";

/**
 * Every Documents cross-conversion the UI offers. For each readable source we
 * read the target dropdown and convert to all of them (doc⇄doc, sheet⇄sheet and
 * the cross-family bridges). One source file is loaded per test and re-converted
 * by changing the target (which clears the prior result).
 */
const SOURCES = ["txt", "md", "html", "rtf", "docx", "odt", "pptx", "csv", "xlsx", "ods"];

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
    await expect(row.locator("select")).toBeVisible();
    const targets = await row
      .locator("select option")
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));

    const rows: ComboResult[] = [];
    for (const target of targets) {
      await row.locator("select").selectOption(target);
      await row.getByRole("button", { name: "Convert", exact: true }).click();
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
