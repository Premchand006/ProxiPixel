"use client";

import { useStudio } from "@/lib/app/store";
import { QueueCard } from "./QueueCard";

export function Queue() {
  const { items, downloadAll, downloadZip, clearAll } = useStudio();
  const hasResult = items.some((it) => it.result);
  const hasBlob = items.some((it) => it.resultBlob);

  return (
    <>
      <div className="bar">
        <h3>
          <span id="count">{items.length}</span> image
          {items.length === 1 ? "" : "s"} loaded
        </h3>
        <div className="barbtns">
          <button
            className="ghost accent"
            id="dlZip"
            disabled={!hasBlob}
            onClick={() => void downloadZip()}
          >
            Download .zip
          </button>
          <button
            className="ghost"
            id="dlAll"
            disabled={!hasResult}
            onClick={() => void downloadAll()}
          >
            Save each
          </button>
          <button className="ghost" id="clearAll" onClick={() => clearAll()}>
            Clear
          </button>
        </div>
      </div>

      {items.length > 0 ? (
        <div id="queue" className="grid">
          {items.map((it) => (
            <QueueCard key={it.id} it={it} />
          ))}
        </div>
      ) : (
        <div id="emptyState" className="empty">
          No images yet — add some above to get started.
        </div>
      )}
    </>
  );
}
