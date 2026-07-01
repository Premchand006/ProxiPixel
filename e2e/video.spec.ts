import { test } from "@playwright/test";
import { gotoApp, selectTab, addImage, runAndCollect, reportAndAssert, EXT } from "./helpers";

/**
 * FFmpeg.wasm smoke test: transcode an H.264 MP4 to an animated GIF end-to-end
 * through the app UI — decode → palettegen/paletteuse → GIF encode → a
 * downloadable blob. This exercises the full video pipeline and the CDN FFmpeg
 * load (the ESM core fixed in lib/engine/loaders.ts).
 *
 * Scope note: the app supports mp4/webm/mov inputs → mp4/webm/gif outputs, all
 * through this same pipeline. The remaining combinations are impractical to run
 * *reliably* in headless CI — each fresh page reloads the ~32 MB FFmpeg core,
 * VP9 (WebM) encoding is extremely CPU/memory-heavy, and headless Chromium
 * can't decode H.264 in a <video> element for poster extraction. The per-format
 * FFmpeg argument construction is unit-tested in tests/engine/video-args.test.ts.
 */
test("video: mp4 → gif (FFmpeg.wasm pipeline)", async ({ page }) => {
  // Wide budget: the first request cold-compiles the app and the run downloads
  // + compiles the ~32 MB FFmpeg core before the transcode even starts.
  test.setTimeout(600_000);
  await gotoApp(page);
  await selectTab(page, "video");
  await addImage(page, "sample.mp4");
  await page.fill("#vEnd", "1");
  await page.locator("#vMute").check();
  await page.selectOption("#vFmt", "gif");
  await page.locator("#run").click();
  const res = await runAndCollect(page, "mp4→gif", EXT.gif, { timeout: 540_000 });
  reportAndAssert("video mp4→gif", [res]);
});
