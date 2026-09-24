import { newCanvas, ctx2d, flatten, type Canvas } from "./canvas";
import type { JsPDFConstructor, PdfjsModule } from "./external";
import { VENDOR } from "./loaders";

let pdfjs: PdfjsModule | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (pdfjs) return pdfjs;
  try {
    const lib = (await import("pdfjs-dist")) as unknown as PdfjsModule;
    // Same-origin vendored worker (see VENDOR.pdfjsWorker for why it isn't
    // bundled via `new URL(..., import.meta.url)`).
    lib.GlobalWorkerOptions.workerSrc = VENDOR.pdfjsWorker;
    pdfjs = lib;
  } catch {
    throw new Error("PDF support didn’t load");
  }
  return pdfjs;
}

export interface PdfPage {
  canvas: Canvas;
  page: number;
  total: number;
}

/** Render each PDF page to a 2x raster canvas (one queue item per page). */
export async function renderPdfPages(file: File): Promise<PdfPage[]> {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data }).promise;
  const pages: PdfPage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 2 }); // 2x for crisp raster
    const c = newCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    await page.render({ canvasContext: ctx2d(c), viewport: vp }).promise;
    pages.push({ canvas: c, page: p, total: doc.numPages });
  }
  return pages;
}

async function loadJsPDF(): Promise<JsPDFConstructor> {
  const { jsPDF } = await import("jspdf");
  return jsPDF as unknown as JsPDFConstructor;
}

/** Wrap a single image as a one-page PDF sized to fit. Ported verbatim. */
export async function encodePDF(canvas: Canvas): Promise<Blob> {
  const JsPDF = await loadJsPDF();
  const flat = flatten(canvas);
  const dataUrl = flat.toDataURL("image/jpeg", 0.92);
  const w = flat.width;
  const h = flat.height;
  const pdf = new JsPDF({
    orientation: w >= h ? "l" : "p",
    unit: "px",
    format: [w, h],
  });
  pdf.addImage(dataUrl, "JPEG", 0, 0, w, h);
  return pdf.output("blob");
}
