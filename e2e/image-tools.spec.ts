import { test, expect } from "@playwright/test";
import {
  gotoApp,
  selectTab,
  addImage,
  runAndCollect,
  reportAndAssert,
  EXT,
  MIME,
  type ComboResult,
} from "./helpers";

/**
 * The Upscale, Optimize and Watermark tools across their key option branches.
 * Each combo uses a distinct output format so its result link is unambiguous
 * within the single reused queue card.
 */

test("upscale: scales, methods and output formats", async ({ page }) => {
  test.setTimeout(240_000);
  await gotoApp(page);
  await selectTab(page, "upscale");
  await addImage(page, "sample.png");

  const combos: Array<{ scale: string; method?: string; width?: number; fmt: string }> = [
    { scale: "2", fmt: "png" },
    { scale: "4k", fmt: "jpeg" },
    { scale: "custom", width: 240, fmt: "webp" },
    { scale: "2", method: "smooth", fmt: "tiff" },
  ];
  const rows: ComboResult[] = [];
  for (const c of combos) {
    await page.locator(`#upScale button[data-v="${c.scale}"]`).click();
    if (c.width) await page.fill("#upW", String(c.width));
    if (c.method) await page.selectOption("#upMethod", c.method);
    await page.selectOption("#upFmt", c.fmt);
    await page.locator("#run").click();
    const label = `${c.scale}${c.method ? "/" + c.method : ""}→${c.fmt}`;
    rows.push(await runAndCollect(page, label, EXT[c.fmt], { expectType: MIME[c.fmt] }));
  }
  // The upscale result card reports a dimension change.
  await expect(page.locator(".card .delta.up")).toBeVisible();
  reportAndAssert("upscale", rows);
});

test("optimize: quality, target-size and width-cap branches", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoApp(page);
  await selectTab(page, "optimize");
  await addImage(page, "sample.png");

  const setMode = (m: "quality" | "size") =>
    page.locator(`#opMode button[data-v="${m}"]`).click();
  const rows: ComboResult[] = [];

  // Quality mode → lossy webp.
  await setMode("quality");
  await page.fill("#opQ", "75").catch(() => {}); // range input: fill may noop
  await page.selectOption("#opFmt", "webp");
  await page.locator("#run").click();
  rows.push(await runAndCollect(page, "quality→webp", EXT.webp, { expectType: MIME.webp }));

  // Size mode (binary search) → jpeg under the cap.
  await setMode("size");
  await page.fill("#opSize", "20");
  await page.selectOption("#opFmt", "jpeg");
  await page.locator("#run").click();
  rows.push(await runAndCollect(page, "size→jpeg", EXT.jpeg, { expectType: MIME.jpeg }));

  // Size mode but a lossless format (encodes once, ignores the cap).
  await page.selectOption("#opFmt", "png");
  await page.locator("#run").click();
  rows.push(await runAndCollect(page, "size→png", EXT.png, { expectType: MIME.png }));

  // Width cap → tiff (lossless; AVIF encode isn't available in this browser).
  await setMode("quality");
  await page.fill("#opMaxW", "48");
  await page.selectOption("#opFmt", "tiff");
  await page.locator("#run").click();
  rows.push(await runAndCollect(page, "maxW→tiff", EXT.tiff, { expectType: MIME.tiff }));

  reportAndAssert("optimize", rows);
});

test("watermark: reconstructs a bottom-right Gemini-style stamp", async ({ page }) => {
  test.setTimeout(120_000);
  await gotoApp(page);
  await selectTab(page, "watermark");
  await addImage(page, "sample_wm.png");

  await page.selectOption("#wmFmt", "png");
  await page.locator("#run").click();
  const res = await runAndCollect(page, "watermark→png", EXT.png, { expectType: MIME.png });
  await expect(page.locator(".card .delta.good")).toContainText(/watermark removed/i);
  reportAndAssert("watermark", [res]);
});
