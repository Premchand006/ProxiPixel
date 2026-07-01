import type { RawImage } from "./types";

/** Deep copy — the pixel buffer is duplicated so callers can mutate freely. */
export function cloneRawImage(img: RawImage): RawImage {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  };
}
