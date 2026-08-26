import type {
  ExifInfo,
  ImageFormat,
  ResampleMethod,
  VideoOptions,
} from "@/lib/engine/types";

export type Mode =
  | "convert"
  | "upscale"
  | "optimize"
  | "watermark"
  | "video"
  | "documents"
  | "pdftools";

export type StatusKind = "" | "work" | "err";

/** One row in the queue. Heavy browser objects (canvas, blob, object URLs) are
 *  held by reference; React updates replace the wrapping object, not the pixels. */
export interface QueueItem {
  id: number;
  name: string;
  kind: "image" | "video";
  // ---- source ----
  file?: File; // kept for video (and re-processing)
  canvas?: HTMLCanvasElement; // images only
  w: number;
  h: number;
  duration?: number; // video
  origSize: number;
  origType: string;
  exif: ExifInfo | null;
  thumb?: string; // dataURL (image thumb) or video poster
  // ---- result ----
  result?: string; // object URL
  resultBlob?: Blob;
  resultName?: string;
  resultSize?: number;
  resultKind?: Mode;
  outW?: number; // upscale output dims
  outH?: number;
  usedQ?: number; // optimize quality used
  // ---- persistence (signed in) ----
  jobId?: string; // jobs row id, set after recordJob
  saved?: boolean; // output uploaded to Storage
  saving?: boolean;
  // ---- status ----
  status: string;
  statusKind: StatusKind;
}

export interface ConvertOptions {
  fmt: ImageFormat;
  q: number; // 40..100 (percent)
}

export type UpscaleScale = "4k" | "1.5" | "2" | "3" | "4" | "custom";
// Upscale and Optimize can save to any of the Convert formats.
export type UpscaleFormat = ImageFormat;

export interface UpscaleUIOptions {
  scale: UpscaleScale;
  width: number; // custom target width (px)
  method: ResampleMethod;
  denoise: number; // 0..1
  clarity: number; // 0..1
  sharpen: number; // 0..1.5
  radius: number; // px
  fmt: UpscaleFormat;
}

export interface OptimizeUIOptions {
  mode: "quality" | "size";
  q: number; // 30..95 (percent)
  size: number; // target max KB
  fmt: ImageFormat;
  maxW: number; // cap width (px); 0 = none
}

/** Options for the Watermark (Gemini) removal tool. */
export interface WatermarkUIOptions {
  /** Output format. Defaults to PNG to keep the lossless removal intact. */
  fmt: ImageFormat;
  /** Output quality for lossy formats (40..100, percent). */
  q: number;
  /** Adaptive alpha-map fitting passed through to the engine. */
  adaptive: "auto" | "always" | "never";
}

export interface Options {
  convert: ConvertOptions;
  up: UpscaleUIOptions;
  op: OptimizeUIOptions;
  wm: WatermarkUIOptions;
  vid: VideoOptions;
}

export const DEFAULT_OPTIONS: Options = {
  convert: { fmt: "png", q: 90 },
  up: {
    scale: "4k",
    width: 3840,
    method: "lanczos",
    denoise: 0,
    clarity: 0.16,
    sharpen: 0.7,
    radius: 1,
    fmt: "png",
  },
  op: { mode: "quality", q: 75, size: 200, fmt: "avif", maxW: 0 },
  wm: { fmt: "png", q: 92, adaptive: "auto" },
  vid: {
    fmt: "mp4",
    q: 65,
    width: "orig",
    aspect: "keep",
    fps: "orig",
    start: 0,
    end: 0,
    mute: false,
  },
};

/** Input format chips shown on the dropzone. */
export const INPUTS = [
  "JPG",
  "PNG",
  "WEBP",
  "AVIF",
  "GIF",
  "BMP",
  "TIFF",
  "HEIC",
  "PDF",
] as const;

export const TAB_TITLES: Record<Mode, string> = {
  convert: "Drop images to convert",
  upscale: "Drop images to enhance",
  optimize: "Drop images to optimize",
  watermark: "Drop Gemini images to remove watermarks",
  video: "Drop videos to convert & enhance",
  documents: "Drop documents & spreadsheets to convert",
  pdftools: "Drop PDFs to edit",
};

/** One-line statement of what each tab is for, shown under the tab bar and as
 *  each tab button's tooltip — so the six tools read as distinct, not as an
 *  undifferentiated row of labels. */
export const TAB_DESCRIPTIONS: Record<Mode, string> = {
  convert: "Change an image's file format — no compression or resizing applied.",
  upscale: "Enlarge an image (up to 4K) with sharpening — for making images bigger.",
  optimize: "Shrink file size to a target quality or target KB — for making images smaller.",
  watermark: "Remove the visible Gemini watermark from an AI-generated image.",
  video: "Transcode, trim, crop, or mute a video clip.",
  documents: "Convert documents and spreadsheets — Word, Markdown, HTML, Excel, CSV, and more.",
  pdftools: "Merge, split, reorder, rotate, crop, and add page numbers to a PDF.",
};

export const VIDEO_EXT =
  /\.(mp4|webm|mov|mkv|avi|m4v|ogv|3gp|wmv|flv|mpg|mpeg|ts)$/i;

/** Bytes -> human string (matches the reference's fmtBytes). */
export function formatBytes(b: number): string {
  return b < 1024
    ? b + " B"
    : b < 1048576
      ? (b / 1024).toFixed(b < 10240 ? 1 : 0) + " KB"
      : (b / 1048576).toFixed(2) + " MB";
}

/** Seconds -> m:ss (matches the reference's dur). */
export function formatDuration(s: number | undefined): string {
  if (!s || !isFinite(s)) return "";
  const m = Math.floor(s / 60);
  const x = Math.round(s % 60);
  return `${m}:${String(x).padStart(2, "0")}`;
}
