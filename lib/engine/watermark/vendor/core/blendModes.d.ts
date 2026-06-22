import type { ImageDataLike, WatermarkPosition } from "../sdk/image-data.js";

/** In-place reverse alpha blending over the watermark box. Mutates `imageData.data`. */
export function removeWatermark(
  imageData: ImageDataLike,
  alphaMap: Float32Array,
  position: WatermarkPosition,
  options?: { alphaGain?: number; logoValue?: number },
): void;
