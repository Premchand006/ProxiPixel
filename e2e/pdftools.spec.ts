import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";

// Verifies the PDF Tools tab end-to-end in a real browser — the pdf-lib
// engine itself is unit-tested (tests/engine/pdftools.test.ts); this checks
// the UI actually wires operation selection, file upload, and params through
// to it, and that a real download comes back.

async function gotoPdfTools(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("tab", { name: "PDF Tools" }).click();
  await expect(page.getByRole("button", { name: "Merge PDF", exact: true })).toBeVisible();
}

async function selectOp(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function runOp(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: `Run: ${label}` }).click();
}

async function fixturePdfBytes(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 300]);
  return Buffer.from(await doc.save());
}

async function download(page: Page, link = page.locator("a.dl").first()): Promise<Buffer> {
  await expect(link).toBeVisible({ timeout: 30_000 });
  const [dl] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = await dl.path();
  return readFile(path);
}

test("merge combines pages from both PDFs in order", async ({ page }) => {
  await gotoPdfTools(page);
  await selectOp(page, "Merge PDF");
  const [a, b] = await Promise.all([fixturePdfBytes(2), fixturePdfBytes(3)]);
  await page.locator('input[type="file"]').setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: a },
    { name: "b.pdf", mimeType: "application/pdf", buffer: b },
  ]);
  await runOp(page, "Merge PDF");
  const bytes = await download(page);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(5);
});

test("rotate applies the selected angle to every page", async ({ page }) => {
  await gotoPdfTools(page);
  await selectOp(page, "Rotate PDF");
  await page.locator('input[type="file"]').setInputFiles({
    name: "r.pdf",
    mimeType: "application/pdf",
    buffer: await fixturePdfBytes(2),
  });
  await page.locator("#ptAngle").selectOption("180");
  await runOp(page, "Rotate PDF");
  const bytes = await download(page);
  const doc = await PDFDocument.load(bytes);
  for (const p of doc.getPages()) expect(p.getRotation().angle).toBe(180);
});

test("remove pages drops just the listed pages", async ({ page }) => {
  await gotoPdfTools(page);
  await selectOp(page, "Remove pages");
  await page.locator('input[type="file"]').setInputFiles({
    name: "rm.pdf",
    mimeType: "application/pdf",
    buffer: await fixturePdfBytes(5),
  });
  await page.locator("#ptPages").fill("2,4");
  await runOp(page, "Remove pages");
  const bytes = await download(page);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(3);
});

test("an invalid page range surfaces an inline error, not a crash", async ({ page }) => {
  await gotoPdfTools(page);
  await selectOp(page, "Extract pages");
  await page.locator('input[type="file"]').setInputFiles({
    name: "e.pdf",
    mimeType: "application/pdf",
    buffer: await fixturePdfBytes(3),
  });
  await page.locator("#ptPages").fill("99");
  await runOp(page, "Extract pages");
  await expect(page.locator(".status.err")).toContainText(/out of range/);
});
