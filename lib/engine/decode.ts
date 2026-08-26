import { newCanvas, ctx2d, type Canvas } from "./canvas";
import type { UtifModule } from "./external";

/**
 * Decode any browser-native image (PNG/JPEG/WebP/AVIF/GIF/BMP — and HEIC on
 * platforms that decode it natively, e.g. Safari/iOS/macOS) via `Image`.
 * Rejects if the blob can't be decoded, so HEIC callers can fall back to the
 * software decoder.
 */
export function blobToCanvas(blob: Blob): Promise<Canvas> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // Some browsers fire `load` for an undecodable image with 0×0 dimensions;
      // treat that as a failure so the fallback decoder can take over.
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        rej(new Error("Unreadable image"));
        return;
      }
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

async function loadUTIF(): Promise<UtifModule> {
  const mod = (await import("utif")) as unknown as {
    default?: UtifModule;
  } & UtifModule;
  return mod.default ?? mod;
}

/**
 * Decode a HEIC/HEIF file to a canvas. Tries the browser's native decoder
 * first — Safari/iOS/macOS read HEIC directly, which is faster and preserves
 * EXIF orientation/colour — then falls back to the `heic-to` software decoder
 * (a current `libheif` build) for browsers without native support
 * (Chrome/Firefox/Edge). Throws a precise error if neither path can read it.
 */
async function decodeHeic(file: File): Promise<Canvas> {
  // 1) Native decode where the platform supports HEIC.
  try {
    return await blobToCanvas(file);
  } catch {
    /* no native HEIC support — fall through to the software decoder */
  }

  // 2) Software decode via heic-to (libheif/WASM in a worker). The CSP build
  //    self-contains its WASM and avoids `eval`, so it works under our strict
  //    Content-Security-Policy. Imported lazily so the core image path never
  //    pulls in the ~3 MB decoder.
  let png: Blob;
  try {
    const { heicTo } = await import("heic-to/csp");
    png = await heicTo({ blob: file, type: "image/png" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Couldn’t decode HEIC image${msg ? ` (${msg})` : ""}`);
  }
  if (!png || !png.size) {
    throw new Error("Couldn’t decode HEIC image (empty result)");
  }
  return blobToCanvas(png);
}

/**
 * Decode an input file to a canvas. HEIC/HEIF go through {@link decodeHeic},
 * TIFF through `UTIF`; everything else uses the browser's native image
 * decoding. (PDFs are handled separately in `pdf.ts`.)
 */
export async function decodeFile(file: File): Promise<Canvas> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const t = file.type;
  if (ext === "heic" || ext === "heif" || t === "image/heic" || t === "image/heif") {
    return decodeHeic(file);
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
