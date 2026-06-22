"use client";

import { useStudio } from "@/lib/app/store";
import type { ImageFormat } from "@/lib/engine/types";
import { OUT_CONVERT } from "@/lib/engine/encode";
import { RunButton } from "@/components/RunButton";

const LOSSY = new Set<ImageFormat>(["jpeg", "webp", "avif"]);

const ADAPTIVE: ReadonlyArray<{
  v: "auto" | "always" | "never";
  label: string;
}> = [
  { v: "auto", label: "Auto" },
  { v: "always", label: "Always" },
  { v: "never", label: "Off" },
];

export function WatermarkPanel() {
  const { options, setWm } = useStudio();
  const wm = options.wm;
  const lossy = LOSSY.has(wm.fmt);

  return (
    <>
      <div className="field">
        <label htmlFor="wmFmt">Output format</label>
        <select
          id="wmFmt"
          value={wm.fmt}
          onChange={(e) => setWm({ fmt: e.target.value as ImageFormat })}
        >
          {OUT_CONVERT.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {lossy && (
        <div className="field">
          <label htmlFor="wmQ">Quality</label>
          <div className="rangewrap">
            <input
              type="range"
              id="wmQ"
              min={40}
              max={100}
              value={wm.q}
              onChange={(e) => setWm({ q: +e.target.value })}
            />
            <span className="rangeval" id="wmQv">
              {wm.q}%
            </span>
          </div>
        </div>
      )}

      <div className="field">
        <label>Detection</label>
        <div className="seg" id="wmAdaptive" role="group" aria-label="Detection">
          {ADAPTIVE.map((a) => (
            <button
              key={a.v}
              data-v={a.v}
              aria-pressed={wm.adaptive === a.v}
              onClick={() => setWm({ adaptive: a.v })}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="spacer" />
      <RunButton />
      <div className="hint" id="wmHint">
        Removes Gemini&rsquo;s visible bottom-right watermark with exact reverse
        alpha blending — lossless on supported sizes. PNG keeps the result
        pixel-perfect; pick a lossy format only if you need a smaller file.
      </div>
    </>
  );
}
