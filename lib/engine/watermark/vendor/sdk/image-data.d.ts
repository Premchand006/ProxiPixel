// Minimal, self-contained type surface for the vendored Gemini watermark
// remover (pure image-data path). Mirrors @pilio/gemini-watermark-remover's
// `image-data` entry but declares only what ProxiPixel consumes, so the rest
// of the upstream type graph (node/video/sharp) is not pulled in.

export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface WatermarkPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WatermarkConfig {
  logoSize: number;
  marginRight: number;
  marginBottom: number;
  alphaVariant?: string;
}

export interface WatermarkMeta {
  /** True when a watermark was located and removal was applied. */
  applied: boolean;
  /** Why removal was skipped (set when `applied` is false). */
  skipReason: string | null;
  size: number | null;
  position: WatermarkPosition | null;
  config: WatermarkConfig | null;
  source: string;
  decisionTier: string | null;
  alphaGain: number;
  passCount: number;
}

export interface RemoveOptions {
  /** Adaptive alpha-map fitting. Defaults to `'auto'`. */
  adaptiveMode?: "auto" | "always" | "never" | "off";
  aggressiveLocatedFallback?: boolean;
  locatedAggressiveRemoval?: boolean;
}

export interface ImageDataRemovalResult {
  imageData: ImageDataLike;
  meta: WatermarkMeta;
}

/**
 * Remove a Gemini visible watermark from decoded RGBA pixels using reverse
 * alpha blending. Fully synchronous — uses embedded alpha maps, no network or
 * workers. Returns the (possibly modified) image data plus detection metadata.
 */
export function removeWatermarkFromImageDataSync(
  imageData: ImageDataLike,
  options?: RemoveOptions,
): ImageDataRemovalResult;
