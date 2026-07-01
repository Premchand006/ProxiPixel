"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/app/store";
import { INPUTS, TAB_TITLES } from "@/lib/app/types";

export function DropZone() {
  const { mode, addFiles } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const f = [...(e.clipboardData?.files ?? [])];
      if (f.length) addFiles(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  return (
    <div
      className={`drop${over ? " over" : ""}`}
      id="drop"
      tabIndex={0}
      role="button"
      aria-label="Add images: click, drop, or paste"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div className="iconrow">
        <i />
        <i />
        <i />
      </div>
      <h2 id="dropTitle">{TAB_TITLES[mode]}</h2>
      <p>
        Drag &amp; drop, <span className="pick">click to browse</span>, or paste
        from clipboard
      </p>
      <div className="formats" id="formatChips">
        {INPUTS.map((f) => (
          <span className="fmt" key={f}>
            {f}
          </span>
        ))}
        <span
          className="fmt"
          style={{ color: "var(--magenta)", borderColor: "rgba(255,92,158,.4)" }}
        >
          MP4 / MOV / WEBM
        </span>
        <span
          className="fmt"
          style={{ color: "var(--cyan)", borderColor: "rgba(52,224,216,.4)" }}
        >
          images + video
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        id="fileInput"
        multiple
        accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.heic,.heif,.tif,.tiff,.pdf,application/pdf"
        className="hide"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
