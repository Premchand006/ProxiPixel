#!/usr/bin/env node
/**
 * Derives every favicon / app icon from public/logo.png:
 *
 *   app/favicon.ico            16, 32 and 48 px (PNG-in-ICO)
 *   app/icon.png               192 px  (Next file convention → <link rel="icon">)
 *   app/apple-icon.png         180 px  (→ <link rel="apple-touch-icon">)
 *   public/icon-192.png        web app manifest
 *   public/icon-512.png        web app manifest, Organization logo, OG card
 *   public/icon-maskable-512.png  manifest "maskable" (logo inside the 80% safe zone)
 *
 * The source logo is a 563×603 PNG of ~310 KB, far too heavy to serve as a
 * favicon. Outputs are committed, so this only needs re-running when the logo
 * changes: `node tools/generate-icons.mjs`.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public/logo.png");

const meta = await sharp(src).metadata();
// The logo sits on an opaque, near-white background; sample a corner so the
// padding added around it is indistinguishable from the original.
const { data: corner } = await sharp(src)
  .extract({ left: 2, top: 2, width: 1, height: 1 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };

/** Square master: pad the short side so nothing is cropped. */
const side = Math.max(meta.width, meta.height);
const square = await sharp(src)
  .extend({
    top: Math.floor((side - meta.height) / 2),
    bottom: Math.ceil((side - meta.height) / 2),
    left: Math.floor((side - meta.width) / 2),
    right: Math.ceil((side - meta.width) / 2),
    background,
  })
  .flatten({ background })
  .png()
  .toBuffer();

const png = (size) =>
  sharp(square)
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toBuffer();

async function write(rel, buf) {
  writeFileSync(join(root, rel), buf);
  console.log(`${rel.padEnd(30)} ${(buf.length / 1024).toFixed(1)} KB`);
}

await write("app/icon.png", await png(192));
await write("app/apple-icon.png", await png(180));
await write("public/icon-192.png", await png(192));
await write("public/icon-512.png", await png(512));

// Maskable: launchers may crop to a circle, so keep the logo within the
// central 80% and fill the rest with the background colour.
const inner = Math.round(512 * 0.72);
const pad = Math.floor((512 - inner) / 2);
await write(
  "public/icon-maskable-512.png",
  await sharp(square)
    .resize(inner, inner, { kernel: "lanczos3" })
    .extend({
      top: pad,
      bottom: 512 - inner - pad,
      left: pad,
      right: 512 - inner - pad,
      background,
    })
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toBuffer(),
);

// ICO container holding PNG images (supported by every current browser).
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let offset = header.length + dir.length;
sizes.forEach((s, i) => {
  const o = i * 16;
  dir.writeUInt8(s, o); // width
  dir.writeUInt8(s, o + 1); // height
  dir.writeUInt8(0, o + 2); // palette
  dir.writeUInt8(0, o + 3); // reserved
  dir.writeUInt16LE(1, o + 4); // colour planes
  dir.writeUInt16LE(32, o + 6); // bits per pixel
  dir.writeUInt32LE(images[i].length, o + 8);
  dir.writeUInt32LE(offset, o + 12);
  offset += images[i].length;
});
await write("app/favicon.ico", Buffer.concat([header, dir, ...images]));
