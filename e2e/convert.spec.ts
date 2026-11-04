import { expect, test } from "@playwright/test";

// A 2x2 opaque-red PNG (valid, decodable by the browser).
const RED_PNG_2x2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP8z8Dwn4EIwDiqEAAxkAX1uxNZawAAAABJRU5ErkJggg==",
  "base64",
);

test("home page renders the wordmark and tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".wordmark")).toContainText("PIXEL");
  await expect(page.getByRole("tab", { name: "Pixel" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("converts a PNG to JPEG and shows a downloadable result", async ({
  page,
}) => {
  await page.goto("/");

  await page.setInputFiles("#fileInput", {
    name: "pixel.png",
    mimeType: "image/png",
    buffer: RED_PNG_2x2,
  });

  // The queue shows exactly one decoded card.
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card .thumb img")).toBeVisible();

  // Choose JPEG and run the conversion.
  await page.selectOption("#cFmt", "jpeg");
  await page.getByRole("button", { name: "Convert all" }).click();

  // A working download link appears, named *.jpg.
  const dl = page.locator(".card a.dl");
  await expect(dl).toBeVisible();
  await expect(dl).toHaveAttribute("download", /\.jpg$/);
  // The result row reports the output format.
  await expect(
    page.locator(".card .stats").filter({ hasText: "JPG" }),
  ).toBeVisible();
});
