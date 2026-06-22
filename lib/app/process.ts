import { canvasToRaw, rawToCanvas } from "@/lib/engine/canvas";
import { EXT, encode } from "@/lib/engine/encode";
import { enhance, lanczosResize, UHD_4K_LONG_EDGE } from "@/lib/engine/upscale";
import { removeWatermark } from "@/lib/engine/watermark";
import { optimizeToTargetSize } from "@/lib/engine/optimize";
import { processVideo } from "@/lib/engine/video/ffmpeg";
import type { ImageFormat } from "@/lib/engine/types";
import type { Mode, Options, QueueItem } from "./types";

/** Formats whose encoder honors a 0..1 quality argument. The rest are lossless
 *  (or fixed-quality), so the quality slider / target-size search don't apply. */
const LOSSY: ReadonlySet<ImageFormat> = new Set(["jpeg", "webp", "avif"]);
const isLossy = (fmt: ImageFormat): boolean => LOSSY.has(fmt);

/** The fields a finished job contributes back to its queue item. */
export type JobResult = Pick<
  QueueItem,
  "resultBlob" | "resultName" | "resultKind" | "outW" | "outH" | "usedQ"
>;

/**
 * Run one queue item through the engine for the active tool. Pure bridge between
 * the browser canvas and the framework-agnostic engine — faithful to the
 * reference's `processItem`. Throws on failure (caller records the message).
 */
export async function runJob(
  item: QueueItem,
  mode: Mode,
  options: Options,
): Promise<JobResult> {
  const base = item.name.replace(/\.[^.]+$/, "");

  if (mode === "video") {
    if (!item.file) throw new Error("No video source");
    const { blob } = await processVideo(item.file, options.vid);
    return {
      resultBlob: blob,
      resultName: `${base}_out.${options.vid.fmt}`,
      resultKind: "video",
    };
  }

  const canvas = item.canvas;
  if (!canvas) throw new Error("No image source");

  if (mode === "convert") {
    const { fmt } = options.convert;
    const q = options.convert.q / 100;
    const blob = await encode(canvas, fmt, q);
    return { resultBlob: blob, resultName: `${base}.${EXT[fmt]}`, resultKind: "convert" };
  }

  if (mode === "upscale") {
    const u = options.up;
    // "4k" fills the 3840px long edge (true 4K UHD on 16:9); already-4K+ sources
    // are left at native size and just enhanced. Numeric scales multiply.
    const longest = Math.max(canvas.width, canvas.height);
    const targetW =
      u.scale === "custom"
        ? u.width
        : u.scale === "4k"
          ? Math.round(
              canvas.width *
                (longest < UHD_4K_LONG_EDGE ? UHD_4K_LONG_EDGE / longest : 1),
            )
          : Math.round(canvas.width * parseFloat(u.scale));
    const out = enhance(canvasToRaw(canvas), {
      targetW,
      method: u.method,
      denoise: u.denoise,
      clarity: u.clarity,
      sharpen: u.sharpen,
      radius: u.radius,
    });
    const outCanvas = rawToCanvas(out);
    const blob = await encode(
      outCanvas,
      u.fmt,
      isLossy(u.fmt) ? 0.95 : undefined,
    );
    const tag =
      u.scale === "custom"
        ? `${out.width}w`
        : u.scale === "4k"
          ? "4k"
          : `${u.scale}x`;
    return {
      resultBlob: blob,
      resultName: `${base}_${tag}.${EXT[u.fmt]}`,
      resultKind: "upscale",
      outW: out.width,
      outH: out.height,
    };
  }

  if (mode === "watermark") {
    const wm = options.wm;
    const { image, meta, refined } = await removeWatermark(canvasToRaw(canvas), {
      adaptiveMode: wm.adaptive,
    });
    if (!meta.applied && !refined) {
      // Nothing was removed by either the catalog engine or the corner
      // refinement — surface a clear message instead of a silent no-op copy.
      throw new Error(
        meta.skipReason
          ? `No Gemini watermark removed (${meta.skipReason})`
          : "No Gemini watermark detected",
      );
    }
    const lossy = isLossy(wm.fmt);
    const blob = await encode(
      rawToCanvas(image),
      wm.fmt,
      lossy ? wm.q / 100 : undefined,
    );
    return {
      resultBlob: blob,
      resultName: `${base}_clean.${EXT[wm.fmt]}`,
      resultKind: "watermark",
    };
  }

  // optimize
  const op = options.op;
  let src = canvas;
  if (op.maxW > 0 && canvas.width > op.maxW) {
    const resized = lanczosResize(
      canvasToRaw(canvas),
      op.maxW,
      Math.round(canvas.height * (op.maxW / canvas.width)),
    );
    src = rawToCanvas(resized);
  }
  const lossy = isLossy(op.fmt);
  let blob: Blob;
  let usedQ: number;
  if (op.mode === "size" && lossy) {
    // Binary-search quality to land just under the target size.
    const { result, q } = await optimizeToTargetSize<Blob>(
      (quality) => encode(src, op.fmt, quality),
      op.size * 1024,
    );
    blob = result;
    usedQ = q;
  } else {
    // Quality mode, or a lossless format that ignores the size target.
    usedQ = op.q / 100;
    blob = await encode(src, op.fmt, lossy ? usedQ : undefined);
  }
  return {
    resultBlob: blob,
    resultName: `${base}_opt.${EXT[op.fmt]}`,
    resultKind: "optimize",
    usedQ,
  };
}
