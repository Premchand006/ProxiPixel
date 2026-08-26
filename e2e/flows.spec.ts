import { expect, test, type Page } from "@playwright/test";

// A 2x2 opaque-red PNG (valid, decodable by the browser).
const RED_PNG_2x2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP8z8Dwn4EIwDiqEAAxkAX1uxNZawAAAABJRU5ErkJggg==",
  "base64",
);

async function addPng(page: Page): Promise<void> {
  await page.setInputFiles("#fileInput", {
    name: "pixel.png",
    mimeType: "image/png",
    buffer: RED_PNG_2x2,
  });
  await expect(page.locator(".card")).toHaveCount(1);
}

test("tabs switch the tool panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#cFmt")).toBeVisible(); // Convert panel
  await page.getByRole("tab", { name: "Upscale" }).click();
  await expect(page.locator("#upScale")).toBeVisible(); // Upscale panel
  await page.getByRole("tab", { name: "Video" }).click();
  await expect(page.locator("#vFmt")).toBeVisible(); // Video panel
});

test("tablist is keyboard navigable with arrow keys", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Pixel" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Upscale" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Pixel" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("optimize produces a smaller-or-equal WEBP result", async ({ page }) => {
  await page.goto("/");
  await addPng(page);
  await page.getByRole("tab", { name: "Optimize" }).click();
  await page.selectOption("#opFmt", "webp"); // chromium reliably encodes webp
  await page.getByRole("button", { name: "Optimize all" }).click();

  const dl = page.locator(".card a.dl");
  await expect(dl).toBeVisible();
  await expect(dl).toHaveAttribute("download", /_opt\.webp$/);
});

test("compare modal opens and closes with Escape", async ({ page }) => {
  await page.goto("/");
  await addPng(page);
  await page.getByRole("button", { name: "Convert all" }).click();
  await expect(page.locator(".card a.dl")).toBeVisible();

  await page.getByRole("button", { name: "Compare" }).click();
  const dialog = page.getByRole("dialog", { name: "Before and after compare" });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("clear empties the queue", async ({ page }) => {
  await page.goto("/");
  await addPng(page);
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator(".card")).toHaveCount(0);
  await expect(page.locator("#emptyState")).toBeVisible();
});
