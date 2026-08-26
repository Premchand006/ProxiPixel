"use client";

import { useStudio } from "@/lib/app/store";
import { ConvertPanel } from "./panels/ConvertPanel";
import { UpscalePanel } from "./panels/UpscalePanel";
import { OptimizePanel } from "./panels/OptimizePanel";
import { WatermarkPanel } from "./panels/WatermarkPanel";
import { VideoPanel } from "./panels/VideoPanel";

export function OptionsPanel() {
  const { mode } = useStudio();
  return (
    <div
      className="panel"
      id="tool-panel"
      role="tabpanel"
      aria-labelledby={`tab-${mode}`}
      aria-describedby={`tab-${mode}-desc`}
    >
      {mode === "convert" && <ConvertPanel />}
      {mode === "upscale" && <UpscalePanel />}
      {mode === "optimize" && <OptimizePanel />}
      {mode === "watermark" && <WatermarkPanel />}
      {mode === "video" && <VideoPanel />}
    </div>
  );
}
