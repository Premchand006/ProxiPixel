"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/app/store";
import { useDialog } from "@/lib/app/use-dialog";

export function CompareModal() {
  const { compareItem, closeCompare } = useStudio();
  const dialogRef = useDialog(!!compareItem, closeCompare);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const draggingRef = useRef(false);

  // Render the full-res original to a data URL when the modal opens.
  const before = useMemo(
    () => compareItem?.canvas?.toDataURL("image/png") ?? "",
    [compareItem],
  );

  // Re-centre the slider for each newly opened item (state adjusted during
  // render rather than in an effect, so there's no extra cascading render).
  const [shownItem, setShownItem] = useState(compareItem);
  if (shownItem !== compareItem) {
    setShownItem(compareItem);
    setPct(50);
  }

  const moveFromClientX = useCallback((clientX: number) => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const x = clientX - r.left;
    setPct(Math.max(0, Math.min(100, (x / r.width) * 100)));
  }, []);

  if (!compareItem || !compareItem.result || !compareItem.canvas) return null;

  return (
    <div
      className="cmp"
      id="cmp"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Before and after compare"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCompare();
      }}
    >
      <div className="cmpwrap">
        <div className="cmphead">
          <h4 id="cmpTitle">{compareItem.resultName}</h4>
          <button aria-label="Close compare" onClick={closeCompare}>
            ×
          </button>
        </div>
        <div
          className="cmpbox"
          id="cmpBox"
          ref={boxRef}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            moveFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) moveFromClientX(e.clientX);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
        >
          {/* Dynamic data/object URLs — next/image isn't applicable. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="cmpBefore" alt="Original" src={before || undefined} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="cmpAfter"
            alt="Result"
            src={compareItem.result}
            style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
          />
          <div className="cmpdiv" id="cmpDiv" style={{ left: `${pct}%` }} />
          <span className="cmptag l">After</span>
          <span className="cmptag r">Before</span>
        </div>
      </div>
    </div>
  );
}
