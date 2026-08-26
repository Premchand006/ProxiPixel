import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

// jsdom ships File/Blob without arrayBuffer()/text() (real browsers have
// both) — swap in Node's, same fix tests/docs/convert.test.ts uses.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;
import {
  addPageNumbers,
  cropPages,
  extractPages,
  mergePdfs,
  organizePages,
  parsePageOrder,
  parsePageRanges,
  removePages,
  rotatePages,
  splitPdf,
} from "@/lib/engine/pdftools";

/** Build a throwaway N-page PDF as a File, for tests that need real PDF bytes. */
async function fixturePdf(pages: number, name = "test.pdf"): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 300]);
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], name, { type: "application/pdf" });
}

async function pageCountOf(blob: Blob): Promise<number> {
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  return doc.getPageCount();
}

describe("parsePageRanges", () => {
  it("parses singles, ranges, and de-dupes by first occurrence", () => {
    expect(parsePageRanges("1,3,5-7,3", 10)).toEqual([0, 2, 4, 5, 6]);
  });

  it("rejects out-of-range pages", () => {
    expect(() => parsePageRanges("1,11", 10)).toThrow(/out of range/);
    expect(() => parsePageRanges("0", 10)).toThrow(/out of range/);
  });

  it("rejects a backwards range", () => {
    expect(() => parsePageRanges("7-5", 10)).toThrow(/backwards/);
  });

  it("rejects malformed tokens", () => {
    expect(() => parsePageRanges("abc", 10)).toThrow(/isn't a page number/);
  });

  it("rejects an empty spec", () => {
    expect(() => parsePageRanges("", 10)).toThrow(/at least one/);
    expect(() => parsePageRanges("   ", 10)).toThrow(/at least one/);
  });
});

describe("parsePageOrder", () => {
  it("accepts a full permutation", () => {
    expect(parsePageOrder("3,1,2", 3)).toEqual([2, 0, 1]);
  });

  it("rejects a partial list", () => {
    expect(() => parsePageOrder("1,2", 3)).toThrow(/all 3 pages/);
  });
});

describe("mergePdfs", () => {
  it("concatenates pages from every input in order", async () => {
    const [a, b, c] = await Promise.all([fixturePdf(2), fixturePdf(3), fixturePdf(1)]);
    const merged = await mergePdfs([a, b, c]);
    expect(await pageCountOf(merged)).toBe(6);
  });

  it("requires at least two files", async () => {
    await expect(mergePdfs([await fixturePdf(2)])).rejects.toThrow(/at least two/);
  });
});

describe("extractPages", () => {
  it("keeps only the requested pages", async () => {
    const out = await extractPages(await fixturePdf(5), "1,3,5");
    expect(await pageCountOf(out)).toBe(3);
  });
});

describe("removePages", () => {
  it("drops the requested pages and keeps the rest", async () => {
    const out = await removePages(await fixturePdf(5), "2,4");
    expect(await pageCountOf(out)).toBe(3);
  });

  it("refuses to remove every page", async () => {
    await expect(removePages(await fixturePdf(3), "1-3")).rejects.toThrow(/every page/);
  });
});

describe("organizePages", () => {
  it("reorders every page", async () => {
    const out = await organizePages(await fixturePdf(3), "3,1,2");
    expect(await pageCountOf(out)).toBe(3);
  });
});

describe("splitPdf", () => {
  it("splits into groups per the spec", async () => {
    const parts = await splitPdf(await fixturePdf(7), "1-3;4-6;7");
    expect(parts).toHaveLength(3);
    expect(await pageCountOf(parts[0]!.blob)).toBe(3);
    expect(await pageCountOf(parts[1]!.blob)).toBe(3);
    expect(await pageCountOf(parts[2]!.blob)).toBe(1);
  });

  it("splits one PDF per page when no spec is given", async () => {
    const parts = await splitPdf(await fixturePdf(4), "");
    expect(parts).toHaveLength(4);
    for (const p of parts) expect(await pageCountOf(p.blob)).toBe(1);
  });
});

describe("rotatePages", () => {
  it("rotates every page by the given angle", async () => {
    const out = await rotatePages(await fixturePdf(2), 90);
    const doc = await PDFDocument.load(new Uint8Array(await out.arrayBuffer()));
    for (const page of doc.getPages()) expect(page.getRotation().angle).toBe(90);
  });

  it("accumulates on top of existing rotation", async () => {
    const once = await rotatePages(await fixturePdf(1), 90);
    const twice = await rotatePages(new File([once], "r.pdf"), 180);
    const doc = await PDFDocument.load(new Uint8Array(await twice.arrayBuffer()));
    expect(doc.getPage(0).getRotation().angle).toBe(270);
  });

  it("only rotates the pages listed in spec", async () => {
    const out = await rotatePages(await fixturePdf(3), 90, "2");
    const doc = await PDFDocument.load(new Uint8Array(await out.arrayBuffer()));
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getPage(2).getRotation().angle).toBe(0);
  });
});

describe("cropPages", () => {
  it("insets the crop box by the margin on every side", async () => {
    const out = await cropPages(await fixturePdf(1), 20);
    const doc = await PDFDocument.load(new Uint8Array(await out.arrayBuffer()));
    const box = doc.getPage(0).getCropBox();
    expect(box).toEqual({ x: 20, y: 20, width: 160, height: 260 });
  });

  it("rejects a margin that would collapse the page", async () => {
    await expect(cropPages(await fixturePdf(1), 200)).rejects.toThrow(/too large/);
  });
});

describe("addPageNumbers", () => {
  it("stamps every page without changing the page count", async () => {
    const out = await addPageNumbers(await fixturePdf(3), {
      position: "bottom-center",
      startAt: 1,
      format: "{n} / {total}",
    });
    expect(await pageCountOf(out)).toBe(3);
  });
});
