#!/usr/bin/env node
/**
 * Copies the browser-runtime assets FFmpeg.wasm needs — a UMD loader script,
 * its versioned worker chunk, and the WASM core (JS glue + .wasm binary) —
 * out of the pinned `@ffmpeg/ffmpeg` / `@ffmpeg/core` packages into
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
copy(
  join(coreRoot, "dist/esm/ffmpeg-core.js"),
  join(outDir, "ffmpeg-core/ffmpeg-core.js"),
);
copy(
  join(coreRoot, "dist/esm/ffmpeg-core.wasm"),
  join(outDir, "ffmpeg-core/ffmpeg-core.wasm"),
);

if (!existsSync(join(outDir, "ffmpeg/ffmpeg.js"))) {
  console.error("Vendoring failed: expected files are missing.");
  process.exit(1);
}
console.log("Done.");
