import type { RawImage } from "./types";

/**
 * Browser canvas helpers. These are the only place the engine touches the DOM;
 * the pure algorithms work on {@link RawImage} and never import this file, so
 * unit tests stay Node-runnable.
 */
export type Canvas = HTMLCanvasElement;

export function newCanvas(w: number, h: number): Canvas {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: Canvas): CanvasRenderingContext2D {
  const x = c.getContext("2d");
  if (!x) throw new Error("2D canvas context unavailable");
  return x;
}

export function getImageDataOf(c: Canvas): ImageData {
  return ctx2d(c).getImageData(0, 0, c.width, c.height);
}

/** Composite over white — for formats without an alpha channel. */
export function flatten(c: Canvas): Canvas {
  const o = newCanvas(c.width, c.height);
  const x = ctx2d(o);
  x.fillStyle = "#fff";
  x.fillRect(0, 0, o.width, o.height);
  x.drawImage(c, 0, 0);
  return o;
}

export function canvasBlob(c: Canvas, type: string, q?: number): Promise<Blob> {
  return new Promise((res, rej) => {
    c.toBlob(
      (b) => (b ? res(b) : rej(new Error("This browser can’t encode " + type))),
      type,
      q,
    );
  });
}

export function canvasToRaw(c: Canvas): RawImage {
  const id = getImageDataOf(c);
  return { width: id.width, height: id.height, data: id.data };
}

export function rawToCanvas(img: RawImage): Canvas {
  const c = newCanvas(img.width, img.height);
  // Copy into an ArrayBuffer-backed buffer, as ImageData requires.
  const id = new ImageData(
    new Uint8ClampedArray(img.data),
    img.width,
    img.height,
  );
  ctx2d(c).putImageData(id, 0, 0);
  return c;
}
