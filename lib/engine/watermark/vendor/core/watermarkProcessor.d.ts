import type { ImageDataLike, WatermarkMeta } from "../sdk/image-data.js";

export interface ProcessWatermarkOptions {
  alpha48: Float32Array;
  alpha96: Float32Array;
  /** Margin-variant alpha maps keyed by catalog id (e.g. "20260520"). */
  alpha96Variants?: Record<string, Float32Array>;
  adaptiveMode?: "auto" | "always" | "never" | "off";
  /** Resolver for any watermark size the detector lands on. */
  getAlphaMap?: (size: number | string) => Float32Array;
  debugTimings?: boolean;
}

export interface ProcessWatermarkResult {
  imageData: ImageDataLike;
  meta: WatermarkMeta;
}

/** Core reverse-alpha-blending removal over decoded RGBA pixels. */
export function processWatermarkImageData(
  imageData: ImageDataLike,
  options?: ProcessWatermarkOptions,
): ProcessWatermarkResult;
