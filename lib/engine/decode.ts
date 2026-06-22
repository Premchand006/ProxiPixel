import { newCanvas, ctx2d, type Canvas } from "./canvas";
import { CDN, injectScript } from "./loaders";
import type { Heic2Any, UtifModule } from "./external";

/** Decode any browser-native image (PNG/JPEG/WebP/AVIF/GIF/BMP) via `Image`. */
export function blobToCanvas(blob: Blob): Promise<Canvas> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = newCanvas(img.naturalWidth, img.naturalHeight);
      ctx2d(c).drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      res(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("Unreadable image"));
    };
    img.src = url;
  });
}

async function loadHeic2Any(): Promise<Heic2Any> {
  if (!window.heic2any) await injectScript(CDN.heic2any);
  if (!window.heic2any) throw new Error("HEIC support didn’t load");
  return window.heic2any;
}

async function loadUTIF(): Promise<UtifModule> {
  if (!window.UTIF) await injectScript(CDN.utif);
  if (!window.UTIF) throw new Error("TIFF support didn’t load");
  return window.UTIF;
}

/**
 * Decode an input file to a canvas. HEIC/HEIF go through `heic2any`, TIFF
 * through `UTIF`; everything else uses the browser's native image decoding.
 * (PDFs are handled separately in `pdf.ts`.) Ported verbatim.
 */
export async function decodeFile(file: File): Promise<Canvas> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const t = file.type;
  if (ext === "heic" || ext === "heif" || t === "image/heic" || t === "image/heif") {
    const heic2any = await loadHeic2Any();
    const out = await heic2any({ blob: file, toType: "image/png" });
    return blobToCanvas(Array.isArray(out) ? out[0] : out);
  }
  if (ext === "tif" || ext === "tiff" || t === "image/tiff") {
    const UTIF = await loadUTIF();
    const buf = await file.arrayBuffer();
    const ifds = UTIF.decode(buf);
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const w = ifds[0].width;
    const h = ifds[0].height;
    const c = newCanvas(w, h);
    const id = ctx2d(c).createImageData(w, h);
    id.data.set(rgba);
    ctx2d(c).putImageData(id, 0, 0);
    return c;
  }
  return blobToCanvas(file);
}
