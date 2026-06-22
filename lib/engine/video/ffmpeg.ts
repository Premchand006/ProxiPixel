import { CDN, fetchFile, injectScript, toBlobURL } from "../loaders";
import type { FFmpegInstance } from "../external";
import type { VideoOptions } from "../types";
import { buildVideoArgs } from "./args";

let ffmpeg: FFmpegInstance | null = null;
let ffmpegLoading: Promise<FFmpegInstance> | null = null;

export interface FFmpegCallbacks {
  onLog?: (message: string) => void;
  onProgress?: (progress: number) => void;
}
let cbs: FFmpegCallbacks = {};

/** Register log/progress callbacks used during the next `processVideo` run. */
export function setFFmpegCallbacks(c: FFmpegCallbacks): void {
  cbs = c;
}

/**
 * Load FFmpeg.wasm (single-threaded core) on first use. Uses the versioned
 * class worker (`814.ffmpeg.js`) per the project's FFmpeg notes; no
 * cross-origin isolation required. Concurrent callers share one load.
 */
export async function loadFFmpeg(): Promise<FFmpegInstance> {
  if (ffmpeg) return ffmpeg;
  if (ffmpegLoading) return ffmpegLoading;
  ffmpegLoading = (async () => {
    if (typeof window.FFmpegWASM === "undefined") {
      await injectScript(`${CDN.ffmpegBase}/ffmpeg.js`);
    }
    if (!window.FFmpegWASM) throw new Error("FFmpeg failed to load");
    const inst = new window.FFmpegWASM.FFmpeg();
    inst.on("log", ({ message }) => {
      cbs.onLog?.(message);
    });
    inst.on("progress", ({ progress }) => {
      cbs.onProgress?.(progress);
    });
    await inst.load({
      classWorkerURL: await toBlobURL(
        `${CDN.ffmpegBase}/814.ffmpeg.js`,
        "text/javascript",
      ),
      coreURL: await toBlobURL(
        `${CDN.ffcoreBase}/ffmpeg-core.js`,
        "text/javascript",
      ),
      wasmURL: await toBlobURL(
        `${CDN.ffcoreBase}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });
    ffmpeg = inst;
    return inst;
  })();
  try {
    return await ffmpegLoading;
  } catch (e) {
    ffmpegLoading = null; // allow retry after a failed load
    throw e;
  }
}

export interface VideoResult {
  blob: Blob;
  outName: string;
}

/**
 * Transcode/edit a video entirely in the browser. Writes the input to FFmpeg's
 * virtual FS, runs the arg vector from {@link buildVideoArgs}, and returns the
 * output blob. Ported from the reference's `processVideo` (UI/DOM stripped).
 */
export async function processVideo(
  file: File,
  o: VideoOptions,
): Promise<VideoResult> {
  const lib = await loadFFmpeg();
  const extMatch = file.name.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0] : ".mp4";
  const inName = "in" + ext;
  const outName = "out." + (o.fmt === "gif" ? "gif" : o.fmt);
  await lib.writeFile(inName, await fetchFile(file));
  await lib.exec(buildVideoArgs(inName, outName, o));
  const data = await lib.readFile(outName);
  const mime =
    o.fmt === "gif"
      ? "image/gif"
      : o.fmt === "webm"
        ? "video/webm"
        : "video/mp4";
  const blob = new Blob([data], { type: mime });
  try {
    await lib.deleteFile(inName);
    await lib.deleteFile(outName);
  } catch {
    /* best-effort cleanup of the virtual FS */
  }
  return { blob, outName };
}
