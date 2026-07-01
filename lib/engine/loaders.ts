/**
 * Runtime loaders for the optional, CDN-hosted libraries. Faithful to the
 * reference single-file app: heavy encoders/decoders are fetched on first use
 * rather than bundled, so the core PNG/JPEG/WebP/BMP path never depends on
 * them. Versions are pinned to the ones the reference was tested against.
 *
 * Phase 7 may revisit this (e.g. self-host or npm-bundle) for offline/strict
 * CSP deploys; URLs are centralized here to make that a one-file change.
 */
export const CDN = {
  gifenc: "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js",
  utif: "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js",
  jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  pdfjs: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.mjs",
  pdfjsWorker:
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs",
  ffmpegBase: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd",
  // ESM core: @ffmpeg/ffmpeg creates the worker as a module worker whenever a
  // classWorkerURL is supplied, and a module worker has no `importScripts` — it
  // falls back to `import(coreURL)`, which only works on the ESM core build.
  // (The UMD core throws "failed to import ffmpeg-core.js" there.)
  ffcoreBase: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm",
} as const;

/**
 * Dynamic-import an ESM module from a URL. The `webpackIgnore` magic comment
 * keeps the bundler from trying to resolve the CDN specifier at build time.
 */
export async function loadModule<T>(url: string): Promise<T> {
  return (await import(/* webpackIgnore: true */ url)) as T;
}

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
