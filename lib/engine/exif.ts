import type { ExifInfo } from "./types";

/**
 * Inspect a JPEG's APP1/Exif block to report what metadata the *source* file
 * carried. ProxiPixel always re-encodes through a canvas, which drops metadata
 * entirely; this exists only so the UI can tell the user what was removed
 * (notably GPS location).
 *
 * Returns `null` if the buffer is not a JPEG. Ported verbatim from the
 * reference's `detectExifJPEG`.
 */
export function detectExifJPEG(buf: ArrayBuffer): ExifInfo | null {
  const dv = new DataView(buf);
  if (dv.getUint16(0) !== 0xffd8) return null; // not a JPEG
  let off = 2;
  while (off < dv.byteLength - 4) {
    if (dv.getUint8(off) !== 0xff) break;
    const marker = dv.getUint8(off + 1);
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end
    const len = dv.getUint16(off + 2);
    if (marker === 0xe1) {
      // APP1
      const s = off + 4;
      if (dv.getUint32(s) === 0x45786966) {
        // "Exif"
        const tiff = s + 6;
        const le = dv.getUint16(tiff) === 0x4949; // II = little-endian
        const u16 = (o: number): number => dv.getUint16(o, le);
        const u32 = (o: number): number => dv.getUint32(o, le);
        const ifd0 = tiff + u32(tiff + 4);
        const n = u16(ifd0);
        const tags = new Set<number>();
        for (let i = 0; i < n; i++) tags.add(u16(ifd0 + 2 + i * 12));
        return {
          hasGPS: tags.has(0x8825),
          hasCamera: tags.has(0x010f) || tags.has(0x0110),
          hasDate: tags.has(0x0132) || tags.has(0x8769),
          any: tags.size > 0,
        };
      }
    }
    off += 2 + len;
  }
  return { hasGPS: false, hasCamera: false, hasDate: false, any: false };
}
