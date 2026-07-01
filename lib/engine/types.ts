/**
 * Core engine types. The engine is framework-agnostic: pure functions operate
 * on `RawImage` (a plain, DOM-free mirror of the browser's `ImageData`), so the
 * algorithms can be unit-tested in Node and reused in any UI.
 */

/** RGBA, row-major, 8-bit per channel. `data.length === width * height * 4`. */
export interface RawImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type ImageFormat =
  | "png"
  | "jpeg"
  | "webp"
  | "avif"
  | "bmp"
  | "gif"
  | "tiff"
  | "pdf";

export type ResampleMethod = "lanczos" | "smooth";

/** Options for the Upscale/clarity pipeline. Amounts are normalized 0..1-ish. */
export interface UpscaleOptions {
  /** Requested output width in px; height follows the source aspect ratio. */
  targetW: number;
  method: ResampleMethod;
  /** 0..1 — edge-preserving-ish smooth blend. */
  denoise: number;
  /** 0..1 — local-contrast (large-radius unsharp). */
  clarity: number;
  /** ~0..1.5 — unsharp mask amount. */
  sharpen: number;
  /** px — unsharp/blur radius. */
  radius: number;
}

/**
 * Video options. `width`, `aspect`, and `fps` are the raw select values from
 * the reference UI (`'orig'` / `'keep'` or a numeric string), kept as strings
 * because they are interpolated verbatim into FFmpeg filter graphs.
 */
export interface VideoOptions {
  fmt: "mp4" | "webm" | "gif";
  /** 0..100 quality slider; mapped to CRF. */
  q: number;
  /** `'orig'` or a pixel width as a string, e.g. `'1280'`. */
  width: string;
  /** `'keep'` or an aspect ratio as a string, e.g. `'1.7778'`. */
  aspect: string;
  /** `'orig'` or an fps as a string, e.g. `'30'`. */
  fps: string;
  /** Trim start, seconds. */
  start: number;
  /** Trim end, seconds (`<= start` means "to end"). */
  end: number;
  mute: boolean;
}

export interface ExifInfo {
  hasGPS: boolean;
  hasCamera: boolean;
  hasDate: boolean;
  any: boolean;
}
