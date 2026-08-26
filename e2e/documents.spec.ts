import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Verifies the Documents tab end-to-end in a real browser — exercising the
// binary readers (docx via mammoth, odt via the custom parser) that jsdom/vitest
// can't run because of File/Blob realm quirks.

async function gotoDocs(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.getByRole("heading", { name: /Drop documents/i })).toBeVisible();
}

interface Upload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** Upload one file, pick the global target, convert, and return the downloaded bytes. */
async function convertOnce(page: Page, file: Upload, target: string): Promise<Buffer> {
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.selectOption("#docFmt", target);
  await page.getByRole("button", { name: "Convert all", exact: true }).click();
  const row = page.locator(".docrow").last();
  const link = row.getByRole("link", { name: "Download" });
  await expect(link).toBeVisible({ timeout: 30_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = await download.path();
  return readFile(path);
}

const isZip = (b: Buffer): boolean => b[0] === 0x50 && b[1] === 0x4b;

test("md → docx → txt round-trips (docx write + mammoth read)", async ({ page }) => {
  await gotoDocs(page);
  const docx = await convertOnce(
    page,
    { name: "a.md", mimeType: "text/markdown", buffer: Buffer.from("# Hello Heading\n\nA body paragraph here.") },
    "docx",
  );
  expect(isZip(docx)).toBe(true);

  await page.getByRole("button", { name: "Clear" }).click();
  const txt = await convertOnce(
    page,
    {
      name: "a.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: docx,
    },
    "txt",
  );
  const text = txt.toString("utf8");
  expect(text).toContain("Hello Heading");
  expect(text).toContain("A body paragraph here");
});

test("md → odt → txt round-trips (odt write + custom reader)", async ({ page }) => {
  await gotoDocs(page);
  const odt = await convertOnce(
    page,
    { name: "b.md", mimeType: "text/markdown", buffer: Buffer.from("# Title One\n\nOpenDocument body text.") },
    "odt",
  );
  expect(isZip(odt)).toBe(true);

  await page.getByRole("button", { name: "Clear" }).click();
  const txt = await convertOnce(
    page,
    { name: "b.odt", mimeType: "application/vnd.oasis.opendocument.text", buffer: odt },
    "txt",
  );
  const text = txt.toString("utf8");
  expect(text).toContain("Title One");
  expect(text).toContain("OpenDocument body text");
});

test("csv ↔ xlsx round-trips the data (SheetJS)", async ({ page }) => {
  await gotoDocs(page);
  const xlsx = await convertOnce(
    page,
    { name: "c.csv", mimeType: "text/csv", buffer: Buffer.from("name,age\nAda,36\nGrace,45") },
    "xlsx",
  );
  expect(isZip(xlsx)).toBe(true);

  await page.getByRole("button", { name: "Clear" }).click();
  const csv = await convertOnce(
    page,
    {
      name: "c.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: xlsx,
    },
    "csv",
  );
  const text = csv.toString("utf8").replace(/\r/g, "").trim();
  expect(text).toBe("name,age\nAda,36\nGrace,45");
});
