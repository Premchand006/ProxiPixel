import { describe, expect, it } from "vitest";
import { detectExifJPEG } from "@/lib/engine/exif";

/**
 * Build a minimal JPEG: SOI + APP1/Exif with a little-endian IFD0 holding the
 * three tags ProxiPixel surfaces — Make (0x010F, camera), DateTime (0x0132,
 * date), and the GPS IFD pointer (0x8825).
 */
function jpegWithExifTags(tags: number[]): ArrayBuffer {
  const tiff: number[] = [
    0x49, 0x49, // "II" little-endian
    0x2a, 0x00, // 42
    0x08, 0x00, 0x00, 0x00, // IFD0 at offset 8
    tags.length & 0xff, (tags.length >> 8) & 0xff, // entry count
  ];
  for (const tag of tags) {
    tiff.push(tag & 0xff, (tag >> 8) & 0xff); // tag id (LE)
    tiff.push(0x02, 0x00); // type
    tiff.push(0x01, 0x00, 0x00, 0x00); // count
    tiff.push(0x00, 0x00, 0x00, 0x00); // value/offset (unused)
  }
  tiff.push(0x00, 0x00, 0x00, 0x00); // next-IFD offset = 0

  const exifPayload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0"
  const segLen = exifPayload.length + 2; // includes the 2 length bytes
  const bytes = [
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1
    (segLen >> 8) & 0xff, segLen & 0xff, // length (big-endian)
    ...exifPayload,
  ];
  return new Uint8Array(bytes).buffer;
}

describe("detectExifJPEG", () => {
  it("detects GPS, camera, and date tags", () => {
    const info = detectExifJPEG(
      jpegWithExifTags([0x010f, 0x0132, 0x8825]),
    );
    expect(info).not.toBeNull();
    expect(info).toEqual({
      hasGPS: true,
      hasCamera: true,
      hasDate: true,
      any: true,
    });
  });

  it("flags GPS-only files without falsely reporting camera/date", () => {
    const info = detectExifJPEG(jpegWithExifTags([0x8825]));
    expect(info).toEqual({
      hasGPS: true,
      hasCamera: false,
      hasDate: false,
      any: true,
    });
  });

  it("returns all-false for a JPEG with no Exif APP1", () => {
    // SOI immediately followed by SOS (0xFFDA) -> parser stops, no tags.
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x00, 0x00, 0x00])
      .buffer;
    expect(detectExifJPEG(buf)).toEqual({
      hasGPS: false,
      hasCamera: false,
      hasDate: false,
      any: false,
    });
  });

  it("returns null for non-JPEG input", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      .buffer;
    expect(detectExifJPEG(png)).toBeNull();
  });
});
