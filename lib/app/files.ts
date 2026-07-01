import { newCanvas, ctx2d, canvasBlob } from "@/lib/engine/canvas";

/** A 300px-wide PNG data URL thumbnail for a decoded image canvas. */
export function makeThumb(canvas: HTMLCanvasElement): string {
  const tw = Math.min(300, canvas.width);
  const th = Math.max(1, Math.round(canvas.height * (tw / canvas.width)));
  const tc = newCanvas(tw, th);
  ctx2d(tc).drawImage(canvas, 0, 0, tw, th);
  return tc.toDataURL("image/png");
}

/** Baseline "source" size for a PDF page: the page rendered as a PNG. */
export async function pngSize(canvas: HTMLCanvasElement): Promise<number> {
  try {
    return (await canvasBlob(canvas, "image/png")).size;
  } catch {
    return 0;
  }
}

export function isPdf(file: File): boolean {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf";
}

export function isJpeg(file: File): boolean {
  return /\.jpe?g$/i.test(file.name) || file.type === "image/jpeg";
}
