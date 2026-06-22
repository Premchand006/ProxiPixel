import { describe, expect, it } from "vitest";
import {
  enhance,
  lanczosResize,
  lanczosResizeLinear,
} from "@/lib/engine/upscale";
import type { RawImage } from "@/lib/engine/types";

function solid(
  w: number,
  h: number,
  rgba: [number, number, number, number],
): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return { width: w, height: h, data: new Uint8ClampedArray(data) };
}

describe("lanczosResize", () => {
  it("produces exactly the requested output dimensions", () => {
    const out = lanczosResize(solid(4, 4, [10, 20, 30, 255]), 9, 7);
    expect(out.width).toBe(9);
    expect(out.height).toBe(7);
    expect(out.data.length).toBe(9 * 7 * 4);
  });

  it("preserves a constant-color image when upscaling", () => {
    const color: [number, number, number, number] = [100, 150, 200, 255];
    const out = lanczosResize(solid(4, 4, color), 8, 8);
    for (let i = 0; i < out.data.length; i += 4) {
      // Normalized weights sum to 1, so a flat field stays flat (±1 rounding).
      expect(Math.abs(out.data[i] - color[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(out.data[i + 1] - color[1])).toBeLessThanOrEqual(1);
      expect(Math.abs(out.data[i + 2] - color[2])).toBeLessThanOrEqual(1);
      expect(out.data[i + 3]).toBe(color[3]);
    }
  });

  it("preserves a constant-color image when downscaling", () => {
    const color: [number, number, number, number] = [200, 80, 40, 255];
    const out = lanczosResize(solid(10, 10, color), 4, 4);
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(Math.abs(out.data[i] - color[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(out.data[i + 1] - color[1])).toBeLessThanOrEqual(1);
      expect(Math.abs(out.data[i + 2] - color[2])).toBeLessThanOrEqual(1);
    }
  });
});

describe("lanczosResizeLinear (gamma-correct)", () => {
  it("produces the requested dimensions", () => {
    const out = lanczosResizeLinear(solid(4, 4, [10, 20, 30, 255]), 9, 7);
    expect(out.width).toBe(9);
    expect(out.height).toBe(7);
    expect(out.data.length).toBe(9 * 7 * 4);
  });

  it("preserves a constant color through the linear round-trip", () => {
    const color: [number, number, number, number] = [100, 150, 200, 255];
    const out = lanczosResizeLinear(solid(4, 4, color), 8, 8);
    for (let i = 0; i < out.data.length; i += 4) {
      // sRGB→linear→sRGB LUT round-trip allows a couple of levels of error.
      expect(Math.abs(out.data[i] - color[0])).toBeLessThanOrEqual(2);
      expect(Math.abs(out.data[i + 1] - color[1])).toBeLessThanOrEqual(2);
      expect(Math.abs(out.data[i + 2] - color[2])).toBeLessThanOrEqual(2);
      expect(out.data[i + 3]).toBe(255);
    }
  });

  it("blends two greys brighter in linear light than naive sRGB averaging", () => {
    // A black/white checker resized to 1px averages to mid-grey. In linear
    // light that is ~188 in sRGB, well above the gamma-space average of ~128.
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255,
    ]);
    const out = lanczosResizeLinear({ width: 2, height: 2, data }, 1, 1);
    expect(out.data[0]).toBeGreaterThan(150);
  });
});

describe("enhance", () => {
  it("upscales to the requested width, height by aspect", () => {
    const out = enhance(solid(100, 50, [120, 130, 140, 255]), {
      targetW: 800,
      method: "lanczos",
      denoise: 0,
      clarity: 0,
      sharpen: 0,
      radius: 1,
    });
    expect(out.width).toBe(800);
    expect(out.height).toBe(400);
  });
});
