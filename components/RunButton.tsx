"use client";

import { useStudio } from "@/lib/app/store";
import type { Mode } from "@/lib/app/types";

const LABELS: Record<Mode, string> = {
  convert: "Convert all",
  upscale: "Enhance all",
  optimize: "Optimize all",
  watermark: "Remove watermarks",
  video: "Process video",
  documents: "Convert documents",
};

export function RunButton() {
  const { mode, items, running, runAll } = useStudio();
  const ready = items.some((it) =>
    mode === "video"
      ? it.kind === "video" && it.file
      : it.kind === "image" && it.canvas,
  );
  return (
    <button
      className="run"
      id="run"
      disabled={running || !ready}
      onClick={() => void runAll()}
    >
      {running ? "Working…" : LABELS[mode]}
    </button>
  );
}
