"use client";

import { useStudio } from "@/lib/app/store";
import { formatBytes, formatDuration, type QueueItem } from "@/lib/app/types";

function Delta({ it }: { it: QueueItem }) {
  if (!it.result) return null;
  if (it.resultKind === "upscale") {
    return (
      <span className="delta up">
        {it.w}×{it.h} → {it.outW}×{it.outH}
      </span>
    );
  }
  if (it.resultKind === "watermark") {
    return <span className="delta good">✓ watermark removed</span>;
  }
  if (!it.origSize || !it.resultSize) return null;
  const pct = Math.round((1 - it.resultSize / it.origSize) * 100);
  return pct > 0 ? (
    <span className="delta good">↓ {pct}% smaller</span>
  ) : (
    <span className="delta bad">{pct}% (↑ larger)</span>
  );
}

function Badge({ it }: { it: QueueItem }) {
  if (it.exif && it.exif.any) {
    const bits: string[] = [];
    if (it.exif.hasGPS) bits.push("GPS");
    if (it.exif.hasCamera) bits.push("camera");
    if (it.exif.hasDate) bits.push("date");
    return (
      <span className={`badge ${it.exif.hasGPS ? "gps" : ""}`}>
        {(it.exif.hasGPS ? "⚠" : "ⓘ") + " " + bits.join(" + ")}
        {it.result ? " → stripped" : ""}
      </span>
    );
  }
  if (it.result && it.exif) {
    return <span className="badge clean">✓ no metadata</span>;
  }
  return null;
}

export function QueueCard({ it }: { it: QueueItem }) {
  const { removeItem, openCompare, openVideo, saveOutput } = useStudio();
  const isVid = it.kind === "video";
  const dims = it.w ? `${it.w}×${it.h}` : "—";
  const canPreview =
    isVid &&
    !!it.resultName &&
    (it.resultName.endsWith(".mp4") || it.resultName.endsWith(".webm"));

  return (
    <div className="card">
      <div className="thumb">
        {it.thumb ? (
          // Dynamic data/object URLs — next/image isn't applicable here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.thumb} alt="" />
        ) : (
          <span className="status work">…</span>
        )}
      </div>
      <div className="meta">
        <div className="name" title={it.name}>
          {it.name}
        </div>
        <div className="stats">
          {isVid ? (
            <span>
              {dims}
              {it.duration ? ` · ${formatDuration(it.duration)}` : ""} ·{" "}
              <span className="pill">VIDEO</span> ·{" "}
              <b>{formatBytes(it.origSize)}</b>
            </span>
          ) : (
            <span>
              {dims} · {it.origType} · <b>{formatBytes(it.origSize)}</b>
            </span>
          )}
        </div>

        <Badge it={it} />

        {it.result ? (
          <>
            <div className="stats">
              <span>
                <b>{formatBytes(it.resultSize ?? 0)}</b> ·{" "}
                {it.resultName?.split(".").pop()?.toUpperCase()}
              </span>
            </div>
            <Delta it={it} />
          </>
        ) : it.status ? (
          <div className={`status ${it.statusKind}`}>{it.status}</div>
        ) : null}

        <div className="cardbtns">
          {it.result ? (
            <a className="dl" href={it.result} download={it.resultName}>
              Download
            </a>
          ) : (
            <span className="dl" aria-disabled="true">
              Download
            </span>
          )}

          {it.result && canPreview && (
            <button className="cmpbtn" onClick={() => openVideo(it)}>
              Preview
            </button>
          )}
          {it.result && !isVid && (
            <button className="cmpbtn" onClick={() => openCompare(it)}>
              Compare
            </button>
          )}

          {it.saved ? (
            <span className="badge clean">✓ saved</span>
          ) : (
            it.jobId &&
            it.resultBlob && (
              <button
                className="cmpbtn"
                disabled={it.saving}
                onClick={() => void saveOutput(it)}
              >
                {it.saving ? "Saving…" : "Save"}
              </button>
            )
          )}

          <button
            className="rm"
            aria-label="Remove"
            onClick={() => removeItem(it.id)}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
