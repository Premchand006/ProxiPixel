"use client";

import { useStudio } from "@/lib/app/store";
import type { UpscaleFormat, UpscaleScale } from "@/lib/app/types";
import type { ResampleMethod } from "@/lib/engine/types";
import { OUT_CONVERT } from "@/lib/engine/encode";
import { RunButton } from "@/components/RunButton";

const SCALES: Array<{ v: UpscaleScale; label: string }> = [
  { v: "4k", label: "4K" },
  { v: "1.5", label: "1.5×" },
  { v: "2", label: "2×" },
  { v: "3", label: "3×" },
  { v: "4", label: "4×" },
  { v: "custom", label: "W" },
];

export function UpscalePanel() {
  const { options, setUp } = useStudio();
  const u = options.up;

  return (
    <>
      <div className="field">
        <label>Scale</label>
        <div className="seg" id="upScale" role="group" aria-label="Scale factor">
          {SCALES.map((s) => (
            <button
              key={s.v}
              data-v={s.v}
              aria-pressed={u.scale === s.v}
              onClick={() => setUp({ scale: s.v })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {u.scale === "custom" && (
        <div className="field" id="upWwrap">
          <label htmlFor="upW">Target width (px)</label>
          <input
            type="number"
            id="upW"
            min={16}
            step={16}
            value={u.width}
            onChange={(e) => setUp({ width: +e.target.value || 16 })}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="upMethod">Resampling</label>
        <select
          id="upMethod"
          value={u.method}
          onChange={(e) => setUp({ method: e.target.value as ResampleMethod })}
        >
          <option value="lanczos">Lanczos (sharpest)</option>
          <option value="smooth">Smooth (fast)</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="upDenoise">Denoise</label>
        <div className="rangewrap">
          <input
            type="range"
            id="upDenoise"
            min={0}
            max={100}
            value={Math.round(u.denoise * 100)}
            onChange={(e) => setUp({ denoise: +e.target.value / 100 })}
          />
          <span className="rangeval" id="upDenoiseV">
            {u.denoise.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="upClarity">Clarity</label>
        <div className="rangewrap">
          <input
            type="range"
            id="upClarity"
            min={0}
            max={100}
            value={Math.round(u.clarity * 100)}
            onChange={(e) => setUp({ clarity: +e.target.value / 100 })}
          />
          <span className="rangeval" id="upClarityV">
            {u.clarity.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="upSharp">Sharpen</label>
        <div className="rangewrap">
          <input
            type="range"
            id="upSharp"
            min={0}
            max={150}
            value={Math.round(u.sharpen * 100)}
            onChange={(e) => setUp({ sharpen: +e.target.value / 100 })}
          />
          <span className="rangeval" id="upSharpV">
            {u.sharpen.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="upRadius">Sharpen radius</label>
        <div className="rangewrap">
          <input
            type="range"
            id="upRadius"
            min={1}
            max={3}
            value={u.radius}
            onChange={(e) => setUp({ radius: +e.target.value })}
          />
          <span className="rangeval" id="upRadiusV">
            {u.radius} px
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="upFmt">Save as</label>
        <select
          id="upFmt"
          value={u.fmt}
          onChange={(e) => setUp({ fmt: e.target.value as UpscaleFormat })}
        >
          {OUT_CONVERT.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="spacer" />
      <RunButton />
      <div className="hint">
        {u.scale === "4k"
          ? "4K fills the 3840px long edge (true 4K UHD on 16:9). "
          : ""}
        Pipeline: denoise → gamma-correct Lanczos → clarity → Gaussian sharpen,
        all local. Resampling in linear light keeps edges crisp; thresholded
        sharpening adds detail without halos or amplified noise. 4K + large
        images take a moment.
      </div>
    </>
  );
}
