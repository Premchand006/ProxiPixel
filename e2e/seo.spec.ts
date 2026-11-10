import { expect, test } from "@playwright/test";

// Landing pages, crawler files and indexing rules, checked against the real
// server: each tool URL opens its own tab, tab switches keep the URL in sync,
// format pages preselect their output, and private pages stay out of the index.

test("each tool landing page opens its own tab with its own heading", async ({
  page,
}) => {
  await page.goto("/image-upscaler");
  await expect(page.getByRole("tab", { name: "Upscale" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("h1")).toHaveText(
    "Upscale images to 4K in your browser",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/image-upscaler$/,
  );
  await expect(page.locator("h1")).toHaveCount(1);
});

test("switching tabs updates the URL, title and heading without losing the page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Video" }).click();
  await expect(page).toHaveURL(/\/video-converter$/);
  await expect(page).toHaveTitle(/Video Converter/);
  await expect(page.locator("h1")).toHaveText(
    "Convert, trim and crop video in your browser",
  );

  await page.getByRole("tab", { name: "Pixel" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("a format page preselects its output format", async ({ page }) => {
  await page.goto("/convert/heic-to-jpg");
  await expect(page.locator("#cFmt")).toHaveValue("jpeg");
  await expect(page.locator("h1")).toHaveText(
    "Convert HEIC to JPG in your browser",
  );
  await expect(
    page.getByRole("heading", {
      name: /What to know about converting HEIC to JPG/,
    }),
  ).toBeVisible();
});

test("footer links every tool and the unknown slugs 404", async ({ page }) => {
  await page.goto("/");
  const tools = page.getByRole("navigation", { name: "Tools" });
  await expect(tools.getByRole("link")).toHaveCount(7);
  const res = await page.goto("/not-a-real-tool");
  expect(res?.status()).toBe(404);
});

test("crawler files are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/image-upscaler</loc>");
  expect(xml).toContain("/convert/heic-to-jpg</loc>");
  expect(xml).not.toContain("/library");

  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(await llms.text()).toMatch(/^# ProxiPixel/);

  const manifest = await request.get("/manifest.webmanifest");
  expect((await manifest.json()).short_name).toBe("ProxiPixel");

  const og = await request.get("/opengraph-image");
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("private pages are noindex", async ({ page }) => {
  const res = await page.goto("/login");
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});
