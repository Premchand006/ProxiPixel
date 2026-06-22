import type { RawImage } from "./types";
import type {
  RemoveOptions,
  WatermarkMeta,
} from "./watermark/vendor/sdk/image-data.js";
import type { ProcessWatermarkResult } from "./watermark/vendor/core/watermarkProcessor.js";
import {
  reconstructCornerWatermark,
  regionResidual,
} from "./watermark/inpaint.js";

/**
 * Gemini watermark removal — a thin, typed adapter over the vendored
 * reverse-alpha-blending engine (`lib/engine/watermark/vendor`). Like the rest
 * of the engine it operates on {@link RawImage} (DOM-free, ImageData-shaped) so
 * the browser bridge in `lib/engine/canvas.ts` can drive it unchanged.
 *
 * This runs the upstream `WatermarkEngine.removeWatermarkFromImage` pipeline
 * (every calibrated alpha variant warmed, `adaptiveMode` default 'auto'), then
 * adds a **content-aware reconstruction** fallback ({@link reconstructCornerWatermark})
 * for the cases reverse-alpha-blending cannot handle.
 *
 * Why a fallback is needed: the upstream engine solves
 * `original = (watermarked − α·logo) / (1 − α)`. On a dark or busy background the
 * near-opaque sparkle has destroyed the underlying pixels (α→1), so that
 * division only amplifies error and leaves the tell-tale gray box with a ghost
 * of the star inside. Worse, on non-standard image sizes the catalog detector
 * can mis-size the alpha footprint and report a confident removal
 * (`applied:true`, `decisionTier:'direct-match'`) while leaving the logo almost
 * untouched. We therefore ignore the engine's self-assessment and judge by the
 * **actual residue** left in the watermark's corner box: when the reconstruction
 * (which rebuilds the background instead of un-blending it) is measurably
 * cleaner, we use it. Clean native removals score equally well and are kept, so
 * the well-tuned engine is never regressed.
 */

export type { WatermarkMeta };

export interface WatermarkResult {
  image: RawImage;
  meta: WatermarkMeta;
  /** True when the content-aware reconstruction replaced the engine's removal. */
  refined: boolean;
}

interface WatermarkEngine {
  process: (
    src: RawImage,
    adaptiveMode: RemoveOptions["adaptiveMode"],
  ) => ProcessWatermarkResult;
}

// The heavy engine (~360 KB of embedded alpha maps + detection tables) is loaded
// on demand the first time removal runs, then cached — so the alpha maps are
// decoded once and reused across an entire queue, mirroring the upstream engine.
let enginePromise: Promise<WatermarkEngine> | null = null;

async function getEngine(): Promise<WatermarkEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [
        { processWatermarkImageData },
        { interpolateAlphaMap },
        { getEmbeddedAlphaMap },
      ] = await Promise.all([
        import("./watermark/vendor/core/watermarkProcessor.js"),
        import("./watermark/vendor/core/adaptiveDetector.js"),
        import("./watermark/vendor/core/embeddedAlphaMaps.js"),
      ]);

      const alpha48 = getEmbeddedAlphaMap(48);
      const alpha96 = getEmbeddedAlphaMap(96);
      const alpha96NewMargin = getEmbeddedAlphaMap("96-20260520");
      const alpha36v2 = getEmbeddedAlphaMap("36-v2");
      const alphaMaps: Record<string, Float32Array> = {
        48: alpha48,
        96: alpha96,
        "96-20260520": alpha96NewMargin,
        "36-v2": alpha36v2,
      };
      // The engine asks for interpolated maps at arbitrary sizes; memoize them.
      const interpCache = new Map<number, Float32Array>();
      const alphaFor = (size: number | string): Float32Array => {
        const embedded = alphaMaps[size];
        if (embedded) return embedded;
        const n = Number(size);
        let v = interpCache.get(n);
        if (!v) {
          v = interpolateAlphaMap(alpha96, 96, n);
          interpCache.set(n, v);
        }
        return v;
      };

      return {
        process: (src, adaptiveMode) =>
          processWatermarkImageData(
            { width: src.width, height: src.height, data: src.data },
            {
              alpha48,
              alpha96,
              alpha96Variants: { "20260520": alpha96NewMargin },
              adaptiveMode,
              getAlphaMap: alphaFor,
            },
          ),
      };
    })();
  }
  return enginePromise;
}

// Reconstruction gating, scored on mean luminance deviation (in 0–255 units)
// from the local background inside the detected watermark box.
const REC_MIN_ENGINE_RESIDUE = 4; // engine left visible residue worth replacing
const REC_MIN_MEAN_IMPROVEMENT = 2; // reconstruction must cut mean residue by ≥ this

/**
 * Remove a Gemini watermark from one image. The returned `image` is always
 * present (the source pixels, re-encoded, when nothing is removed); inspect
 * `meta.applied || refined` to tell whether a watermark was actually removed.
 */
export async function removeWatermark(
  src: RawImage,
  options: RemoveOptions = { adaptiveMode: "auto" },
): Promise<WatermarkResult> {
  const engine = await getEngine();
  const W = src.width;
  const H = src.height;
  // Keep the untouched pixels — the engine mutates src.data in place, and the
  // reconstruction re-fits against the original.
  const original = src.data.slice();
  const { imageData, meta } = engine.process(src, options.adaptiveMode);

  let data = imageData.data;
  let refined = false;

  // Independently locate the corner watermark in the original and rebuild the
  // background under it. We adopt the reconstruction only when the engine's own
  // output still shows meaningful residue there AND the reconstruction is
  // clearly cleaner — so confident, well-removed standard images are untouched
  // while the engine's silent failures (gray box / ghost) are repaired.
  const rec = reconstructCornerWatermark({
    width: W,
    height: H,
    data: original,
  });
  if (rec) {
    const engineResidue = regionResidual(data, W, H, rec.box, rec.cornerBg);
    if (
      engineResidue.mean >= REC_MIN_ENGINE_RESIDUE &&
      engineResidue.mean - rec.after.mean >= REC_MIN_MEAN_IMPROVEMENT
    ) {
      data = rec.full;
      refined = true;
    }
  }

  return { image: { width: W, height: H, data }, meta, refined };
}
