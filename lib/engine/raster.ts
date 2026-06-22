import type { RawImage } from "./types";

/** Allocate a zero-filled (transparent black) RGBA image. */
export function createRawImage(width: number, height: number): RawImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Deep copy — the pixel buffer is duplicated so callers can mutate freely. */
export function cloneRawImage(img: RawImage): RawImage {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  };
}
