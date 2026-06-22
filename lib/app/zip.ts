import { CDN, injectScript } from "@/lib/engine/loaders";

interface JSZipInstance {
  file(name: string, data: Blob): void;
  generateAsync(opts: { type: "blob" }): Promise<Blob>;
}
interface JSZipConstructor {
  new (): JSZipInstance;
}

declare global {
  interface Window {
    JSZip?: JSZipConstructor;
  }
}

async function loadJSZip(): Promise<JSZipConstructor> {
  if (!window.JSZip) await injectScript(CDN.jszip);
  if (!window.JSZip) throw new Error("ZIP support didn’t load");
  return window.JSZip;
}

/**
 * Bundle finished results into a single .zip (CDN-loaded JSZip). De-duplicates
 * colliding filenames with a numeric suffix, matching the reference.
 */
export async function zipResults(
  results: Array<{ name: string; blob: Blob }>,
): Promise<Blob> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const used: Record<string, number> = {};
  for (const it of results) {
    let name = it.name;
    if (used[name]) {
      const dot = name.lastIndexOf(".");
      name = name.slice(0, dot) + "_" + used[it.name] + name.slice(dot);
    }
    used[it.name] = (used[it.name] || 0) + 1;
    zip.file(name, it.blob);
  }
  return zip.generateAsync({ type: "blob" });
}
