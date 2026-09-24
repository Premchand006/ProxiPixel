import { type Page, type Locator, expect } from "@playwright/test";
import { join } from "node:path";

/** Fixtures live next to the specs; Playwright runs from the project root. */
export const fx = (name: string): string =>
  join(process.cwd(), "e2e", "fixtures", name);

/** Output format -> file extension (mirrors EXT in lib/engine/encode.ts). */
export const EXT: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  avif: "avif",
  bmp: "bmp",
  gif: "gif",
  tiff: "tiff",
  pdf: "pdf",
};

/** Output format -> expected blob MIME, to catch silent toBlob() fallbacks. */
export const MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  tiff: "image/tiff",
  pdf: "application/pdf",
};

export async function gotoApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#tab-convert")).toBeVisible();
}

export async function selectTab(page: Page, mode: string): Promise<void> {
  await page.locator(`#tab-${mode}`).click();
}

/** Load a file into the main image/video dropzone and wait until decoded. */
export async function addImage(
  page: Page,
  fixture: string,
  readyTimeout = 90_000,
): Promise<void> {
  await page.locator("#fileInput").setInputFiles(fx(fixture));
  // The Run button enables once an item has a decoded canvas (or video file).
  await expect(page.locator("#run")).toBeEnabled({ timeout: readyTimeout });
}

export interface BlobInfo {
  name: string | null;
  size: number;
  type: string;
}

/** Fetch a result object-URL inside the page and report its real bytes/type. */
export async function fetchResult(page: Page, link: Locator): Promise<BlobInfo> {
  const href = await link.getAttribute("href");
  const name = await link.getAttribute("download");
  if (!href) throw new Error("result link has no href");
  const info = await page.evaluate(async (u: string) => {
    const r = await fetch(u);
    const b = await r.blob();
    return { size: b.size, type: b.type };
  }, href);
  return { name, ...info };
}

export interface ComboResult {
  combo: string;
  status: "ok" | "empty" | "error" | "timeout" | "type-mismatch" | "skipped";
  size?: number;
  type?: string;
  name?: string | null;
  err?: string;
}

/**
 * Whether this browser can actually *encode* AVIF via canvas. Playwright's
 * bundled Chromium omits the AVIF encoder (it still decodes AVIF), so `→avif`
 * outputs fall back to PNG here and are skipped rather than failed. Real
 * Chrome/Edge encode AVIF fine — the app gates on this via avifSupported().
 */
export async function avifEncodeSupported(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    c.getContext("2d")?.fillRect(0, 0, 4, 4);
    const blob = await new Promise<Blob | null>((r) =>
      c.toBlob((b) => r(b), "image/avif", 0.5),
    );
    return !!blob && blob.type === "image/avif";
  });
}

export interface CollectOptions {
  /** Scope locators to a sub-tree (e.g. one document row). */
  scope?: Locator | Page;
  timeout?: number;
  /** Expected blob MIME; a mismatch (silent toBlob fallback) fails the combo. */
  expectType?: string;
}

/**
 * Click Run, then resolve once the result download link for `ext` appears or an
 * error status shows. Returns a structured result so callers can build a matrix
 * instead of aborting at the first failure.
 */
export async function runAndCollect(
  page: Page,
  combo: string,
  ext: string,
  opts: CollectOptions = {},
): Promise<ComboResult> {
  const { scope = page, timeout = 90_000, expectType } = opts;
  const root = "locator" in scope ? scope : page;
  const ok = root.locator(`a.dl[download$=".${ext}"]`).first();
  const err = root.locator(".status.err").first();
  try {
    await expect(ok.or(err)).toBeVisible({ timeout });
  } catch {
    return { combo, status: "timeout" };
  }
  if (await ok.isVisible()) {
    const info = await fetchResult(page, ok);
    let status: ComboResult["status"] = info.size > 0 ? "ok" : "empty";
    if (status === "ok" && expectType && info.type && info.type !== expectType) {
      status = "type-mismatch";
    }
    return { combo, status, size: info.size, type: info.type, name: info.name };
  }
  return { combo, status: "error", err: (await err.textContent())?.trim() };
}

/** Pretty-print a matrix block and assert every combo produced real bytes. */
export function reportAndAssert(title: string, rows: ComboResult[]): void {
  const line = (r: ComboResult): string =>
    `  ${r.combo}: ${r.status}` +
    (r.size ? ` (${r.size}B ${r.type})` : "") +
    (r.err ? ` [${r.err}]` : "");
  console.log(`\n=== ${title} ===\n${rows.map(line).join("\n")}`);
  const failures = rows.filter((r) => r.status !== "ok" && r.status !== "skipped");
  expect(
    failures,
    `${title}: ${failures.length} failing combo(s): ${JSON.stringify(failures, null, 2)}`,
  ).toEqual([]);
}
