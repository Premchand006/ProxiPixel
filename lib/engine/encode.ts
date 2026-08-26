import type { ImageFormat, RawImage } from "./types";
import {
  canvasBlob,
  flatten,
  getImageDataOf,
  newCanvas,
  ctx2d,
  type Canvas,
} from "./canvas";
import type { GifencModule, UtifModule } from "./external";
import { encodePDF } from "./pdf";

/** File extension per output format (note: JPEG -> `.jpg`). */
export const EXT: Record<ImageFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  avif: "avif",
  bmp: "bmp",
  gif: "gif",
  tiff: "tiff",
  pdf: "pdf",
};

/** Output formats offered by the Convert tool, as `[value, label]`. */
export const OUT_CONVERT: ReadonlyArray<readonly [ImageFormat, string]> = [
  ["png", "PNG"],
  ["jpeg", "JPG"],
  ["webp", "WEBP"],
  ["avif", "AVIF"],
  ["bmp", "BMP"],
  ["gif", "GIF"],
  ["tiff", "TIFF"],
  ["pdf", "PDF"],
];

/**
 * Encode an RGBA image as an uncompressed 24-bit BMP (BI_RGB), bottom-up rows,
 * BGR channel order, each row padded to a 4-byte boundary. Alpha is composited
 * over white. Pure — ported verbatim from the reference's `encodeBMP`.
 */
export function encodeBMP(img: RawImage): Uint8Array<ArrayBuffer> {
  const { width: w, height: h, data } = img;
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pix = rowSize * h;
  const fileH = 14;
  const dibH = 40;
  const size = fileH + dibH + pix;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  let p = 0;
  dv.setUint8(p++, 0x42); // 'B'
  dv.setUint8(p++, 0x4d); // 'M'
  dv.setUint32(p, size, true);
  p += 4;
  dv.setUint32(p, 0, true);
  p += 4;
  dv.setUint32(p, fileH + dibH, true);
  p += 4;
  dv.setUint32(p, dibH, true);
  p += 4;
  dv.setInt32(p, w, true);
  p += 4;
  dv.setInt32(p, h, true);
  p += 4;
  dv.setUint16(p, 1, true);
  p += 2;
  dv.setUint16(p, 24, true);
  p += 2;
  dv.setUint32(p, 0, true);
  p += 4;
  dv.setUint32(p, pix, true);
  p += 4;
  dv.setInt32(p, 2835, true);
  p += 4;
  dv.setInt32(p, 2835, true);
  p += 4;
  dv.setUint32(p, 0, true);
  p += 4;
  dv.setUint32(p, 0, true);
  p += 4;
  const start = fileH + dibH;
  for (let y = 0; y < h; y++) {
    const sy = h - 1 - y;
    let off = start + y * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (sy * w + x) * 4;
      const a = data[i + 3] / 255;
      dv.setUint8(off++, Math.round(data[i + 2] * a + 255 * (1 - a)));
      dv.setUint8(off++, Math.round(data[i + 1] * a + 255 * (1 - a)));
      dv.setUint8(off++, Math.round(data[i] * a + 255 * (1 - a)));
    }
  }
  return new Uint8Array(buf);
}

/** GIF (256-color, quantized) via the `gifenc` module (code-split on first use). */
export async function encodeGIF(canvas: Canvas): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = (await import(
    "gifenc"
  )) as unknown as GifencModule;
  const { data, width, height } = getImageDataOf(canvas);
  const palette = quantize(data, 256);
  const index = applyPalette(data, palette);
  const enc = GIFEncoder();
  enc.writeFrame(index, width, height, { palette });
  enc.finish();
  return new Blob([enc.bytes()], { type: "image/gif" });
}

async function loadUTIF(): Promise<UtifModule> {
  const mod = (await import("utif")) as unknown as {
    default?: UtifModule;
  } & UtifModule;
  return mod.default ?? mod;
}

/** Uncompressed TIFF via the `UTIF` module (code-split on first use). */
export async function encodeTIFF(canvas: Canvas): Promise<Blob> {
  const UTIF = await loadUTIF();
  const id = getImageDataOf(canvas);
  const buf = UTIF.encodeImage(id.data, id.width, id.height);
  return new Blob([buf], { type: "image/tiff" });
}

/** Probe whether this browser can actually encode AVIF (cached). */
let avifEncodeOK: boolean | null = null;
export async function avifSupported(): Promise<boolean> {
  if (avifEncodeOK !== null) return avifEncodeOK;
  try {
    const c = newCanvas(2, 2);
    ctx2d(c).fillRect(0, 0, 2, 2);
    const b = await new Promise<Blob | null>((r) => {
      try {
        c.toBlob((bb) => r(bb), "image/avif", 0.5);
      } catch {
        r(null);
      }
    });
    avifEncodeOK = !!b && b.type === "image/avif";
  } catch {
    avifEncodeOK = false;
  }
  return avifEncodeOK;
}

/** Encode a canvas to the requested format. Ported verbatim. */
export async function encode(
  canvas: Canvas,
  fmt: ImageFormat,
  quality?: number,
): Promise<Blob> {
  switch (fmt) {
    case "png":
      return canvasBlob(canvas, "image/png");
    case "jpeg":
      return canvasBlob(flatten(canvas), "image/jpeg", quality);
    case "webp":
      return canvasBlob(canvas, "image/webp", quality);
    case "avif":
      return canvasBlob(canvas, "image/avif", quality);
    case "bmp":
      return new Blob([encodeBMP(getImageDataOf(flatten(canvas)))], {
        type: "image/bmp",
      });
    case "gif":
      return encodeGIF(canvas);
    case "tiff":
      return encodeTIFF(canvas);
    case "pdf":
      return encodePDF(canvas);
    default:
      throw new Error("Unknown format");
  }
}
