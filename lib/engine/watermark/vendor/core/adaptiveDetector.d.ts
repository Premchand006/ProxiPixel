/** Resample a square alpha map from `sourceSize`×`sourceSize` to `targetSize`. */
export function interpolateAlphaMap(
  sourceAlpha: Float32Array,
  sourceSize: number,
  targetSize: number,
): Float32Array;
