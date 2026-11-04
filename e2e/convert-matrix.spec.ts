import { test } from "@playwright/test";
import {
  gotoApp,
  selectTab,
  addImage,
  runAndCollect,
  reportAndAssert,
  avifEncodeSupported,
  EXT,
  MIME,
  type ComboResult,
} from "./helpers";

/**
 * The full Convert matrix: every supported still-image input decoded and
 * re-encoded to every supported output format. One test per input keeps the
 * source decoded once (cheap) while looping every output (the encode under
 * test). Output bytes are fetched back and their MIME checked, so a silent
 * `toBlob` fallback (e.g. AVIF → PNG) is caught, not passed.
 */
const INPUTS = ["png", "jpg", "webp", "avif", "gif", "bmp", "tiff", "heic", "pdf"];
const OUTPUTS = ["png", "jpeg", "webp", "avif", "bmp", "gif", "tiff", "pdf"];

for (const input of INPUTS) {
  test(`convert ${input} → every format`, async ({ page }) => {
    test.setTimeout(240_000);
    await gotoApp(page);
    await selectTab(page, "convert");
    await addImage(page, `sample.${input}`);
    const avifOk = await avifEncodeSupported(page);

    const rows: ComboResult[] = [];
    for (const out of OUTPUTS) {
      if (out === "avif" && !avifOk) {
        rows.push({ combo: `${input}→avif`, status: "skipped", err: "browser can't encode AVIF" });
        continue;
      }
      await page.selectOption("#cFmt", out);
      await page.locator("#run").click();
      rows.push(
        await runAndCollect(page, `${input}→${out}`, EXT[out], {
          expectType: MIME[out],
        }),
      );
    }
    reportAndAssert(`convert ${input}`, rows);
  });
}
