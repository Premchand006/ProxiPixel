import { describe, expect, it } from "vitest";
import { removeWatermark } from "@/lib/engine/watermark";
import { jobInputSchema } from "@/server/validation";
import type { RawImage } from "@/lib/engine/types";

/**
 * Integration smoke test for the vendored Gemini watermark engine. We can't
 * synthesize Gemini's exact alpha-blended logo here, so we verify the safe,
 * deterministic contract: the wrapper loads the engine, runs on decoded RGBA
 * pixels, preserves the image shape, and reports `applied: false` when there is
 * no watermark to remove (a flat image at a known Gemini size).
 */
describe("removeWatermark", () => {
  function flatImage(w: number, h: number, v = 128): RawImage {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data };
  }

  it("runs the engine and preserves image dimensions", async () => {
    const src = flatImage(1024, 1024);
    const { image, meta, refined } = await removeWatermark(src);
    expect(image.width).toBe(1024);
    expect(image.height).toBe(1024);
    expect(image.data.length).toBe(1024 * 1024 * 4);
    expect(typeof meta.applied).toBe("boolean");
    expect(typeof refined).toBe("boolean");
  });

  it("reports no removal on a flat (watermark-free) image", async () => {
    const { meta, refined } = await removeWatermark(flatImage(1024, 1024));
    expect(meta.applied).toBe(false);
    expect(meta.skipReason).not.toBeNull();
    // No watermark, no position -> the corner refinement never engages.
    expect(refined).toBe(false);
  });

  const lum = (d: Uint8ClampedArray, i: number) =>
    0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

  /** Max luminance over the bottom-right corner (where a Gemini stamp lives). */
  function cornerPeak(img: RawImage, frac = 0.2): number {
    const x0 = Math.floor(img.width * (1 - frac));
    const y0 = Math.floor(img.height * (1 - frac));
    let peak = 0;
    for (let y = y0; y < img.height; y++)
      for (let x = x0; x < img.width; x++) {
        const l = lum(img.data, (y * img.width + x) * 4);
        if (l > peak) peak = l;
      }
    return peak;
  }

  /**
   * A dark image (non-standard size) with a bright, semi-transparent sparkle
   * stamped near the bottom-right corner — the case reverse-alpha-blending leaves
   * as a gray box with a ghost, and the content-aware reconstruction repairs.
   */
  function darkWithCornerStamp(w: number, h: number): RawImage {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 12; // near-black background
      data[i + 3] = 255;
    }
    const cx = w - 70;
    const cy = h - 60;
    const r = 26;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        // Four-point-star falloff: bright core fading to the diamond's tips.
        const d = (Math.abs(x - cx) + Math.abs(y - cy)) / r;
        if (d > 1) continue;
        const a = Math.pow(1 - d, 0.6); // opacity 1 at centre -> 0 at the tips
        const i = (y * w + x) * 4;
        const v = Math.round(12 * (1 - a) + 240 * a);
        data[i] = data[i + 1] = data[i + 2] = v;
      }
    }
    return { width: w, height: h, data };
  }

  it("reconstructs a bright corner watermark the engine leaves behind", async () => {
    const src = darkWithCornerStamp(1300, 820);
    expect(cornerPeak(src)).toBeGreaterThan(180); // the stamp is clearly visible

    const { image, refined } = await removeWatermark(src);
    expect(image.width).toBe(1300);
    expect(image.height).toBe(820);
    // The reconstruction path engaged and the bright stamp is gone (corner now
    // reads as background, not a residual ghost).
    expect(refined).toBe(true);
    expect(cornerPeak(image)).toBeLessThan(60);
  });
});

describe("jobInputSchema watermark kind", () => {
  it("accepts the watermark tool kind", () => {
    const parsed = jobInputSchema.parse({
      kind: "watermark",
      sourceName: "Gemini_Generated_Image.png",
      targetFormat: "png",
    });
    expect(parsed.kind).toBe("watermark");
  });
});
