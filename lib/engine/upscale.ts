import type { RawImage, ResampleMethod, UpscaleOptions } from "./types";
import { cloneRawImage } from "./raster";

/** Guard against tab-freezing output sizes (from the reference). */
const MAXDIM = 8000;
/** Above this pixel count, fall back from JS Lanczos to the fast resampler. */
const LANCZOS_PIXEL_CAP = 24_000_000;

/** 4K UHD long-edge target (3840×2160). The default upscale fills this. */
export const UHD_4K_LONG_EDGE = 3840;

/**
 * sRGB(0..255) → linear-light(0..255). Resampling and blurring should average
 * light *linearly* — averaging gamma-encoded values darkens edges and dulls
 * highlights. This LUT + {@link lin2srgb} let the pipeline work in linear light.
 */
const SRGB_TO_LINEAR = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = 255 * (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  }
  return t;
})();

/** linear-light(0..255) → sRGB(0..255), via a fine LUT (4096 buckets) for speed. */
const LINEAR_TO_SRGB = (() => {
  const N = 4096;
  const t = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const c = i / N; // 0..1 linear
    t[i] =
      255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  }
  return t;
})();
function lin2srgb(v: number): number {
  let idx = (v / 255) * 4096;
  if (idx < 0) idx = 0;
  else if (idx > 4096) idx = 4096;
  return LINEAR_TO_SRGB[idx | 0];
}

/**
 * Separable box blur over RGB (alpha untouched), edge-clamped. Returns the
 * blurred channels as floats so callers can compute high-precision differences.
 * Ported verbatim from the reference.
 */
export function boxBlurSeparable(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
): Float32Array {
  const tmp = new Float32Array(data.length);
  const out = new Float32Array(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0,
        b = 0,
        c = 0,
        n = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
        const j = (y * w + xx) * 4;
        a += data[j];
        b += data[j + 1];
        c += data[j + 2];
        n++;
      }
      const i = (y * w + x) * 4;
      tmp[i] = a / n;
      tmp[i + 1] = b / n;
      tmp[i + 2] = c / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0,
        b = 0,
        c = 0,
        n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        const j = (yy * w + x) * 4;
        a += tmp[j];
        b += tmp[j + 1];
        c += tmp[j + 2];
        n++;
      }
      const i = (y * w + x) * 4;
      out[i] = a / n;
      out[i + 1] = b / n;
      out[i + 2] = c / n;
    }
  return out;
}

/** Separable box blur over a Float32 RGB buffer (alpha untouched), edge-clamped. */
function boxBlurSeparableF32(
  src: Float32Array,
  w: number,
  h: number,
  r: number,
): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0,
        b = 0,
        c = 0,
        n = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
        const j = (y * w + xx) * 4;
        a += src[j];
        b += src[j + 1];
        c += src[j + 2];
        n++;
      }
      const i = (y * w + x) * 4;
      tmp[i] = a / n;
      tmp[i + 1] = b / n;
      tmp[i + 2] = c / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0,
        b = 0,
        c = 0,
        n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        const j = (yy * w + x) * 4;
        a += tmp[j];
        b += tmp[j + 1];
        c += tmp[j + 2];
        n++;
      }
      const i = (y * w + x) * 4;
      out[i] = a / n;
      out[i + 1] = b / n;
      out[i + 2] = c / n;
    }
  return out;
}

/**
 * Smooth (≈ Gaussian) blur via three box-blur passes — the box-filter halos
 * that a single pass leaves around edges average out, so unsharp masking built
 * on it sharpens cleanly instead of ringing.
 */
function gaussianBlurRGB(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
): Float32Array {
  let b = boxBlurSeparable(data, w, h, r);
  b = boxBlurSeparableF32(b, w, h, r);
  b = boxBlurSeparableF32(b, w, h, r);
  return b;
}

/**
 * Unsharp mask (in place), Gaussian-based with an optional threshold. Pixels
 * whose local contrast is below `threshold` are left alone, so flat areas and
 * sensor/compression noise are not amplified while real edges get crisper.
 */
export function applyUnsharp(
  img: RawImage,
  amount: number,
  radius: number,
  threshold = 0,
): RawImage {
  if (amount <= 0) return img;
  const { width: w, height: h, data } = img;
  const blur = gaussianBlurRGB(data, w, h, radius || 1);
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const diff = data[i + c] - blur[i + c];
      if (diff <= threshold && diff >= -threshold) continue;
      const v = data[i + c] + amount * diff;
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  return img;
}

/** Gentle edge-preserving-ish denoise: blend toward a radius-1 blur. Verbatim. */
export function applyDenoise(img: RawImage, amount: number): RawImage {
  if (amount <= 0) return img;
  const { width: w, height: h, data } = img;
  const blur = boxBlurSeparable(data, w, h, 1);
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) {
      data[i + c] = data[i + c] * (1 - amount) + blur[i + c] * amount;
    }
  return img;
}

/** Local-contrast "clarity": large-radius unsharp at 1.1x strength. Verbatim. */
export function applyClarity(img: RawImage, amount: number): RawImage {
  if (amount <= 0) return img;
  const { width: w, height: h, data } = img;
  const blur = boxBlurSeparable(data, w, h, 6);
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] + amount * 1.1 * (data[i + c] - blur[i + c]);
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  return img;
}

/**
 * High-quality separable Lanczos (a=3) resampler — sharper than canvas
 * resizing. Weights are normalized per output sample, so a constant-color
 * source maps to the same constant color. Ported verbatim (canvas I/O replaced
 * by `RawImage` so it is pure and testable).
 */
export function lanczosResize(src: RawImage, dstW: number, dstH: number): RawImage {
  const sw = src.width;
  const sh = src.height;
  const sdata = src.data;
  const A = 3;
  const sinc = (x: number): number => {
    if (x === 0) return 1;
    const p = Math.PI * x;
    return Math.sin(p) / p;
  };
  const kernel = (x: number): number => {
    x = Math.abs(x);
    return x >= A ? 0 : sinc(x) * sinc(x / A);
  };
  const build = (
    dstLen: number,
    srcLen: number,
  ): Array<Array<[number, number]>> => {
    const ratio = srcLen / dstLen;
    const scale = ratio > 1 ? 1 / ratio : 1;
    const support = A / scale;
    const rows: Array<Array<[number, number]>> = [];
    for (let i = 0; i < dstLen; i++) {
      const center = (i + 0.5) * ratio - 0.5;
      const s0 = Math.max(0, Math.floor(center - support));
      const s1 = Math.min(srcLen - 1, Math.ceil(center + support));
      const ws: Array<[number, number]> = [];
      let sum = 0;
      for (let s = s0; s <= s1; s++) {
        const k = kernel((s - center) * scale);
        if (k !== 0) {
          ws.push([s, k]);
          sum += k;
        }
      }
      for (const w of ws) w[1] /= sum || 1;
      rows.push(ws);
    }
    return rows;
  };
  const wx = build(dstW, sw);
  const wy = build(dstH, sh);

  const tmp = new Float32Array(dstW * sh * 4);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < dstW; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (const [s, wt] of wx[x]) {
        const j = (y * sw + s) * 4;
        r += sdata[j] * wt;
        g += sdata[j + 1] * wt;
        b += sdata[j + 2] * wt;
        a += sdata[j + 3] * wt;
      }
      const k = (y * dstW + x) * 4;
      tmp[k] = r;
      tmp[k + 1] = g;
      tmp[k + 2] = b;
      tmp[k + 3] = a;
    }

  const od = new Uint8ClampedArray(dstW * dstH * 4);
  for (let x = 0; x < dstW; x++)
    for (let y = 0; y < dstH; y++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (const [s, wt] of wy[y]) {
        const j = (s * dstW + x) * 4;
        r += tmp[j] * wt;
        g += tmp[j + 1] * wt;
        b += tmp[j + 2] * wt;
        a += tmp[j + 3] * wt;
      }
      const k = (y * dstW + x) * 4;
      // Uint8ClampedArray rounds + clamps on assignment.
      od[k] = r;
      od[k + 1] = g;
      od[k + 2] = b;
      od[k + 3] = a;
    }

  return { width: dstW, height: dstH, data: od };
}

/** Per-output-sample Lanczos (a=3) weights along one axis. Normalized so a flat
 *  field stays flat. Shared by the linear-light resampler. */
function buildLanczosWeights(
  dstLen: number,
  srcLen: number,
): Array<Array<[number, number]>> {
  const A = 3;
  const sinc = (x: number): number => {
    if (x === 0) return 1;
    const p = Math.PI * x;
    return Math.sin(p) / p;
  };
  const kernel = (x: number): number => {
    x = Math.abs(x);
    return x >= A ? 0 : sinc(x) * sinc(x / A);
  };
  const ratio = srcLen / dstLen;
  const scale = ratio > 1 ? 1 / ratio : 1;
  const support = A / scale;
  const rows: Array<Array<[number, number]>> = [];
  for (let i = 0; i < dstLen; i++) {
    const center = (i + 0.5) * ratio - 0.5;
    const s0 = Math.max(0, Math.floor(center - support));
    const s1 = Math.min(srcLen - 1, Math.ceil(center + support));
    const ws: Array<[number, number]> = [];
    let sum = 0;
    for (let s = s0; s <= s1; s++) {
      const k = kernel((s - center) * scale);
      if (k !== 0) {
        ws.push([s, k]);
        sum += k;
      }
    }
    for (const w of ws) w[1] /= sum || 1;
    rows.push(ws);
  }
  return rows;
}

/**
 * Gamma-correct (linear-light) Lanczos resample. Identical kernel to
 * {@link lanczosResize}, but RGB is converted to linear light before sampling
 * and back to sRGB after — so high-contrast edges keep their brightness instead
 * of darkening, which is the main visible quality win when enlarging to 4K.
 */
export function lanczosResizeLinear(
  src: RawImage,
  dstW: number,
  dstH: number,
): RawImage {
  const sw = src.width;
  const sh = src.height;
  const sd = src.data;

  // Source in linear light (RGB via LUT; alpha is already linear).
  const lin = new Float32Array(sw * sh * 4);
  for (let i = 0; i < lin.length; i += 4) {
    lin[i] = SRGB_TO_LINEAR[sd[i]];
    lin[i + 1] = SRGB_TO_LINEAR[sd[i + 1]];
    lin[i + 2] = SRGB_TO_LINEAR[sd[i + 2]];
    lin[i + 3] = sd[i + 3];
  }

  const wx = buildLanczosWeights(dstW, sw);
  const wy = buildLanczosWeights(dstH, sh);

  const tmp = new Float32Array(dstW * sh * 4);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < dstW; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (const [s, wt] of wx[x]) {
        const j = (y * sw + s) * 4;
        r += lin[j] * wt;
        g += lin[j + 1] * wt;
        b += lin[j + 2] * wt;
        a += lin[j + 3] * wt;
      }
      const k = (y * dstW + x) * 4;
      tmp[k] = r;
      tmp[k + 1] = g;
      tmp[k + 2] = b;
      tmp[k + 3] = a;
    }

  const od = new Uint8ClampedArray(dstW * dstH * 4);
  for (let x = 0; x < dstW; x++)
    for (let y = 0; y < dstH; y++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (const [s, wt] of wy[y]) {
        const j = (s * dstW + x) * 4;
        r += tmp[j] * wt;
        g += tmp[j + 1] * wt;
        b += tmp[j + 2] * wt;
        a += tmp[j + 3] * wt;
      }
      const k = (y * dstW + x) * 4;
      od[k] = lin2srgb(r);
      od[k + 1] = lin2srgb(g);
      od[k + 2] = lin2srgb(b);
      od[k + 3] = a;
    }

  return { width: dstW, height: dstH, data: od };
}

/** Single-pass bilinear resample (edge-clamped). */
function bilinearResize(src: RawImage, dstW: number, dstH: number): RawImage {
  const { width: sw, height: sh, data } = src;
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  const sxr = sw / dstW;
  const syr = sh / dstH;
  for (let y = 0; y < dstH; y++) {
    const fy = (y + 0.5) * syr - 0.5;
    let y0 = Math.floor(fy);
    const wy = fy - y0;
    if (y0 < 0) y0 = 0;
    if (y0 >= sh) y0 = sh - 1;
    let y1 = y0 + 1;
    if (y1 >= sh) y1 = sh - 1;
    for (let x = 0; x < dstW; x++) {
      const fx = (x + 0.5) * sxr - 0.5;
      let x0 = Math.floor(fx);
      const wx = fx - x0;
      if (x0 < 0) x0 = 0;
      if (x0 >= sw) x0 = sw - 1;
      let x1 = x0 + 1;
      if (x1 >= sw) x1 = sw - 1;
      const i00 = (y0 * sw + x0) * 4;
      const i01 = (y0 * sw + x1) * 4;
      const i10 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[i00 + c] * (1 - wx) + data[i01 + c] * wx;
        const bot = data[i10 + c] * (1 - wx) + data[i11 + c] * wx;
        out[o + c] = top * (1 - wy) + bot * wy;
      }
    }
  }
  return { width: dstW, height: dstH, data: out };
}

/**
 * Pure equivalent of the reference's "smooth" path. The reference used the
 * browser's high-quality canvas scaler stepped by halving/doubling; that is not
 * reproducible byte-for-byte in JS, so we step the same way using bilinear.
 */
function smoothResize(
  src: RawImage,
  dstW: number,
  dstH: number,
  baseW: number,
  baseH: number,
): RawImage {
  let cur = src;
  let tw = baseW;
  while (Math.abs(tw - dstW) > 1) {
    const stepW = dstW > tw ? Math.min(dstW, tw * 2) : Math.max(dstW, tw / 2);
    const stepH = Math.round(baseH * (stepW / baseW));
    cur = bilinearResize(cur, Math.round(stepW), stepH);
    tw = stepW;
  }
  if (cur.width !== dstW || cur.height !== dstH) {
    cur = bilinearResize(cur, dstW, dstH);
  }
  return cur;
}

/** Unsharp threshold (0..255): edges below this are left alone so the final
 *  sharpen doesn't amplify flat-area noise or interpolation texture. */
const SHARPEN_THRESHOLD = 2;

/**
 * Full pixel-clarity pipeline: denoise → gamma-correct resample → clarity →
 * thresholded Gaussian sharpen. Operates on a copy of the source. Output width
 * is clamped to {@link MAXDIM}; Lanczos downgrades to the fast resampler above
 * {@link LANCZOS_PIXEL_CAP}.
 */
export function enhance(src: RawImage, o: UpscaleOptions): RawImage {
  let c = cloneRawImage(src);
  // Denoise the (smaller) source first so enlargement doesn't magnify grain.
  if (o.denoise > 0) applyDenoise(c, o.denoise);

  let reqW = Math.max(1, Math.round(o.targetW));
  if (reqW > MAXDIM) reqW = MAXDIM;
  const dstW = reqW;
  const dstH = Math.max(1, Math.round(src.height * (dstW / src.width)));
  const method: ResampleMethod =
    dstW * dstH > LANCZOS_PIXEL_CAP && o.method === "lanczos"
      ? "smooth"
      : o.method;

  if (dstW !== src.width) {
    c =
      method === "lanczos"
        ? lanczosResizeLinear(c, dstW, dstH)
        : smoothResize(c, dstW, dstH, src.width, src.height);
  }

  // Local contrast first (pre-sharpen), then a crisp thresholded edge pass.
  if (o.clarity > 0) applyClarity(c, o.clarity);
  if (o.sharpen > 0) applyUnsharp(c, o.sharpen, o.radius, SHARPEN_THRESHOLD);
  return c;
}
