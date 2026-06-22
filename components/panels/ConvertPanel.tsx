"use client";

import { useStudio } from "@/lib/app/store";
import { OUT_CONVERT } from "@/lib/engine/encode";
import type { ImageFormat } from "@/lib/engine/types";
import { RunButton } from "@/components/RunButton";

const WARN: Partial<Record<ImageFormat, string>> = {
  gif: "GIF caps at 256 colours — best for graphics, not photos.",
  tiff: "TIFF here is uncompressed (large files, lossless).",
  pdf: "Each image becomes a one-page PDF sized to fit.",
  bmp: "BMP is uncompressed 24-bit.",
};

export function ConvertPanel() {
  const { options, setConvert, avifOK } = useStudio();
  const { fmt, q } = options.convert;
  const lossy = fmt === "jpeg" || fmt === "webp" || fmt === "avif";
  const hint =
    fmt === "avif"
      ? avifOK
        ? "AVIF: best compression, modern browsers."
        : "Your browser can’t encode AVIF — try Chrome or Edge."
      : (WARN[fmt] ?? "");

  return (
    <>
      <div className="field">
        <label htmlFor="cFmt">Convert to</label>
        <select
          id="cFmt"
          value={fmt}
          onChange={(e) => setConvert({ fmt: e.target.value as ImageFormat })}
        >
          {OUT_CONVERT.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {lossy && (
        <div className="field" id="cQwrap">
          <label htmlFor="cQ">Quality</label>
          <div className="rangewrap">
            <input
              type="range"
              id="cQ"
              min={40}
              max={100}
              value={q}
              onChange={(e) => setConvert({ q: +e.target.value })}
            />
            <span className="rangeval" id="cQv">
              {q}%
            </span>
          </div>
        </div>
      )}
      <div className="spacer" />
      <RunButton />
      <div className="hint" id="cHint">
        {hint}
      </div>
    </>
  );
}
