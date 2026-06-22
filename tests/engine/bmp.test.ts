import { describe, expect, it } from "vitest";
import { encodeBMP } from "@/lib/engine/encode";
import type { RawImage } from "@/lib/engine/types";

/**
 * Mirrors the reference's BMP guarantees: 24-bit BI_RGB header, 4-byte row
 * padding, BGR channel order, bottom-up row order, and alpha composited over
 * white.
 */
describe("encodeBMP", () => {
  // 2x2 image, RGBA top-to-bottom:
  //   (0,0) red opaque        (1,0) green opaque
  //   (0,1) blue opaque       (1,1) black @ 50% alpha -> 127 over white
  const img: RawImage = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 0, 0, 255, /* */ 0, 255, 0, 255,
      0, 0, 255, 255, /* */ 0, 0, 0, 128,
    ]),
  };
  const bmp = encodeBMP(img);
  const dv = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);

  it("writes the BM signature", () => {
    expect(bmp[0]).toBe(0x42);
    expect(bmp[1]).toBe(0x4d);
  });

  it("writes a correct file/DIB header", () => {
    // rowSize = floor((24*2+31)/32)*4 = 8; pixels = 8*2 = 16; total = 54+16 = 70
    expect(dv.getUint32(2, true)).toBe(70); // file size
    expect(dv.getUint32(10, true)).toBe(54); // pixel data offset
    expect(dv.getUint32(14, true)).toBe(40); // DIB header size
    expect(dv.getInt32(18, true)).toBe(2); // width
    expect(dv.getInt32(22, true)).toBe(2); // height
    expect(dv.getUint16(26, true)).toBe(1); // planes
    expect(dv.getUint16(28, true)).toBe(24); // bpp
    expect(dv.getUint32(30, true)).toBe(0); // BI_RGB
    expect(dv.getUint32(34, true)).toBe(16); // image size
    expect(dv.getInt32(38, true)).toBe(2835); // x ppm
    expect(dv.getInt32(42, true)).toBe(2835); // y ppm
  });

  it("orders rows bottom-up with BGR channels and 4-byte padding", () => {
    const px = bmp.slice(54); // pixel array
    // File row 0 = bottom source row (y=1): blue, then black@50% over white.
    expect([...px.slice(0, 8)]).toEqual([
      255, 0, 0, /* blue  -> B,G,R */ 127, 127, 127, /* black@.5 over white */
      0, 0, /* row padding */
    ]);
    // File row 1 = top source row (y=0): red, then green.
    expect([...px.slice(8, 16)]).toEqual([
      0, 0, 255, /* red   -> B,G,R */ 0, 255, 0, /* green -> B,G,R */
      0, 0, /* row padding */
    ]);
  });
});
