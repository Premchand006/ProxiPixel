/**
 * Content-aware watermark reconstruction ("visual re-imagination").
 *
 * The vendored Gemini engine removes the logo by *reverse alpha blending* —
 * solving `original = (watermarked − α·logo) / (1 − α)`. That works only when the
 * underlying pixels survive the blend. Where Gemini stamps a near-opaque white
 * sparkle onto a dark or busy background the original detail is destroyed (α→1),
 * the division by `(1 − α)` amplifies every error, and you get the tell-tale
 * gray rectangle with a ghost of the star still inside it.
 *
 * This module takes the opposite, strictly-better approach for that case: it
 * does not try to recover the lost pixels, it *reconstructs* the background that
 * belongs there. It (1) finds the watermark by its own bright cluster in the
 * bottom-right corner, (2) builds a soft, feathered mask of every pixel the logo
 * touched (core + anti-aliased halo), (3) fills the hole with a multi-resolution
 * pull–push interpolation that follows the surrounding color and gradient, and
 * (4) optionally transfers high-frequency texture from a clean neighbouring patch
 * so a patterned background reads as continuous rather than smeared.
 *
 * Everything here is DOM-free and operates on `{ width, height, data }` (an
 * ImageData-shaped object with an RGBA `Uint8ClampedArray`), so it runs in the
 * browser engine bridge and in plain Node tests unchanged.
 */

const REC = 0.299;
const GEC = 0.587;
const BEC = 0.114;

/** Rec.601 luminance of the pixel at byte offset `i`. */
export function lumAt(d, i) {
  return REC * d[i] + GEC * d[i + 1] + BEC * d[i + 2];
}

function median(values) {
  if (!values.length) return 0;
  const s = Float64Array.from(values).sort();
  return s[s.length >> 1];
}

function percentile(values, p) {
  if (!values.length) return 0;
  const s = Float64Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Peak and mean absolute luminance deviation from `bg` over a box. Used to gate
 * detection and, in the adapter, to decide whether the reconstruction beats the
 * engine's own output.
 */
export function regionResidual(data, W, H, box, bg) {
  let peak = 0;
  let sum = 0;
  let n = 0;
  const x1 = Math.min(W, box.x + box.w);
  const y1 = Math.min(H, box.y + box.h);
  for (let y = Math.max(0, box.y); y < y1; y++) {
    for (let x = Math.max(0, box.x); x < x1; x++) {
      const dv = Math.abs(lumAt(data, (y * W + x) * 4) - bg);
      if (dv > peak) peak = dv;
      sum += dv;
      n++;
    }
  }
  return { peak, mean: n ? sum / n : 0 };
}

/**
 * Locate a bright Gemini sparkle in the bottom-right corner of `img` and build a
 * soft removal mask for it. Returns null when no compact, logo-like bright
 * cluster is present (so a clean or watermark-free image is left untouched).
 *
 * The returned `mask` is a Float32 alpha (0 = clean background, 1 = fully
 * watermark) covering a `window` rectangle that is the cluster's bounding box
 * padded with clean context for the fill to sample.
 */
export function detectCornerWatermark(img, opts = {}) {
  const { width: W, height: H, data } = img;
  const minDim = Math.min(W, H);
  const cornerFrac = opts.cornerFrac ?? 0.22;
  const corner = Math.max(140, Math.min(620, Math.round(minDim * cornerFrac)));
  const cx0 = Math.max(0, W - corner);
  const cy0 = Math.max(0, H - corner);
  const cornerArea = (W - cx0) * (H - cy0);

  // Robust local background of the whole corner. The damask/vignette is dark and
  // dominant; the sparkle is a small, bright minority, so the median ignores it.
  const cornerLum = [];
  for (let y = cy0; y < H; y++)
    for (let x = cx0; x < W; x++) cornerLum.push(lumAt(data, (y * W + x) * 4));
  const cornerBg = median(cornerLum);
  const cornerMad = median(cornerLum.map((v) => Math.abs(v - cornerBg)));
  const brightT = Math.max(7, cornerMad * 4);

  // Peak excess over the corner. The Gemini sparkle is a near-white stamp, so on
  // any normal background it is by far the brightest thing present.
  let peakExcess = 0;
  for (let y = cy0; y < H; y++)
    for (let x = cx0; x < W; x++) {
      const ex = lumAt(data, (y * W + x) * 4) - cornerBg;
      if (ex > peakExcess) peakExcess = ex;
    }
  if (peakExcess < (opts.minPeakExcess ?? 26)) return null; // no bright logo here

  // CORE detection. Decorative backgrounds (damask filigree, light vignettes)
  // routinely clear a low "bright" threshold, which would swallow the whole
  // corner. The logo's white *core* sits far above that, so we locate the
  // cluster from pixels near the peak only — this is what isolates the star from
  // the ornamentation around it.
  const coreT = Math.max(brightT * 2.5, peakExcess * 0.45);
  const xs = [];
  const ys = [];
  for (let y = cy0; y < H; y++) {
    for (let x = cx0; x < W; x++) {
      if (lumAt(data, (y * W + x) * 4) - cornerBg > coreT) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  const minBright = opts.minBrightPix ?? 24;
  if (xs.length < minBright) return null;
  if (xs.length > cornerArea * 0.4) return null; // corner is broadly bright, not a logo

  // Cluster centre/extent via median + a high percentile of the spread — robust
  // to a few stray bright background specks.
  const cx = Math.round(median(xs));
  const cy = Math.round(median(ys));
  const extent = Math.max(
    percentile(
      xs.map((x) => Math.abs(x - cx)),
      0.9,
    ),
    percentile(
      ys.map((y) => Math.abs(y - cy)),
      0.9,
    ),
  );
  // The visible logo (with its anti-aliased points) extends a little past the
  // bright core; pad the core extent to cover it.
  const R = Math.max(18, Math.round(extent * 1.25 + 6));
  if (R > minDim * 0.16) return null; // implausibly large for a corner stamp

  // Working window: the logo box padded with clean surroundings the fill samples.
  const pad = Math.max(18, Math.round(R * 0.9));
  const wx0 = Math.max(0, cx - R - pad);
  const wy0 = Math.max(0, cy - R - pad);
  const wx1 = Math.min(W, cx + R + pad + 1);
  const wy1 = Math.min(H, cy + R + pad + 1);
  const ww = wx1 - wx0;
  const wh = wy1 - wy0;

  // Soft mask from brightness excess, gated to a disc around the star so nearby
  // background ornamentation is never swept in. The smoothstep captures the
  // anti-aliased edge; a grayscale dilation + feather then extend it over the
  // faint halo the logo casts just outside its core (where reverse-blend rings).
  const tLow = Math.max(brightT, peakExcess * 0.05);
  const tHigh = Math.max(tLow + 2, peakExcess * 0.35);
  const gateInner = R * 1.15;
  const gateOuter = R * 1.85;
  const raw = new Float32Array(ww * wh);
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const px = wx0 + x;
      const py = wy0 + y;
      const ex = lumAt(data, (py * W + px) * 4) - cornerBg;
      const dist = Math.hypot(px - cx, py - cy);
      const gate = 1 - smoothstep(gateInner, gateOuter, dist);
      raw[y * ww + x] = smoothstep(tLow, tHigh, ex) * gate;
    }
  }
  const dil = Math.max(2, Math.round(R * 0.16));
  const dilated = grayscaleDilate(raw, ww, wh, dil);
  const mask = boxBlur(dilated, ww, wh, Math.max(2, Math.round(R * 0.12)));

  return {
    window: { x: wx0, y: wy0, w: ww, h: wh },
    mask,
    cornerBg,
    brightT,
    cluster: { cx, cy, R },
    box: {
      x: Math.max(0, cx - R - dil),
      y: Math.max(0, cy - R - dil),
      w: Math.min(W, cx + R + dil + 1) - Math.max(0, cx - R - dil),
      h: Math.min(H, cy + R + dil + 1) - Math.max(0, cy - R - dil),
    },
  };
}

/** Grayscale (max) dilation by a square radius — grows the soft mask outward. */
function grayscaleDilate(src, w, h, r) {
  if (r <= 0) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const v = src[y * w + xx];
        if (v > m) m = v;
      }
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        const v = tmp[yy * w + x];
        if (v > m) m = v;
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

/** Separable box blur (two passes ≈ Gaussian) — feathers the mask edge. */
function boxBlur(src, w, h, r) {
  if (r <= 0) return src.slice();
  const pass = (input) => {
    const tmp = new Float32Array(w * h);
    const norm = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++)
        acc += input[y * w + Math.max(0, Math.min(w - 1, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc * norm;
        const add = input[y * w + Math.min(w - 1, x + r + 1)];
        const sub = input[y * w + Math.max(0, x - r)];
        acc += add - sub;
      }
    }
    const out = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++)
        acc += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc * norm;
        const add = tmp[Math.min(h - 1, y + r + 1) * w + x];
        const sub = tmp[Math.max(0, y - r) * w + x];
        acc += add - sub;
      }
    }
    return out;
  };
  return pass(pass(src));
}

/**
 * Multi-resolution pull–push hole fill. Given premultiplied color channels and a
 * per-pixel confidence `weight` (1 = known, 0 = hole), it propagates known color
 * down an image pyramid and interpolates it back up, yielding a smooth fill that
 * follows the surrounding color and gradient. Returns filled {r,g,b} for every
 * pixel; known pixels are preserved, holes are reconstructed.
 */
function pullPushFill(r0, g0, b0, weight, w, h) {
  const levels = [];
  // Level 0 holds normalized color + weight.
  levels.push({
    w,
    h,
    r: r0.slice(),
    g: g0.slice(),
    b: b0.slice(),
    a: weight.slice(),
  });

  // Pull: build coarser levels by weighted-averaging 2×2 children.
  let lw = w;
  let lh = h;
  while (lw > 1 || lh > 1) {
    const nw = Math.max(1, Math.ceil(lw / 2));
    const nh = Math.max(1, Math.ceil(lh / 2));
    const cur = levels[levels.length - 1];
    const nr = new Float32Array(nw * nh);
    const ng = new Float32Array(nw * nh);
    const nb = new Float32Array(nw * nh);
    const na = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let sa = 0;
        let cnt = 0;
        for (let dy = 0; dy < 2; dy++) {
          const cy = y * 2 + dy;
          if (cy >= lh) continue;
          for (let dx = 0; dx < 2; dx++) {
            const cx = x * 2 + dx;
            if (cx >= lw) continue;
            const idx = cy * lw + cx;
            const a = cur.a[idx];
            sr += cur.r[idx] * a;
            sg += cur.g[idx] * a;
            sb += cur.b[idx] * a;
            sa += a;
            cnt++;
          }
        }
        const o = y * nw + x;
        if (sa > 0) {
          nr[o] = sr / sa;
          ng[o] = sg / sa;
          nb[o] = sb / sa;
        }
        na[o] = cnt ? Math.min(1, sa / cnt) : 0;
      }
    }
    levels.push({ w: nw, h: nh, r: nr, g: ng, b: nb, a: na });
    lw = nw;
    lh = nh;
  }

  // Push: from coarsest to finest, blend each pixel's own (confident) color with
  // the bilinearly-interpolated color from the level above.
  for (let l = levels.length - 2; l >= 0; l--) {
    const cur = levels[l];
    const up = levels[l + 1];
    for (let y = 0; y < cur.h; y++) {
      for (let x = 0; x < cur.w; x++) {
        const idx = y * cur.w + x;
        const a = cur.a[idx];
        if (a >= 0.999) continue; // fully known — keep as is
        // Bilinear sample of the coarser level at this pixel's position.
        const fx = (x - 0.5) / 2;
        const fy = (y - 0.5) / 2;
        const x0 = Math.max(0, Math.min(up.w - 1, Math.floor(fx)));
        const y0 = Math.max(0, Math.min(up.h - 1, Math.floor(fy)));
        const x1 = Math.min(up.w - 1, x0 + 1);
        const y1 = Math.min(up.h - 1, y0 + 1);
        const tx = Math.max(0, Math.min(1, fx - x0));
        const ty = Math.max(0, Math.min(1, fy - y0));
        const i00 = y0 * up.w + x0;
        const i10 = y0 * up.w + x1;
        const i01 = y1 * up.w + x0;
        const i11 = y1 * up.w + x1;
        const lerp = (p00, p10, p01, p11) =>
          (p00 * (1 - tx) + p10 * tx) * (1 - ty) +
          (p01 * (1 - tx) + p11 * tx) * ty;
        const ur = lerp(up.r[i00], up.r[i10], up.r[i01], up.r[i11]);
        const ug = lerp(up.g[i00], up.g[i10], up.g[i01], up.g[i11]);
        const ub = lerp(up.b[i00], up.b[i10], up.b[i01], up.b[i11]);
        cur.r[idx] = cur.r[idx] * a + ur * (1 - a);
        cur.g[idx] = cur.g[idx] * a + ug * (1 - a);
        cur.b[idx] = cur.b[idx] * a + ub * (1 - a);
        cur.a[idx] = 1;
      }
    }
  }

  const base = levels[0];
  return { r: base.r, g: base.g, b: base.b };
}

/**
 * Transfer high-frequency texture from a clean neighbouring patch onto the
 * (smooth) pull–push base, so a patterned background reads as continuous instead
 * of blurred. Conservative by design: it only acts when the surroundings carry
 * real texture and a same-size clean source exists, and the detail it adds is
 * capped and mask-weighted. Mutates baseR/G/B in place.
 */
function transferTexture(img, win, mask, baseR, baseG, baseB, surroundRms) {
  // Only when the surroundings carry real, high-contrast texture. On dark or
  // near-flat backgrounds the smooth pull–push fill is already ideal and added
  // detail would only introduce a faint ghost of the donor patch.
  if (surroundRms < 14) return;
  const { width: W, data } = img;
  const { x: wx, y: wy, w: ww, h: wh } = win;

  // A clean source block the same size as the window, taken from just left of it
  // (preferring horizontal neighbours; the corner's left side is the most
  // watermark-free direction). Bail if it would overlap the masked area.
  let sx = wx - ww - 4;
  let sy = wy;
  if (sx < 0) {
    sx = wx; // fall back to directly above
    sy = wy - wh - 4;
  }
  if (sx < 0 || sy < 0) return;

  // Detail = source − local mean (box-blurred source). Add it to the base where
  // the mask is active, scaled down so it never dominates the reconstruction.
  const srcLum = new Float32Array(ww * wh);
  const srcR = new Float32Array(ww * wh);
  const srcG = new Float32Array(ww * wh);
  const srcB = new Float32Array(ww * wh);
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const i = ((sy + y) * W + (sx + x)) * 4;
      const o = y * ww + x;
      srcR[o] = data[i];
      srcG[o] = data[i + 1];
      srcB[o] = data[i + 2];
      srcLum[o] = lumAt(data, i);
    }
  }
  const blurR = boxBlur(srcR, ww, wh, 3);
  const blurG = boxBlur(srcG, ww, wh, 3);
  const blurB = boxBlur(srcB, ww, wh, 3);
  const strength = 0.6;
  for (let i = 0; i < ww * wh; i++) {
    const m = mask[i];
    if (m <= 0.01) continue;
    baseR[i] += (srcR[i] - blurR[i]) * strength * m;
    baseG[i] += (srcG[i] - blurG[i]) * strength * m;
    baseB[i] += (srcB[i] - blurB[i]) * strength * m;
  }
}

/**
 * Detect a bottom-right Gemini watermark and reconstruct the background under it.
 * Returns a full-image RGBA buffer plus diagnostics, or null when no watermark
 * is found. `data` is a fresh copy of `img.data` with the corner repaired.
 */
export function reconstructCornerWatermark(img, opts = {}) {
  const det = detectCornerWatermark(img, opts);
  if (!det) return null;
  const { width: W, height: H, data } = img;
  const { window: win, mask, cornerBg, box } = det;
  const { x: wx, y: wy, w: ww, h: wh } = win;

  // Window color channels + a per-pixel confidence: pixels the mask barely
  // touches are trusted sources; the logo core is a hole to be filled.
  const r0 = new Float32Array(ww * wh);
  const g0 = new Float32Array(ww * wh);
  const b0 = new Float32Array(ww * wh);
  const weight = new Float32Array(ww * wh);
  let ringSum = 0;
  let ringSumSq = 0;
  let ringN = 0;
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const i = ((wy + y) * W + (wx + x)) * 4;
      const o = y * ww + x;
      r0[o] = data[i];
      g0[o] = data[i + 1];
      b0[o] = data[i + 2];
      const m = mask[o];
      // Known where the mask is near zero; ramp confidence to 0 by m≈0.4 so
      // contaminated halo pixels are not used as fill sources.
      weight[o] = m <= 0.06 ? 1 : m >= 0.4 ? 0 : (0.4 - m) / 0.34;
      if (m < 0.04) {
        const l = lumAt(data, i);
        ringSum += l;
        ringSumSq += l * l;
        ringN++;
      }
    }
  }
  const ringMean = ringN ? ringSum / ringN : cornerBg;
  const surroundRms = ringN
    ? Math.sqrt(Math.max(0, ringSumSq / ringN - ringMean * ringMean))
    : 0;

  const filled = pullPushFill(r0, g0, b0, weight, ww, wh);
  if (opts.texture !== false) {
    transferTexture(img, win, mask, filled.r, filled.g, filled.b, surroundRms);
  }

  // Composite the reconstruction back under the soft mask: out = orig·(1−m)+fill·m.
  const out = data.slice();
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const o = y * ww + x;
      const m = mask[o];
      if (m <= 0.003) continue;
      const i = ((wy + y) * W + (wx + x)) * 4;
      out[i] = Math.max(
        0,
        Math.min(255, Math.round(data[i] * (1 - m) + filled.r[o] * m)),
      );
      out[i + 1] = Math.max(
        0,
        Math.min(255, Math.round(data[i + 1] * (1 - m) + filled.g[o] * m)),
      );
      out[i + 2] = Math.max(
        0,
        Math.min(255, Math.round(data[i + 2] * (1 - m) + filled.b[o] * m)),
      );
    }
  }

  const before = regionResidual(data, W, H, box, cornerBg);
  const after = regionResidual(out, W, H, box, cornerBg);
  return {
    full: out,
    box,
    cornerBg,
    surroundRms,
    before,
    after,
    cluster: det.cluster,
  };
}
