/**
 * Runtime loaders for the browser-only media engine.
 *
 * gifenc, utif, jspdf, and pdfjs-dist are real npm dependencies now (see
 * package.json) — call sites `import()` them directly and code-split
 * naturally, so the core PNG/JPEG/WebP/BMP path still never pulls them in.
 *
 * FFmpeg.wasm is the one exception: its loader (`ffmpeg.js`) and core
 * (`ffmpeg-core.js` + `.wasm`) are fetched by URL at runtime — that's how
 * `@ffmpeg/ffmpeg` itself works, not something ProxiPixel chose — so they
 * can't just be `import()`ed. `VENDOR` points those fetches at same-origin
 * copies under `public/vendor/`, produced from the pinned package versions by
 * `tools/vendor-assets.mjs` on `postinstall`. Nothing in the engine fetches
 * code from a third-party origin at runtime any more.
 */
export const VENDOR = {
  ffmpegBase: "/vendor/ffmpeg",
  ffcoreBase: "/vendor/ffmpeg-core",
  // pdf.js's worker is also served from here rather than bundled — webpack's
  // emitted copy gets re-minified by Next into invalid JS (see
  // tools/vendor-assets.mjs).
  pdfjsWorker: "/vendor/pdfjs/pdf.worker.min.mjs",
} as const;

/** Inject a UMD `<script>` and resolve once it has loaded (browser only). */
export function injectScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("blocked: " + src));
    document.head.appendChild(s);
  });
}

/** Fetch a URL and re-wrap it as a same-origin blob URL with an explicit MIME. */
export async function toBlobURL(url: string, type: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("fetch " + r.status);
  const b = await r.blob();
  return URL.createObjectURL(new Blob([b], { type }));
}

/** Read a Blob (or URL) into bytes for FFmpeg's virtual filesystem. */
export async function fetchFile(input: Blob | string): Promise<Uint8Array> {
  if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
  const r = await fetch(input);
  return new Uint8Array(await r.arrayBuffer());
}
