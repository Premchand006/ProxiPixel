#!/usr/bin/env node
/**
 * Copies the browser-runtime assets FFmpeg.wasm needs — a UMD loader script,
 * its versioned worker chunk, and the WASM core (JS glue + .wasm binary) —
 * plus pdf.js's worker script out of the pinned `@ffmpeg/ffmpeg` /
 * `@ffmpeg/core` / `pdfjs-dist` packages into
 * `public/vendor/`, so the app serves them same-origin instead of fetching
 * from a third-party CDN (jsdelivr/unpkg) at runtime in every visitor's
 * browser. Runs on `postinstall`, so it's always current with whatever
 * version pnpm-lock.yaml pinned; the copied output is gitignored — the
 * pinned package version + lockfile integrity hash is the source of truth,
 * not these bytes.
 *
 * Deliberately plain `fs` copies of the dist files (not deep `import`/
 * `require` of them) because both packages' `exports` maps only expose their
 * main entry point, not the sibling asset files this script needs — and,
 * true of both packages, don't expose `./package.json` either. So: resolve
 * the (exported) main entry, then walk up from it. Both packages publish the
 * same shape — `<root>/dist/{esm,umd}/<file>` — so the root is always three
 * directories above the resolved entry file, regardless of whether Node's
 * CJS resolver picked the esm or umd condition.
 */
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function pkgRoot(name) {
  const entry = require.resolve(name);
  return dirname(dirname(dirname(entry)));
}

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`  vendored ${to}`);
}

const outDir = join(process.cwd(), "public", "vendor");

const ffmpegRoot = pkgRoot("@ffmpeg/ffmpeg");
const coreRoot = pkgRoot("@ffmpeg/core");

console.log("Vendoring FFmpeg.wasm assets into public/vendor/ ...");
copy(join(ffmpegRoot, "dist/umd/ffmpeg.js"), join(outDir, "ffmpeg/ffmpeg.js"));
copy(
  join(ffmpegRoot, "dist/umd/814.ffmpeg.js"),
  join(outDir, "ffmpeg/814.ffmpeg.js"),
);
// UMD core, not ESM: the class worker loads it with `importScripts()`, and
// since @ffmpeg/ffmpeg 0.12.11 its `import()` fallback for ESM cores is
// compiled into a stub that always throws "Cannot find module".
copy(
  join(coreRoot, "dist/umd/ffmpeg-core.js"),
  join(outDir, "ffmpeg-core/ffmpeg-core.js"),
);
copy(
  join(coreRoot, "dist/umd/ffmpeg-core.wasm"),
  join(outDir, "ffmpeg-core/ffmpeg-core.wasm"),
);

// pdf.js worker — served as a static file rather than bundled via
// `new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url)`: webpack
// emits that as an asset, and Next's production minifier then re-minifies it
// and hoists a stray `"use strict"` in pdf.js's bundled OpenJPEG decoder into
// a function with default params — a SyntaxError that kills the worker (and
// its fake-worker fallback). Mozilla's own pre-minified build is used as-is.
console.log("Vendoring pdf.js worker into public/vendor/ ...");
const pdfjsBuild = dirname(require.resolve("pdfjs-dist"));
copy(
  join(pdfjsBuild, "pdf.worker.min.mjs"),
  join(outDir, "pdfjs/pdf.worker.min.mjs"),
);

if (
  !existsSync(join(outDir, "ffmpeg/ffmpeg.js")) ||
  !existsSync(join(outDir, "pdfjs/pdf.worker.min.mjs"))
) {
  console.error("Vendoring failed: expected files are missing.");
  process.exit(1);
}
console.log("Done.");
