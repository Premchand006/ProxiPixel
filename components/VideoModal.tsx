"use client";

import { useStudio } from "@/lib/app/store";
import { useDialog } from "@/lib/app/use-dialog";

export function VideoModal() {
  const { videoItem, closeVideo } = useStudio();
  const ref = useDialog(!!videoItem, closeVideo);

  if (!videoItem || !videoItem.result) return null;

  return (
    <div
      className="vmodal"
      id="vmodal"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Video preview"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeVideo();
      }}
    >
      <button className="x" aria-label="Close preview" onClick={closeVideo}>
        ×
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated output, no captions available */}
      <video id="vmVideo" src={videoItem.result} controls playsInline autoPlay />
    </div>
  );
}
