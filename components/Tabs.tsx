"use client";

import { useRef } from "react";
import { useStudio } from "@/lib/app/store";
import type { Mode } from "@/lib/app/types";

const TABS: Array<{ mode: Mode; label: string }> = [
  { mode: "convert", label: "Convert" },
  { mode: "upscale", label: "Upscale" },
  { mode: "optimize", label: "Optimize" },
  { mode: "watermark", label: "Watermark" },
  { mode: "video", label: "Video" },
  { mode: "documents", label: "Documents" },
];

export function Tabs() {
  const { mode, setMode } = useStudio();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number): void {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const tab = TABS[next]!;
    setMode(tab.mode);
    refs.current[next]?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label="Tool">
      {TABS.map((t, i) => {
        const selected = mode === t.mode;
        return (
          <button
            key={t.mode}
            type="button"
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="tab"
            role="tab"
            id={`tab-${t.mode}`}
            aria-selected={selected}
            aria-controls="tool-panel"
            tabIndex={selected ? 0 : -1}
            data-mode={t.mode}
            onClick={() => setMode(t.mode)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
