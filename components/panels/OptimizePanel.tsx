"use client";

import { useStudio } from "@/lib/app/store";
import type { ImageFormat } from "@/lib/engine/types";
import { OUT_CONVERT } from "@/lib/engine/encode";
import { RunButton } from "@/components/RunButton";

const LOSSY = new Set<ImageFormat>(["jpeg", "webp", "avif"]);

export function OptimizePanel() {
  const { options, setOp } = useStudio();
  const op = options.op;
  const lossy = LOSSY.has(op.fmt);
  const hint =
    op.mode === "size"
      ? lossy
        ? "Binary-searches quality to land just under your size cap."
        : "Target size only applies to JPEG/WebP/AVIF — this format ignores it and encodes once."
      : "Smart pass finds the best quality that fits your target, then reports the savings.";

  return (
    <>
      <div className="field">
        <label>Target</label>
        <div className="seg" id="opMode" role="group" aria-label="Optimize by">
          <button
            data-v="quality"
            aria-pressed={op.mode === "quality"}
            onClick={() => setOp({ mode: "quality" })}
          >
            Quality
          </button>
          <button
            data-v="size"
            aria-pressed={op.mode === "size"}
            onClick={() => setOp({ mode: "size" })}
          >
            File size
          </button>
        </div>
      </div>

      {op.mode === "quality" && (
        <div className="field" id="opQwrap">
          <label htmlFor="opQ">Quality</label>
          <div className="rangewrap">
            <input
              type="range"
              id="opQ"
              min={30}
              max={95}
              value={op.q}
              onChange={(e) => setOp({ q: +e.target.value })}
            />
            <span className="rangeval" id="opQv">
              {op.q}%
            </span>
          </div>
        </div>
      )}

      {op.mode === "size" && (
        <div className="field" id="opSizeWrap">
          <label htmlFor="opSize">Max size (KB)</label>
          <input
            type="number"
            id="opSize"
            min={10}
            step={10}
            value={op.size}
            onChange={(e) => setOp({ size: +e.target.value || 0 })}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="opFmt">Format</label>
        <select
          id="opFmt"
          value={op.fmt}
          onChange={(e) => setOp({ fmt: e.target.value as ImageFormat })}
        >
          {OUT_CONVERT.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="opMaxW">Cap width (px)</label>
        <input
          type="number"
          id="opMaxW"
          min={0}
          step={100}
          placeholder="none"
          value={op.maxW}
          onChange={(e) => setOp({ maxW: +e.target.value || 0 })}
        />
      </div>

      <div className="spacer" />
      <RunButton />
      <div className="hint" id="opHint">
        {hint}
      </div>
    </>
  );
}
