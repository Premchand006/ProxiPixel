/** Types for the content-aware watermark reconstruction engine (`inpaint.js`). */

export interface InpaintImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Residual {
  /** Max absolute luminance deviation from the local background over the box. */
  peak: number;
  /** Mean absolute luminance deviation over the box. */
  mean: number;
}

export interface DetectOptions {
  /** Bottom-right fraction of the short side to scan (default 0.22). */
  cornerFrac?: number;
  /** Minimum bright-core pixel count to treat a cluster as a logo (default 24). */
  minBrightPix?: number;
  /** Minimum peak luminance excess for a bright stamp to exist (default 26). */
  minPeakExcess?: number;
}

export interface ReconstructOptions extends DetectOptions {
  /** Transfer neighbour texture onto the fill on textured backgrounds (default true). */
  texture?: boolean;
}

export interface Detection {
  window: Box;
  mask: Float32Array;
  cornerBg: number;
  brightT: number;
  cluster: { cx: number; cy: number; R: number };
  box: Box;
}

export interface Reconstruction {
  /** Full-image RGBA buffer with the corner watermark reconstructed. */
  full: Uint8ClampedArray;
  /** Tight box around the watermark, used for residual scoring. */
  box: Box;
  cornerBg: number;
  surroundRms: number;
  /** Residual in `box` before removal (the intact watermark). */
  before: Residual;
  /** Residual in `box` after reconstruction. */
  after: Residual;
  cluster: { cx: number; cy: number; R: number };
}

export function lumAt(d: Uint8ClampedArray, i: number): number;

export function regionResidual(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  box: Box,
  bg: number,
): Residual;

export function detectCornerWatermark(
  img: InpaintImage,
  opts?: DetectOptions,
): Detection | null;

export function reconstructCornerWatermark(
  img: InpaintImage,
  opts?: ReconstructOptions,
): Reconstruction | null;
