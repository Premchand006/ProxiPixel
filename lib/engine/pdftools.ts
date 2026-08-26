import { PDFDocument, degrees, StandardFonts, rgb } from "pdf-lib";

/**
 * PDF page-manipulation tools (merge, split, remove/extract/organize pages,
 * rotate, crop, page numbers). Built on pdf-lib, entirely client-side — same
 * "never leaves your device" guarantee as the rest of the engine. Image ->
 * PDF wrapping (a single image as a one-page PDF) lives in lib/engine/pdf.ts,
 * used by the image tool panels' format dropdowns — this module is PDF-page
 * operations only.
 */

export interface NamedBlob {
  name: string;
  blob: Blob;
}

async function loadPdf(file: File): Promise<PDFDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await PDFDocument.load(bytes);
  } catch {
    throw new Error(`Couldn't read "${file.name}" as a PDF`);
  }
}

async function savePdfBlob(doc: PDFDocument): Promise<Blob> {
  return new Blob([new Uint8Array(await doc.save())], { type: "application/pdf" });
}

/** Page count of a PDF file, for UI hints (e.g. "this PDF has 12 pages"). */
export async function getPageCount(file: File): Promise<number> {
  return (await loadPdf(file)).getPageCount();
}

const baseName = (name: string): string => name.replace(/\.pdf$/i, "");

/**
 * Parse a human page-range spec ("1,3,5-7") into 0-indexed page numbers, in
 * the order given, de-duplicated by first occurrence. 1-indexed in the UI to
 * match how people talk about page numbers; validated against `pageCount` so
 * a bad range fails with a message a non-programmer can act on.
 */
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const trimmed = spec.trim();
  if (!trimmed) throw new Error("Enter at least one page number");

  const seen = new Set<number>();
  const out: number[] = [];
  const addOne = (n: number, raw: string): void => {
    if (!Number.isInteger(n) || n < 1 || n > pageCount) {
      throw new Error(
        `Page ${raw} is out of range — this PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}`,
      );
    }
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n - 1);
    }
  };

  for (const part of trimmed.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end) throw new Error(`Range "${token}" goes backwards`);
      for (let n = start; n <= end; n++) addOne(n, String(n));
      continue;
    }
    if (!/^\d+$/.test(token)) throw new Error(`"${token}" isn't a page number or range`);
    addOne(Number(token), token);
  }

  if (!out.length) throw new Error("Enter at least one page number");
  return out;
}

/**
 * Parse a full reordering spec — every page must appear exactly once (unlike
 * {@link parsePageRanges}, a missing or repeated page is an error here, since
 * "organize" has to account for the whole document).
 */
export function parsePageOrder(spec: string, pageCount: number): number[] {
  const order = parsePageRanges(spec, pageCount);
  if (order.length !== pageCount) {
    throw new Error(
      `List all ${pageCount} page${pageCount === 1 ? "" : "s"} exactly once (got ${order.length})`,
    );
  }
  return order;
}

/** Combine multiple PDFs into one, in the given order. */
export async function mergePdfs(files: File[]): Promise<Blob> {
  if (files.length < 2) throw new Error("Add at least two PDFs to merge");
  const merged = await PDFDocument.create();
  for (const file of files) {
    const src = await loadPdf(file);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return savePdfBlob(merged);
}

/** Keep only the given pages, in the given order. */
export async function extractPages(file: File, spec: string): Promise<Blob> {
  const src = await loadPdf(file);
  const indices = parsePageRanges(spec, src.getPageCount());
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  for (const page of pages) out.addPage(page);
  return savePdfBlob(out);
}

/** Drop the given pages, keeping the rest in their original order. */
export async function removePages(file: File, spec: string): Promise<Blob> {
  const src = await loadPdf(file);
  const pageCount = src.getPageCount();
  const drop = new Set(parsePageRanges(spec, pageCount));
  if (drop.size >= pageCount) throw new Error("Can't remove every page");
  const keep = Array.from({ length: pageCount }, (_, i) => i).filter((i) => !drop.has(i));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  for (const page of pages) out.addPage(page);
  return savePdfBlob(out);
}

/** Reorder every page per `spec` (must list each page exactly once). */
export async function organizePages(file: File, spec: string): Promise<Blob> {
  const src = await loadPdf(file);
  const order = parsePageOrder(spec, src.getPageCount());
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  for (const page of pages) out.addPage(page);
  return savePdfBlob(out);
}

/**
 * Split into multiple PDFs. `spec` is `;`-separated page-range groups (e.g.
 * "1-3;4-6;7"), one output file per group. An empty spec splits into one PDF
 * per page.
 */
export async function splitPdf(file: File, spec: string): Promise<NamedBlob[]> {
  const src = await loadPdf(file);
  const pageCount = src.getPageCount();
  const groups = spec.trim()
    ? spec
        .split(";")
        .map((g) => g.trim())
        .filter(Boolean)
        .map((g) => parsePageRanges(g, pageCount))
    : Array.from({ length: pageCount }, (_, i) => [i]);
  if (!groups.length) throw new Error("Enter at least one page group");

  const name = baseName(file.name);
  const results: NamedBlob[] = [];
  for (let i = 0; i < groups.length; i++) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, groups[i]!);
    for (const page of pages) out.addPage(page);
    results.push({ name: `${name}_part${i + 1}.pdf`, blob: await savePdfBlob(out) });
  }
  return results;
}

/** Rotate pages clockwise by `angle` degrees. Applies to all pages if `spec` is omitted. */
export async function rotatePages(
  file: File,
  angle: 90 | 180 | 270,
  spec?: string,
): Promise<Blob> {
  const doc = await loadPdf(file);
  const pageCount = doc.getPageCount();
  const indices = spec?.trim() ? parsePageRanges(spec, pageCount) : doc.getPageIndices();
  for (const i of indices) {
    const page = doc.getPage(i);
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  }
  return savePdfBlob(doc);
}

/**
 * Crop by insetting `marginPt` points from every edge of the page's visible
 * area. Applies to all pages if `spec` is omitted. A simple uniform-margin
 * crop rather than four independent edges — covers the common case (trim a
 * scanned border, tighten margins) without a visual crop-box editor.
 */
export async function cropPages(
  file: File,
  marginPt: number,
  spec?: string,
): Promise<Blob> {
  if (marginPt < 0) throw new Error("Margin can't be negative");
  const doc = await loadPdf(file);
  const pageCount = doc.getPageCount();
  const indices = spec?.trim() ? parsePageRanges(spec, pageCount) : doc.getPageIndices();
  for (const i of indices) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const w = width - marginPt * 2;
    const h = height - marginPt * 2;
    if (w <= 0 || h <= 0) {
      throw new Error(`Margin too large for page ${i + 1} (${width.toFixed(0)}×${height.toFixed(0)}pt)`);
    }
    page.setCropBox(marginPt, marginPt, w, h);
  }
  return savePdfBlob(doc);
}

export type PageNumberPosition =
  | "bottom-center"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "top-right"
  | "top-left";

export interface PageNumberOptions {
  position: PageNumberPosition;
  /** First page's printed number (lets a doc continue numbering from a prior section). */
  startAt: number;
  /** `{n}` -> page number, `{total}` -> total page count. */
  format: string;
}

/** Stamp `{n}/{total}`-style page numbers onto every page. */
export async function addPageNumbers(file: File, opts: PageNumberOptions): Promise<Blob> {
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 10;
  const margin = 24;
  const pages = doc.getPages();

  pages.forEach((page, i) => {
    const label = opts.format
      .replace(/\{n\}/g, String(opts.startAt + i))
      .replace(/\{total\}/g, String(pages.length));
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, size);

    const x =
      opts.position.endsWith("center")
        ? (width - textWidth) / 2
        : opts.position.endsWith("right")
          ? width - margin - textWidth
          : margin;
    const y = opts.position.startsWith("bottom") ? margin - size * 0.3 : height - margin;

    page.drawText(label, { x, y, size, font, color: rgb(0, 0, 0) });
  });

  return savePdfBlob(doc);
}
